import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendUrl = env.VITE_DEV_PROXY_TARGET || 'http://localhost:8080'

  return {
    root: resolve(__dirname, 'drawing'),
    base: '/drawing-app/',
    plugins: [vue()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        'vue-i18n': 'vue-i18n/dist/vue-i18n.runtime.esm-bundler.js',
      },
    },
    define: { __INTLIFY_JIT_COMPILATION__: true },
    build: {
      outDir: resolve(__dirname, 'dist/drawing-app'),
      emptyOutDir: true,
    },
    server: {
      host: '0.0.0.0',
      port: 3001,
      proxy: {
        '/api': { target: backendUrl, changeOrigin: true },
        '/v1': { target: backendUrl, changeOrigin: true },
      },
    },
  }
})
