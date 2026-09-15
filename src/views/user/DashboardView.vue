<template>
  <AppLayout>
    <div class="dashboard-shell space-y-5">
      <section class="dash-page-heading">
        <div>
          <p class="dash-eyebrow">{{ t('dashboard.analyticsOverview') }}</p>
          <h1>{{ t('dashboard.title') }}</h1>
          <p>{{ t('dashboard.welcomeMessage') }}</p>
        </div>
        <button class="dash-refresh" type="button" :disabled="loading || loadingCharts" @click="refreshAll">
          <Icon name="refresh" size="sm" :class="{ 'animate-spin': loading || loadingCharts }" />
          {{ t('common.refresh') }}
        </button>
      </section>

      <div v-if="loading" class="dash-loading">
        <LoadingSpinner />
      </div>
      <template v-else-if="stats">
        <UserDashboardStats
          :stats="stats"
          :balance="user?.balance || 0"
          :is-simple="authStore.isSimpleMode"
          :platform-quotas="platformQuotas"
        />
        <UserDashboardCharts
          v-model:startDate="startDate"
          v-model:endDate="endDate"
          v-model:granularity="granularity"
          :loading="loadingCharts"
          :trend="trendData"
          :models="modelStats"
          @dateRangeChange="loadCharts"
          @granularityChange="loadCharts"
          @refresh="refreshAll"
        />
        <div class="grid grid-cols-1 gap-5 xl:grid-cols-12">
          <div class="xl:col-span-8">
            <UserDashboardRecentUsage :data="recentUsage" :loading="loadingUsage" />
          </div>
          <div class="xl:col-span-4">
            <UserDashboardQuickActions />
          </div>
        </div>
      </template>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { usageAPI, type UserDashboardStats as UserStatsType } from '@/api/usage'
import { getMyPlatformQuotas } from '@/api/user'
import AppLayout from '@/components/layout/AppLayout.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import Icon from '@/components/icons/Icon.vue'
import UserDashboardStats from '@/components/user/dashboard/UserDashboardStats.vue'
import UserDashboardCharts from '@/components/user/dashboard/UserDashboardCharts.vue'
import UserDashboardRecentUsage from '@/components/user/dashboard/UserDashboardRecentUsage.vue'
import UserDashboardQuickActions from '@/components/user/dashboard/UserDashboardQuickActions.vue'
import type { ModelStat, PlatformQuotaItem, TrendDataPoint, UsageLog } from '@/types'
import { formatDateLocalInput } from '@/utils/format'

const { t } = useI18n()
const authStore = useAuthStore()
const user = computed(() => authStore.user)
const stats = ref<UserStatsType | null>(null)
const loading = ref(false)
const loadingUsage = ref(false)
const loadingCharts = ref(false)
const trendData = ref<TrendDataPoint[]>([])
const modelStats = ref<ModelStat[]>([])
const recentUsage = ref<UsageLog[]>([])
const platformQuotas = ref<PlatformQuotaItem[] | null>(null)
const startDate = ref(formatDateLocalInput(new Date(Date.now() - 6 * 86400000)))
const endDate = ref(formatDateLocalInput(new Date()))
const granularity = ref('day')

async function loadStats() {
  loading.value = true
  try {
    await authStore.refreshUser()
    stats.value = await usageAPI.getDashboardStats()
  } catch (error) {
    console.error('Failed to load dashboard stats:', error)
  } finally {
    loading.value = false
  }
}

async function loadCharts() {
  loadingCharts.value = true
  try {
    const [trend, models] = await Promise.all([
      usageAPI.getDashboardTrend({
        start_date: startDate.value,
        end_date: endDate.value,
        granularity: granularity.value as 'day' | 'hour',
      }),
      usageAPI.getDashboardModels({
        start_date: startDate.value,
        end_date: endDate.value,
      }),
    ])
    trendData.value = trend.trend || []
    modelStats.value = models.models || []
  } catch (error) {
    console.error('Failed to load charts:', error)
  } finally {
    loadingCharts.value = false
  }
}

async function loadRecent() {
  loadingUsage.value = true
  try {
    const response = await usageAPI.getByDateRange(startDate.value, endDate.value)
    recentUsage.value = response.items.slice(0, 5)
  } catch (error) {
    console.error('Failed to load recent usage:', error)
  } finally {
    loadingUsage.value = false
  }
}

async function loadPlatformQuotas() {
  try {
    const response = await getMyPlatformQuotas()
    platformQuotas.value = response.platform_quotas ?? []
  } catch (error) {
    console.warn('Failed to load platform quotas:', error)
    platformQuotas.value = []
  }
}

function refreshAll() {
  void loadStats()
  void loadCharts()
  void loadRecent()
  void loadPlatformQuotas()
}

