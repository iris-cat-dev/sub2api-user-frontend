<template>
  <div
    v-if="mobileOpen"
    class="fixed inset-0 z-30 bg-[#02040f]/75 backdrop-blur-sm lg:hidden"
    aria-hidden="true"
    @click="closeMobile"
  />

  <aside
    class="app-sidebar"
    :class="[
      sidebarCollapsed ? 'app-sidebar--collapsed' : '',
      mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
    ]"
  >
    <header class="sidebar-brand">
      <router-link to="/dashboard" class="sidebar-logo" @click="closeMobile">
        <img :src="siteLogo || '/logo.svg'" alt="" class="h-full w-full object-contain" />
      </router-link>

      <div class="sidebar-expanded-only min-w-0 flex-1">
        <router-link
          to="/dashboard"
          class="block truncate text-[17px] font-bold tracking-tight text-white"
          @click="closeMobile"
        >
          {{ siteName }}
        </router-link>
        <span v-if="siteVersion" class="mt-0.5 block text-[10px] font-medium uppercase tracking-[0.16em] text-[#697596]">
          v{{ siteVersion }}
        </span>
      </div>


      <button
        type="button"
        class="sidebar-collapse sidebar-expanded-only flex lg:hidden"
        :aria-label="t('common.close')"
        @click="closeMobile"
      >
        <Icon name="x" size="sm" />
      </button>
    </header>

    <div class="sidebar-search sidebar-expanded-only">
      <Icon name="search" size="sm" class="shrink-0" />
      <input
        v-model="searchQuery"
        type="search"
        :placeholder="t('sidebar.searchPlaceholder')"
        :aria-label="t('sidebar.searchPlaceholder')"
      />
    </div>

    <nav class="sidebar-navigation" :aria-label="t('sidebar.navigation')">
      <section v-for="section in filteredSections" :key="section.id" class="sidebar-nav-section">
        <p class="sidebar-section-label sidebar-expanded-only">{{ section.label }}</p>
        <div class="space-y-1">
          <router-link
            v-for="item in section.items"
            :key="item.path"
            :to="item.path"
            class="sidebar-nav-link"
            :class="{ 'sidebar-nav-link--active': isActive(item.path) }"
            :title="sidebarCollapsed ? item.label : undefined"
            :aria-current="isActive(item.path) ? 'page' : undefined"
            :data-tour="item.path === '/keys' ? 'sidebar-my-keys' : undefined"
            @click="closeMobile"
          >
            <span class="sidebar-nav-icon">
              <span v-if="item.iconSvg" class="h-4 w-4" v-html="sanitizeSvg(item.iconSvg)" />
              <Icon v-else :name="item.icon" size="sm" />
            </span>
            <span class="sidebar-nav-label sidebar-expanded-only">{{ item.label }}</span>
            <Icon
              v-if="!isActive(item.path)"
              name="chevronRight"
              size="xs"
              class="sidebar-nav-chevron sidebar-expanded-only"
            />
          </router-link>
        </div>
      </section>

      <p v-if="filteredSections.length === 0" class="sidebar-empty sidebar-expanded-only">
        {{ t('sidebar.noResults') }}
      </p>
    </nav>

    <div class="sidebar-collapse-dock">
      <button
        type="button"
        class="sidebar-collapse hidden lg:flex"
        :aria-label="sidebarCollapsed ? t('common.expand') : t('common.collapse')"
        :title="sidebarCollapsed ? t('common.expand') : t('common.collapse')"
        @click="appStore.toggleSidebar()"
      >
        <Icon :name="sidebarCollapsed ? 'chevronRight' : 'chevronLeft'" size="sm" />
      </button>
    </div>

    <footer class="sidebar-footer">
      <router-link
        to="/profile"
        class="sidebar-account"
        :class="{ 'sidebar-account--active': isActive('/profile') }"
        :title="sidebarCollapsed ? userDisplayName : undefined"
        @click="closeMobile"
      >
        <span class="sidebar-avatar">
          <img v-if="userAvatar" :src="userAvatar" alt="" class="h-full w-full object-cover" />
          <span v-else>{{ userInitials }}</span>
        </span>
        <span class="sidebar-account-copy sidebar-expanded-only">
          <strong>{{ userDisplayName }}</strong>
          <small>{{ authStore.user?.email }}</small>
        </span>
        <Icon name="chevronRight" size="xs" class="sidebar-expanded-only text-[#697596]" />
      </router-link>
    </footer>
  </aside>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useBatchImageAccess } from '@/composables/useBatchImageAccess'
