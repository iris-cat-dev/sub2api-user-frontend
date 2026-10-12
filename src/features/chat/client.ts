import { chatAttachmentBase64 } from './attachments'
import type { ChatMessage, ChatReply, ChatRequest } from './types'

type RecordValue = Record<string, unknown>
const modelNameCollator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' })

function record(value: unknown): RecordValue | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : null
}

function text(value: unknown): string {
  if (typeof value === 'string') return value
  if (!Array.isArray(value)) return ''
  return value.map(part => {
    const item = record(part)
    return typeof item?.text === 'string' ? item.text
      : typeof item?.refusal === 'string' ? item.refusal
        : typeof item?.thinking === 'string' ? item.thinking : ''
  }).join('')
}

function errorMessage(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  const item = record(value)
  return item ? errorMessage(item.message) ?? errorMessage(item.error) : null
}

async function responseError(response: Response): Promise<Error> {
  if (response.headers.get('Content-Type')?.toLowerCase().includes('text/html')) {
    return new Error(`Chat API returned HTTP ${response.status}${response.status === 524 ? ': upstream request timed out' : ''}`)
  }
  const body = await response.text()
  let parsed: unknown
  try { parsed = JSON.parse(body) } catch { /* Gateways may return plain text. */ }
  return new Error(errorMessage(parsed) ?? (body.trim() || `Chat API returned HTTP ${response.status}`))
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw signal.reason ?? new DOMException('Request stopped', 'AbortError')
}

// Parse lines rather than chunks: UTF-8 characters, CRLF pairs and event blocks
// can all cross a network boundary. The last block need not end with a blank line.
async function readEvents(response: Response, signal: AbortSignal, consume: (data: string, event: string) => boolean): Promise<void> {
  if (!response.body) throw new Error('Chat API returned an empty event stream')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let data: string[] = []
  let event = ''
  let finished = false
  const dispatch = () => {
    if (data.length) finished = consume(data.join('\n'), event)
    data = []
    event = ''
  }
  const line = (value: string) => {
    if (!value) { dispatch(); return }
    if (value.startsWith(':')) return
    const colon = value.indexOf(':')
    const name = colon < 0 ? value : value.slice(0, colon)
    let field = colon < 0 ? '' : value.slice(colon + 1)
    if (field.startsWith(' ')) field = field.slice(1)
    if (name === 'data') data.push(field)
    if (name === 'event') event = field
  }
  const drain = (final: boolean) => {
    while (!finished) {
      const separator = /[\r\n]/.exec(buffer)
      if (!separator) break
      const index = separator.index
      if (!final && buffer[index] === '\r' && index === buffer.length - 1) break
      const length = buffer[index] === '\r' && buffer[index + 1] === '\n' ? 2 : 1
      line(buffer.slice(0, index))
      buffer = buffer.slice(index + length)
    }
    if (final && !finished) {
      if (buffer) line(buffer)
      buffer = ''
      dispatch()
    }
  }
  const cancel = () => { void reader.cancel().catch(() => undefined) }
  signal.addEventListener('abort', cancel, { once: true })
  try {
    while (!finished) {
      throwIfAborted(signal)
      const { done, value } = await reader.read()
      throwIfAborted(signal)
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true })
      drain(done)
      if (done) break
    }
  } finally {
    signal.removeEventListener('abort', cancel)
    try { await reader.cancel() } catch { /* Preserve the original transport failure. */ }
    reader.releaseLock()
  }
}

export async function listChatModels(apiKey: string, signal?: AbortSignal): Promise<string[]> {
  const response = await fetch('/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` }, signal, cache: 'no-store',
  })
  if (!response.ok) throw await responseError(response)
  let payload: unknown
  try { payload = await response.json() } catch { throw new Error('Model API returned invalid JSON') }
  const models = record(payload)?.data
  if (!Array.isArray(models)) throw new Error('Model API returned no model list')
  const ids = new Set<string>()
  for (const value of models) {
    const item = record(value)
    const id = item?.id
    if (typeof id !== 'string' || !id.trim()) continue
    // Unknown and multimodal chat models remain selectable. Exclude only models
    // whose name or declared task clearly identifies a non-chat endpoint.
    if (/(?:^|[\/_.-])(?:gpt-image|chatgpt-image|dall-e|imagen\d*|sora|veo\d*|whisper|tts|embeddings?|text-embedding|image-generation|video-generation|audio|transcribe|transcription|rerank)(?:$|[\/_.-])/i.test(id)) continue
    if (/(?:^|\/)(?:flux(?:[.-]|$)|stable-diffusion|midjourney|grok-imagine)/i.test(id)) continue
    if (/(?:^|-)image(?:$|-preview(?:-|$))/i.test(id)) continue
    const task = item?.type ?? item?.task
    if (typeof task === 'string' && /^(?:image|video|audio|embedding|image_generation|video_generation|text-to-image|text-to-video|text-to-speech|automatic-speech-recognition|feature-extraction|rerank)$/i.test(task)) continue
    ids.add(id)
  }
  return [...ids].sort(modelNameCollator.compare)
}