onMounted(() => {
  refreshAll()
})
</script>

<style>

.dashboard-shell {
  margin: 0 auto;
  max-width: 1680px;
}

.dash-page-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
}

.dash-page-heading h1 {
  margin-top: 0.25rem;
  color: #fff;
  font-size: clamp(1.45rem, 2vw, 2rem);
  font-weight: 700;
  letter-spacing: -0.03em;
}

.dash-page-heading > div > p:last-child {
  margin-top: 0.35rem;
  color: #7f8baa;
  font-size: 0.82rem;
}

.dash-eyebrow {
  color: #d946ef;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.dash-refresh {
  display: inline-flex;
  min-height: 2.5rem;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid rgba(217, 70, 239, 0.28);
  border-radius: 8px;
  padding: 0.55rem 0.85rem;
  background: rgba(217, 70, 239, 0.08);
  color: #f0abfc;
  font-size: 0.75rem;
  font-weight: 600;
  transition: border-color 160ms ease, background 160ms ease;
}

.dash-refresh:hover:not(:disabled) {
  border-color: rgba(217, 70, 239, 0.55);
  background: rgba(217, 70, 239, 0.14);
}

.dash-refresh:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.dash-card {
  border: 1px solid rgba(102, 126, 204, 0.14);
  border-radius: 10px;
  background: linear-gradient(145deg, rgba(12, 22, 52, 0.98), rgba(8, 16, 40, 0.98));
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.14);
}

.dash-stat-card {
  position: relative;
  display: flex;
  min-height: 8.2rem;
  align-items: center;
  gap: 1rem;
  overflow: hidden;
  padding: 1.15rem;
}

.dash-stat-card::after {
  position: absolute;
  top: -2.5rem;
  right: -2.5rem;
  width: 6rem;
  height: 6rem;
  border-radius: 999px;
  background: rgba(217, 70, 239, 0.09);
  content: '';
  filter: blur(18px);
}

.dash-stat-icon,
.dash-action-icon,
.dash-row-icon {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(129, 102, 255, 0.22);
  border-radius: 8px;
  background: linear-gradient(145deg, rgba(121, 74, 255, 0.2), rgba(18, 30, 66, 0.65));
}

.dash-stat-icon {
  width: 2.7rem;
  height: 2.7rem;
}

