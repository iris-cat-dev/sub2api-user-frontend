<template>
  <div :class="flat ? '' : 'card overflow-hidden'">
    <div
      v-if="showIpGeoToolbar"
      class="flex items-center justify-end gap-2 border-b border-gray-200 px-4 py-2 dark:border-dark-700"
    >
      <span v-if="pendingIpCount > 0" class="text-xs text-gray-500 dark:text-gray-400">
        {{ t('usage.ipGeo.pending', { count: pendingIpCount }) }}
      </span>
      <button
        type="button"
        class="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-primary-600 transition-colors hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-primary-400 dark:hover:bg-primary-900/30"
        :disabled="ipGeoBatchLoading || pendingIpCount === 0"
        @click="handleBatchFetchIpGeo"
      >
        {{ ipGeoBatchLoading ? t('usage.ipGeo.batchFetching') : t('usage.ipGeo.batchFetch') }}
      </button>
    </div>

    <div class="overflow-auto">
      <DataTable
        :columns="columns"
        :data="data"
        :loading="loading"
        :server-side-sort="serverSideSort"
        :default-sort-key="defaultSortKey"
        :default-sort-order="defaultSortOrder"
        @sort="(key, order) => emit('sort', key, order)"
      >
        <template #cell-api_key="{ row }">
          <span class="text-sm text-gray-900 dark:text-white">{{ row.api_key?.name || '-' }}</span>
        </template>

        <template #cell-model="{ row }">
          <span class="break-all text-sm font-medium text-gray-900 dark:text-white">{{ row.model }}</span>
        </template>

        <template #cell-reasoning_effort="{ row }">
          <span class="text-sm text-gray-900 dark:text-white">{{ formatReasoningEffort(row.reasoning_effort) }}</span>
        </template>

        <template #cell-endpoint="{ row }">
          <span class="block max-w-[320px] break-all text-xs text-gray-700 dark:text-gray-300">
            {{ row.inbound_endpoint?.trim() || '-' }}
          </span>
        </template>

        <template #cell-group="{ row }">
          <span v-if="row.group" class="inline-flex rounded bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
            {{ row.group.name }}
          </span>
          <span v-else class="text-sm text-gray-400">-</span>
        </template>

        <template #cell-stream="{ row }">
          <div class="flex flex-wrap items-center gap-1">
            <span class="inline-flex rounded px-2 py-0.5 text-xs font-medium" :class="requestTypeBadgeClass(row)">
              {{ requestTypeLabel(row) }}
            </span>
            <span
              v-if="row.native_compaction_v2"
              class="inline-flex rounded bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-800 dark:bg-teal-900 dark:text-teal-200"
            >
              {{ t('usage.nativeCompactionV2') }}
            </span>
          </div>
        </template>

        <template #cell-billing_mode="{ row }">
          <span class="inline-flex rounded px-2 py-0.5 text-xs font-medium" :class="getBillingModeBadgeClass(getDisplayBillingMode(row))">
            {{ getBillingModeLabel(getDisplayBillingMode(row), t) }}
          </span>
        </template>

        <template #cell-tokens="{ row }">
          <div v-if="isImageUsage(row)" class="flex items-center gap-1.5 text-sm">
            <Icon name="sparkles" size="sm" class="text-indigo-500" />
            <span class="font-medium text-gray-900 dark:text-white">{{ row.image_count }}{{ t('usage.imageUnit') }}</span>
            <span class="text-gray-400">({{ formatImageBillingSize(row, t) }})</span>
          </div>
          <div v-else class="space-y-1 text-xs">
            <div class="flex items-center gap-3">
              <span class="inline-flex items-center gap-1">
                <Icon name="arrowDown" size="xs" class="text-emerald-500" />
                {{ row.input_tokens?.toLocaleString() || 0 }}
              </span>
              <span class="inline-flex items-center gap-1">
                <Icon name="arrowUp" size="xs" class="text-violet-500" />
                {{ row.output_tokens?.toLocaleString() || 0 }}
              </span>
            </div>
            <div v-if="row.cache_read_tokens > 0 || row.cache_creation_tokens > 0" class="flex items-center gap-3 text-gray-500">
              <span v-if="row.cache_read_tokens > 0">R {{ formatCacheTokens(row.cache_read_tokens) }}</span>
              <span v-if="row.cache_creation_tokens > 0">W {{ formatCacheTokens(row.cache_creation_tokens) }}</span>
            </div>
            <div v-if="row.image_input_tokens > 0 || row.image_output_tokens > 0" class="text-fuchsia-600 dark:text-fuchsia-400">
              {{ t('usage.imageTokens') }}: {{ (row.image_input_tokens + row.image_output_tokens).toLocaleString() }}
            </div>
          </div>
        </template>

        <template #cell-cost="{ row }">
          <div class="text-sm">
            <div class="flex items-center gap-1.5">
              <span class="font-medium text-green-600 dark:text-green-400">¥{{ row.actual_cost?.toFixed(6) || '0.000000' }}</span>
              <span
                v-if="row.long_context_billing_applied"
                class="inline-flex rounded bg-amber-100 px-1 py-px text-[10px] font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
              >x2</span>
            </div>
            <div class="text-[11px] text-gray-400">{{ t('usage.standardCost') }} ¥{{ row.total_cost?.toFixed(6) || '0.000000' }}</div>
          </div>
        </template>

        <template #cell-latency="{ row }">
          <div class="flex items-stretch gap-2">
            <span
              class="w-1 shrink-0 rounded-full"
              :class="row.first_token_ms != null
                ? ['bg-gradient-to-b from-40% to-60%', LATENCY_BAR_FROM_CLASSES[firstTokenSeverity(row.first_token_ms)], LATENCY_BAR_TO_CLASSES[durationSeverity(row.duration_ms ?? 0)]]
                : LATENCY_BAR_CLASSES[durationSeverity(row.duration_ms ?? 0)]"
              aria-hidden="true"
            />
            <div class="grid grid-cols-[max-content_max-content] items-baseline gap-x-2 gap-y-0.5 text-xs">
              <span class="text-gray-400">{{ t('usage.latencyFirstToken') }}</span>
              <span v-if="row.first_token_ms != null" class="font-medium tabular-nums" :class="LATENCY_TEXT_CLASSES[firstTokenSeverity(row.first_token_ms)]">{{ formatDuration(row.first_token_ms) }}</span>
              <span v-else class="text-gray-400">-</span>
              <span class="text-gray-400">{{ t('usage.latencyDuration') }}</span>
              <span class="font-medium tabular-nums" :class="LATENCY_TEXT_CLASSES[durationSeverity(row.duration_ms ?? 0)]">{{ formatDuration(row.duration_ms) }}</span>
            </div>
          </div>
        </template>

        <template #cell-created_at="{ value }">
          <span class="text-sm text-gray-600 dark:text-gray-400">{{ formatDateTime(value) }}</span>
        </template>

        <template #cell-request_id="{ row }">
          <div v-if="row.request_id" class="flex max-w-[160px] items-center gap-1.5">
            <span class="truncate font-mono text-xs text-gray-500" :title="row.request_id">{{ row.request_id }}</span>
            <button
              type="button"
              class="shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-700"
              :title="copiedRequestId === row.request_id ? t('keys.copied') : t('keys.copyToClipboard')"
              @click="copyRequestId(row.request_id)"
            >
              <Icon :name="copiedRequestId === row.request_id ? 'check' : 'copy'" size="sm" />
            </button>
          </div>
          <span v-else class="text-sm text-gray-400">-</span>
        </template>

        <template #cell-user_agent="{ row }">
          <span v-if="row.user_agent" class="block max-w-[320px] truncate text-sm text-gray-600 dark:text-gray-400" :title="row.user_agent">
            {{ formatUserAgent(row.user_agent) }}
          </span>
          <span v-else class="text-sm text-gray-400">-</span>
        </template>

        <template #cell-ip_address="{ row }">
          <div v-if="row.ip_address">
            <span class="font-mono text-sm text-gray-600 dark:text-gray-400">{{ row.ip_address }}</span>
            <IpGeoCell :ip="row.ip_address" />
          </div>
          <span v-else class="text-sm text-gray-400">-</span>
        </template>

        <template #empty><EmptyState :message="t('usage.noRecords')" /></template>
      </DataTable>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import DataTable from '@/components/common/DataTable.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import IpGeoCell from '@/components/common/IpGeoCell.vue'
