import { afterEach, describe, expect, it, vi } from 'vitest'
import { listDrawingModels, requestDrawing } from './imageClient'

const image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII='

const input = (imageFiles: File[], onPreview?: (dataUrl: string) => void) => ({
  apiKey: 'sk-limited',
  model: 'gpt-image-2',
  prompt: '把参考图改成水彩画',
  size: 'auto',
  quality: 'auto' as const,
  imageFiles,
  stream: true,
  onPreview,
})

afterEach(() => vi.unstubAllGlobals())

describe('drawing gateway', () => {
  it('uses the broadly compatible singular multipart field for one reference image', async () => {
    const file = new File(['source image'], 'source.png', { type: 'image/png' })
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe('/v1/images/edits')
      expect(init.headers).toEqual({ Authorization: 'Bearer sk-limited' })
      expect(init.body).toBeInstanceOf(FormData)
      expect((init.body as FormData).getAll('image')).toEqual([file])
      expect((init.body as FormData).getAll('image[]')).toEqual([])
      return new Response(JSON.stringify({ data: [{ b64_json: image }] }), { headers: { 'Content-Type': 'application/json' } })
    })
    vi.stubGlobal('fetch', fetchMock)

    expect(await requestDrawing(input([file]))).toEqual([`data:image/png;base64,${image}`])
  })

  it('sends multiple reference files intact and retains the final SSE image', async () => {
    const first = new File(['first image'], 'front.png', { type: 'image/png' })
    const second = new File(['second image'], 'back.png', { type: 'image/png' })
    const previews: string[] = []
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const event = `data: ${JSON.stringify({ type: 'image_edit.partial_image', b64_json: image })}\n\n`
          + `data: ${JSON.stringify({ type: 'image_edit.completed', b64_json: image })}\n\n`
        const bytes = new TextEncoder().encode(event)
        controller.enqueue(bytes.slice(0, 23))
        controller.enqueue(bytes.slice(23))
        controller.close()
      },
    })
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe('/v1/images/edits')
      expect(init.headers).toEqual({ Authorization: 'Bearer sk-limited' })
      expect(init.body).toBeInstanceOf(FormData)
      const files = (init.body as FormData).getAll('image')
      expect(files).toEqual([first, second])
      expect((init.body as FormData).getAll('image[]')).toEqual([])
      expect((init.body as FormData).get('stream')).toBe('true')
      return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } })
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await requestDrawing(input([first, second], (dataUrl) => previews.push(dataUrl)))

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(previews).toEqual([`data:image/png;base64,${image}`])
    expect(result).toEqual([`data:image/png;base64,${image}`])
  })

  it('uses JSON generation instead of image editing when no reference exists', async () => {
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe('/v1/images/generations')
      expect(JSON.parse(init.body as string)).toMatchObject({ prompt: '把参考图改成水彩画', stream: true })
      return new Response(JSON.stringify({ data: [{ b64_json: image }] }), { headers: { 'Content-Type': 'application/json' } })
    })
    vi.stubGlobal('fetch', fetchMock)

    expect(await requestDrawing(input([]))).toEqual([`data:image/png;base64,${image}`])
  })

  it('shows a concise timeout instead of saving an HTML error page as the task error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      '<html><body><h1>Error code 524</h1><p>Cloudflare timed out</p></body></html>',
      { status: 524, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    )))

    await expect(requestDrawing(input([]))).rejects.toThrow('Image API returned HTTP 524: upstream image request timed out')
  })

  it('keeps the upstream image format in the saved result', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      data: [{ b64_json: 'AA==', output_format: 'webp', url: 'data:image/webp;base64,AA==' }],
    }), { headers: { 'Content-Type': 'application/json' } })))

    expect(await requestDrawing(input([]))).toEqual(['data:image/webp;base64,AA=='])
  })

  it('lists image models for their supported platforms without video models', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      data: [
        { id: 'gpt-image-2' }, { id: 'grok-imagine' },
        { id: 'grok-imagine-image-quality' }, { id: 'grok-imagine-video' },
        { id: 'grok-imagine-edit' }, { id: 'grok-4' },
      ],
    }))))

    expect(await listDrawingModels('sk-limited', 'grok')).toEqual(['grok-imagine', 'grok-imagine-image-quality'])
    expect(await listDrawingModels('sk-limited', 'openai')).toEqual(['gpt-image-2'])
    expect(await listDrawingModels('sk-limited', 'composite')).toEqual([
      'gpt-image-2', 'grok-imagine', 'grok-imagine-image-quality',
    ])
  })

  it('sends Grok generation without OpenAI-only options or streaming', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe('/v1/images/generations')
      expect(init.headers).toEqual({ Authorization: 'Bearer sk-limited', 'Content-Type': 'application/json' })
      expect(JSON.parse(init.body as string)).toEqual({ model: 'grok-imagine-image', prompt: '把参考图改成水彩画', response_format: 'b64_json' })
      return new Response(JSON.stringify({ data: [{ b64_json: image }] }), { headers: { 'Content-Type': 'application/json' } })
    }))

    expect(await requestDrawing({ ...input([]), model: 'grok-imagine-image' })).toEqual([`data:image/png;base64,${image}`])
  })

  it('sends Grok references as data URLs with base64 output requested and reads the image', async () => {
    const files = [
      new File(['image one'], 'front.png', { type: 'image/png' }),
      new File(['image two'], 'back.webp', { type: 'image/webp' }),
    ]
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe('/v1/images/edits')
      expect(init.headers).toEqual({ Authorization: 'Bearer sk-limited', 'Content-Type': 'application/json' })
      expect(JSON.parse(init.body as string)).toEqual({
        model: 'grok-imagine-image-quality',
        prompt: '把参考图改成水彩画',
        response_format: 'b64_json',
        image: { url: 'data:image/png;base64,aW1hZ2Ugb25l', type: 'image_url' },
        images: [{ url: 'data:image/webp;base64,aW1hZ2UgdHdv', type: 'image_url' }],
      })
      return new Response(JSON.stringify({ data: [{ b64_json: image }] }), { headers: { 'Content-Type': 'application/json' } })
    }))

    expect(await requestDrawing({ ...input(files), model: 'grok-imagine-image-quality' })).toEqual([`data:image/png;base64,${image}`])
  })
})
