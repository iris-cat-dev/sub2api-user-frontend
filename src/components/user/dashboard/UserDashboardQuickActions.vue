<template>
  <section class="dash-card h-full overflow-hidden">
    <header class="border-b border-[#192747] px-4 py-4 sm:px-5">
      <p class="dash-eyebrow">{{ t('dashboard.quickActions') }}</p>
      <h2 class="mt-1 text-sm font-semibold text-white">{{ t('dashboard.getStarted') }}</h2>
    </header>
    <div class="space-y-2 p-3 sm:p-4">
      <button type="button" class="dash-action group" @click="router.push('/keys')">
        <span class="dash-action-icon text-fuchsia-300">
          <Icon name="key" size="md" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block text-sm font-medium text-slate-100">{{ t('dashboard.createApiKey') }}</span>
          <span class="mt-0.5 block truncate text-xs text-slate-500">{{ t('dashboard.generateNewKey') }}</span>
        </span>
        <Icon name="chevronRight" size="sm" class="text-slate-600 transition-colors group-hover:text-fuchsia-300" />
      </button>

      <button type="button" class="dash-action group" @click="router.push('/usage')">
        <span class="dash-action-icon text-cyan-300">
          <Icon name="chart" size="md" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block text-sm font-medium text-slate-100">{{ t('dashboard.viewUsage') }}</span>
          <span class="mt-0.5 block truncate text-xs text-slate-500">{{ t('dashboard.checkDetailedLogs') }}</span>
        </span>
        <Icon name="chevronRight" size="sm" class="text-slate-600 transition-colors group-hover:text-cyan-300" />
      </button>

      <button v-if="canUseBatchImage" type="button" class="dash-action group" @click="router.push('/batch-image')">
        <span class="dash-action-icon text-blue-300">
          <Icon name="sparkles" size="md" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block text-sm font-medium text-slate-100">{{ t('dashboard.batchImageAgent') }}</span>
          <span class="mt-0.5 block truncate text-xs text-slate-500">{{ t('dashboard.batchImageAgentDesc') }}</span>
        </span>
        <Icon name="chevronRight" size="sm" class="text-slate-600 transition-colors group-hover:text-blue-300" />
      </button>

      <button type="button" class="dash-action group" @click="router.push('/redeem')">
        <span class="dash-action-icon text-violet-300">
          <Icon name="gift" size="md" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block text-sm font-medium text-slate-100">{{ t('dashboard.redeemCode') }}</span>
          <span class="mt-0.5 block truncate text-xs text-slate-500">{{ t('dashboard.addBalanceWithCode') }}</span>
        </span>
        <Icon name="chevronRight" size="sm" class="text-slate-600 transition-colors group-hover:text-violet-300" />
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import { useBatchImageAccess } from '@/composables/useBatchImageAccess'
const router = useRouter()
const { t } = useI18n()
const { canUseBatchImage, refreshBatchImageAccess } = useBatchImageAccess()

onMounted(() => {
  void refreshBatchImageAccess()
})
</script>
