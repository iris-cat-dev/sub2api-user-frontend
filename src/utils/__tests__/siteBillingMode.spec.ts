import { describe, it, expect } from 'vitest'
import { resolveSiteBillingMode } from '@/utils/siteBillingMode'

describe('resolveSiteBillingMode', () => {
  it('defaults to recharge & subscription when settings are missing or empty', () => {
    expect(resolveSiteBillingMode(undefined)).toBe('recharge_and_subscription')
    expect(resolveSiteBillingMode(null)).toBe('recharge_and_subscription')
    expect(resolveSiteBillingMode({})).toBe('recharge_and_subscription')
  })

  it('maps the two backend switches onto the three modes', () => {
    expect(resolveSiteBillingMode({ subscription_enabled: true, payment_balance_disabled: false })).toBe('recharge_and_subscription')
    expect(resolveSiteBillingMode({ subscription_enabled: false, payment_balance_disabled: false })).toBe('recharge_only')
    expect(resolveSiteBillingMode({ subscription_enabled: true, payment_balance_disabled: true })).toBe('subscription_only')
  })

  it('treats the API-only "both disabled" combination as recharge only', () => {
    expect(resolveSiteBillingMode({ subscription_enabled: false, payment_balance_disabled: true })).toBe('recharge_only')
  })

})
