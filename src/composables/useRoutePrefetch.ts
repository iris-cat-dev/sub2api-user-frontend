import { readonly, ref } from 'vue'
import type { Ref } from 'vue'
import type { RouteLocationNormalized, Router } from 'vue-router'

type ComponentImportFn = () => Promise<unknown>

const PREFETCH_ADJACENCY: Record<string, string[]> = {
  '/dashboard': ['/keys', '/usage'],
  '/keys': ['/dashboard', '/usage'],
  '/usage': ['/keys', '/redeem'],
  '/redeem': ['/usage', '/profile'],
  '/profile': ['/dashboard', '/keys'],
  '/subscriptions': ['/purchase', '/orders'],
  '/purchase': ['/subscriptions', '/orders'],
}

export interface RoutePrefetchController {
  prefetchedRoutes: Readonly<Ref<ReadonlySet<string>>>
  triggerPrefetch: (route: RouteLocationNormalized) => void
  cancelPendingPrefetch: () => void
  resetPrefetchState: () => void
  _getPrefetchConfig: (route: RouteLocationNormalized) => ComponentImportFn[]
}

export function useRoutePrefetch(router?: Router): RoutePrefetchController {
  const pendingPrefetchHandle = ref<number | null>(null)
  const prefetchedRoutes = ref<Set<string>>(new Set())

  function getComponentImporter(path: string): ComponentImportFn | null {
    if (!router) return null
    const route = router.getRoutes().find((candidate) => candidate.path === path)
    const component = route?.components?.default
    return typeof component === 'function' ? component as ComponentImportFn : null
  }

  function getPrefetchPaths(route: RouteLocationNormalized): string[] {
    return PREFETCH_ADJACENCY[route.path] ?? []
  }

  async function prefetchComponent(importer: ComponentImportFn): Promise<void> {
    try {
      await importer()
    } catch (error) {
      if (import.meta.env.DEV) console.debug('[Prefetch] Failed to prefetch component:', error)
    }
  }

  function cancelPendingPrefetch() {
    if (pendingPrefetchHandle.value === null) return
    if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(pendingPrefetchHandle.value)
    else window.clearTimeout(pendingPrefetchHandle.value)
    pendingPrefetchHandle.value = null
  }

  function triggerPrefetch(route: RouteLocationNormalized) {
    cancelPendingPrefetch()
    const paths = getPrefetchPaths(route)
    if (paths.length === 0) return

    const run = () => {
      pendingPrefetchHandle.value = null
      if (prefetchedRoutes.value.has(route.path)) return
      const importers = paths
        .map(getComponentImporter)
        .filter((importer): importer is ComponentImportFn => importer !== null)
      if (importers.length === 0) return
      Promise.all(importers.map(prefetchComponent)).then(() => prefetchedRoutes.value.add(route.path))
    }

    pendingPrefetchHandle.value = typeof window.requestIdleCallback === 'function'
      ? window.requestIdleCallback(run, { timeout: 2000 })
      : window.setTimeout(run, 1000)
  }

  function resetPrefetchState() {
    cancelPendingPrefetch()
    prefetchedRoutes.value.clear()
  }

  function getPrefetchConfig(route: RouteLocationNormalized): ComponentImportFn[] {
    return getPrefetchPaths(route)
      .map(getComponentImporter)
      .filter((importer): importer is ComponentImportFn => importer !== null)
  }

  return {
    prefetchedRoutes: readonly(prefetchedRoutes),
    triggerPrefetch,
    cancelPendingPrefetch,
    resetPrefetchState,
    _getPrefetchConfig: getPrefetchConfig,
  }
}

export const _userPrefetchMap = PREFETCH_ADJACENCY
