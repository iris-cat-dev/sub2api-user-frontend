import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import { useNavigationLoadingState } from '@/composables/useNavigationLoading'
import { resolveRouteDocumentTitle } from './title'

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/home' },
  {
    path: '/home',
    name: 'Home',
    component: () => import('@/views/HomeView.vue'),
    meta: { requiresAuth: false, title: 'Home' },
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/auth/LoginView.vue'),
    meta: { requiresAuth: false, title: 'Login', titleKey: 'home.login' },
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/views/auth/RegisterView.vue'),
    meta: { requiresAuth: false, title: 'Register', titleKey: 'auth.createAccount' },
  },
  {
    path: '/email-verify',
    name: 'EmailVerify',
    component: () => import('@/views/auth/EmailVerifyView.vue'),
    meta: { requiresAuth: false, title: 'Verify Email' },
  },
  {
    path: '/auth/callback',
    alias: '/auth/oauth/callback',
    name: 'OAuthCallback',
    component: () => import('@/views/auth/OAuthCallbackView.vue'),
    meta: { requiresAuth: false, title: 'OAuth Callback', titleKey: 'auth.oauthCallbackPageTitle' },
  },
  {
    path: '/auth/linuxdo/callback',
    name: 'LinuxDoOAuthCallback',
    component: () => import('@/views/auth/LinuxDoCallbackView.vue'),
    meta: { requiresAuth: false, title: 'LinuxDo OAuth Callback', titleKey: 'auth.linuxdoCallbackPageTitle' },
  },
  {
    path: '/auth/wechat/callback',
    name: 'WeChatOAuthCallback',
    component: () => import('@/views/auth/WechatCallbackView.vue'),
    meta: { requiresAuth: false, title: 'WeChat OAuth Callback', titleKey: 'auth.wechatCallbackPageTitle' },
  },
  {
    path: '/auth/wechat/payment/callback',
    name: 'WeChatPaymentOAuthCallback',
    component: () => import('@/views/auth/WechatPaymentCallbackView.vue'),
    meta: { requiresAuth: false, title: 'WeChat Payment Callback', titleKey: 'auth.wechatPaymentCallbackPageTitle' },
  },
  {
    path: '/auth/dingtalk/callback',
    name: 'DingTalkOAuthCallback',
    component: () => import('@/views/auth/DingTalkCallbackView.vue'),
    meta: { requiresAuth: false, title: 'DingTalk OAuth Callback', titleKey: 'auth.dingtalkCallbackPageTitle' },
  },
  {
    path: '/auth/dingtalk/email-completion',
    name: 'dingtalk-email-completion',
    component: () => import('@/views/auth/DingTalkEmailCompletionView.vue'),
    meta: { requiresAuth: false, title: 'DingTalk Email Completion' },
  },
  {
    path: '/auth/oidc/callback',
    name: 'OIDCOAuthCallback',
    component: () => import('@/views/auth/OidcCallbackView.vue'),
    meta: { requiresAuth: false, title: 'OIDC OAuth Callback', titleKey: 'auth.oidcCallbackPageTitle' },
  },
  {
    path: '/forgot-password',
    name: 'ForgotPassword',
    component: () => import('@/views/auth/ForgotPasswordView.vue'),
    meta: { requiresAuth: false, title: 'Forgot Password', titleKey: 'auth.forgotPasswordTitle' },
  },
  {
    path: '/reset-password',
    name: 'ResetPassword',
    component: () => import('@/views/auth/ResetPasswordView.vue'),
    meta: { requiresAuth: false, title: 'Reset Password' },
  },
  {
    path: '/key-usage',
    name: 'KeyUsage',
    component: () => import('@/views/KeyUsageView.vue'),
    meta: { requiresAuth: false, title: 'Key Usage' },
  },
  {
    path: '/legal/:documentId',
    name: 'LegalDocument',
    component: () => import('@/views/public/LegalDocumentView.vue'),
    meta: { requiresAuth: false, title: 'Legal Document' },
  },
  {
    path: '/model-plaza',
    name: 'ModelPlaza',
    component: () => import('@/views/ModelPlazaView.vue'),
    meta: { requiresAuth: false, title: 'Model Plaza', titleKey: 'modelPlaza.title' },
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('@/views/user/DashboardView.vue'),
    meta: { title: 'Dashboard', titleKey: 'dashboard.title', descriptionKey: 'dashboard.welcomeMessage' },
  },
  {
    path: '/keys',
    name: 'Keys',
    component: () => import('@/views/user/KeysView.vue'),
    meta: { title: 'API Keys', titleKey: 'keys.title', descriptionKey: 'keys.description' },
  },
  {
    path: '/batch-image',
    alias: '/docs/batch-image',
    name: 'BatchImageGuide',
    component: () => import('@/views/user/BatchImageGuideView.vue'),
    meta: { title: 'Batch Image Guide', titleKey: 'batchImageGuide.title', descriptionKey: 'batchImageGuide.description' },
  },
  {
    path: '/usage',
    name: 'Usage',
    component: () => import('@/views/user/UsageView.vue'),
    meta: { title: 'Usage Records', titleKey: 'usage.title', descriptionKey: 'usage.description' },
  },
  {
    path: '/pricing',
    name: 'ModelPricing',
    component: () => import('@/views/user/ModelPricingView.vue'),
    meta: { title: 'Model Pricing', titleKey: 'modelPricing.title', descriptionKey: 'modelPricing.description' },
  },
  {
    path: '/redeem',
    name: 'Redeem',
    component: () => import('@/views/user/RedeemView.vue'),
    meta: { title: 'Redeem Code', titleKey: 'redeem.title', descriptionKey: 'redeem.description' },
  },
  {
    path: '/affiliate',
    name: 'Affiliate',
    component: () => import('@/views/user/AffiliateView.vue'),
    meta: { title: 'Affiliate', titleKey: 'affiliate.title', descriptionKey: 'affiliate.description' },
  },
  {
    path: '/available-channels',
    name: 'UserAvailableChannels',
    component: () => import('@/views/user/AvailableChannelsView.vue'),
    meta: { title: 'Available Channels', titleKey: 'availableChannels.title', descriptionKey: 'availableChannels.description' },
  },
  {
    path: '/monitor',
    name: 'ChannelStatus',
    component: () => import('@/views/user/ChannelStatusView.vue'),
    meta: { title: 'Channel Status', titleKey: 'channelStatus.title', descriptionKey: 'channelStatus.description' },
  },
  {
    path: '/profile',
    name: 'Profile',
    component: () => import('@/views/user/ProfileView.vue'),
    meta: { title: 'Profile', titleKey: 'profile.title', descriptionKey: 'profile.description' },
  },
  {
    path: '/subscriptions',
    name: 'Subscriptions',
    component: () => import('@/views/user/SubscriptionsView.vue'),
    meta: { title: 'My Subscriptions', titleKey: 'userSubscriptions.title', descriptionKey: 'userSubscriptions.description', requiresSubscription: true },
  },
  {
    path: '/purchase',
    name: 'PurchaseSubscription',
    component: () => import('@/views/user/PaymentView.vue'),
    meta: { title: 'Purchase Subscription', titleKey: 'nav.buySubscription', descriptionKey: 'purchase.description', requiresPayment: true },
  },
  {
    path: '/orders',
    name: 'OrderList',
    component: () => import('@/views/user/UserOrdersView.vue'),
    meta: { title: 'My Orders', titleKey: 'nav.myOrders', requiresPayment: true },
  },
  {
    path: '/payment/qrcode',
    name: 'PaymentQRCode',
    component: () => import('@/views/user/PaymentQRCodeView.vue'),
    meta: { title: 'Payment', titleKey: 'payment.qr.scanToPay', requiresPayment: true },
  },
  {
    path: '/payment/result',
    name: 'PaymentResult',
    component: () => import('@/views/user/PaymentResultView.vue'),
    meta: { requiresAuth: false, title: 'Payment Result', titleKey: 'payment.result.success' },
  },
  {
    path: '/payment/stripe',
    name: 'StripePayment',
    component: () => import('@/views/user/StripePaymentView.vue'),
    meta: { requiresAuth: false, title: 'Stripe Payment', titleKey: 'payment.stripePay' },
  },
  {
    path: '/payment/airwallex',
    name: 'AirwallexPayment',
    component: () => import('@/views/user/AirwallexPaymentView.vue'),
    meta: { requiresAuth: false, title: 'Airwallex Payment', titleKey: 'payment.airwallexPay' },
  },
  {
    path: '/payment/stripe-popup',
    name: 'StripePopup',
    component: () => import('@/views/user/StripePopupView.vue'),
    meta: { requiresAuth: false, title: 'Payment' },
  },
  {
    path: '/custom/:id',
    name: 'CustomPage',
    component: () => import('@/views/user/CustomPageView.vue'),
    meta: { title: 'Custom Page', titleKey: 'customPage.title' },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { requiresAuth: false, title: '404 Not Found' },
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior(_to, _from, savedPosition) {
    return savedPosition || { top: 0 }
  },
})

