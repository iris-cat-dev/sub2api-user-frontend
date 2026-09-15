export const USER_UI_REQUEST_HEADER = 'X-User-UI-Request'

function requestPath(rawURL: string): string {
  const value = rawURL.trim()
  if (!value) return ''
  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
    return new URL(value, origin).pathname
  } catch {
    return value.split(/[?#]/, 1)[0]
  }
}

function normalizeAPIPath(path: string): string {
  const raw = requestPath(path)
  if (!raw) return ''
  if (raw === '/api/v1' || raw.startsWith('/api/v1/')) return raw.slice('/api/v1'.length) || '/'
  return raw.startsWith('/') ? raw : `/${raw}`
}

export function isUserTimingAPIPath(requestURL: string): boolean {
  const path = normalizeAPIPath(requestURL)
  if (!path) return false
  if (path === '/auth/me' || path === '/auth/revoke-all-sessions' || path === '/auth/oauth/bind-token') return true
  if (path === '/user' || path.startsWith('/user/')) return true
  if (path === '/keys' || path.startsWith('/keys/')) return true
  if (path === '/groups/available' || path === '/groups/rates') return true
  if (path === '/channels/available') return true
  if (path === '/usage' || path.startsWith('/usage/')) return true
  if (path === '/announcements' || path.startsWith('/announcements/')) return true
  if (path === '/redeem' || path.startsWith('/redeem/')) return true
  if (path === '/subscriptions' || path.startsWith('/subscriptions/')) return true
  if (path === '/channel-monitors' || path.startsWith('/channel-monitors/')) return true
  if (path.startsWith('/payment/')) {
    return !path.startsWith('/payment/public') && !path.startsWith('/payment/webhook')
  }
  return false
}

export function shouldMarkUserUIRequest(requestURL: string): boolean {
  return isUserTimingAPIPath(requestURL)
}
