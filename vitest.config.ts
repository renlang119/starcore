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
      setupFiles: ['src/tests/force-zh-locale.ts', 'src/tests/reset-providers.ts'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html'],
        include: ['src/**/*.{ts,vue}'],
        exclude: ['src/**/*.test.ts', 'src/tests/**', 'src/main.ts', 'src/router/index.ts'],
        // 覆盖率门禁（v1.67 入库）：档位取 v1.66 实跑基线（全局 lines 92.78 /
        // stores 97.57 / lib 92.78）取整留余。branches 现状约 73.5，首版不挂，
        // 登记观察 1-2 版后再议；下调阈值须有版本级理由，不得顺手改小消化劣化。
        thresholds: {
          lines: 92,
          'src/stores/**': {
            lines: 97,
          },
          'src/lib/**': {
            lines: 92,
          },
        },
      },
    },
  })
)
