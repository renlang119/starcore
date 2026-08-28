import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

// 复用 vite.config.ts 的 resolve.alias 配置，消除重复
// Vue 组件测试通过文件级 // @vitest-environment jsdom 指令切换环境
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
      globals: true,
      setupFiles: ['./src/tests/setup.ts'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html'],
        include: ['src/**/*.{ts,vue}'],
        exclude: ['src/**/*.test.ts', 'src/tests/**', 'src/main.ts', 'src/router/index.ts'],
      },
    },
  }),
)