.dash-stat-label {
  color: #818dab;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.dash-stat-value {
  margin-top: 0.35rem;
  overflow: hidden;
  color: #fff;
  font-size: clamp(1.4rem, 2vw, 1.85rem);
  font-weight: 700;
  letter-spacing: -0.04em;
  line-height: 1.1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dash-stat-meta {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.45rem;
  color: #65718f;
  font-size: 0.66rem;
}

.dash-status-dot {
  width: 0.4rem;
  height: 0.4rem;
  border-radius: 999px;
  background: #34d399;
  box-shadow: 0 0 8px rgba(52, 211, 153, 0.75);
}

.dash-secondary-stat {
  display: flex;
  min-height: 6.7rem;
  align-items: center;
  justify-content: space-between;
  gap: 0.85rem;
  padding: 1rem 1.1rem;
}

.dash-secondary-value {
  margin-top: 0.3rem;
  color: #fff;
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: -0.03em;
}

.dash-secondary-value small {
  color: #697695;
  font-size: 0.62rem;
  font-weight: 600;
}

.dash-mini-breakdown {
  display: flex;
  flex-direction: column;
  gap: 0.22rem;
  color: #697695;
  font-size: 0.58rem;
  text-align: right;
}

.dash-mini-breakdown b {
  color: #b8c2da;
  font-weight: 600;
}

.dash-performance-chip,
.dash-chart-total {
  border: 1px solid rgba(34, 211, 238, 0.18);
  border-radius: 999px;
  background: rgba(34, 211, 238, 0.07);
  color: #67e8f9;
  font-size: 0.68rem;
  font-weight: 700;
  white-space: nowrap;
}

.dash-performance-chip {
  padding: 0.42rem 0.6rem;
}

.dash-performance-chip span {
  color: #65718f;
  font-size: 0.55rem;
}

.dash-chart-total {
  padding: 0.38rem 0.62rem;
}

.dash-platform-card {
  border: 1px solid rgba(95, 119, 194, 0.17);
  border-radius: 8px;
  padding: 0.9rem;
  background: rgba(8, 18, 44, 0.72);
}

.dash-platform-card dl dt {
  color: #697695;
}

.dash-platform-card dl dd {
  color: #c4cce0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.dash-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.9rem 1rem;
}

.dash-usage-row {
  position: relative;
  display: flex;
  min-height: 4.6rem;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-radius: 7px;
  padding: 0.7rem 0.6rem;
  transition: background 160ms ease;
}

.dash-usage-row + .dash-usage-row::before {
  position: absolute;
  top: 0;
  right: 0.6rem;
  left: 0.6rem;
  height: 1px;
  background: rgba(102, 126, 204, 0.14);
  content: '';
}

.dash-usage-row:hover {
  background: rgba(99, 63, 190, 0.08);
}

.dash-row-icon {
  width: 2.15rem;
  height: 2.15rem;
  color: #d8b4fe;
}

.dash-action {
  display: flex;
  width: 100%;
  min-height: 4rem;
  align-items: center;
  gap: 0.75rem;
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 0.65rem;
  text-align: left;
  transition: border-color 160ms ease, background 160ms ease;
}

.dash-action:hover {
  border-color: rgba(217, 70, 239, 0.18);
  background: rgba(117, 64, 202, 0.08);
}

.dash-action-icon {
  width: 2.45rem;
  height: 2.45rem;
}

.dash-loading {
  display: flex;
  min-height: 24rem;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(102, 126, 204, 0.14);
  border-radius: 10px;
  background: rgba(10, 18, 43, 0.72);
}

html:not(.dark) .dashboard-shell .dash-page-heading h1,
html:not(.dark) .dashboard-shell .dash-stat-value,
html:not(.dark) .dashboard-shell .dash-secondary-value,
html:not(.dark) .dashboard-shell .text-white,
html:not(.dark) .dashboard-shell .text-slate-100,
html:not(.dark) .dashboard-shell .text-slate-200 {
  color: #172033;
}

html:not(.dark) .dashboard-shell .dash-page-heading > div > p:last-child,
html:not(.dark) .dashboard-shell .dash-stat-label,
html:not(.dark) .dashboard-shell .dash-stat-meta,
html:not(.dark) .dashboard-shell .text-slate-500,
html:not(.dark) .dashboard-shell .text-slate-600 {
  color: #718096;
}

html:not(.dark) .dashboard-shell .text-slate-400 {
  color: #52617a;
}

html:not(.dark) .dashboard-shell .text-fuchsia-300 {
  color: #9333ea;
}

html:not(.dark) .dashboard-shell .dash-card {
  border-color: #e0e5ef;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 14px 36px rgba(41, 55, 82, 0.08);
}

html:not(.dark) .dashboard-shell .dash-stat-card::after {
  background: rgba(124, 58, 237, 0.08);
}

html:not(.dark) .dashboard-shell .dash-stat-icon,
html:not(.dark) .dashboard-shell .dash-action-icon,
html:not(.dark) .dashboard-shell .dash-row-icon {
  border-color: rgba(124, 58, 237, 0.16);
  background: linear-gradient(145deg, rgba(124, 58, 237, 0.1), rgba(238, 242, 255, 0.9));
}

html:not(.dark) .dashboard-shell .dash-platform-card {
  border-color: #e3e7f0;
  background: #f8faff;
}

html:not(.dark) .dashboard-shell .dash-platform-card dl dt {
  color: #718096;
}

html:not(.dark) .dashboard-shell .dash-platform-card dl dd {
  color: #344054;
}

html:not(.dark) .dashboard-shell .dash-performance-chip,
html:not(.dark) .dashboard-shell .dash-chart-total {
  border-color: rgba(14, 165, 233, 0.18);
  background: #f0f9ff;
  color: #0369a1;
}

html:not(.dark) .dashboard-shell .dash-refresh {
  border-color: rgba(124, 58, 237, 0.22);
  background: #f4f0ff;
  color: #7c3aed;
}

html:not(.dark) .dashboard-shell .dash-usage-row + .dash-usage-row::before {
  background: #e4e8f1;
}

html:not(.dark) .dashboard-shell .dash-action:hover,
html:not(.dark) .dashboard-shell .dash-usage-row:hover {
  background: #f7f5ff;
}

html:not(.dark) .dashboard-shell .dash-loading {
  border-color: #e0e5ef;
  background: rgba(255, 255, 255, 0.86);
}

html:not(.dark) .dashboard-shell [class*="border-[#"] {
  border-color: #e4e8f1;
}

html:not(.dark) .dashboard-shell [class*="bg-[#0"] {
  background: #f7f9fd;
}

@media (max-width: 639px) {
  .dash-page-heading {
    align-items: flex-start;
  }

  .dash-page-heading > div > p:last-child {
    max-width: 18rem;
  }

  .dash-refresh {
    flex-shrink: 0;
    padding-inline: 0.7rem;
  }

  .dash-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .dash-usage-row {
    align-items: flex-start;
  }

  .dash-usage-row > div:last-child {
    max-width: 9.5rem;
  }

  .dash-stat-card {
    min-height: 7.25rem;
  }
}
</style>
