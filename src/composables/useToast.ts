/**
 * useToast — 视图层轻提示（单条、自动消失）
 *
 * v0.73 自 MapView/RelicView/PrestigeView 三处重复实现收敛而来：
 * 视图只需 const toast = useToast()，模板挂 <Toast :toast="toast" />。
 * duration 可调（PrestigeView 存档/导入类提示曾用 3000–5000ms）。
 */
import { ref, onUnmounted } from 'vue'

export interface ToastApi {
  /** 当前显示的消息（空串=隐藏） */
  msg: Readonly<ReturnType<typeof ref<string>>>
  show: (msg: string, duration?: number) => void
}

export function useToast(): ToastApi {
  const msg = ref('')
  let timer: ReturnType<typeof setTimeout> | null = null

  function show(m: string, duration = 2000) {
    msg.value = m
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      msg.value = ''
    }, duration)
  }

  onUnmounted(() => {
    if (timer) clearTimeout(timer)
  })

  return { msg, show }
}
