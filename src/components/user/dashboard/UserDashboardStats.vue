<template>
  <section class="space-y-5">
    <div
      class="grid grid-cols-1 gap-4 sm:grid-cols-2"
      :class="isSimple ? 'xl:grid-cols-4' : 'xl:grid-cols-5'"
    >
      <article v-if="!isSimple" class="dash-card dash-stat-card">
        <div class="dash-stat-icon text-fuchsia-300">
          <Icon name="dollar" size="md" :stroke-width="1.8" />
        </div>
        <div class="min-w-0">
          <p class="dash-stat-label">{{ t('dashboard.balance') }}</p>
          <p class="dash-stat-value">¥{{ formatBalance(balance) }}</p>
          <p class="dash-stat-meta text-emerald-400">{{ t('common.available') }}</p>
        </div>
      </article>

      <article class="dash-card dash-stat-card" data-testid="discount-card">
        <div class="dash-stat-icon text-emerald-300">
          <Icon name="calculator" size="md" :stroke-width="1.8" />
        </div>
        <div class="min-w-0">
          <p class="dash-stat-label">{{ t('dashboard.discount') }}</p>
          <p class="dash-stat-value">{{ effectiveDiscountMultiplier.toFixed(2) }}x</p>
          <p class="dash-stat-meta text-emerald-400">
            {{ t('dashboard.discountAppliesAllChannels') }}
          </p>
        </div>
      </article>

      <article class="dash-card dash-stat-card">
        <div class="dash-stat-icon text-cyan-300">
          <Icon name="key" size="md" :stroke-width="1.8" />
        </div>
        <div class="min-w-0">
          <p class="dash-stat-label">{{ t('dashboard.apiKeys') }}</p>
          <p class="dash-stat-value">{{ stats?.total_api_keys || 0 }}</p>
          <p class="dash-stat-meta">
            <span class="dash-status-dot"></span>
            {{ stats?.active_api_keys || 0 }} {{ t('common.active') }}
          </p>
        </div>
      </article>

      <article class="dash-card dash-stat-card">
        <div class="dash-stat-icon text-blue-300">
          <Icon name="chart" size="md" :stroke-width="1.8" />
        </div>
        <div class="min-w-0">
          <p class="dash-stat-label">{{ t('dashboard.todayRequests') }}</p>
          <p class="dash-stat-value">{{ formatNumber(stats?.today_requests || 0) }}</p>
          <p class="dash-stat-meta">{{ t('common.total') }}: {{ formatNumber(stats?.total_requests || 0) }}</p>
        </div>
      </article>

      <article class="dash-card dash-stat-card">
        <div class="dash-stat-icon text-violet-300">
          <Icon name="bolt" size="md" :stroke-width="1.8" />
        </div>
        <div class="min-w-0">
          <p class="dash-stat-label">{{ t('dashboard.todayCost') }}</p>
          <p class="dash-stat-value">
            <span :title="t('dashboard.actual')">¥{{ formatCost(stats?.today_actual_cost || 0) }}</span>
            <span class="text-sm font-normal text-slate-500" :title="t('dashboard.standard')">
              / ¥{{ formatCost(stats?.today_cost || 0) }}
            </span>
          </p>
          <p class="dash-stat-meta">
            {{ t('common.total') }}:
            <span :title="t('dashboard.actual')">¥{{ formatCost(stats?.total_actual_cost || 0) }}</span>
            <span class="text-slate-600" :title="t('dashboard.standard')"> / ¥{{ formatCost(stats?.total_cost || 0) }}</span>
          </p>
        </div>
      </article>
    </div>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <article class="dash-card dash-secondary-stat">
        <div>
          <p class="dash-stat-label">{{ t('dashboard.todayTokens') }}</p>
          <p class="dash-secondary-value">{{ formatTokens(stats?.today_tokens || 0) }}</p>
        </div>
        <div class="dash-mini-breakdown">
          <span>{{ t('dashboard.input') }} <b>{{ formatTokens(stats?.today_input_tokens || 0) }}</b></span>
          <span>{{ t('dashboard.output') }} <b>{{ formatTokens(stats?.today_output_tokens || 0) }}</b></span>
          <span>{{ t('dashboard.cache') }} <b>{{ formatTokens((stats?.today_cache_creation_tokens || 0) + (stats?.today_cache_read_tokens || 0)) }}</b></span>
        </div>
      </article>

      <article class="dash-card dash-secondary-stat">
        <div>
          <p class="dash-stat-label">{{ t('dashboard.totalTokens') }}</p>
          <p class="dash-secondary-value">{{ formatTokens(stats?.total_tokens || 0) }}</p>
        </div>
        <div class="dash-mini-breakdown">
          <span>{{ t('dashboard.input') }} <b>{{ formatTokens(stats?.total_input_tokens || 0) }}</b></span>
          <span>{{ t('dashboard.output') }} <b>{{ formatTokens(stats?.total_output_tokens || 0) }}</b></span>
          <span>{{ t('dashboard.cache') }} <b>{{ formatTokens((stats?.total_cache_creation_tokens || 0) + (stats?.total_cache_read_tokens || 0)) }}</b></span>
        </div>
      </article>

      <article class="dash-card dash-secondary-stat">
        <div>
          <p class="dash-stat-label">{{ t('dashboard.performance') }}</p>
          <p class="dash-secondary-value">{{ formatTokens(stats?.rpm || 0) }} <small>RPM</small></p>
        </div>
        <div class="dash-performance-chip">
          {{ formatTokens(stats?.tpm || 0) }} <span>TPM</span>
        </div>
      </article>

      <article class="dash-card dash-secondary-stat">
        <div>
          <p class="dash-stat-label">{{ t('dashboard.avgResponse') }}</p>
          <p class="dash-secondary-value">{{ formatDuration(stats?.average_duration_ms || 0) }}</p>
        </div>
        <div class="dash-stat-icon text-fuchsia-300">
          <Icon name="clock" size="md" :stroke-width="1.8" />
        </div>
      </article>
    </div>

    <div v-if="!isSimple && platformCards.length > 0" class="dash-card p-4 sm:p-5">
      <div class="mb-4 flex items-center justify-between gap-3">
        <div>
          <p class="dash-eyebrow">{{ t('dashboard.platformCount', { count: platformCount }) }}</p>
          <h2 class="mt-1 text-sm font-semibold text-white">{{ t('dashboard.platformBreakdown') }}</h2>
        </div>
        <div class="h-px flex-1 bg-gradient-to-r from-fuchsia-500/25 to-transparent"></div>
      </div>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article
          v-for="item in platformCards"
          :key="item.platform"
          data-testid="platform-card"
          :data-platform="item.platform"
          class="dash-platform-card"
          :class="{ 'border-dashed opacity-80': item.isOther }"
        >
          <div class="flex items-start justify-between gap-3">
            <span class="flex min-w-0 items-center gap-2.5 text-sm font-semibold text-slate-100">
              <span
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                :class="item.isOther ? 'bg-slate-500/10 text-slate-500 dark:text-slate-400' : platformBadgeLightClass(item.platform)"
              >
                <PlatformIcon v-if="!item.isOther" :platform="item.platform as GroupPlatform" size="md" />
                <Icon v-else name="globe" size="sm" />
              </span>
              <span class="truncate">{{ item.isOther ? t('dashboard.platformOther') : platformLabel(item.platform) }}</span>
            </span>
            <span class="font-mono text-sm font-semibold text-fuchsia-300" :title="t('dashboard.actual')">
              ¥{{ formatCost(item.total_actual_cost) }}
            </span>
          </div>
          <dl class="mt-4 space-y-2 text-xs">
            <div class="flex items-center justify-between gap-3">
              <dt>{{ t('dashboard.todayCost') }}</dt>
              <dd>¥{{ formatCost(item.today_actual_cost) }}</dd>
            </div>
            <div class="flex items-center justify-between gap-3">
              <dt>{{ t('dashboard.requests') }}</dt>
              <dd>{{ item.total_requests > 0 ? formatNumber(item.total_requests) : '-' }}</dd>
            </div>
            <div class="flex items-center justify-between gap-3">
              <dt>{{ t('dashboard.tokens') }}</dt>
              <dd>{{ item.total_tokens > 0 ? formatTokens(item.total_tokens) : '-' }}</dd>
            </div>
          </dl>

          <div v-if="hasAnyLimit(item.quota) && !item.isOther" class="mt-4 space-y-2.5 border-t border-[#1c2a50] pt-3">
            <p class="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              {{ t('dashboard.platformQuota.title') }}
            </p>
            <template v-for="w in (['daily', 'weekly', 'monthly'] as const)" :key="w">
              <div v-if="quotaVal(item.quota, `${w}_limit_usd`) != null" class="space-y-1">
                <template v-if="(quotaVal(item.quota, `${w}_limit_usd`) as number) === 0">
                  <div class="flex items-center justify-between gap-2 text-xs">
                    <span class="text-slate-400">{{ t(`dashboard.platformQuota.${w}`) }}</span>
                    <span class="font-mono text-rose-400">{{ t('dashboard.platformQuota.disabled') }}</span>
                  </div>
                  <div class="h-1 w-full overflow-hidden rounded-full bg-[#111c3b]">
                    <div class="h-full w-full rounded-full bg-rose-500"></div>
                  </div>
                </template>
                <template v-else>
                  <div class="flex items-center justify-between gap-2 text-xs">
                    <span class="text-slate-400">{{ t(`dashboard.platformQuota.${w}`) }}</span>
                    <span class="font-mono text-slate-200">
                      ¥{{ formatUsd((quotaVal(item.quota, `${w}_usage_usd`) as number) ?? 0) }} /
                      ¥{{ formatUsd(quotaVal(item.quota, `${w}_limit_usd`) as number) }}
                    </span>
                  </div>
                  <div class="h-1 w-full overflow-hidden rounded-full bg-[#111c3b]">
                    <div
                      class="h-full rounded-full transition-all"
                      :class="quotaBarClass(calcPercent((quotaVal(item.quota, `${w}_usage_usd`) as number) ?? 0, quotaVal(item.quota, `${w}_limit_usd`) as number))"
                      :style="{ width: calcPercent((quotaVal(item.quota, `${w}_usage_usd`) as number) ?? 0, quotaVal(item.quota, `${w}_limit_usd`) as number) + '%' }"
                    ></div>
                  </div>
                  <p v-if="quotaVal(item.quota, `${w}_window_resets_at`)" class="text-[10px] text-slate-600">
                    {{ t('dashboard.platformQuota.resetsAt', { time: formatResetTime(quotaVal(item.quota, `${w}_window_resets_at`) as string) }) }}
                  </p>
                </template>
              </div>
            </template>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import PlatformIcon from '@/components/common/PlatformIcon.vue'
