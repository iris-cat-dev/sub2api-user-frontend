import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv } from 'vite'
import checker from 'vite-plugin-checker'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendUrl = env.VITE_DEV_PROXY_TARGET || 'http://localhost:8080'
  const devPort = Number(env.VITE_DEV_PORT || 3000)

  return {
    plugins: [vue(), checker({ vueTsc: true })],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        'vue-i18n': 'vue-i18n/dist/vue-i18n.runtime.esm-bundler.js',
      },
    },
    define: {
      __INTLIFY_JIT_COMPILATION__: true,
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      cssCodeSplit: false,
      rollupOptions: {
        output: {
          experimentalMinChunkSize: 20_000,
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return undefined
            if (id.includes('/chart.js/') || id.includes('/vue-chartjs/')) return 'vendor-chart'
            if (id.includes('/@stripe/stripe-js/')) return 'vendor-stripe'
            return 'vendor-misc'
          },
        },
      },
    },
    server: {
      host: '0.0.0.0',
      port: devPort,
      proxy: {
        '/api': { target: backendUrl, changeOrigin: true },
        '/v1': { target: backendUrl, changeOrigin: true },
        '/drawing-app': { target: 'http://localhost:3001', changeOrigin: true, ws: true },
      },
    },
  }
})
