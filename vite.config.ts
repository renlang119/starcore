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
    // 不产出 sourcemap：产物内本就不含 sourceMappingURL，本地构建的 .map 亦无用途；
    // 源码暴露面由「不生成」直接收口（部署侧 deploy.sh 仍保留 --exclude='*.map' 作为兜底）
    sourcemap: false,
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
