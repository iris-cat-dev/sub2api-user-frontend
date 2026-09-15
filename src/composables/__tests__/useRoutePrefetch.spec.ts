import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RouteLocationNormalized, RouteRecordNormalized, Router } from 'vue-router'

import { _userPrefetchMap, useRoutePrefetch } from '../useRoutePrefetch'

function route(path: string): RouteLocationNormalized {
  return {
    path,
    name: undefined,
    params: {},
    query: {},
    hash: '',
    fullPath: path,
    matched: [],
    meta: {},
    redirectedFrom: undefined,
  }
}

function createMockRouter(importer: () => Promise<unknown>): Router {
  const routes = ['/dashboard', '/keys', '/usage', '/redeem', '/profile', '/subscriptions', '/purchase', '/orders']
    .map((path) => ({ path, components: { default: importer } }))
  return { getRoutes: () => routes as RouteRecordNormalized[] } as Router
}

describe('user route prefetch', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('requestIdleCallback', (callback: IdleRequestCallback) => {
      return window.setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 50 }), 0)
    })
    vi.stubGlobal('cancelIdleCallback', (id: number) => window.clearTimeout(id))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('preloads adjacent user pages once during idle time', async () => {
    const importer = vi.fn().mockResolvedValue({ default: {} })
    const controller = useRoutePrefetch(createMockRouter(importer))

    controller.triggerPrefetch(route('/dashboard'))
    await vi.runAllTimersAsync()

    expect(importer).toHaveBeenCalledTimes(2)
    expect(controller.prefetchedRoutes.value.has('/dashboard')).toBe(true)

    controller.triggerPrefetch(route('/dashboard'))
    await vi.runAllTimersAsync()
    expect(importer).toHaveBeenCalledTimes(2)
  })

  it('cancels an obsolete pending prefetch when navigation changes', async () => {
    const importer = vi.fn().mockResolvedValue({ default: {} })
    const controller = useRoutePrefetch(createMockRouter(importer))

    controller.triggerPrefetch(route('/dashboard'))
    controller.triggerPrefetch(route('/profile'))
    await vi.runAllTimersAsync()

    expect(controller.prefetchedRoutes.value.has('/dashboard')).toBe(false)
    expect(controller.prefetchedRoutes.value.has('/profile')).toBe(true)
  })

  it('does nothing for unknown or removed management routes', async () => {
    const importer = vi.fn().mockResolvedValue({ default: {} })
    const controller = useRoutePrefetch(createMockRouter(importer))

    controller.triggerPrefetch(route('/admin/dashboard'))
    controller.triggerPrefetch(route('/unknown'))
    await vi.runAllTimersAsync()

    expect(importer).not.toHaveBeenCalled()
    expect(controller.prefetchedRoutes.value.size).toBe(0)
    expect(_userPrefetchMap).not.toHaveProperty('/admin/dashboard')
  })
})
