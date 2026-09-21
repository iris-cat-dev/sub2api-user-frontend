import { afterEach, describe, expect, it, vi } from 'vitest'

import { onRequest } from '../../functions/_middleware'

type Context = Parameters<typeof onRequest>[0]

function createContext(
  path: string,
  options: { upstream?: string; request?: RequestInit; next?: () => Promise<Response> } = {},
): Context {
  return {
    request: new Request(`https://user.example${path}`, options.request),
    env: { API_UPSTREAM: options.upstream },
    next: options.next ?? vi.fn(async () => new Response('asset')),
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Cloudflare Pages proxy middleware', () => {
  it('serves static and SPA requests through Pages', async () => {
    const next = vi.fn(async () => new Response('page'))
    const response = await onRequest(createContext('/dashboard', { next }))

    expect(await response.text()).toBe('page')
    expect(next).toHaveBeenCalledOnce()
  })

  it('does not serve the SPA HTML fallback for a missing built asset', async () => {
    const response = await onRequest(createContext('/assets/missing-chunk.js', {
      next: async () => new Response('<!doctype html>', {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }),
    }))

    expect(response.status).toBe(404)
    expect(response.headers.get('Content-Type')).toBe('text/plain; charset=utf-8')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })

  it('preserves valid built asset responses', async () => {
    const response = await onRequest(createContext('/assets/current-chunk.js', {
      next: async () => new Response('export default true', {
        headers: { 'Content-Type': 'application/javascript' },
      }),
    }))

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('application/javascript')
  })

  it.each([
    '/api/v1/admin/users',
    '/api/v1/setup/status',
    '/api%2Fv1%2Fadmin/users',
    '/setup',
  ])('blocks management path %s before proxying', async (path) => {
    const upstreamFetch = vi.fn()
    vi.stubGlobal('fetch', upstreamFetch)

    const response = await onRequest(createContext(path, { upstream: 'https://api.example' }))

    expect(response.status).toBe(404)
    expect(upstreamFetch).not.toHaveBeenCalled()
  })

  it('requires a valid API_UPSTREAM for API requests', async () => {
    expect((await onRequest(createContext('/api/v1/settings/public'))).status).toBe(503)
    expect((await onRequest(createContext('/api/v1/settings/public', { upstream: 'file:///tmp/api' }))).status).toBe(503)
  })

  it('forwards method, body, path, and query to the configured backend', async () => {
    const upstreamFetch = vi.fn(async () => new Response('proxied', { status: 201 }))
    vi.stubGlobal('fetch', upstreamFetch)
    const context = createContext('/api/v1/user/profile?view=full', {
      upstream: 'https://api.example/backend/',
      request: {
        method: 'POST',
        headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Ada' }),
      },
    })

    const response = await onRequest(context)
    const forwarded = upstreamFetch.mock.calls[0]?.[0] as Request

    expect(response.status).toBe(201)
    expect(forwarded.url).toBe('https://api.example/backend/api/v1/user/profile?view=full')
    expect(forwarded.method).toBe('POST')
    expect(forwarded.headers.get('Authorization')).toBe('Bearer token')
    expect(await forwarded.json()).toEqual({ name: 'Ada' })
  })

  it('returns a gateway response when the backend fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))

    const response = await onRequest(createContext('/v1/models', { upstream: 'https://api.example' }))

    expect(response.status).toBe(502)
  })
})