import { platformBadgeLightClass } from '@/utils/platformColors'
import type { GroupPlatform, PlatformQuotaItem } from '@/types'
import type { PlatformDashboardStats, UserDashboardStats as UserStatsType } from '@/api/usage'

interface FusedPlatformCard {
  platform: string
  total_actual_cost: number
  today_actual_cost: number
  total_requests: number
  total_tokens: number
  isOther?: boolean
  quota?: PlatformQuotaItem
}

const props = defineProps<{
  stats: UserStatsType
  balance: number
  isSimple: boolean
  discountMultiplier?: number
  platformQuotas?: PlatformQuotaItem[] | null
}>()
const { t } = useI18n()

const effectiveDiscountMultiplier = computed(() => {
  const value = props.discountMultiplier ?? 1
  return value > 0 && value <= 1 ? value : 1
})

const PLATFORM_LABELS: Record<string, string> = {
  anthropic: 'Claude',
  openai: 'OpenAI',
  gemini: 'Gemini',
  antigravity: 'Antigravity',
  grok: 'Grok',
  kimi: 'Kimi',
  zhipu: 'Zhipu GLM',
  deepseek: 'DeepSeek',
  minimax: 'MiniMax',
}

const platformLabel = (p: string) => PLATFORM_LABELS[p] ?? p

