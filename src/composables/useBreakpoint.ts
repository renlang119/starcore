import { ref, onMounted, onUnmounted } from 'vue'

/**
 * 响应式断点检测
 *
 * 核心思路：通过 matchMedia API 检测屏幕宽度，
 * 在组件层面用 v-if 控制导航栏的渲染（而非仅靠 CSS class）。
 *
 * 关键改进：在 setup 阶段立即从 window.matchMedia 初始化，
 * 而非等 onMounted 才更新。这消除了移动端首帧渲染 SideNav 的闪烁（FOUC）。
 * 本项目是纯客户端 SPA（无 SSR），可在 setup 中安全访问 window。
 *
 * P3-4: 扩展四档断点 S/M/L/XL，isDesktop 保持不变。
 */

const MOBILE_BREAKPOINT = 768 // px, 与 Tailwind md 断点一致

export type Breakpoint = 'S' | 'M' | 'L' | 'XL'

function calcBreakpoint(w: number): Breakpoint {
  if (w < 768) return 'S'
  if (w < 1024) return 'M'
  if (w < 1440) return 'L'
  return 'XL'
}

export function useBreakpoint() {
  // setup 阶段立即求值——消除首帧闪烁
  const mql =
    typeof window !== 'undefined' ? window.matchMedia(`(min-width: ${MOBILE_BREAKPOINT}px)`) : null
  const isDesktop = ref(mql ? mql.matches : true)
  const breakpoint = ref<Breakpoint>(
    typeof window !== 'undefined' ? calcBreakpoint(window.innerWidth) : 'S'
  )

  function update(e: MediaQueryListEvent) {
    isDesktop.value = e.matches
    breakpoint.value = calcBreakpoint(window.innerWidth)
  }

  onMounted(() => {
    // 再同步一次，防止 setup 到 mount 之间窗口尺寸变化
    if (mql) {
      isDesktop.value = mql.matches
      breakpoint.value = calcBreakpoint(window.innerWidth)
      mql.addEventListener('change', update)
    }
  })

  onUnmounted(() => {
    mql?.removeEventListener('change', update)
  })

  return { isDesktop, breakpoint }
}