function responseSnapshot(payload: RecordValue): ChatReply {
  let content = ''
  let reasoning = ''
  if (Array.isArray(payload.output)) {
    for (const value of payload.output) {
      const item = record(value)
      if (item?.type === 'message') content += text(item.content)
      if (item?.type === 'reasoning') reasoning += text(item.summary) || text(item.content)
    }
  }
  return { content: content || text(payload.output_text), reasoning }
}

function incomplete(reason: unknown): Error {
  return new Error(`Chat response incomplete${typeof reason === 'string' ? `: ${reason}` : ''}; received output has been retained`)
}
function messageText(message: ChatMessage): string {
  let value = message.content
  for (const attachment of message.attachments) {
    if (attachment.kind !== 'text') continue
    const section = `Attached text file \"${attachment.name}\":\n${attachment.data}`
    value += value ? `\n\n${section}` : section
  }
  return value
}

function responsesMessage(message: ChatMessage): RecordValue {
  const content: RecordValue[] = []
  const value = messageText(message)
  if (value) content.push({ type: message.role === 'assistant' ? 'output_text' : 'input_text', text: value })
  if (message.role === 'user') {
    for (const attachment of message.attachments) {
      if (attachment.kind === 'image') content.push({ type: 'input_image', image_url: attachment.data, detail: 'auto' })
      if (attachment.kind === 'pdf') content.push({ type: 'input_file', filename: attachment.name, file_data: attachment.data })
    }
  }
  return { role: message.role, content }
}

function completionsMessage(message: ChatMessage): RecordValue {
  if (message.role === 'assistant') return { role: message.role, content: message.content }
  const content: RecordValue[] = []
  const value = messageText(message)
  if (value) content.push({ type: 'text', text: value })
  for (const attachment of message.attachments) {
    if (attachment.kind === 'image') content.push({ type: 'image_url', image_url: { url: attachment.data, detail: 'auto' } })
    if (attachment.kind === 'pdf') content.push({ type: 'file', file: { filename: attachment.name, file_data: attachment.data } })
  }
  return { role: message.role, content }
}

function messagesMessage(message: ChatMessage): RecordValue {
  if (message.role === 'assistant') return { role: message.role, content: message.content }
  const content: RecordValue[] = []
  const value = messageText(message)
  if (value) content.push({ type: 'text', text: value })
  for (const attachment of message.attachments) {
    if (attachment.kind === 'image') content.push({
      type: 'image',
      source: { type: 'base64', media_type: attachment.mimeType, data: chatAttachmentBase64(attachment) },
    })
    if (attachment.kind === 'pdf') content.push({
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: chatAttachmentBase64(attachment) },
    })
  }
  return { role: message.role, content }
}


