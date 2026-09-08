import { ref, watch, onUnmounted, type Ref } from 'vue'

const FOCUSABLE = 'a,button,input,textarea,select,[tabindex]:not([tabindex="-1"])'

/** 焦点陷阱可选行为 */
export interface FocusTrapOptions {
  /** Escape 键回调（不传则不处理 Escape） */
  onEscape?: () => void
}

/**
 * 焦点陷阱 composable
 * 当弹窗显示时，Tab/Shift+Tab 循环限制在弹窗内部，
 * 关闭后焦点恢复到触发元素；可选 Escape 关闭。
 *
 * v0.77：补 onUnmounted 监听清理与 immediate 首轮生效；增 Escape 回调。
 *
 * @param containerRef 弹窗容器 DOM ref
 * @param active 控制激活/关闭的响应式布尔值
 * @param options onEscape：Escape 键回调（各弹窗接入关闭/取消语义）
 */
export function useFocusTrap(
  containerRef: Ref<HTMLElement | null>,
  active: Ref<boolean>,
  options: FocusTrapOptions = {}
) {
  const previousFocus = ref<HTMLElement | null>(null)

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (options.onEscape) {
        e.stopPropagation()
        options.onEscape()
      }
      return
    }
    if (e.key !== 'Tab' || !containerRef.value) return
    const focusables = containerRef.value.querySelectorAll<HTMLElement>(FOCUSABLE)
    if (focusables.length === 0) {
      e.preventDefault()
      return
    }
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault()
        last.focus()
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
  }

  watch(
    active,
    (val) => {
      if (val) {
        previousFocus.value = document.activeElement as HTMLElement | null
        document.addEventListener('keydown', handleKeydown)
        // 等 DOM 渲染后聚焦第一个可交互元素
        requestAnimationFrame(() => {
          const first = containerRef.value?.querySelector<HTMLElement>(FOCUSABLE)
          first?.focus()
        })
      } else {
        document.removeEventListener('keydown', handleKeydown)
        previousFocus.value?.focus()
        previousFocus.value = null
      }
    },
    { immediate: true }
  )

  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown)
  })
}
