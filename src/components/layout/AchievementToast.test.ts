/**
 * AchievementToast.test.ts：成就解锁全局提示组件测试
 *
 * 覆盖：空队列不渲染、入队即显示成就名与奖励、
 * 2.5 秒自动取下一条、连续解锁排队展示。
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mountView, useViewTestHooks } from '@/tests/view-mount'
import { resetProviderSingletons } from '@/tests/reset-providers'
import { useAchievementsStore } from '@/stores/achievements'
import { ACHIEVEMENTS } from '@/data/achievements'
import AchievementToast from './AchievementToast.vue'

const first = ACHIEVEMENTS.find((a) => a.id === 'ach_energy_1')!
const second = ACHIEVEMENTS.find((a) => a.id === 'ach_energy_2')!

describe('AchievementToast 成就解锁提示', () => {
  useViewTestHooks()

  beforeEach(() => {
    resetProviderSingletons()
  })

  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('空队列时不渲染提示', () => {
    const wrapper = mountView(AchievementToast)
    expect(wrapper.find('.ach-toast').exists()).toBe(false)
  })

  it('入队后显示成就名称与奖励文案', async () => {
    const ach = useAchievementsStore()
    const wrapper = mountView(AchievementToast)

    ach.toastQueue.push({ id: first.id, name: first.name, at: Date.now() })
    await wrapper.vm.$nextTick()

    const toast = wrapper.find('.ach-toast')
    expect(toast.exists()).toBe(true)
    expect(toast.attributes('role')).toBe('status')
    expect(toast.find('.toast-name').text()).toBe(first.name)
    expect(toast.find('.toast-reward').text()).toBe(first.effects[0]?.label)
  })

  it('2.5 秒后自动取下一条，队列清空后提示消失', async () => {
    const ach = useAchievementsStore()
    const wrapper = mountView(AchievementToast)

    ach.toastQueue.push({ id: first.id, name: first.name, at: Date.now() })
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.ach-toast').exists()).toBe(true)

    vi.advanceTimersByTime(2500)
    await wrapper.vm.$nextTick()
    expect(ach.toastQueue.length).toBe(0)
    expect(wrapper.find('.ach-toast').exists()).toBe(false)
  })

  it('连续解锁排队展示：第一条消失后接第二条', async () => {
    const ach = useAchievementsStore()
    const wrapper = mountView(AchievementToast)

    ach.toastQueue.push(
      { id: first.id, name: first.name, at: Date.now() },
      { id: second.id, name: second.name, at: Date.now() }
    )
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.toast-name').text()).toBe(first.name)

    vi.advanceTimersByTime(2500)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.toast-name').text()).toBe(second.name)

    vi.advanceTimersByTime(2500)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.ach-toast').exists()).toBe(false)
  })
})
