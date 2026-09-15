<template>
  <div class="card p-4">
    <div class="mb-4 flex items-center justify-between gap-3">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('dashboard.modelDistribution') }}</h3>
      <div v-if="showMetricToggle" class="inline-flex rounded-lg bg-gray-100 p-1 dark:bg-dark-800">
        <button type="button" class="rounded-md px-2.5 py-1 text-xs font-medium" :class="metric === 'tokens' ? activeClass : inactiveClass" @click="emit('update:metric', 'tokens')">
          {{ t('dashboard.metricTokens') }}
        </button>
        <button type="button" class="rounded-md px-2.5 py-1 text-xs font-medium" :class="metric === 'actual_cost' ? activeClass : inactiveClass" @click="emit('update:metric', 'actual_cost')">
          {{ t('dashboard.metricActualCost') }}
        </button>
      </div>
    </div>
    <div v-if="loading" class="flex h-48 items-center justify-center"><LoadingSpinner /></div>
    <div v-else-if="displayItems.length > 0 && chartData" class="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
      <div class="h-48 w-48 shrink-0"><Doughnut :data="chartData" :options="chartOptions" /></div>
      <div class="max-h-48 w-full min-w-0 flex-1 overflow-auto">
        <table class="w-full text-xs">
          <thead>
            <tr class="text-gray-500 dark:text-gray-400">
              <th class="pb-2 text-left">{{ t('dashboard.model') }}</th>
              <th class="pb-2 text-right">{{ t('dashboard.requests') }}</th>
              <th class="pb-2 text-right">{{ t('dashboard.tokens') }}</th>
              <th class="pb-2 text-right">{{ t('dashboard.actual') }}</th>
              <th class="pb-2 text-right">{{ t('dashboard.standard') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in displayItems" :key="item.model" class="border-t border-gray-100 dark:border-dark-700">
              <td class="max-w-[130px] truncate py-1.5 font-medium text-gray-900 dark:text-white" :title="item.model">{{ item.model }}</td>
              <td class="py-1.5 text-right text-gray-600 dark:text-gray-400">{{ formatNumber(item.requests) }}</td>
              <td class="py-1.5 text-right text-gray-600 dark:text-gray-400">{{ formatNumber(item.total_tokens) }}</td>
              <td class="py-1.5 text-right text-green-600 dark:text-green-400">{{ formatCost(item.actual_cost) }}</td>
              <td class="py-1.5 text-right text-gray-500">{{ formatCost(item.cost) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <div v-else class="flex h-48 items-center justify-center text-sm text-gray-500 dark:text-gray-400">{{ t('dashboard.noDataAvailable') }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArcElement, Chart as ChartJS, Legend, Tooltip } from 'chart.js'
import type { ChartData, ChartOptions } from 'chart.js'
import { Doughnut } from 'vue-chartjs'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import type { ModelStat } from '@/types'

type DistributionMetric = 'tokens' | 'actual_cost'

const props = withDefaults(defineProps<{
  modelStats: ModelStat[]
  loading?: boolean
  metric?: DistributionMetric
  showMetricToggle?: boolean
}>(), {
  loading: false,
  metric: 'tokens',
  showMetricToggle: false,
})
const emit = defineEmits<{ 'update:metric': [value: DistributionMetric] }>()
const { t } = useI18n()
ChartJS.register(ArcElement, Tooltip, Legend)

const activeClass = 'bg-white text-gray-900 shadow-sm dark:bg-dark-700 dark:text-white'
const inactiveClass = 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
const colors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#64748b']
const displayItems = computed(() => {
  const metric = props.metric === 'actual_cost' ? 'actual_cost' : 'total_tokens'
  return [...props.modelStats].sort((left, right) => right[metric] - left[metric]).slice(0, 10)
})
const chartData = computed<ChartData<'doughnut'> | null>(() => {
  if (displayItems.value.length === 0) return null
  return {
    labels: displayItems.value.map((item) => item.model),
    datasets: [{
      data: displayItems.value.map((item) => props.metric === 'actual_cost' ? item.actual_cost : item.total_tokens),
      backgroundColor: colors,
      borderWidth: 0,
    }],
  }
})
const chartOptions: ChartOptions<'doughnut'> = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '65%',
  plugins: { legend: { display: false } },
}

function formatNumber(value: number): string {
  return Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}
function formatCost(value: number): string {
  return `¥${value.toFixed(4)}`
}
</script>
