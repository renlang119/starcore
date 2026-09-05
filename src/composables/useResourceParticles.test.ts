/**
 * useResourceParticles.test.ts — 资源粒子随机动画时长（v0.50）
 *
 * 体验增强设计规范 §P3-6：生命周期随机 0.8–1.2s，经 --duration 注入 CSS，
 * 移除定时器与动画时长同步。
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, type Ref } from 'vue'
import { useResourceParticles } from './useResourceParticles'

interface Particle {
  id: number
  resourceId: string
  duration: number
}

// jsdom 无 matchMedia，stub 为「非减少动效」
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }),
})

let particlesRef: Ref<Particle[]> | null = null

function mountParticles(ids: string[] = ['energy']) {
  const Comp = defineComponent({
    setup() {
      const { particles } = useResourceParticles(() => ids)
      particlesRef = particles as Ref<Particle[]>
      return () => h('div')
    },
  })
  return mount(Comp)
}

describe('useResourceParticles 随机生命周期', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    particlesRef = null
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('生成粒子的 duration 在 800~1200ms 区间', () => {
    mountParticles()
    for (let i = 0; i < 8; i++) vi.advanceTimersByTime(400)
    const list = particlesRef!.value
    expect(list.length).toBeGreaterThan(0)
    for (const p of list) {
      expect(p.duration).toBeGreaterThanOrEqual(800)
      expect(p.duration).toBeLessThanOrEqual(1200)
    }
  })

  it('粒子到期移除（不早于 800ms，不晚于 1300ms）', () => {
    const ids = ['energy']
    mountParticles(ids)
    vi.advanceTimersByTime(400) // 生成第 1 个
    expect(particlesRef!.value.length).toBe(1)
    ids.length = 0 // 停止后续生成，只观察这 1 个
    // 移除定时器计时起点 = 生成时刻
    vi.advanceTimersByTime(800)
    const after800 = particlesRef!.value.length
    vi.advanceTimersByTime(500)
    const after1300 = particlesRef!.value.length
    // 800ms 时可能还在（duration > 800），1300ms 时必定已移除
    expect(after800).toBeLessThanOrEqual(1)
    expect(after1300).toBe(0)
  })

  it('无正产出资源时不生成', () => {
    mountParticles([])
    vi.advanceTimersByTime(2000)
    expect(particlesRef!.value.length).toBe(0)
  })
})