// 处理"各平台之和 < 总值"的差值：后端按平台聚合时过滤了无法归属平台的行
// （group 与 account 都缺 platform）。这里把差值作为"其他"卡片显式展示，
// 避免 Row 1 总值与 Row 3 平台拆分加总对不上、用户困惑。
const OTHER_THRESHOLD = 0.0001
const platformCards = computed<FusedPlatformCard[]>(() => {
  // 建立 by_platform Map
  const byPlat = new Map<string, PlatformDashboardStats>()
  for (const item of props.stats?.by_platform ?? []) byPlat.set(item.platform, item)

  // 建立 quota Map。三档全空的记录不产生卡片，挂到卡片上也不渲染配额区。
  const byQuota = new Map<string, PlatformQuotaItem>()
  for (const q of props.platformQuotas ?? []) byQuota.set(q.platform, q)

  // 卡片集合 = 有用量的平台 ∪ 至少配置了一档限额的平台。
  // 三档全空的限额记录等价于不限额，不单独产生卡片。
  // 后端 by_platform / quota 接口均不会返回 platform='__other__'，
  // 无需显式排除；__other__ 由下方差值补差逻辑单独追加。
  const platforms = new Set<string>(byPlat.keys())
  for (const [platform, q] of byQuota) {
    if (hasAnyLimit(q)) platforms.add(platform)
  }

  const PLATFORM_ORDER = ['anthropic', 'openai', 'gemini', 'antigravity', 'grok']
  const cards: FusedPlatformCard[] = []

  for (const p of platforms) {
    const stat = byPlat.get(p)
    cards.push({
      platform: p,
      total_actual_cost: stat?.total_actual_cost ?? 0,
      today_actual_cost: stat?.today_actual_cost ?? 0,
      total_requests: stat?.total_requests ?? 0,
      total_tokens: stat?.total_tokens ?? 0,
      quota: byQuota.get(p),
    })
  }

  // 排序：按 PLATFORM_ORDER，未知平台按名称排序
  cards.sort((a, b) => {
    const ai = PLATFORM_ORDER.indexOf(a.platform)
    const bi = PLATFORM_ORDER.indexOf(b.platform)
    if (ai === -1 && bi === -1) return a.platform.localeCompare(b.platform)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })

  // __other__ 补差逻辑：只对 by_platform 有 usage 数据的总和计算
  const total = props.stats?.total_actual_cost ?? 0
  const today = props.stats?.today_actual_cost ?? 0
  const sumTotal = cards.reduce((s, c) => s + c.total_actual_cost, 0)
  const sumToday = cards.reduce((s, c) => s + c.today_actual_cost, 0)
  const diffTotal = Math.max(0, total - sumTotal)
  const diffToday = Math.max(0, today - sumToday)

  if (diffTotal > OTHER_THRESHOLD || diffToday > OTHER_THRESHOLD) {
    cards.push({
      platform: '__other__',
      total_actual_cost: diffTotal,
      today_actual_cost: diffToday,
      total_requests: 0,
      total_tokens: 0,
      isOther: true,
    })
  }

  return cards
})