import Icon from '@/components/icons/Icon.vue'
import { useAppStore, useAuthStore } from '@/stores'
import { FeatureFlags, isFeatureFlagEnabled } from '@/utils/featureFlags'
import { resolveSiteBillingMode } from '@/utils/siteBillingMode'
import { sanitizeSvg } from '@/utils/sanitize'
import { sanitizeUrl } from '@/utils/url'

type IconName = 'grid' | 'key' | 'sparkles' | 'chart' | 'calculator' | 'server' | 'creditCard' | 'dollar' | 'document' | 'gift' | 'users' | 'user'
type NavGroup = 'workspace' | 'billing' | 'service' | 'account'

interface NavItem {
  path: string
  label: string
  icon: IconName
  group: NavGroup
  iconSvg?: string
  hideInSimpleMode?: boolean
  enabled?: boolean
}

interface NavSection {
  id: NavGroup
  label: string
  items: NavItem[]
}

const searchQuery = ref('')
const { t } = useI18n()
const route = useRoute()
const appStore = useAppStore()
const authStore = useAuthStore()
const { canUseBatchImage, refreshBatchImageAccess } = useBatchImageAccess()

const sidebarCollapsed = computed(() => appStore.sidebarCollapsed)
const mobileOpen = computed(() => appStore.mobileOpen)
const siteName = computed(() => appStore.siteName)
const siteLogo = computed(() => sanitizeUrl(appStore.siteLogo, { allowRelative: true, allowDataUrl: true }))
const siteVersion = computed(() => appStore.siteVersion)
const userDisplayName = computed(() => authStore.user?.username || authStore.user?.email || t('nav.myAccount'))
const userAvatar = computed(() => sanitizeUrl(authStore.user?.avatar_url || '', { allowRelative: true }))
const userInitials = computed(() => {
  const name = userDisplayName.value.trim()
  if (!name) return 'U'
  const words = name.split(/[\s._-]+/).filter(Boolean)
  return words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join('') || 'U'
})

const purchaseNavLabel = computed(() => {
  const mode = resolveSiteBillingMode(appStore.cachedPublicSettings)
  if (mode === 'recharge_only') return t('nav.recharge')
  if (mode === 'subscription_only') return t('nav.subscribe')
  return t('nav.buySubscription')
})

const navItems = computed<NavItem[]>(() => {
  const items: NavItem[] = [
    { path: '/dashboard', label: t('nav.dashboard'), icon: 'grid', group: 'workspace' },
    { path: '/keys', label: t('nav.apiKeys'), icon: 'key', group: 'workspace' },
    { path: '/batch-image', label: t('nav.batchImage'), icon: 'sparkles', group: 'workspace', hideInSimpleMode: true, enabled: canUseBatchImage.value },
    { path: '/usage', label: t('nav.usage'), icon: 'chart', group: 'workspace', hideInSimpleMode: true },
    { path: '/pricing', label: t('nav.modelPricing'), icon: 'calculator', group: 'workspace', hideInSimpleMode: true },
    { path: '/monitor', label: t('nav.channelStatus'), icon: 'server', group: 'workspace', enabled: isFeatureFlagEnabled(FeatureFlags.channelMonitor) },
    { path: '/subscriptions', label: t('nav.mySubscriptions'), icon: 'creditCard', group: 'billing', hideInSimpleMode: true, enabled: isFeatureFlagEnabled(FeatureFlags.subscription) },
    { path: '/purchase', label: purchaseNavLabel.value, icon: 'dollar', group: 'billing', hideInSimpleMode: true, enabled: isFeatureFlagEnabled(FeatureFlags.payment) },
    { path: '/orders', label: t('nav.myOrders'), icon: 'document', group: 'billing', hideInSimpleMode: true, enabled: isFeatureFlagEnabled(FeatureFlags.payment) },
    { path: '/redeem', label: t('nav.redeem'), icon: 'gift', group: 'billing', hideInSimpleMode: true },
    { path: '/affiliate', label: t('nav.affiliate'), icon: 'users', group: 'billing', hideInSimpleMode: true, enabled: isFeatureFlagEnabled(FeatureFlags.affiliate) },
    { path: '/profile', label: t('nav.profile'), icon: 'user', group: 'account' },
  ]

  const customItems = (appStore.cachedPublicSettings?.custom_menu_items ?? [])
    .filter((item) => item.visibility === 'user')
    .sort((left, right) => left.sort_order - right.sort_order)
    .map((item): NavItem => ({
      path: `/custom/${item.id}`,
      label: item.label,
      icon: 'document',
      iconSvg: item.icon_svg,
      group: 'service',
    }))

  return [...items, ...customItems].filter((item) => {
    if (item.enabled === false) return false
    return !(authStore.isSimpleMode && item.hideInSimpleMode)
  })
})

