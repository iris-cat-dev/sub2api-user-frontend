<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import AnnouncementPopup from '@/components/common/AnnouncementPopup.vue'
import NavigationProgress from '@/components/common/NavigationProgress.vue'
import Toast from '@/components/common/Toast.vue'
import { resolveRouteDocumentTitle } from '@/router/title'
import { useAnnouncementStore, useAppStore, useAuthStore, useSubscriptionStore } from '@/stores'
import { updateFavicon } from '@/utils/branding'
import { FeatureFlags, isFeatureFlagEnabled } from '@/utils/featureFlags'
import { resolveSiteBillingMode } from '@/utils/siteBillingMode'

const router = useRouter()
const route = useRoute()
const appStore = useAppStore()
const authStore = useAuthStore()
const subscriptionStore = useSubscriptionStore()
const announcementStore = useAnnouncementStore()

function updateDocumentTitle() {
  document.title = resolveRouteDocumentTitle(
    route,
    appStore.siteName,
    appStore.cachedPublicSettings?.custom_menu_items ?? [],
    { billingMode: resolveSiteBillingMode(appStore.cachedPublicSettings) },
  )
}

watch(
  () => appStore.siteLogo,
  (newLogo) => {
    if (newLogo) updateFavicon(newLogo)
  },
  { immediate: true },
)

watch(
  [
    () => route.fullPath,
    () => route.meta.title,
    () => route.meta.titleKey,
    () => appStore.siteName,
    () => appStore.cachedPublicSettings?.custom_menu_items,
    () => appStore.cachedPublicSettings?.subscription_enabled,
    () => appStore.cachedPublicSettings?.payment_balance_disabled,
  ],
  updateDocumentTitle,
  { deep: true },
)

function onVisibilityChange() {
  if (document.visibilityState === 'visible' && authStore.isAuthenticated) {
    announcementStore.fetchAnnouncements()
  }
}

const subscriptionFeatureEnabled = computed(() => isFeatureFlagEnabled(FeatureFlags.subscription))

function startSubscriptionSync() {
  subscriptionStore.fetchActiveSubscriptions().catch((error) => {
    console.error('Failed to preload subscriptions:', error)
  })
  subscriptionStore.startPolling()
}

watch(subscriptionFeatureEnabled, (enabled) => {
  if (!authStore.isAuthenticated) return
  if (enabled) startSubscriptionSync()
  else subscriptionStore.clear()
})

watch(
  () => authStore.isAuthenticated,
  (isAuthenticated, oldValue) => {
    if (isAuthenticated) {
      if (subscriptionFeatureEnabled.value) startSubscriptionSync()
      if (oldValue === false) setTimeout(() => announcementStore.fetchAnnouncements(true), 3000)
      else announcementStore.fetchAnnouncements()
      document.addEventListener('visibilitychange', onVisibilityChange)
    } else {
      subscriptionStore.clear()
      announcementStore.reset()
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  },
  { immediate: true },
)

router.afterEach(() => {
  if (authStore.isAuthenticated) announcementStore.fetchAnnouncements()
})

onMounted(async () => {
  if (!appStore.publicSettingsLoaded) await appStore.fetchPublicSettings()
  updateDocumentTitle()
})

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisibilityChange)
})
</script>

<template>
  <NavigationProgress />
  <RouterView />
  <Toast />
  <AnnouncementPopup />
</template>
