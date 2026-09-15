/**
 * 全局错误兜底屏状态（v0.95）
 *
 * main.ts 注册的全局错误处理器捕获未捕获异常后置位，App 切换到
 * 「星核运行异常」兜底屏，替代半渲染或白屏状态；状态置于组件树
 * 之外，根组件渲染失败时依然可用。
 */
import { ref } from 'vue'

/** 是否激活运行期兜底屏 */
export const fallbackActive = ref(false)

/** 激活兜底屏（重复触发保持激活） */
export function activateFallback(): void {
  fallbackActive.value = true
}

/** 复位兜底屏（清档重开后由游戏界面接管） */
export function resetFallback(): void {
  fallbackActive.value = false
}
