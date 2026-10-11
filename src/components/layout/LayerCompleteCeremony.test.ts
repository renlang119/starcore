/**
 * LayerCompleteCeremony.test.ts：层完成仪式组件测试（v1.55）
 *
 * 覆盖：空队列不渲染、普通层横幅（层名与层色注入）、点击提前关闭、
 * 3.5 秒自动取下一条、深空层改播终局全屏仪式（贺词文案 + 点击关闭）。
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mountView, useViewTestHooks } from '@/tests/view-mount'
import { resetProviderSingletons } from '@/tests/reset-providers'
import { useGameStore } from '@/stores/game'
import { LAYER_INFO } from '@/data/explore'
import LayerCompleteCeremony from './LayerCompleteCeremony.vue'

vi.mock('@/composables/useFocusTrap', () => ({
  useFocusTrap: () => {},
}))

describe('LayerCompleteCeremony 层完成仪式', () => {
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

  it('空队列时不渲染横幅与仪式', () => {
    const wrapper = mountView(LayerCompleteCeremony)
    expect(wrapper.find('.layer-banner').exists()).toBe(false)
    expect(wrapper.find('.ceremony-overlay').exists()).toBe(false)
  })

  it('普通层入队后显示横幅（层名文案 + 层色注入）', async () => {
    const game = useGameStore()
    const wrapper = mountView(LayerCompleteCeremony)

    game.exploration.layerCeremonyQueue.push('orbit')
    await wrapper.vm.$nextTick()

    const banner = wrapper.find('.layer-banner')
    expect(banner.exists()).toBe(true)
    expect(banner.text()).toContain(LAYER_INFO.orbit.name)
    expect(banner.attributes('style')).toContain(LAYER_INFO.orbit.color)
    expect(wrapper.find('.ceremony-overlay').exists()).toBe(false)
  })

  it('点击横幅提前关闭并消费队列', async () => {
    const game = useGameStore()
    const wrapper = mountView(LayerCompleteCeremony)

    game.exploration.layerCeremonyQueue.push('orbit')
    await wrapper.vm.$nextTick()
    await wrapper.find('.layer-banner').trigger('click')
    await wrapper.vm.$nextTick()

    expect(game.exploration.layerCeremonyQueue).toEqual([])
    expect(wrapper.find('.layer-banner').exists()).toBe(false)
  })

  it('3.5 秒自动取下一条（连续两层排队展示）', async () => {
    const game = useGameStore()
    const wrapper = mountView(LayerCompleteCeremony)

    game.exploration.layerCeremonyQueue.push('orbit', 'inner')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.layer-banner').text()).toContain(LAYER_INFO.orbit.name)

    vi.advanceTimersByTime(3500)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.layer-banner').text()).toContain(LAYER_INFO.inner.name)

    vi.advanceTimersByTime(3500)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.layer-banner').exists()).toBe(false)
    expect(game.exploration.layerCeremonyQueue).toEqual([])
  })

  it('深空层改播终局全屏仪式（贺词 + 点击关闭）', async () => {
    const game = useGameStore()
    const wrapper = mountView(LayerCompleteCeremony)

    game.exploration.layerCeremonyQueue.push('void')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.layer-banner').exists()).toBe(false)
    const overlay = wrapper.find('.ceremony-overlay')
    expect(overlay.exists()).toBe(true)
    expect(overlay.text()).toContain('全宇宙已探索完毕')
    expect(overlay.text()).toContain('星核文明接过守门者的位置')

    await overlay.trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.ceremony-overlay').exists()).toBe(false)
    expect(game.exploration.layerCeremonyQueue).toEqual([])
  })
})