let authInitialized = false
const navigationLoading = useNavigationLoadingState()

const backendModePublicPaths = [
  '/login',
  '/key-usage',
  '/payment/result',
  '/payment/airwallex',
  '/payment/stripe',
  '/payment/stripe-popup',
  '/legal',
]
const callbackPaths = [
  '/auth/callback',
  '/auth/oauth/callback',
  '/auth/linuxdo/callback',
  '/auth/dingtalk/callback',
  '/auth/dingtalk/email-completion',
  '/auth/oidc/callback',
  '/auth/wechat/callback',
  '/auth/wechat/payment/callback',
]

function backendModeAllows(path: string, hasPendingAuthSession: boolean): boolean {
  if (backendModePublicPaths.some((allowed) => path === allowed || path.startsWith(`${allowed}/`))) return true
  if (callbackPaths.includes(path)) return true
  return hasPendingAuthSession && (path === '/register' || path === '/email-verify')
}

router.beforeEach(async (to) => {
  navigationLoading.startNavigation()

  const authStore = useAuthStore()
  const appStore = useAppStore()
  if (!authInitialized) {
    authStore.checkAuth()
    authInitialized = true
  }

  document.title = resolveRouteDocumentTitle(
    to,
    appStore.siteName,
    appStore.cachedPublicSettings?.custom_menu_items ?? [],
  )

  const requiresAuth = to.meta.requiresAuth !== false
  if (!requiresAuth) {
    if (authStore.isAuthenticated && (to.path === '/login' || to.path === '/register')) {
      if (appStore.backendModeEnabled && !authStore.isAdmin) return true
      return '/dashboard'
    }

    if (to.path === '/model-plaza') {
      if (!appStore.publicSettingsLoaded) await appStore.fetchPublicSettings()
      const settings = appStore.cachedPublicSettings
      if (appStore.publicSettingsLoaded && settings?.model_plaza_enabled === false) {
        return authStore.isAuthenticated ? '/dashboard' : '/home'
      }
      if (settings?.model_plaza_require_auth && !authStore.isAuthenticated) {
        return { path: '/login', query: { redirect: to.fullPath } }
      }
    }

    if (appStore.backendModeEnabled && !authStore.isAuthenticated && !backendModeAllows(to.path, authStore.hasPendingAuthSession)) {
      return '/login'
    }
    return true
  }

  if (!authStore.isAuthenticated) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }

  if ((to.meta.requiresPayment || to.meta.requiresSubscription) && !appStore.publicSettingsLoaded) {
    await appStore.fetchPublicSettings()
  }

  if (to.meta.requiresPayment && appStore.publicSettingsLoaded && appStore.cachedPublicSettings?.payment_enabled === false) {
    return '/dashboard'
  }
  if (to.meta.requiresSubscription && appStore.publicSettingsLoaded && appStore.cachedPublicSettings?.subscription_enabled === false) {
    return '/dashboard'
  }
  if (authStore.isSimpleMode && ['/subscriptions', '/redeem'].some((path) => to.path.startsWith(path))) {
    return '/dashboard'
  }
  if (appStore.backendModeEnabled && !authStore.isAdmin && !backendModeAllows(to.path, authStore.hasPendingAuthSession)) {
    return '/login'
  }

  return true
})

router.afterEach(() => {
  navigationLoading.endNavigation()
})

router.onError((error) => {
  console.error('Router error:', error)
  const isChunkLoadError =
    error.message?.includes('Failed to fetch dynamically imported module') ||
    error.message?.includes('Loading chunk') ||
    error.message?.includes('Loading CSS chunk') ||
    error.name === 'ChunkLoadError'
  if (!isChunkLoadError) return

  const reloadKey = 'chunk_reload_attempted'
  const lastReload = sessionStorage.getItem(reloadKey)
  const now = Date.now()
  if (!lastReload || now - Number(lastReload) > 10_000) {
    sessionStorage.setItem(reloadKey, String(now))
    window.location.reload()
  }
})

export default router
