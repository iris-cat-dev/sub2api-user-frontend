import { afterEach, describe, expect, it, vi, type Mock } from 'vitest'
import { listChatModels, requestChat } from './client'
import type { ChatMessage, ChatProtocol, ChatReply } from './types'

const context: ChatMessage[] = [
  { id: 'u1', role: 'user', content: 'Remember 猫', attachments: [], reasoning: '', status: 'done', error: null, model: 'chat-model', createdAt: 1 },
  { id: 'a1', role: 'assistant', content: '猫 remembered', attachments: [], reasoning: 'Thinking', status: 'stopped', error: null, model: 'chat-model', createdAt: 2 },
  { id: 'u2', role: 'user', content: 'What did I say?', attachments: [], reasoning: '', status: 'done', error: null, model: 'chat-model', createdAt: 3 },
]

function streamResponse(source: string, cancel?: () => void): Response {
  const bytes = new TextEncoder().encode(source)
  return new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      // Split every byte to exercise UTF-8 code points and CRLF across chunks.
      for (const byte of bytes) controller.enqueue(new Uint8Array([byte]))
      controller.close()
    },
    cancel,
  }), { headers: { 'Content-Type': 'text/event-stream' } })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('chat model discovery', () => {
  it('deduplicates, filters non-chat endpoints, and sorts model IDs naturally', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({
      data: [
        { id: 'grok-4.7' },
        { id: 'deepseek-v4.1-flash' },
        { id: 'gpt-6.1-sol' },
        { id: 'claude-opus-5-5' },
        { id: 'grok-4.6' },
        { id: 'deepseek-v4-flash-0731' },
        { id: 'gpt-6-luna' },
        { id: 'kimi-k3' },
        { id: 'grok-4.7' },
        { id: 'gpt-image-1' },
      ],
    })))
    await expect(listChatModels('secret')).resolves.toEqual([
      'claude-opus-5-5',
      'deepseek-v4-flash-0731',
      'deepseek-v4.1-flash',
      'gpt-6-luna',
      'gpt-6.1-sol',
      'grok-4.6',
      'grok-4.7',
      'kimi-k3',
    ])
  })
})

