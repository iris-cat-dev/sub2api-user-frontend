import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RouteRecordRaw } from 'vue-router'
import '@/router'

const routerHarness = vi.hoisted(() => ({
  guard: null as ((to: Record<string, any>) => Promise<unknown>) | null,
  routes: [] as RouteRecordRaw[],
}))

const authStore = vi.hoisted(() => ({
  checkAuth: vi.fn(),
  isAuthenticated: false,
  isAdmin: false,
  isSimpleMode: false,
  hasPendingAuthSession: false,
}))

const appStore = vi.hoisted(() => ({
  siteName: 'Sub2API',
  backendModeEnabled: false,
  publicSettingsLoaded: true,
  cachedPublicSettings: {} as Record<string, unknown>,
  fetchPublicSettings: vi.fn(),
}))

vi.mock('vue-router', () => ({
  createWebHistory: vi.fn(() => ({})),
  createRouter: vi.fn((options: { routes: RouteRecordRaw[] }) => {
    routerHarness.routes = options.routes
    return {
      beforeEach: vi.fn((guard: (to: Record<string, any>) => Promise<unknown>) => {
        routerHarness.guard = guard
      }),
      afterEach: vi.fn(),
      onError: vi.fn(),
    }
  }),
}))

vi.mock('@/stores/auth', () => ({ useAuthStore: () => authStore }))
vi.mock('@/stores/app', () => ({ useAppStore: () => appStore }))
vi.mock('@/composables/useNavigationLoading', () => ({
  useNavigationLoadingState: () => ({
    startNavigation: vi.fn(),
    endNavigation: vi.fn(),
    isLoading: { value: false },
  }),
}))
vi.mock('@/composables/useRoutePrefetch', () => ({
  useRoutePrefetch: () => ({
    triggerPrefetch: vi.fn(),
    cancelPendingPrefetch: vi.fn(),
    resetPrefetchState: vi.fn(),
  }),
}))

function runGuard(path: string, meta: Record<string, unknown> = {}, fullPath = path) {
  if (!routerHarness.guard) throw new Error('router guard was not registered')
  return routerHarness.guard({ path, fullPath, name: 'TestRoute', params: {}, meta })
}

describe('standalone user router', () => {
  beforeEach(() => {
    authStore.isAuthenticated = false
    authStore.isAdmin = false
    authStore.isSimpleMode = false
    authStore.hasPendingAuthSession = false
    appStore.backendModeEnabled = false
    appStore.publicSettingsLoaded = true
    appStore.cachedPublicSettings = {}
    appStore.fetchPublicSettings.mockReset()
  })

  it('ships user routes without admin or setup entries', () => {
    const paths = routerHarness.routes.map((route) => route.path)
    expect(paths).toEqual(expect.arrayContaining(['/home', '/dashboard', '/keys', '/usage', '/profile']))
    expect(paths.some((path) => path === '/admin' || path.startsWith('/admin/'))).toBe(false)
    expect(paths.some((path) => path === '/setup' || path.startsWith('/setup/'))).toBe(false)
  })

  it('preserves the requested protected route when redirecting to login', async () => {
    await expect(runGuard('/usage', {}, '/usage?page=2')).resolves.toEqual({
      path: '/login',
      query: { redirect: '/usage?page=2' },
    })
  })

  it('sends authenticated users, including administrators, to the user dashboard after login', async () => {
    authStore.isAuthenticated = true
    authStore.isAdmin = true
    await expect(runGuard('/login', { requiresAuth: false })).resolves.toBe('/dashboard')
  })

  it('waits for public settings and blocks disabled payment routes', async () => {
    authStore.isAuthenticated = true
    appStore.publicSettingsLoaded = false
    appStore.fetchPublicSettings.mockImplementation(async () => {
      appStore.cachedPublicSettings = { payment_enabled: false }
      appStore.publicSettingsLoaded = true
    })

    await expect(runGuard('/purchase', { requiresPayment: true })).resolves.toBe('/dashboard')
    expect(appStore.fetchPublicSettings).toHaveBeenCalledOnce()
  })

  it('requires login when the public model plaza is configured as authenticated', async () => {
    appStore.cachedPublicSettings = { model_plaza_require_auth: true }
    await expect(runGuard('/model-plaza', { requiresAuth: false })).resolves.toEqual({
      path: '/login',
      query: { redirect: '/model-plaza' },
    })
  })

  it('keeps simple mode away from subscription management', async () => {
    authStore.isAuthenticated = true
    authStore.isSimpleMode = true
    await expect(runGuard('/subscriptions')).resolves.toBe('/dashboard')
  })
})
