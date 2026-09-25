import type { DrawingRequest } from './types'

type JsonObject = Record<string, unknown>

function object(value: unknown): JsonObject | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : null
}

function message(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  const record = object(value)
  if (!record) return null
  return message(record.message) ?? message(record.error)
}

async function responseError(response: Response): Promise<Error> {
  if (response.headers.get('Content-Type')?.toLowerCase().includes('text/html')) {
    return new Error(response.status === 524
      ? 'Image API returned HTTP 524: upstream image request timed out'
      : `Image API returned HTTP ${response.status}`)
  }
  const text = await response.text()
  let parsed: unknown
  try { parsed = JSON.parse(text) } catch { /* Plain-text gateway errors are valid. */ }
  return new Error(message(parsed) ?? (text.trim() || `Image API returned HTTP ${response.status}`))
}

function imageValue(value: unknown): string | null {
  const item = object(value)
  if (!item) return null
  if (typeof item.url === 'string' && item.url.startsWith('data:image/')) return item.url
  if (typeof item.b64_json === 'string' && item.b64_json) {
    if (item.b64_json.startsWith('data:')) return item.b64_json
    const format = item.output_format === 'webp' ? 'webp' : item.output_format === 'jpeg' || item.output_format === 'jpg' ? 'jpeg' : 'png'
    return `data:image/${format};base64,${item.b64_json}`
  }
  return typeof item.url === 'string' && item.url ? item.url : null
}

async function persistentImage(value: string, signal?: AbortSignal): Promise<string> {
  if (value.startsWith('data:')) return value
  if (!/^https?:\/\//i.test(value)) throw new Error('Image API returned an unsupported image URL')
  const response = await fetch(value, { signal })
  if (!response.ok) throw new Error(`Unable to download generated image (HTTP ${response.status})`)
  const blob = await response.blob()
  if (!blob.type.startsWith('image/')) throw new Error('Generated image URL did not return an image')
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read generated image'))
    reader.readAsDataURL(blob)
  })
}

async function finalImages(payload: unknown, signal?: AbortSignal): Promise<string[]> {
  const data = object(payload)?.data
  if (!Array.isArray(data)) throw new Error(message(object(payload)?.error) ?? 'Image API returned no image data')
  const values = data.map(imageValue).filter((value): value is string => value !== null)
  if (!values.length) throw new Error('Image API returned no usable images')
  return Promise.all(values.map(value => persistentImage(value, signal)))
}

async function streamImages(response: Response, request: DrawingRequest): Promise<string[]> {
  if (!response.body) throw new Error('Image API returned an empty event stream')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const completed: string[] = []
  let result: unknown
  let buffer = ''
  let sawEvent = false
  const cancel = () => { void reader.cancel().catch(() => undefined) }
  request.signal?.addEventListener('abort', cancel, { once: true })

  const consume = (block: string) => {
    const lines = block.split(/\r?\n/).filter(line => line.startsWith('data:'))
    if (!lines.length) return
    const data = lines.map(line => line.slice(5).trimStart()).join('\n').trim()
    if (!data || data === '[DONE]') return
    let event: unknown
    try { event = JSON.parse(data) } catch { throw new Error(`Invalid image event stream: ${data.slice(0, 160)}`) }
    const item = object(event)
    if (!item) throw new Error('Invalid image event stream payload')
    sawEvent = true
    if (item.type === 'error' || item.type === 'image_generation.failed' || item.type === 'image_edit.failed' || item.error) {
      throw new Error(message(item.error) ?? message(item) ?? 'Image generation failed')
    }
    if (item.object === 'image.generation.result' || item.object === 'image.edit.result') {
      result = item
    } else if (item.type === 'image_generation.partial_image' || item.type === 'image_edit.partial_image') {
      const preview = imageValue(item)
      if (preview) request.onPreview?.(preview)
    } else if (item.type === 'image_generation.completed' || item.type === 'image_edit.completed') {
      const image = imageValue(item)
      if (image) completed.push(image)
    }
  }

  try {
    while (true) {
      if (request.signal?.aborted) throw request.signal.reason ?? new DOMException('Aborted', 'AbortError')
      const { done, value } = await reader.read()
      if (request.signal?.aborted) throw request.signal.reason ?? new DOMException('Aborted', 'AbortError')
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let separator = /\r?\n\r?\n/.exec(buffer)
      while (separator) {
        consume(buffer.slice(0, separator.index))
        buffer = buffer.slice(separator.index + separator[0].length)
        separator = /\r?\n\r?\n/.exec(buffer)
      }
    }
    buffer += decoder.decode()
    if (buffer.trim()) consume(buffer)
    if (!sawEvent) throw new Error('Image API returned no event data')
    if (result !== undefined) return await finalImages(result, request.signal)
    if (!completed.length) throw new Error('Image event stream returned no final images')
    return await Promise.all(completed.map(value => persistentImage(value, request.signal)))
  } finally {
    request.signal?.removeEventListener('abort', cancel)
    reader.releaseLock()
  }
}

function uploadDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read reference image'))
    reader.readAsDataURL(file)
  })
}

export async function requestDrawing(request: DrawingRequest): Promise<string[]> {
  const edit = request.imageFiles.length > 0
  const grok = /^grok-imagine(?:$|-image)/i.test(request.model)
  const fields = grok ? {
    model: request.model,
    prompt: request.prompt,
    response_format: 'b64_json',
  } : {
    model: request.model,
    prompt: request.prompt,
    size: request.size,
    quality: request.quality,
    output_format: 'png',
    response_format: 'b64_json',
    ...(request.stream ? { stream: true, partial_images: 2 } : {}),
  }
  let body: BodyInit
  const headers: Record<string, string> = { Authorization: `Bearer ${request.apiKey}` }
  if (edit && grok) {
    const images = await Promise.all(request.imageFiles.map(uploadDataUrl))
    const reference = (url: string) => ({ url, type: 'image_url' })
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify({
      ...fields,
      image: reference(images[0]!),
      ...(images.length > 1 ? { images: images.slice(1).map(reference) } : {}),
    })
  } else if (edit) {
    const form = new FormData()
    for (const [key, value] of Object.entries(fields)) form.append(key, String(value))
    for (const file of request.imageFiles) form.append(request.imageFiles.length === 1 ? 'image' : 'image[]', file, file.name)
    body = form
  } else {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(fields)
  }
  const response = await fetch(edit ? '/v1/images/edits' : '/v1/images/generations', {
    method: 'POST', headers, body, signal: request.signal, cache: 'no-store',
  })
  if (!response.ok) throw await responseError(response)
  if (!grok && request.stream && response.headers.get('Content-Type')?.toLowerCase().includes('text/event-stream')) {
    return streamImages(response, request)
  }
  let payload: unknown
  try { payload = await response.json() } catch { throw new Error('Image API returned invalid JSON') }
  return finalImages(payload, request.signal)
}

export async function listDrawingModels(apiKey: string, platform?: string): Promise<string[]> {
  const response = await fetch('/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store',
  })
  if (!response.ok) throw await responseError(response)
  let payload: unknown
  try { payload = await response.json() } catch { throw new Error('Model API returned invalid JSON') }
  const data = object(payload)?.data
  if (!Array.isArray(data)) throw new Error('Model API returned no model list')
  return Array.from(new Set(data.map(item => object(item)?.id).filter((id): id is string => {
    if (typeof id !== 'string') return false
    const openai = /^gpt-image-/i.test(id)
    const grok = /^grok-imagine(?:$|-image[a-z0-9-]*$)/i.test(id) && !/-video(?:-|$)/i.test(id)
    return platform === 'openai' ? openai : platform === 'grok' ? grok : openai || grok
  })))
}
