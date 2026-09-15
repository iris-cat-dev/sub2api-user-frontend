import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import type * as VueI18n from 'vue-i18n'

import ModelDistributionChart from '../ModelDistributionChart.vue'

const messages: Record<string, string> = {
  'dashboard.modelDistribution': 'Model Distribution',
  'dashboard.model': 'Model',
  'dashboard.requests': 'Requests',
  'dashboard.tokens': 'Tokens',
  'dashboard.actual': 'Actual',
  'dashboard.standard': 'Standard',
  'dashboard.metricTokens': 'By Tokens',
  'dashboard.metricActualCost': 'By Actual Cost',
  'dashboard.noDataAvailable': 'No data available',
}

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof VueI18n>('vue-i18n')
  return { ...actual, useI18n: () => ({ t: (key: string) => messages[key] ?? key }) }
})

vi.mock('vue-chartjs', () => ({
  Doughnut: {
    props: ['data'],
    template: '<div class="chart-data">{{ JSON.stringify(data) }}</div>',
  },
}))

const modelStats = [
  { model: 'model-a', requests: 8, input_tokens: 100, output_tokens: 50, cache_creation_tokens: 0, cache_read_tokens: 0, total_tokens: 1000, cost: 1.5, actual_cost: 0.2 },
  { model: 'model-b', requests: 3, input_tokens: 40, output_tokens: 20, cache_creation_tokens: 0, cache_read_tokens: 0, total_tokens: 500, cost: 0.5, actual_cost: 1.4 },
]

function chartData(wrapper: ReturnType<typeof mount>) {
  return JSON.parse(wrapper.get('.chart-data').text())
}

describe('ModelDistributionChart', () => {
  it('ranks and charts models by tokens by default', () => {
    const wrapper = mount(ModelDistributionChart, { props: { modelStats } })

    expect(chartData(wrapper).labels).toEqual(['model-a', 'model-b'])
    expect(chartData(wrapper).datasets[0].data).toEqual([1000, 500])
    expect(wrapper.findAll('tbody tr').map((row) => row.find('td').text())).toEqual(['model-a', 'model-b'])
  })

  it('ranks and charts models by actual user cost when selected', () => {
    const wrapper = mount(ModelDistributionChart, { props: { modelStats, metric: 'actual_cost' } })

    expect(chartData(wrapper).labels).toEqual(['model-b', 'model-a'])
    expect(chartData(wrapper).datasets[0].data).toEqual([1.4, 0.2])
    expect(wrapper.findAll('tbody tr').map((row) => row.find('td').text())).toEqual(['model-b', 'model-a'])
  })

  it('emits metric changes from the visible toggle', async () => {
    const wrapper = mount(ModelDistributionChart, {
      props: { modelStats, showMetricToggle: true },
    })

    await wrapper.findAll('button')[1].trigger('click')
    expect(wrapper.emitted('update:metric')).toEqual([['actual_cost']])
  })
})