import Icon from '@/components/icons/Icon.vue'
import { useAppStore } from '@/stores/app'
import type { UsageLog } from '@/types'
import type { Column } from '@/components/common/types'
import { formatCacheTokens } from '@/utils/formatters'
import { formatDateTime, formatReasoningEffort } from '@/utils/format'
import { formatImageBillingSize } from '@/utils/imageUsage'
import { getBillingModeBadgeClass, getBillingModeLabel, getDisplayBillingMode, isImageUsage } from '@/utils/billingMode'
import { resolveUsageRequestType } from '@/utils/usageRequestType'
import { fetchBatch, getEntry } from '@/utils/ipGeoLookup'
import {
  LATENCY_BAR_CLASSES,
  LATENCY_BAR_FROM_CLASSES,
  LATENCY_BAR_TO_CLASSES,
  LATENCY_TEXT_CLASSES,
  durationSeverity,
  firstTokenSeverity,
} from '@/utils/latencyHealth'

interface Props {
  data: UsageLog[]
  loading?: boolean
  columns: Column[]
  serverSideSort?: boolean
  defaultSortKey?: string
  defaultSortOrder?: 'asc' | 'desc'
  flat?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  serverSideSort: false,
  defaultSortKey: '',
  defaultSortOrder: 'asc',
  flat: false,
})
const emit = defineEmits<{
  sort: [key: string, order: 'asc' | 'desc']
  ipGeoBatchFailed: []
}>()
const { t } = useI18n()
const appStore = useAppStore()
const copiedRequestId = ref<string | null>(null)
const ipGeoBatchLoading = ref(false)

