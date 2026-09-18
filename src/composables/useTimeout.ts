import { onUnmounted } from 'vue'

/**
 * useTimeout — setTimeout 句柄样板收敛（v1.07）
 *
 * 统一样板：重触发先清旧（含触发后句柄复位）、组件卸载自动清理。
 * 此前六处组件各自手写句柄与 onUnmounted；setInterval 类（资源粒子、
 * 主 tick 等）语义不同，不并入本组件。
 */
export function useTimeout() {
  let timer: ReturnType<typeof setTimeout> | null = null

  function clear() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  function set(fn: () => void, delay: number) {
    clear()
    timer = setTimeout(() => {
      timer = null
      fn()
    }, delay)
  }

  onUnmounted(clear)

  return { set, clear }
}

/**
 * useTimeoutMap — 按 key 的多路 setTimeout（资源高亮等场景）
 *
 * 同 key 重触发先清旧；触发后自动从表内移除；卸载时全量清理。
 */
export function useTimeoutMap() {
  const timers = new Map<string, ReturnType<typeof setTimeout>>()

  function clear(key: string) {
    const t = timers.get(key)
    if (t) {
      clearTimeout(t)
      timers.delete(key)
    }
  }

  function set(key: string, fn: () => void, delay: number) {
    clear(key)
    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key)
        fn()
      }, delay)
    )
  }

  function clearAll() {
    for (const t of timers.values()) clearTimeout(t)
    timers.clear()
  }

  onUnmounted(clearAll)

  return { set, clear, clearAll }
}
