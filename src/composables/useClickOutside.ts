import { onMounted, onUnmounted, type Ref } from 'vue'

/**
 * useClickOutside — 点击 root 元素外部时回调（v1.07 自 BottomNav 单例实现收敛）
 *
 * 监听 document 层点击；点击落在 root 内不触发。组件卸载自动移除监听。
 */
export function useClickOutside(root: Ref<HTMLElement | null>, onOutside: () => void) {
  function handler(e: MouseEvent) {
    if (root.value && !root.value.contains(e.target as Node)) onOutside()
  }
  onMounted(() => document.addEventListener('click', handler))
  onUnmounted(() => document.removeEventListener('click', handler))
}
