import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ModelPricingView from '../ModelPricingView.vue'

const { getModelPlaza } = vi.hoisted(() => ({ getModelPlaza: vi.fn() }))

vi.mock('@/api/modelPlaza', () => ({
  getModelPlaza,
  default: { getModelPlaza },
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

function plazaGroup(overrides: Record<string, unknown> = {}) {
  return {
    id: 20,
    name: '模型合集',
    description: '',
    platform: 'composite',
    subscription_type: 'standard',
    rate_multiplier: 1,
    peak_rate_enabled: false,
    peak_start: '',
    peak_end: '',
    peak_rate_multiplier: 1,
    is_exclusive: false,
    image_rate_independent: false,
    image_rate_multiplier: 1,
    long_context_pricing_enabled: false,
    models: [
      {
        name: 'claude-test',
        platform: 'composite',
        pricing: tokenPricing,
        official_pricing: {
          input_price: 15e-6,
          output_price: 75e-6,
          cache_write_price: 18.75e-6,
          cache_read_price: 1.5e-6,
        },
      },
      {
        name: 'gpt-test',
        platform: 'composite',
        pricing: tokenPricing,
        official_pricing: null,
      },
      {
        name: 'image-test',
        platform: 'anthropic',
        pricing: {
          ...tokenPricing,
          billing_mode: 'image',
          input_price: null,
          output_price: null,
          per_request_price: 0.25,
        },
        official_pricing: null,
      },
    ],
    ...overrides,
  }
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
    getModelPlaza.mockReset()
  })

  it('splits composite plaza models into Claude and GPT platform sections', async () => {
    getModelPlaza.mockResolvedValue({
      description: '',
      groups: [plazaGroup()],
    })

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.findAll('section.pricing-group')).toHaveLength(2)
    expect(wrapper.findAll('tbody tr')).toHaveLength(3)
    expect(wrapper.text()).toContain('anthropic')
    expect(wrapper.text()).toContain('openai')
    expect(wrapper.text()).toContain('¥3.00')
    expect(wrapper.text()).toContain('¥15.00')
    expect(wrapper.find('.pricing-official-price').text()).toBe('¥15.00')
    expect(wrapper.text()).toContain('¥0.25')
    expect(wrapper.text()).not.toContain('composite')
  })

  it('keeps the same model in multiple plaza groups', async () => {
    getModelPlaza.mockResolvedValue({
      description: '',
      groups: [
        plazaGroup({
          id: 20,
          name: '模型合集',
          models: [{ name: 'claude-test', platform: 'composite', pricing: tokenPricing, official_pricing: null }],
        }),
        plazaGroup({
          id: 21,
          name: '专属分组',
          rate_multiplier: 2,
          models: [{ name: 'claude-test', platform: 'composite', pricing: tokenPricing, official_pricing: null }],
        }),
      ],
    })

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.findAll('section.pricing-group')).toHaveLength(1)
    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
    expect(wrapper.text()).toContain('模型合集')
    expect(wrapper.text()).toContain('专属分组')
  })
})
