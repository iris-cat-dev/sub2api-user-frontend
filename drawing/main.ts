import { createApp, h } from 'vue'
import { createPinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import i18n, { initI18n } from '@/i18n'
import { applyTheme, resolveInitialTheme } from '@/utils/theme'
import DrawingWorkspace from '@/features/drawing/DrawingWorkspace.vue'
import '../src/style.css'

applyTheme(resolveInitialTheme())

const appElement = document.getElementById('app')!
appElement.textContent = '正在验证登录状态…'

const loginUrl = `/login?redirect=${encodeURIComponent('/drawing')}`
const pinia = createPinia()
const authStore = useAuthStore(pinia)
authStore.checkAuth()

async function bootstrap() {
  if (!authStore.isAuthenticated) {
    window.location.replace(loginUrl)
    return
  }

  try {
    await authStore.refreshUser()
  } catch (error) {
    const status = error && typeof error === 'object' && 'status' in error ? error.status : undefined
    if (!authStore.isAuthenticated || status === 401) {
      window.location.replace(loginUrl)
      return
    }
    const failure = createApp({
      render: () => h('main', { class: 'mx-auto max-w-lg px-6 py-24 text-center text-gray-800 dark:text-white' }, [
        h('h1', { class: 'text-xl font-semibold' }, '无法验证登录状态'),
        h('p', { class: 'mt-3 text-sm text-gray-500' }, '请检查网络连接后重试。'),
        h('button', { class: 'mt-6 rounded-xl bg-primary-600 px-5 py-2 text-sm font-medium text-white', onClick: () => window.location.reload() }, '重试'),
      ]),
    })
    failure.mount(appElement)
    return
  }

  const userId = authStore.user?.id
  if (!userId) {
    window.location.replace(loginUrl)
    return
  }

  await initI18n()
  const app = createApp(DrawingWorkspace, { userId })
  app.use(i18n)
  app.mount(appElement)

  window.addEventListener('storage', (event) => {
    if (event.key !== 'auth_token' && event.key !== 'auth_user') return
    const currentUser = localStorage.getItem('auth_user')
    let currentId: number | undefined
    try {
      const parsed: unknown = currentUser ? JSON.parse(currentUser) : null
      currentId = parsed && typeof parsed === 'object' && 'id' in parsed && typeof parsed.id === 'number'
        ? parsed.id
        : undefined
    } catch {
      currentId = undefined
    }
    if (!localStorage.getItem('auth_token') || currentId !== userId) {
      window.location.replace(loginUrl)
    }
  })
}

void bootstrap()