export async function requestChat(request: ChatRequest): Promise<ChatReply> {
  if (!request.apiKey.trim()) throw new Error('Select an API key before sending')
  if (!request.model.trim()) throw new Error('Select a chat model before sending')
  const controller = new AbortController()
  const abort = () => controller.abort(request.signal?.reason ?? new DOMException('Request stopped', 'AbortError'))
  const timeout = Number.isFinite(request.timeout) && request.timeout! > 0 ? request.timeout! : 120_000
  const timer = setTimeout(() => controller.abort(new DOMException('Chat request timed out; received output has been retained', 'TimeoutError')), timeout)
  if (request.signal?.aborted) abort()
  else request.signal?.addEventListener('abort', abort, { once: true })
  const signal = controller.signal
  let response: Response | undefined
  try {
    throwIfAborted(signal)
    const context = request.messages
    const body: RecordValue = { model: request.model, stream: true }
    const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'text/event-stream, application/json' }
    let path: string
    if (request.protocol === 'responses') {
      path = '/v1/responses'
      headers.Authorization = `Bearer ${request.apiKey}`
      body.store = false
      body.instructions = 'You are a helpful assistant.'
      body.input = context.map(responsesMessage)
    } else if (request.protocol === 'messages') {
      path = '/v1/messages'
      headers['x-api-key'] = request.apiKey
      headers['anthropic-version'] = '2023-06-01'
      body.max_tokens = 8192
      body.messages = context.map(messagesMessage)
    } else {
      path = '/v1/chat/completions'
      headers.Authorization = `Bearer ${request.apiKey}`
      body.messages = context.map(completionsMessage)
    }
    response = await fetch(path, { method: 'POST', headers, body: JSON.stringify(body), signal, cache: 'no-store' })
    if (!response.ok) throw await responseError(response)
    let reply: ChatReply = { content: '', reasoning: '' }
    let completed = false
    let completionError: Error | null = null
    const publish = () => request.onUpdate?.({ ...reply })
    const checkError = (payload: RecordValue) => {
      if (payload.error || payload.type === 'error') throw new Error(errorMessage(payload.error) ?? errorMessage(payload) ?? 'Chat API returned an error')
    }
    const applyResponse = (payload: RecordValue) => {
      const snapshot = responseSnapshot(payload)
      reply = { content: snapshot.content || reply.content, reasoning: snapshot.reasoning || reply.reasoning }
      publish()
      checkError(payload)
      if (payload.status === 'failed' || payload.status === 'incomplete' || payload.status === 'cancelled') throw incomplete(record(payload.incomplete_details)?.reason ?? payload.status)
    }
    const finish = (reason: unknown, allowed: string[]) => {
      if (typeof reason === 'string' && !allowed.includes(reason)) completionError = incomplete(reason)
    }
    const applyChoice = (choice: RecordValue, streaming: boolean) => {
      const snapshot = record(choice.message)
      const message = snapshot ?? (streaming ? record(choice.delta) : null)
      if (message) {
        const content = text(message.content) + text(message.refusal)
        const reasoning = text(message.reasoning_content) || text(message.reasoning) || text(message.reasoning_text)
        reply = streaming && !snapshot ? { content: reply.content + content, reasoning: reply.reasoning + reasoning } : { content, reasoning }
        publish()
      }
      if (typeof choice.finish_reason === 'string') {
        completed = true
        finish(choice.finish_reason, ['stop'])
      }
    }
    if (!response.headers.get('Content-Type')?.toLowerCase().includes('text/event-stream')) {
      let payload: RecordValue | null
      try { payload = record(await response.json()) } catch { throw new Error('Chat API returned invalid JSON') }
      throwIfAborted(signal)
      if (!payload) throw new Error('Chat API returned an invalid response')
      if (request.protocol === 'responses') {
        applyResponse(payload)
        if (!Array.isArray(payload.output) && typeof payload.output_text !== 'string') throw new Error('Chat API returned no response content')
        if (payload.status !== undefined && payload.status !== 'completed') throw incomplete(payload.status)
      } else if (request.protocol === 'messages') {
        checkError(payload)
        if (!Array.isArray(payload.content)) throw new Error('Chat API returned no message content')
        reply = { content: text(payload.content.filter(part => record(part)?.type !== 'thinking')), reasoning: text(payload.content.filter(part => record(part)?.type === 'thinking')) }
        publish()
        if (typeof payload.stop_reason !== 'string') throw incomplete('missing stop reason')
        finish(payload.stop_reason, ['end_turn', 'stop_sequence', 'refusal'])
      } else {
        checkError(payload)
        const choice = Array.isArray(payload.choices) ? record(payload.choices[0]) : null
        if (!choice || !record(choice.message)) throw new Error('Chat API returned no assistant message')
        applyChoice(choice, false)
        if (!completed) throw incomplete('missing finish reason')
      }
      if (completionError) throw completionError
      throwIfAborted(signal)
      return reply
    }
    const contentParts = new Map<string, string>()
    const reasoningParts = new Map<string, string>()
    const setPart = (parts: Map<string, string>, key: string, value: string, append: boolean) => {
      parts.set(key, append ? (parts.get(key) ?? '') + value : value)
      reply = { content: [...contentParts.values()].join(''), reasoning: [...reasoningParts.values()].join('') }
      publish()
    }
    await readEvents(response, signal, (data, eventName) => {
      if (!data.trim()) return false
      if (data.trim() === '[DONE]') {
        if (request.protocol === 'chat-completions') completed = true
        return true
      }
      let item: RecordValue | null
      try { item = record(JSON.parse(data)) } catch { throw new Error('Chat API returned invalid event JSON') }
      if (!item) throw new Error('Chat API returned an invalid event')
      checkError(item)
      if (eventName === 'error') throw new Error(errorMessage(item) ?? 'Chat API returned an error')
      if (request.protocol === 'chat-completions') {
        const choice = Array.isArray(item.choices) ? record(item.choices.find(value => record(value)?.index === 0) ?? item.choices[0]) : null
        if (choice) applyChoice(choice, true)
        return false
      }
      const type = typeof item.type === 'string' ? item.type : eventName
      if (request.protocol === 'messages') {
        const key = String(item.index ?? 0)
        if (type === 'message_start') {
          const message = record(item.message)
          checkError(message ?? {})
          if (Array.isArray(message?.content)) message.content.forEach((part, index) => {
            const block = record(part)
            if (block) setPart(block.type === 'thinking' ? reasoningParts : contentParts, String(index), text([block]), false)
          })
        } else if (type === 'content_block_start') {
          const block = record(item.content_block)
          if (block) setPart(block.type === 'thinking' ? reasoningParts : contentParts, key, text([block]), false)
        } else if (type === 'content_block_delta') {
          const delta = record(item.delta)
          if (delta?.type === 'text_delta' && typeof delta.text === 'string') setPart(contentParts, key, delta.text, true)
          if (delta?.type === 'thinking_delta' && typeof delta.thinking === 'string') setPart(reasoningParts, key, delta.thinking, true)
          if (delta?.type === 'refusal_delta' && typeof delta.refusal === 'string') setPart(contentParts, key, delta.refusal, true)
        } else if (type === 'message_delta') {
          finish(record(item.delta)?.stop_reason, ['end_turn', 'stop_sequence', 'refusal'])
        } else if (type === 'message_stop') {
          completed = true
          return true
        }
        return false
      }
      const outputIndex = item.output_index ?? item.item_id ?? 0
      const partIndex = item.content_index ?? item.summary_index ?? 0
      const key = `${outputIndex}:${partIndex}`
      if (type === 'response.output_text.delta' || type === 'response.refusal.delta') {
        if (typeof item.delta === 'string') setPart(contentParts, key, item.delta, true)
      } else if (type === 'response.output_text.done' || type === 'response.refusal.done') {
        const value = type === 'response.refusal.done' ? item.refusal : item.text
        if (typeof value === 'string') setPart(contentParts, key, value, false)
      } else if (/^response\.reasoning(?:_summary)?_text\.(?:delta|done)$/.test(type)) {
        const value = type.endsWith('.delta') ? item.delta : item.text
        if (typeof value === 'string') setPart(reasoningParts, key, value, type.endsWith('.delta'))
      } else if (type === 'response.output_item.done') {
        const output = record(item.item)
        const parts = output?.type === 'reasoning' ? output.summary ?? output.content : output?.type === 'message' ? output.content : null
        if (Array.isArray(parts)) parts.forEach((part, index) => setPart(output?.type === 'reasoning' ? reasoningParts : contentParts, `${outputIndex}:${index}`, text([part]), false))
      } else if (type === 'response.completed') {
        const payload = record(item.response)
        if (payload) applyResponse(payload)
        completed = true
        return true
      } else if (type === 'response.failed' || type === 'response.incomplete' || type === 'response.cancelled') {
        const payload = record(item.response)
        if (payload) applyResponse(payload)
        throw incomplete(type)
      }
      return false
    })
    throwIfAborted(signal)
    if (completionError) throw completionError
    if (!completed) throw new Error('Chat stream interrupted before completion; received output has been retained')
    return reply
  } catch (error) {
    throwIfAborted(signal)
    throw error
  } finally {
    clearTimeout(timer)
    request.signal?.removeEventListener('abort', abort)
    if (response?.body && !response.body.locked) {
      try { await response.body.cancel() } catch { /* The body may already be closed. */ }
    }
  }
}