describe('chat protocol replies', () => {
  it('deduplicates Responses delta/done/completed snapshots across multiline CRLF and a trailing block', async () => {
    const source = ': heartbeat\r\n\r\n'
      + 'event: response.output_text.delta\r\ndata: {"type":"response.output_text.delta",\r\ndata: "output_index":0,"content_index":0,"delta":"猫"}\r\n\r\n'
      + 'data: {"type":"response.output_text.done","output_index":0,"content_index":0,"text":"猫"}\r\n\r\n'
      + 'data: {"type":"response.reasoning_summary_text.delta","output_index":1,"summary_index":0,"delta":"Think"}\r\n\r\n'
      + 'data: {"type":"response.completed","response":{"status":"completed","output":[{"type":"message","content":[{"type":"output_text","text":"猫"}]},{"type":"reasoning","summary":[{"type":"summary_text","text":"Think"}]}]}}'
    vi.stubGlobal('fetch', vi.fn(async () => streamResponse(source)))
    const updates: ChatReply[] = []
    expect(await requestChat({ apiKey: 'secret', model: 'chat-model', protocol: 'responses', messages: context, onUpdate: reply => updates.push(reply) }))
      .toEqual({ content: '猫', reasoning: 'Think' })
    expect(updates[updates.length - 1]).toEqual({ content: '猫', reasoning: 'Think' })
    expect(updates.every(reply => reply.content === '猫')).toBe(true)
  })
  it.each<ChatProtocol>(['responses', 'chat-completions', 'messages'])('serializes text, image, and PDF attachments for %s', async protocol => {
    const messages: ChatMessage[] = [{
      id: 'u1',
      role: 'user',
      content: 'Review these files',
      attachments: [
        { id: 'text', name: 'notes.md', mimeType: 'text/markdown', size: 4, kind: 'text', data: 'café' },
        { id: 'image', name: 'photo.png', mimeType: 'image/png', size: 5, kind: 'image', data: 'data:image/png;base64,aW1hZ2U=' },
        { id: 'pdf', name: 'report.pdf', mimeType: 'application/pdf', size: 3, kind: 'pdf', data: 'data:application/pdf;base64,cGRm' },
      ],
      reasoning: '',
      status: 'done',
      error: null,
      model: 'chat-model',
      createdAt: 1,
    }]
    let body: Record<string, unknown> = {}
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      body = JSON.parse(String(init?.body)) as Record<string, unknown>
      const payload = protocol === 'responses'
        ? { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'ok' }] }] }
        : protocol === 'messages'
          ? { content: [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn' }
          : { choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }] }
      return Response.json(payload)
    }))
    await expect(requestChat({ apiKey: 'secret', model: 'chat-model', protocol, messages })).resolves.toEqual({ content: 'ok', reasoning: '' })
    const wireMessages = (protocol === 'responses' ? body.input : body.messages) as Array<{ content: unknown }>
    const text = 'Review these files\n\nAttached text file "notes.md":\ncafé'
    expect(wireMessages[0]?.content).toEqual(protocol === 'responses' ? [
      { type: 'input_text', text },
      { type: 'input_image', image_url: 'data:image/png;base64,aW1hZ2U=', detail: 'auto' },
      { type: 'input_file', filename: 'report.pdf', file_data: 'data:application/pdf;base64,cGRm' },
    ] : protocol === 'messages' ? [
      { type: 'text', text },
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'aW1hZ2U=' } },
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: 'cGRm' } },
    ] : [
      { type: 'text', text },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,aW1hZ2U=', detail: 'auto' } },
      { type: 'file', file: { filename: 'report.pdf', file_data: 'data:application/pdf;base64,cGRm' } },
    ])
  })


  it('replaces a Chat Completions final snapshot instead of appending it twice', async () => {
    const events = [
      { choices: [{ index: 0, delta: { content: 'answer', reasoning_content: 'think' } }] },
      { choices: [{ index: 0, message: { content: 'answer', reasoning_content: 'think' }, finish_reason: 'stop' }] },
    ]
    vi.stubGlobal('fetch', vi.fn(async () => streamResponse(events.map(item => `data: ${JSON.stringify(item)}\n\n`).join('') + 'data: [DONE]\n\n')))
    expect(await requestChat({ apiKey: 'secret', model: 'chat-model', protocol: 'chat-completions', messages: context }))
      .toEqual({ content: 'answer', reasoning: 'think' })
  })

  it.each<ChatProtocol>(['responses', 'chat-completions', 'messages'])('retains partial output but rejects an interrupted %s stream', async protocol => {
    const item = protocol === 'responses' ? { type: 'response.output_text.delta', delta: 'partial', output_index: 0 }
      : protocol === 'messages' ? { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'partial' } }
        : { choices: [{ index: 0, delta: { content: 'partial' } }] }
    vi.stubGlobal('fetch', vi.fn(async () => streamResponse(`data: ${JSON.stringify(item)}\n\n`)))
    const updates: ChatReply[] = []
    await expect(requestChat({ apiKey: 'secret', model: 'chat-model', protocol, messages: context, onUpdate: reply => updates.push(reply) })).rejects.toThrow('interrupted')
    expect(updates[updates.length - 1]?.content).toBe('partial')
  })

  it('retains Anthropic reasoning and refusal while exposing max-token truncation', async () => {
    const events = [
      { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'Consider' } },
      { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } },
      { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: 'Cannot help' } },
      { type: 'message_delta', delta: { stop_reason: 'max_tokens' } },
      { type: 'message_stop' },
    ]
    vi.stubGlobal('fetch', vi.fn(async () => streamResponse(events.map(item => `data: ${JSON.stringify(item)}\n\n`).join(''))))
    const updates: ChatReply[] = []
    await expect(requestChat({ apiKey: 'secret', model: 'chat-model', protocol: 'messages', messages: context, onUpdate: reply => updates.push(reply) })).rejects.toThrow('max_tokens')
    expect(updates[updates.length - 1]).toEqual({ content: 'Cannot help', reasoning: 'Consider' })
  })

  it('cancels and unlocks a failed stream reader', async () => {
    const cancel = vi.fn()
    const response = new Response(new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new TextEncoder().encode('data: {"type":"error","error":{"message":"upstream failure"}}\n\n')) },
      cancel,
    }), { headers: { 'Content-Type': 'text/event-stream' } })
    vi.stubGlobal('fetch', vi.fn(async () => response))
    await expect(requestChat({ apiKey: 'secret', model: 'chat-model', protocol: 'responses', messages: context })).rejects.toThrow('upstream failure')
    expect(cancel).toHaveBeenCalledOnce()
    expect(response.body?.locked).toBe(false)
  })

  it('distinguishes timeout from user stop and closes both readers', async () => {
    vi.useFakeTimers()
    const cancels: Mock[] = []
    vi.stubGlobal('fetch', vi.fn(async () => {
      const cancel = vi.fn()
      cancels.push(cancel)
      return new Response(new ReadableStream<Uint8Array>({ cancel }), { headers: { 'Content-Type': 'text/event-stream' } })
    }))
    const controller = new AbortController()
    const stopped = requestChat({ apiKey: 'secret', model: 'chat-model', protocol: 'responses', messages: context, signal: controller.signal })
    const stoppedAssertion = expect(stopped).rejects.toMatchObject({ name: 'AbortError' })
    await Promise.resolve()
    controller.abort()
    await stoppedAssertion
    const timedOut = requestChat({ apiKey: 'secret', model: 'chat-model', protocol: 'responses', messages: context, timeout: 10 })
    const timeoutAssertion = expect(timedOut).rejects.toMatchObject({ name: 'TimeoutError' })
    await vi.advanceTimersByTimeAsync(10)
    await timeoutAssertion
    expect(cancels).toHaveLength(2)
    expect(cancels.every(cancel => cancel.mock.calls.length === 1)).toBe(true)
  })
})
