import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsInlineLimit: 4096,
    // sourcemap: 'hidden' — 本地构建保留 .map 供调试，但产物内不含 sourceMappingURL 引用；
    // 部署侧 deploy.sh 以 --exclude='*.map' 排除，两处配合共同收口源码暴露面（v0.72 口径）
    sourcemap: 'hidden',
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (
            id.includes('node_modules/vue/') ||
            id.includes('node_modules/vue-router/') ||
            id.includes('node_modules/pinia/')
          ) {
            return 'vue'
          }
          if (id.includes('node_modules/decimal.js/')) {
            return 'decimal'
          }
          if (id.includes('node_modules/localforage/')) {
            return 'storage'
          }
        },
      },
    },
  },
})
