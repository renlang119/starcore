/**
 * app.ts：应用装配与挂载
 *
 * 语言包就绪后由 main.ts 动态引入：应用主体（App / 路由 / store / 数据表）
 * 在模块求值阶段取词（t），必须晚于语言包装载，否则文案固化为键名；
 * 入口以动态 import 延迟整体求值（详见 main.ts 与 i18n/index.ts 头注）。
 */
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { t } from '@/i18n'
import { activateFallback } from './lib/error-fallback'

/** 创建应用、注册全局兜底并挂载根组件 */
export function startApp(): void {
  const app = createApp(App)
  app.use(createPinia())
  app.use(router)

  // 全局错误兜底（v0.95）：渲染、生命周期与事件处理中的未捕获异常
  // 统一导向运行期兜底屏，替代半渲染或白屏
  app.config.errorHandler = (err, _instance, info) => {
    console.error(t('app.uncaughtPrefix'), err, info)
    activateFallback()
  }

  app.mount('#app')
}