const filteredSections = computed<NavSection[]>(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase()
  const sectionLabels: Record<NavGroup, string> = {
    workspace: t('sidebar.workspace'),
    billing: t('sidebar.billing'),
    service: t('sidebar.service'),
    account: t('sidebar.account'),
  }

  return (['workspace', 'billing', 'service', 'account'] as const)
    .map((id) => ({
      id,
      label: sectionLabels[id],
      items: navItems.value.filter((item) => (
        item.group === id && (!query || item.label.toLocaleLowerCase().includes(query))
      )),
    }))
    .filter((section) => section.items.length > 0)
})

onMounted(() => {
  refreshBatchImageAccess()
})

function closeMobile() {
  appStore.setMobileOpen(false)
}

function isActive(path: string) {
  return route.path === path || route.path.startsWith(`${path}/`)
}

</script>

<style scoped>
.app-sidebar {
  --sidebar-bg: #ffffff;
  --sidebar-border: #dfe4ef;
  --sidebar-shadow: 18px 18px 55px rgba(48, 61, 88, 0.12);
  --sidebar-text: #52617a;
  --sidebar-text-strong: #172033;
  --sidebar-muted: #8a94a8;
  --sidebar-field: #f5f7fc;
  --sidebar-field-border: #dfe4ef;
  --sidebar-hover: #f2efff;
  --sidebar-active: #eeeafe;
  --sidebar-accent: #7c3aed;
  position: fixed;
  inset: 12px auto 12px 12px;
  z-index: 40;
  display: flex;
  width: 18rem;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--sidebar-border);
  border-radius: 22px;
  background: var(--sidebar-bg);
  box-shadow: var(--sidebar-shadow), inset 0 1px rgba(255, 255, 255, 0.8);
  transition: width 240ms ease, transform 240ms ease;
}

.sidebar-brand {
  display: flex;
  min-height: 76px;
  align-items: center;
  gap: 12px;
  padding: 0 18px;
}

.sidebar-logo {
  display: flex;
  height: 36px;
  width: 36px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 10px;
  background: linear-gradient(145deg, rgba(217, 70, 239, 0.18), rgba(14, 165, 233, 0.12));
  box-shadow: 0 0 22px rgba(217, 70, 239, 0.22);
}

.sidebar-collapse {
  height: 30px;
  width: 30px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: 7px;
  color: var(--sidebar-muted);
  transition: 160ms ease;
}

.sidebar-collapse:hover {
  border-color: rgba(217, 70, 239, 0.22);
  background: rgba(217, 70, 239, 0.08);
  color: var(--sidebar-accent);
}

.sidebar-search {
  display: flex;
  height: 42px;
  flex: 0 0 auto;
  align-items: center;
  gap: 10px;
  margin: 2px 18px 14px;
  padding: 0 12px;
  border: 1px solid var(--sidebar-field-border);
  border-radius: 6px;
  background: var(--sidebar-field);
  color: var(--sidebar-muted);
}

.sidebar-search:focus-within {
  border-color: rgba(217, 70, 239, 0.55);
  box-shadow: 0 0 0 3px rgba(217, 70, 239, 0.09);
}

.sidebar-search input {
  min-width: 0;
  width: 100%;
  height: 100%;
  border: 0 !important;
  border-radius: 0 !important;
  padding: 0 !important;
  background: transparent !important;
  color: var(--sidebar-text-strong);
  font-size: 12px;
  outline: 0 !important;
  box-shadow: none !important;
}

.sidebar-search input::placeholder {
  color: var(--sidebar-muted);
}

.sidebar-navigation {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding: 0 18px 12px;
  scrollbar-color: rgba(114, 128, 170, 0.24) transparent;
  scrollbar-width: thin;
}

.sidebar-nav-section + .sidebar-nav-section {
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid var(--sidebar-border);
}

.sidebar-section-label {
  margin: 0 10px 7px;
  color: var(--sidebar-muted);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.15em;
  text-transform: uppercase;
}

.sidebar-nav-link {
  position: relative;
  display: flex;
  min-height: 42px;
  align-items: center;
  gap: 11px;
  overflow: hidden;
  padding: 0 11px;
  border: 1px solid transparent;
  border-radius: 6px;
  color: var(--sidebar-text);
  font-size: 13px;
  font-weight: 500;
  transition: 160ms ease;
}

.sidebar-nav-link:hover {
  border-color: rgba(124, 58, 237, 0.16);
  background: var(--sidebar-hover);
  color: var(--sidebar-text-strong);
}

