<template>
  <section class="space-y-5">
    <div class="dash-card dash-toolbar">
      <div class="min-w-0">
        <p class="dash-eyebrow">{{ t('dashboard.analyticsOverview') }}</p>
        <p class="mt-1 text-sm font-semibold text-white">{{ t('dashboard.timeRange') }}</p>
      </div>
      <div class="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <DateRangePicker
          :start-date="startDate"
          :end-date="endDate"
          @update:startDate="$emit('update:startDate', $event)"
          @update:endDate="$emit('update:endDate', $event)"
          @change="$emit('dateRangeChange', $event)"
        />
        <div class="w-full sm:w-32">
          <Select
            :model-value="granularity"
            :options="[
              { value: 'day', label: t('dashboard.day') },
              { value: 'hour', label: t('dashboard.hour') },
            ]"
            @update:model-value="$emit('update:granularity', $event)"
            @change="$emit('granularityChange')"
          />
        </div>
        <button class="dash-refresh justify-center" type="button" :disabled="loading" @click="$emit('refresh')">
          {{ t('common.refresh') }}
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-5 xl:grid-cols-12">
      <article class="dash-card relative overflow-hidden p-4 sm:p-5 xl:col-span-5">
        <div v-if="loading" class="absolute inset-0 z-10 flex items-center justify-center bg-[#09112b]/75 backdrop-blur-sm">
          <LoadingSpinner size="md" />
        </div>
        <div class="mb-4 flex items-start justify-between gap-3">
          <div>
            <p class="dash-eyebrow">{{ t('dashboard.tokens') }}</p>
            <h2 class="mt-1 text-sm font-semibold text-white">{{ t('dashboard.modelDistribution') }}</h2>
          </div>
          <span class="dash-chart-total">{{ formatTokens(totalModelTokens) }}</span>
        </div>

        <div class="grid min-h-[280px] grid-cols-1 items-center gap-5 sm:grid-cols-[minmax(180px,0.8fr)_minmax(0,1.2fr)]">
          <div class="relative mx-auto h-56 w-full max-w-64">
            <Doughnut v-if="modelData" :data="modelData" :options="doughnutOptions" />
            <div v-else class="flex h-full items-center justify-center text-sm text-slate-500">
              {{ t('dashboard.noDataAvailable') }}
            </div>
            <div v-if="modelData" class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span class="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{{ t('dashboard.tokens') }}</span>
              <strong class="mt-1 text-2xl tracking-tight text-white">{{ formatTokens(totalModelTokens) }}</strong>
            </div>
          </div>

          <div class="max-h-64 min-w-0 overflow-auto">
            <table class="w-full min-w-[430px] text-xs">
              <thead class="sticky top-0 bg-[#0b1531] text-slate-500">
                <tr>
                  <th class="pb-2 text-left font-medium">{{ t('dashboard.model') }}</th>
                  <th class="pb-2 text-right font-medium">{{ t('dashboard.requests') }}</th>
                  <th class="pb-2 text-right font-medium">{{ t('dashboard.tokens') }}</th>
                  <th class="pb-2 text-right font-medium">{{ t('dashboard.actual') }}</th>
                  <th class="pb-2 text-right font-medium">{{ t('dashboard.standard') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="model in models" :key="model.model" class="border-t border-[#192747]">
                  <td class="max-w-32 truncate py-2 font-medium text-slate-200" :title="model.model">{{ model.model }}</td>
                  <td class="py-2 text-right text-slate-400">{{ formatNumber(model.requests) }}</td>
                  <td class="py-2 text-right text-slate-400">{{ formatTokens(model.total_tokens) }}</td>
                  <td class="py-2 text-right font-mono text-fuchsia-300" :title="`${t('dashboard.standard')}: ¥${formatCost(model.cost)}`">
                    ¥{{ formatCost(model.actual_cost) }}
                  </td>
                  <td class="py-2 text-right font-mono text-slate-500">¥{{ formatCost(model.cost) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </article>

      <div class="min-w-0 xl:col-span-7">
        <TokenUsageTrend :trend-data="trend" :loading="loading" />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Doughnut } from 'vue-chartjs'
import {
  ArcElement,
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
} from 'chart.js'
import DateRangePicker from '@/components/common/DateRangePicker.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import Select from '@/components/common/Select.vue'
import TokenUsageTrend from '@/components/charts/TokenUsageTrend.vue'
import type { ModelStat, TrendDataPoint } from '@/types'
import { useAppStore } from '@/stores/app'
import {
  formatCostFixed as formatCost,
  formatNumberLocaleString as formatNumber,
  formatTokensK as formatTokens,
} from '@/utils/format'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Title, Tooltip, Legend, Filler)

const props = defineProps<{
  loading: boolean
  startDate: string
  endDate: string
  granularity: string
  trend: TrendDataPoint[]
  models: ModelStat[]
}>()

defineEmits([
  'update:startDate',
  'update:endDate',
  'update:granularity',
  'dateRangeChange',
  'granularityChange',
  'refresh',
])

const { t } = useI18n()
const appStore = useAppStore()
const chartColors = ['#d946ef', '#6d5dfc', '#0ea5e9', '#22d3ee', '#8b5cf6', '#ec4899', '#3b82f6', '#14b8a6']
const totalModelTokens = computed(() => props.models.reduce((sum, model) => sum + model.total_tokens, 0))
const modelData = computed(() => {
  if (!props.models.length) return null
  return {
    labels: props.models.map((model) => model.model),
    datasets: [{
      data: props.models.map((model) => model.total_tokens),
      backgroundColor: props.models.map((_, index) => chartColors[index % chartColors.length]),
      borderWidth: 0,
      hoverOffset: 3,
    }],
  }
})

const doughnutOptions = computed<ChartOptions<'doughnut'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  cutout: '74%',
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: appStore.isDark ? '#111b3b' : '#ffffff',
      borderColor: appStore.isDark ? '#293966' : '#dfe4ef',
      borderWidth: 1,
      titleColor: appStore.isDark ? '#ffffff' : '#172033',
      bodyColor: appStore.isDark ? '#cbd5e1' : '#52617a',
      callbacks: {
        label: (context) => `${context.label}: ${formatTokens(context.parsed)} tokens`,
      },
    },
  },
}))
</script>
