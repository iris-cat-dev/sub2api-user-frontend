import { describe, expect, it } from 'vitest'

import {
  USER_UI_REQUEST_HEADER,
  isUserTimingAPIPath,
  shouldMarkUserUIRequest,
} from '@/api/userUIRequest'

describe('user UI request marker', () => {
  it('uses the backend server-timing header contract', () => {
    expect(USER_UI_REQUEST_HEADER).toBe('X-User-UI-Request')
  })

  it.each([
    '/auth/me',
    '/api/v1/user/profile',
    'https://api.example.test/api/v1/keys/42',
    '/usage/stats?range=7d',
    '/payment/plans',
  ])('marks authenticated user API path %s', (url) => {
    expect(shouldMarkUserUIRequest(url)).toBe(true)
  })

  it.each([
    '/settings/public',
    '/payment/public/orders/verify',
    '/payment/webhook/stripe',
    '/admin/users',
    '/api/v1/admin/accounts',
    '/api/v1/keys-admin',
    '',
  ])('does not mark non-user API path %s', (url) => {
    expect(isUserTimingAPIPath(url)).toBe(false)
  })
})
