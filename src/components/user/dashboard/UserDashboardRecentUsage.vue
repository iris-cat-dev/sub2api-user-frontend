<template>
  <section class="dash-card h-full overflow-hidden">
    <header class="flex items-center justify-between border-b border-[#192747] px-4 py-4 sm:px-5">
      <div>
        <p class="dash-eyebrow">{{ t('dashboard.last7Days') }}</p>
        <h2 class="mt-1 text-sm font-semibold text-white">{{ t('dashboard.recentUsage') }}</h2>
      </div>
      <router-link to="/usage" class="text-xs font-semibold text-fuchsia-300 transition-colors hover:text-fuchsia-200">
        {{ t('dashboard.viewAllUsage') }}
      </router-link>
    </header>
    <div class="p-3 sm:p-4">
      <div v-if="loading" class="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
      <div v-else-if="data.length === 0" class="py-8">
        <EmptyState :title="t('dashboard.noUsageRecords')" :description="t('dashboard.startUsingApi')" />
      </div>
      <div v-else class="dash-usage-list">
        <div v-for="log in data" :key="log.id" class="dash-usage-row">
          <div class="flex min-w-0 items-center gap-3">
            <div class="dash-row-icon">
              <Icon name="beaker" size="sm" />
            </div>
            <div class="min-w-0">
              <p class="truncate text-sm font-medium text-slate-100">{{ log.model }}</p>
              <p class="mt-0.5 text-[11px] text-slate-500">{{ formatDateTime(log.created_at) }}</p>
            </div>
          </div>
          <div class="shrink-0 text-right">
            <p class="text-sm font-semibold text-fuchsia-300">
              <span :title="t('dashboard.actual')">¥{{ formatCost(log.actual_cost) }}</span>
              <span class="font-normal text-slate-600" :title="t('dashboard.standard')"> / ¥{{ formatCost(log.total_cost) }}</span>
            </p>
            <p class="mt-0.5 text-[11px] text-slate-500">{{ (log.input_tokens + log.output_tokens).toLocaleString() }} tokens</p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import Icon from '@/components/icons/Icon.vue'
import { formatDateTime } from '@/utils/format'
import type { UsageLog } from '@/types'

defineProps<{
  data: UsageLog[]
  loading: boolean
}>()
const { t } = useI18n()
const formatCost = (c: number) => c.toFixed(4)
</script>
