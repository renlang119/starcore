import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { activateFallback } from './lib/error-fallback'
import './style.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)

// 全局错误兜底（v0.95）：渲染、生命周期与事件处理中的未捕获异常
// 统一导向运行期兜底屏，替代半渲染或白屏
app.config.errorHandler = (err, _instance, info) => {
  console.error('[starcore] 未捕获异常：', err, info)
  activateFallback()
}

app.mount('#app')
