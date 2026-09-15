import { ref, watch, onUnmounted, type Ref } from 'vue'

// 禁用元素不进环绕序列；hidden / aria-hidden / 内联不可见在 collectFocusables 再过滤
const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'

/** 焦点陷阱可选行为 */
export interface FocusTrapOptions {
  /** Escape 键回调（不传则不处理 Escape） */
  onEscape?: () => void
}

/** 收集容器内真实可聚焦元素（过滤 hidden / aria-hidden / 内联 display、visibility 隐藏） */
function collectFocusables(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) =>
      !el.hidden &&
      el.getAttribute('aria-hidden') !== 'true' &&
      el.style.display !== 'none' &&
      el.style.visibility !== 'hidden'
  )
}

/**
 * 焦点陷阱 composable
 * 当弹窗显示时，Tab/Shift+Tab 循环限制在弹窗内部，
 * 关闭后焦点恢复到触发元素；可选 Escape 关闭。
 *
 * v0.77：补 onUnmounted 监听清理与 immediate 首轮生效；增 Escape 回调。
 * v0.96：卸载时若仍在激活态补还焦（「常真 active + 父级 v-if 卸载」路径 watch
 * 收不到 false）；Tab 处理开头补 contains 兜底（焦点落在弹窗外时拉回弹窗，
 * 不再逃逸到页面其余可聚焦元素）；环绕序列过滤禁用与不可见节点。
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

  /** 还焦到触发元素（已离文档则跳过） */
  function restoreFocus() {
    const el = previousFocus.value
    previousFocus.value = null
    if (el && document.contains(el)) el.focus()
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (options.onEscape) {
        e.stopPropagation()
        options.onEscape()
      }
      return
    }
    if (e.key !== 'Tab' || !containerRef.value) return
    const container = containerRef.value
    const focusables = collectFocusables(container)
    if (focusables.length === 0) {
      e.preventDefault()
      return
    }
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    const current = document.activeElement as HTMLElement | null
    // contains 兜底：弹窗内点击非聚焦区域后焦点落在 body 等处，
    // 此时 Tab 重新拉回弹窗（正序回首元素，倒序回末元素）
    if (!current || !container.contains(current)) {
      e.preventDefault()
      ;(e.shiftKey ? last : first).focus()
      return
    }
    if (e.shiftKey) {
      if (current === first) {
        e.preventDefault()
        last.focus()
      }
    } else {
      if (current === last) {
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
          const focusables = containerRef.value ? collectFocusables(containerRef.value) : []
          focusables[0]?.focus()
        })
      } else {
        document.removeEventListener('keydown', handleKeydown)
        restoreFocus()
      }
    },
    { immediate: true }
  )

  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown)
    // 「常真 active + 父级 v-if 卸载」路径：watch 收不到 false，卸载时仍激活须还焦
    if (active.value) restoreFocus()
  })
}
