import { createPinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import AvailableChannelsTable from '../AvailableChannelsTable.vue'
import type { UserAvailableChannel } from '@/api/channels'
import type * as VueI18n from 'vue-i18n'

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof VueI18n>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key }),
  }
})

const rows: UserAvailableChannel[] = [
  {
    name: 'Primary channel',
    description: 'Fast and reliable access',
    platforms: [
      {
        platform: 'anthropic',
        groups: [
          {
            id: 1,
            name: 'Exclusive Pro',
            platform: 'anthropic',
            subscription_type: 'standard',
            rate_multiplier: 1.2,
            peak_rate_enabled: true,
            peak_start: '08:00',
            peak_end: '10:00',
            peak_rate_multiplier: 1.5,
            is_exclusive: true,
          },
          {
            id: 2,
            name: 'Public',
            platform: 'anthropic',
            subscription_type: 'standard',
            rate_multiplier: 1,
            peak_rate_enabled: false,
            peak_start: '',
            peak_end: '',
            peak_rate_multiplier: 1,
            is_exclusive: false,
          },
        ],
        supported_models: [{ name: 'claude-test', platform: 'anthropic', pricing: null }],
      },
    ],
  },
]

const baseProps = {
  rows,
  loading: false,
  userGroupRates: { 1: 0.8 },
}

function mountTable(props = {}) {
  return mount(AvailableChannelsTable, {
    props: { ...baseProps, ...props },
    global: {
      plugins: [createPinia()],
      stubs: {
        Icon: { props: ['name'], template: '<i :data-icon="name" />' },
        PlatformIcon: { template: '<i data-platform-icon />' },
        GroupBadge: {
          props: ['name', 'rateMultiplier', 'userRateMultiplier'],
          template:
            '<span data-group-badge>{{ name }}:{{ rateMultiplier }}:{{ userRateMultiplier }}</span>',
        },
        SupportedModelChip: {
          props: ['model'],
          template: '<span data-model-chip>{{ model.name }}</span>',
        },
      },
    },
  })
}

describe('AvailableChannelsTable responsive surfaces', () => {
  it('renders user channel details in the desktop table', () => {
    const wrapper = mountTable()
    const desktop = wrapper.get('[data-testid="desktop-channels"]')

    expect(desktop.findAll('thead th')).toHaveLength(5)
    expect(desktop.text()).toContain('availableChannels.columns.name')
    expect(desktop.text()).toContain('Primary channel')
    expect(desktop.text()).toContain('Fast and reliable access')
    expect(desktop.findAll('[data-group-badge]')).toHaveLength(2)
    expect(desktop.get('[data-model-chip]').text()).toBe('claude-test')
  })

  it('renders groups, peak rates, and models in the mobile surface', () => {
    const wrapper = mountTable()
    const mobile = wrapper.get('[data-testid="mobile-channels"]')

    expect(mobile.text()).toContain('Primary channel')
    expect(mobile.text()).toContain('Fast and reliable access')
    expect(mobile.text()).toContain('availableChannels.columns.groups')
    expect(mobile.text()).toContain('availableChannels.columns.supportedModels')
    expect(mobile.text()).toContain('availableChannels.exclusive')
    expect(mobile.text()).toContain('availableChannels.public')
    expect(mobile.get('[data-group-badge]').text()).toBe('Exclusive Pro:1.2:0.8')
    expect(mobile.findAll('[data-group-badge]')).toHaveLength(2)
    expect(mobile.get('[data-icon="clock"]')).toBeTruthy()
    expect(mobile.text()).toContain('08:00')
    expect(mobile.text()).toContain('10:00')
    expect(mobile.text()).toContain('×1.5')
    expect(mobile.get('[data-model-chip]').text()).toBe('claude-test')
  })

  it('keeps the mobile placeholders when a platform has no groups or models', () => {
    const wrapper = mountTable({
      rows: [
        {
          name: 'Fallback channel',
          description: '',
          platforms: [{ platform: 'openai', groups: [], supported_models: [] }],
        },
      ],
    })
    const mobile = wrapper.get('[data-testid="mobile-channels"]')

    expect(mobile.text()).toContain('Fallback channel')
    expect(mobile.text()).toContain('openai')
    expect(mobile.text()).toContain('availableChannels.noModels')
    expect(mobile.findAll('dd')[0].text()).toBe('-')
  })

  it('provides loading and empty states on both responsive surfaces', async () => {
    const wrapper = mountTable({ loading: true, rows: [] })

    expect(wrapper.get('[data-testid="desktop-channels"] [data-icon="refresh"]')).toBeTruthy()
    expect(wrapper.get('[data-testid="mobile-loading"] [data-icon="refresh"]')).toBeTruthy()

    await wrapper.setProps({ loading: false })

    expect(wrapper.get('[data-testid="desktop-channels"]').text()).toContain('availableChannels.empty')
    expect(wrapper.get('[data-testid="mobile-empty"]').text()).toContain('availableChannels.empty')
  })
})
