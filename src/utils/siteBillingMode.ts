import type { PublicSettings } from '@/types'
import { FeatureFlags, resolveFeatureFlag } from '@/utils/featureFlags'

/** User purchase mode derived from the public subscription and balance flags. */
export type SiteBillingMode = 'recharge_and_subscription' | 'recharge_only' | 'subscription_only'


export interface BillingModeSettings {
  subscription_enabled?: boolean
  payment_balance_disabled?: boolean
}

export function resolveSiteBillingMode(settings: BillingModeSettings | null | undefined): SiteBillingMode {
  const subscriptionEnabled = resolveFeatureFlag(
    { subscription_enabled: settings?.subscription_enabled } as Partial<PublicSettings>,
    FeatureFlags.subscription,
  )
  if (!subscriptionEnabled) return 'recharge_only'
  if (settings?.payment_balance_disabled === true) return 'subscription_only'
  return 'recharge_and_subscription'
}
