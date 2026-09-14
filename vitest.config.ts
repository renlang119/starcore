import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

// 复用 vite.config.ts 的 resolve.alias 配置，消除重复
// Vue 组件测试通过文件级 // @vitest-environment jsdom 指令切换环境
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
      globals: true,
      // 单线程池内复用 worker（v0.73）。注意：模块级 provider 单例跨文件共享，
      // 由 setupFiles 的 src/tests/reset-providers.ts 每文件前置重置兜底
      // （v0.93 起集中式，此前靠各测试文件散落的手工重置，存在盲点）。
      isolate: false,
      setupFiles: ['src/tests/reset-providers.ts'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html'],
        include: ['src/**/*.{ts,vue}'],
        exclude: ['src/**/*.test.ts', 'src/tests/**', 'src/main.ts', 'src/router/index.ts'],
      },
    },
  })
)