const showIpGeoToolbar = computed(() => props.columns.some((column) => column.key === 'ip_address'))
const currentPageIps = computed(() => Array.from(new Set(
  props.data.map((row) => row.ip_address).filter((ip): ip is string => Boolean(ip)),
)))
const pendingIpCount = computed(() => currentPageIps.value.filter((ip) => {
  const status = getEntry(ip).status
  return status === 'idle' || status === 'error'
}).length)

async function handleBatchFetchIpGeo() {
  ipGeoBatchLoading.value = true
  try {
    if (!await fetchBatch(currentPageIps.value)) emit('ipGeoBatchFailed')
  } finally {
    ipGeoBatchLoading.value = false
  }
}

async function copyRequestId(requestId: string) {
  try {
    await navigator.clipboard.writeText(requestId)
    copiedRequestId.value = requestId
    appStore.showSuccess(t('usage.requestIdCopied'))
    window.setTimeout(() => {
      if (copiedRequestId.value === requestId) copiedRequestId.value = null
    }, 2000)
  } catch {
    appStore.showError(t('common.copyFailed'))
  }
}

function requestTypeLabel(row: UsageLog): string {
  const requestType = resolveUsageRequestType(row)
  if (requestType === 'cyber') return t('usage.cyber')
  if (requestType === 'live') return t('usage.live')
  if (requestType === 'ws_v2') return t('usage.ws')
  if (requestType === 'stream') return t('usage.stream')
  if (requestType === 'sync') return t('usage.sync')
  return t('usage.unknown')
}

function requestTypeBadgeClass(row: UsageLog): string {
  const requestType = resolveUsageRequestType(row)
  if (requestType === 'cyber') return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
  if (requestType === 'live') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
  if (requestType === 'ws_v2') return 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200'
  if (requestType === 'stream') return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
  if (requestType === 'sync') return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
  return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
}

function formatDuration(milliseconds: number | null): string {
  if (milliseconds === null || milliseconds === undefined) return '-'
  return milliseconds < 1000 ? `${milliseconds.toFixed(0)}ms` : `${(milliseconds / 1000).toFixed(2)}s`
}

function formatUserAgent(userAgent: string): string {
  const lower = userAgent.toLowerCase()
  if (lower.includes('claude')) return 'Claude Code'
  if (lower.includes('cursor')) return 'Cursor'
  if (lower.includes('openai') || lower.includes('chatgpt')) return 'OpenAI'
  if (lower.includes('python')) return 'Python SDK'
  if (lower.includes('node')) return 'Node.js SDK'
  if (lower.includes('curl')) return 'cURL'
  return userAgent.length > 50 ? `${userAgent.slice(0, 47)}...` : userAgent
}

</script>
