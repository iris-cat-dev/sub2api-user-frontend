import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import type * as VueI18n from 'vue-i18n'

import GroupDistributionChart from '../GroupDistributionChart.vue'

const messages: Record<string, string> = {
  'dashboard.groupDistribution': 'Group Distribution',
  'dashboard.group': 'Group',
  'dashboard.noGroup': 'No Group',
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

const groupStats = [
  { group_id: 1, group_name: 'group-a', requests: 9, total_tokens: 1200, cost: 1.8, actual_cost: 0.1 },
  { group_id: 2, group_name: 'group-b', requests: 4, total_tokens: 600, cost: 0.7, actual_cost: 0.9 },
]

function chartData(wrapper: ReturnType<typeof mount>) {
  return JSON.parse(wrapper.get('.chart-data').text())
}

describe('GroupDistributionChart', () => {
  it('ranks and charts groups by tokens by default', () => {
    const wrapper = mount(GroupDistributionChart, { props: { groupStats } })

    expect(chartData(wrapper).labels).toEqual(['group-a', 'group-b'])
    expect(chartData(wrapper).datasets[0].data).toEqual([1200, 600])
    expect(wrapper.findAll('tbody tr').map((row) => row.find('td').text())).toEqual(['group-a', 'group-b'])
  })

  it('ranks and charts groups by actual user cost when selected', () => {
    const wrapper = mount(GroupDistributionChart, { props: { groupStats, metric: 'actual_cost' } })

    expect(chartData(wrapper).labels).toEqual(['group-b', 'group-a'])
    expect(chartData(wrapper).datasets[0].data).toEqual([0.9, 0.1])
    expect(wrapper.findAll('tbody tr').map((row) => row.find('td').text())).toEqual(['group-b', 'group-a'])
  })

  it('emits metric changes from the visible toggle', async () => {
    const wrapper = mount(GroupDistributionChart, {
      props: { groupStats, showMetricToggle: true },
    })

    await wrapper.findAll('button')[1].trigger('click')
    expect(wrapper.emitted('update:metric')).toEqual([['actual_cost']])
  })
})
