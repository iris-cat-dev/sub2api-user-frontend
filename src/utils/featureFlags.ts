/**
 * User-facing feature switches resolved from public settings.
 *
 * Opt-out flags remain visible until the backend explicitly disables them.
 * Opt-in flags remain hidden until public settings explicitly enable them.
 */
import { useAppStore } from '@/stores/app'
import type { PublicSettings } from '@/types'
import { DEFAULT_INTERVAL_SECONDS } from '@/constants/channelMonitor'

export type FeatureFlagMode = 'opt-in' | 'opt-out'

export interface FeatureFlagDefinition {
  /** Public-settings key used for lookup. */
  readonly key: keyof PublicSettings
  /** Resolution mode when the key is missing/undefined. */
  readonly mode: FeatureFlagMode
  /** Short human label for logs and debug tooling. */
  readonly label: string
}

function defineFlag<K extends keyof PublicSettings>(
  def: { key: K; mode: FeatureFlagMode; label: string },
): FeatureFlagDefinition {
  return def
}

/**
 * Registered feature flags. Add a new entry here when introducing a new
 * public-settings-driven switch; see the "Adding a new flag" checklist above.
 */
export const FeatureFlags = {
  channelMonitor: defineFlag({
    key: 'channel_monitor_enabled',
    mode: 'opt-out',
    label: 'Channel Monitor',
  }),
  availableChannels: defineFlag({
    key: 'available_channels_enabled',
    mode: 'opt-in',
    label: 'Available Channels',
  }),
  subscription: defineFlag({
    key: 'subscription_enabled',
    mode: 'opt-out',
    label: 'Subscription',
  }),
  modelPlaza: defineFlag({
    key: 'model_plaza_enabled',
    mode: 'opt-in',
    label: 'Model Plaza',
  }),
  payment: defineFlag({
    key: 'payment_enabled',
    mode: 'opt-out',
    label: 'Payment',
  }),
  affiliate: defineFlag({
    key: 'affiliate_enabled',
    mode: 'opt-in',
    label: 'Affiliate',
  }),
} as const

export type RegisteredFeatureFlag = keyof typeof FeatureFlags

/**
 * Read the current value of a flag, honoring the mode's fallback.
 * `true`  → the feature is enabled (menu/route should render).
 * `false` → the feature is disabled (menu/route should hide).
 */
export function isFeatureFlagEnabled(flag: FeatureFlagDefinition): boolean {
  const appStore = useAppStore()
  return resolveFeatureFlag(appStore.cachedPublicSettings, flag)
}

/**
 * Pure resolver behind `isFeatureFlagEnabled`. Use it when the caller already
 * holds a settings object (e.g. a store instance from `@/stores`) and should
 * not reach for `useAppStore` itself — keeps views testable without Pinia.
 */
export function resolveFeatureFlag(
  settings: Partial<PublicSettings> | null | undefined,
  flag: FeatureFlagDefinition,
): boolean {
  const raw = settings?.[flag.key] as boolean | undefined
  if (typeof raw === 'boolean') return raw
  // Settings not yet loaded → fall back to the flag's declared mode:
  //   opt-out → visible by default, opt-in → hidden by default.
  return flag.mode === 'opt-out'
}

/**
 * Sidebar NavItem.featureFlag accepts a getter that returns
 * `false` to hide. Keeping the same contract lets callers swap in
 * registry-backed flags without changing AppSidebar's filter logic.
 */
export function makeSidebarFlag(flag: FeatureFlagDefinition): () => boolean {
  return () => isFeatureFlagEnabled(flag)
}

/** True when channel monitor feature flag is enabled. */
export function isChannelMonitorRouteEnabled(): boolean {
  return isFeatureFlagEnabled(FeatureFlags.channelMonitor)
}

export type ChannelMonitorMode = 'v1' | 'v2'

/** Exclusive channel-monitor implementation. Invalid/missing → v1 (opt-in to v2). */
export function getChannelMonitorMode(): ChannelMonitorMode {
  const appStore = useAppStore()
  const mode = appStore.cachedPublicSettings?.channel_monitor_mode
  return mode === 'v2' ? 'v2' : 'v1'
}

export function isChannelMonitorV1Mode(): boolean {
  return isChannelMonitorRouteEnabled() && getChannelMonitorMode() === 'v1'
}

export function isChannelMonitorV2Mode(): boolean {
  return isChannelMonitorRouteEnabled() && getChannelMonitorMode() === 'v2'
}

export function getChannelMonitorRefreshIntervalSeconds(): number {
  const appStore = useAppStore()
  const configured = appStore.cachedPublicSettings?.channel_monitor_default_interval_seconds
  return configured && configured > 0 ? configured : DEFAULT_INTERVAL_SECONDS
}

/** Hide RPM/TPM on the public monitor to avoid leaking infrastructure scale. */
export function isChannelMonitorThroughputHidden(): boolean {
  const appStore = useAppStore()
  return Boolean(appStore.cachedPublicSettings?.channel_monitor_hide_throughput)
}

/** Show public quota snapshots when explicitly enabled. */
export function isChannelMonitorQuotaVisible(): boolean {
  const appStore = useAppStore()
  return appStore.cachedPublicSettings?.channel_monitor_show_quota === true
}

/** Hide the user ranking tab on the public monitor. */
export function isChannelMonitorUserRankingHidden(): boolean {
  const appStore = useAppStore()
  return Boolean(appStore.cachedPublicSettings?.channel_monitor_hide_user_ranking)
}
