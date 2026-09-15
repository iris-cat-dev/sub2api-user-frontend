<template>
  <article class="token-trend-card dash-card relative h-full min-h-[360px] overflow-hidden p-4 sm:p-5">
    <div class="mb-5 flex items-start justify-between gap-3">
      <div>
        <p class="dash-eyebrow">{{ t('dashboard.requests') }}</p>
        <h2 class="token-trend-title mt-1 text-sm font-semibold">{{ t('dashboard.tokenUsageTrend') }}</h2>
      </div>
      <span class="dash-chart-total">{{ totalRequests.toLocaleString() }}</span>
    </div>
    <div v-if="loading" class="flex h-[290px] items-center justify-center">
      <LoadingSpinner />
    </div>
    <div v-else-if="trendData.length > 0 && chartData" class="h-[290px]">
      <Line :data="chartData" :options="lineOptions" />
    </div>
    <div v-else class="flex h-[290px] items-center justify-center text-sm text-slate-500">
      {{ t('dashboard.noDataAvailable') }}
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  type ChartOptions,
  type TooltipItem,
} from 'chart.js'
import { Line } from 'vue-chartjs'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import type { TrendDataPoint } from '@/types'
import { useAppStore } from '@/stores/app'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

const { t } = useI18n()
const appStore = useAppStore()
const props = defineProps<{
  trendData: TrendDataPoint[]
  loading?: boolean
}>()

const totalRequests = computed(() => props.trendData.reduce((sum, point) => sum + point.requests, 0))
const chartData = computed(() => {
  if (!props.trendData.length) return null
  return {
    labels: props.trendData.map((point) => point.date),
    datasets: [
      {
        label: 'Input',
        data: props.trendData.map((point) => point.input_tokens),
        borderColor: '#6d5dfc',
        backgroundColor: '#6d5dfc',
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0.35,
        yAxisID: 'y',
      },
      {
        label: 'Output',
        data: props.trendData.map((point) => point.output_tokens),
        borderColor: '#0ea5e9',
        backgroundColor: '#0ea5e9',
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0.35,
        yAxisID: 'y',
      },
      {
        label: 'Cache Creation',
        data: props.trendData.map((point) => point.cache_creation_tokens),
        borderColor: '#a855f7',
        backgroundColor: '#a855f7',
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0.35,
        yAxisID: 'y',
      },
      {
        label: 'Cache Read',
        data: props.trendData.map((point) => point.cache_read_tokens),
        borderColor: '#22d3ee',
        backgroundColor: '#22d3ee',
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0.35,
        yAxisID: 'y',
      },
      {
        label: 'Cache Hit Rate',
        data: props.trendData.map((point) => {
          const totalPromptTokens = point.input_tokens + point.cache_read_tokens + point.cache_creation_tokens
          return totalPromptTokens > 0 ? (point.cache_read_tokens / totalPromptTokens) * 100 : 0
        }),
        yAxisID: 'yPercent',
        borderColor: '#ec4899',
        backgroundColor: '#ec4899',
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0.35,
      },
    ],
  }
})

const lineOptions = computed<ChartOptions<'line'>>(() => {
  const dark = appStore.isDark
  const textColor = dark ? '#8f9bb8' : '#667085'
  const axisColor = dark ? '#71809f' : '#7b879b'

  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
      mode: 'index',
    },
    plugins: {
      legend: {
        position: 'top',
        align: 'start',
        labels: {
          color: textColor,
          usePointStyle: true,
          pointStyle: 'circle',
          boxWidth: 6,
          boxHeight: 6,
          padding: 14,
          font: { size: 10 },
        },
      },
      tooltip: {
        backgroundColor: dark ? '#111b3b' : '#ffffff',
        borderColor: dark ? '#293966' : '#dfe4ef',
        borderWidth: 1,
        titleColor: dark ? '#ffffff' : '#172033',
        bodyColor: dark ? '#cbd5e1' : '#52617a',
        callbacks: {
          label: (context: TooltipItem<'line'>) => {
            const value = Number(context.raw)
            if (context.dataset.yAxisID === 'yPercent') {
              return `${context.dataset.label}: ${value.toFixed(1)}%`
            }
            return `${context.dataset.label}: ${formatTokens(value)}`
          },
          footer: (items: TooltipItem<'line'>[]) => {
            const point = props.trendData[items[0]?.dataIndex]
            return point
              ? `Actual: ¥${formatCost(point.actual_cost)} | Standard: ¥${formatCost(point.cost)}`
              : ''
          },
        },
      },
    },
    scales: {
      x: {
        border: { display: false },
        grid: { display: false },
        ticks: {
          color: axisColor,
          font: { size: 10 },
          maxRotation: 0,
        },
      },
      y: {
        border: { display: false },
        grid: { color: dark ? 'rgba(113, 128, 159, 0.12)' : 'rgba(148, 163, 184, 0.2)' },
        ticks: {
          color: axisColor,
          font: { size: 10 },
          callback: (value) => formatTokens(Number(value)),
        },
      },
      yPercent: {
        position: 'right',
        min: 0,
        max: 100,
        border: { display: false },
        grid: { drawOnChartArea: false },
        ticks: {
          color: '#ec4899',
          font: { size: 10 },
          callback: (value) => `${value}%`,
        },
      },
    },
  }
})

function formatTokens(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`
  return value.toLocaleString()
}

function formatCost(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(2)}K`
  if (value >= 1) return value.toFixed(2)
  if (value >= 0.01) return value.toFixed(3)
  return value.toFixed(4)
}
</script>

<style scoped>
.token-trend-title {
  color: #172033;
}

:global(.dark .token-trend-title) {
  color: #ffffff;
}

:global(html:not(.dark) .token-trend-card) {
  border-color: #e0e5ef;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 14px 36px rgba(41, 55, 82, 0.08);
}
</style>
