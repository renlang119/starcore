/**
 * useResourceParticles.ts — P3-3/P3-6 资源产出粒子动画
 *
 * 功能：
 * - rate > 0 时，pill 旁生成 2px 光点向上飘 28px
 * - 每 400ms 生成 1 个
 * - 每资源上限 3 个，全局上限 15 个
 * - visibilitychange 自动暂停
 * - prefers-reduced-motion 降级为不生成
 */
import { ref, onMounted, onUnmounted } from 'vue'

interface Particle {
  id: number
  resourceId: string
  /** 生命周期（ms），生成时随机 800~1200（体验增强设计规范 §P3-6） */
  duration: number
}

const GLOBAL_MAX = 15
const PER_RESOURCE_MAX = 3
const SPAWN_INTERVAL = 400 // ms
const DURATION_MIN = 800
const DURATION_MAX = 1200

export function useResourceParticles(
  /** 返回当前有正 rate 的资源 id 列表 */
  getPositiveRateResources: () => string[]
) {
  const particles = ref<Particle[]>([])
  let nextId = 0
  let spawnTimer: ReturnType<typeof setInterval> | null = null

  const prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  function spawn() {
    if (document.hidden) return
    const positiveIds = getPositiveRateResources()
    if (positiveIds.length === 0) return

    // 全局上限
    if (particles.value.length >= GLOBAL_MAX) return

    // 随机选一个资源
    const resId = positiveIds[Math.floor(Math.random() * positiveIds.length)]

    // 单资源上限
    const count = particles.value.filter((p) => p.resourceId === resId).length
    if (count >= PER_RESOURCE_MAX) return

    const id = nextId++
    const duration = DURATION_MIN + Math.random() * (DURATION_MAX - DURATION_MIN)
    particles.value.push({ id, resourceId: resId, duration })

    // 动画结束后移除（与 --duration 同步）
    setTimeout(() => {
      particles.value = particles.value.filter((p) => p.id !== id)
    }, duration)
  }

  function start() {
    if (prefersReducedMotion) return
    if (spawnTimer) return
    spawnTimer = setInterval(spawn, SPAWN_INTERVAL)
  }

  function stop() {
    if (spawnTimer) {
      clearInterval(spawnTimer)
      spawnTimer = null
    }
  }

  function onVisibilityChange() {
    if (document.hidden) {
      stop()
    } else {
      start()
    }
  }

  onMounted(() => {
    if (!prefersReducedMotion) {
      start()
      document.addEventListener('visibilitychange', onVisibilityChange)
    }
  })

  onUnmounted(() => {
    stop()
    document.removeEventListener('visibilitychange', onVisibilityChange)
  })

  return { particles }
}
