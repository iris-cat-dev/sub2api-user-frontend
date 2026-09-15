interface PagesEnv {
  API_UPSTREAM?: string
}

interface PagesContext {
  request: Request
  env: PagesEnv
  next(): Promise<Response>
}

function normalizePath(pathname: string): string | null {
  try {
    return decodeURIComponent(pathname).replace(/\/{2,}/g, '/')
  } catch {
    return null
  }
}

function isProxiedPath(pathname: string): boolean {
  return pathname === '/api' || pathname.startsWith('/api/') || pathname === '/v1' || pathname.startsWith('/v1/')
}

function isBlockedPath(pathname: string): boolean {
  return pathname === '/setup'
    || pathname.startsWith('/setup/')
    || /^\/api\/v1\/(?:admin|setup)(?:\/|$)/i.test(pathname)
}

function resolveUpstream(requestUrl: URL, configuredUpstream: string): URL | null {
  try {
    const upstream = new URL(configuredUpstream)
    if (upstream.protocol !== 'http:' && upstream.protocol !== 'https:') return null

    const basePath = upstream.pathname.replace(/\/+$/, '')
    upstream.pathname = `${basePath}${requestUrl.pathname}`
    upstream.search = requestUrl.search
    upstream.hash = ''
    return upstream
  } catch {
    return null
  }
}

function createUpstreamRequest(upstream: URL, request: Request): Request {
  const headers = new Headers(request.headers)
  headers.delete('host')

  const init: RequestInit & { duplex?: 'half' } = {
    method: request.method,
    headers,
    redirect: 'manual',
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = request.body
    init.duplex = 'half'
  }
  return new Request(upstream, init)
}

export async function onRequest(context: PagesContext): Promise<Response> {
  const requestUrl = new URL(context.request.url)
  const normalizedPath = normalizePath(requestUrl.pathname)
  if (normalizedPath === null) return new Response('Bad Request', { status: 400 })

  if (isBlockedPath(normalizedPath)) return new Response('Not Found', { status: 404 })
  if (!isProxiedPath(normalizedPath)) return context.next()

  const configuredUpstream = context.env.API_UPSTREAM?.trim()
  if (!configuredUpstream) return new Response('API upstream is not configured', { status: 503 })

  const upstream = resolveUpstream(requestUrl, configuredUpstream)
  if (!upstream) return new Response('API upstream is invalid', { status: 503 })

  try {
    return await fetch(createUpstreamRequest(upstream, context.request))
  } catch {
    return new Response('Bad Gateway', { status: 502 })
  }
}
