import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ModelPricingView from '../ModelPricingView.vue'

const { getAvailable } = vi.hoisted(() => ({ getAvailable: vi.fn() }))

vi.mock('@/api/channels', () => ({
  default: { getAvailable },
}))

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string, params?: Record<string, unknown>) => params?.count == null ? key : `${key}:${params.count}`,
    }),
  }
})

vi.mock('@/utils/platformColors', () => ({
  platformLabel: (platform: string) => platform,
}))

const tokenPricing = {
  billing_mode: 'token' as const,
  input_price: 3e-6,
  output_price: 15e-6,
  cache_write_price: 3.75e-6,
  cache_read_price: 0.3e-6,
  image_input_price: null,
  image_output_price: null,
  per_request_price: null,
  intervals: [],
}

function mountView() {
  return mount(ModelPricingView, {
    global: {
      stubs: {
        AppLayout: { template: '<div><slot /></div>' },
        Icon: true,
        ModelIcon: true,
      },
    },
  })
}

describe('ModelPricingView', () => {
  beforeEach(() => {
    getAvailable.mockReset()
  })

  it('deduplicates models and displays their base ×1 prices', async () => {
    getAvailable.mockResolvedValue([
      {
        name: 'Primary',
        description: '',
        platforms: [{
          platform: 'anthropic',
          groups: [{ rate_multiplier: 4 }],
          supported_models: [
            { name: 'claude-test', platform: 'anthropic', pricing: null },
            { name: 'image-test', platform: 'anthropic', pricing: { ...tokenPricing, billing_mode: 'image', input_price: null, output_price: null, per_request_price: 0.25 } },
          ],
        }],
      },
      {
        name: 'Fallback',
        description: '',
        platforms: [{
          platform: 'anthropic',
          groups: [{ rate_multiplier: 9 }],
          supported_models: [
            { name: 'claude-test', platform: 'anthropic', pricing: tokenPricing },
          ],
        }],
      },
    ])

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
    expect(wrapper.text()).toContain('¥3.00')
    expect(wrapper.text()).toContain('¥15.00')
    expect(wrapper.text()).toContain('¥0.25')
    expect(wrapper.text()).toContain('×1')
    expect(wrapper.text()).not.toContain('¥12.00')
    expect(wrapper.text()).not.toContain('¥27.00')
  })
})