// 标题右侧的平台计数 = 实际渲染的平台卡片数，不含"其他"差额卡。
const platformCount = computed(() => platformCards.value.filter((c) => !c.isOther).length)

// Quota helpers

type QuotaWindow = 'daily' | 'weekly' | 'monthly'
type QuotaField = `${QuotaWindow}_limit_usd` | `${QuotaWindow}_usage_usd` | `${QuotaWindow}_window_resets_at`

function quotaVal(q: PlatformQuotaItem | undefined, key: QuotaField): PlatformQuotaItem[QuotaField] {
  return q?.[key]
}

function hasAnyLimit(q: PlatformQuotaItem | undefined): boolean {
  if (!q) return false
  return q.daily_limit_usd != null || q.weekly_limit_usd != null || q.monthly_limit_usd != null
}

function calcPercent(usage: number, limit: number): number {
  if (!limit || limit <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((usage / limit) * 100)))
}

function quotaBarClass(p: number): string {
  if (p >= 95) return 'bg-red-500'
  if (p >= 75) return 'bg-amber-500'
  return 'bg-green-500'
}

// 与 formatBalance 一致使用 Intl.NumberFormat 做半偶舍入，避免 toFixed 在不同 JS 引擎
// 下偶发截断而非四舍五入（与后端展示精度不一致）。
const usdFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
function formatUsd(n: number): string {
  if (!Number.isFinite(n)) return '0.00'
  return usdFormatter.format(n)
}

function formatResetTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

const formatBalance = (b: number) =>
  new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(b)

const formatNumber = (n: number) => n.toLocaleString()
const formatCost = (c: number) => c.toFixed(4)
const formatTokens = (t: number) => {
  if (t >= 1_000_000) return `${(t / 1_000_000).toFixed(1)}M`
  if (t >= 1000) return `${(t / 1000).toFixed(1)}K`
  return t.toString()
}
const formatDuration = (ms: number) => ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms.toFixed(0)}ms`
</script>