.app-sidebar nav a.sidebar-nav-link--active,
.app-sidebar nav a.sidebar-nav-link--active:hover {
  border-color: transparent !important;
  background: var(--sidebar-active) !important;
  color: var(--sidebar-text-strong) !important;
  box-shadow: none !important;
}

.sidebar-nav-link--active::before {
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  border-radius: 3px 0 0 3px;
  background: var(--sidebar-accent);
  box-shadow: none;
  content: '';
}

.sidebar-nav-link--active .sidebar-nav-icon {
  color: var(--sidebar-accent);
}

.sidebar-nav-icon {
  display: flex;
  height: 20px;
  width: 20px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  color: var(--sidebar-muted);
}

.sidebar-nav-label {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar-nav-chevron {
  flex: 0 0 auto;
  color: var(--sidebar-muted);
}

.sidebar-empty {
  padding: 28px 10px;
  color: var(--sidebar-muted);
  font-size: 12px;
  text-align: center;
}

.sidebar-footer {
  flex: 0 0 auto;
  padding: 12px 18px 16px;
  border-top: 1px solid var(--sidebar-border);
}

.sidebar-account {
  display: flex;
  min-height: 52px;
  align-items: center;
  gap: 11px;
  padding: 6px 9px;
  border: 1px solid transparent;
  border-radius: 8px;
  transition: 160ms ease;
}

.sidebar-account:hover,
.sidebar-account--active {
  border-color: rgba(124, 58, 237, 0.14);
  background: var(--sidebar-hover);
}

.sidebar-avatar {
  display: flex;
  height: 34px;
  width: 34px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid rgba(232, 121, 249, 0.42);
  border-radius: 50%;
  background: linear-gradient(145deg, #7c3aed, #d946ef);
  color: white;
  font-size: 11px;
  font-weight: 800;
}

.sidebar-account-copy {
  min-width: 0;
  flex: 1;
}

.sidebar-account-copy strong,
.sidebar-account-copy small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar-account-copy strong {
  color: var(--sidebar-text-strong);
  font-size: 13px;
  font-weight: 600;
}

.sidebar-account-copy small {
  margin-top: 2px;
  color: var(--sidebar-muted);
  font-size: 10px;
}

.sidebar-brand a {
  color: var(--sidebar-text-strong);
}

:global(.dark .app-sidebar) {
  --sidebar-bg: #080e29;
  --sidebar-border: rgba(102, 126, 204, 0.11);
  --sidebar-shadow: 18px 18px 55px rgba(0, 0, 0, 0.32);
  --sidebar-text: #aab5d8;
  --sidebar-text-strong: #f7f7fc;
  --sidebar-muted: #697596;
  --sidebar-field: #0d193a;
  --sidebar-field-border: #1d2d52;
  --sidebar-hover: rgba(119, 63, 255, 0.07);
  --sidebar-active: #0a1432;
  --sidebar-accent: #d946ef;
  box-shadow: var(--sidebar-shadow), inset 0 1px rgba(102, 126, 204, 0.08);
}

@media (min-width: 1024px) {
  .sidebar-collapse-dock {
    display: flex;
    flex: 0 0 auto;
    justify-content: flex-end;
    padding: 10px 18px;
    border-top: 1px solid var(--sidebar-border);
  }

  .app-sidebar--collapsed {
    width: 4.75rem;
  }

  .app-sidebar--collapsed .sidebar-expanded-only {
    display: none;
  }

  .app-sidebar--collapsed .sidebar-brand,
  .app-sidebar--collapsed .sidebar-nav-link,
  .app-sidebar--collapsed .sidebar-account {
    justify-content: center;
  }

  .app-sidebar--collapsed .sidebar-brand {
    padding: 0 10px;
  }

  .app-sidebar--collapsed .sidebar-collapse-dock {
    justify-content: center;
    padding: 10px;
  }

  .app-sidebar--collapsed .sidebar-collapse {
    border-color: var(--sidebar-field-border);
    background: var(--sidebar-field);
  }

  .app-sidebar--collapsed .sidebar-navigation {
    padding: 14px 10px 12px;
  }

  .app-sidebar--collapsed .sidebar-nav-section + .sidebar-nav-section {
    margin-top: 10px;
    padding-top: 10px;
  }

  .app-sidebar--collapsed .sidebar-footer {
    padding: 12px 10px 16px;
  }
}

@media (max-width: 1023px) {
  .app-sidebar {
    inset: 0 auto 0 0;
    width: min(18rem, calc(100vw - 24px));
    border-width: 0 1px 0 0;
    border-radius: 0 22px 22px 0;
  }
}
</style>
