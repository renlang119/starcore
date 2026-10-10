/**
 * TopBar.test.ts：顶栏资源条组件测试
 *
 * 覆盖：五资源 pill 渲染与默认数值、路由 meta 隐藏资源条（v1.43 契约）、
 * getDisplayRate 实时速率显示（v1.47 契约）、数值变化高亮与熄灭、版本标签。
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mountView, useViewTestHooks, sharedVueRouterMock, routeState } from '@/tests/view-mount'
import { resetProviderSingletons } from '@/tests/reset-providers'
import { D } from '@/lib/decimal'
import { fmt } from '@/lib/format'
import { APP_VERSION } from '@/version'
import { t } from '@/i18n'
import { useGameStore } from '@/stores/game'
import type { ResourceType } from '@/data/buildings'
import TopBar from './TopBar.vue'

// jsdom 无 matchMedia，stub 为「非减少动效」（useResourceParticles 消费）
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }),
})

// 路由经共享态注入：各用例挂载前置入 path/meta
routeState.path = '/build'
vi.mock('vue-router', () => sharedVueRouterMock())

/** 按 sr-only 资源名定位 pill */
function pillOf(wrapper: ReturnType<typeof mountView>, name: string) {
  const pill = wrapper
    .findAll('.res-pill')
    .find((p) => p.find('.sr-only').exists() && p.find('.sr-only').text() === name)
  expect(pill, `未找到资源 pill：${name}`).toBeTruthy()
  return pill!
}

describe('TopBar 资源条', () => {
  useViewTestHooks()

  beforeEach(() => {
    resetProviderSingletons()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('渲染五个资源 pill 与默认数值', () => {
    const wrapper = mountView(TopBar)

    expect(wrapper.findAll('.res-pill').length).toBe(5)
    // 新档能量底值 50，其余资源为 0
    expect(pillOf(wrapper, t('resources.energy')).find('.r-amount').text()).toBe(fmt(D(50)))
    expect(pillOf(wrapper, t('resources.crystal')).find('.r-amount').text()).toBe(fmt(D(0)))
  })

  it('路由 meta.hideTopResources 为真时隐藏资源条但保留版本标签', () => {
    routeState.meta = { hideTopResources: true }
    const wrapper = mountView(TopBar)

    expect(wrapper.find('.strip-wrap').exists()).toBe(false)
    expect(wrapper.find('.version-tag').exists()).toBe(true)
    expect(wrapper.find('.version-tag').text()).toBe(`v${APP_VERSION}`)
  })

  it('速率显示实时派生：默认全 0，getDisplayRate 有值即显示', () => {
    const game = useGameStore()
    game.getDisplayRate = (_id: ResourceType) => D(3)
    const wrapper = mountView(TopBar)

    for (const pill of wrapper.findAll('.res-pill')) {
      expect(pill.find('.r-rate').text()).toBe('+3 /s')
    }
  })

  it('资源数值变化触发 0.3 秒高亮后熄灭', async () => {
    vi.useFakeTimers()
    const game = useGameStore()
    const wrapper = mountView(TopBar)
    const pill = pillOf(wrapper, t('resources.energy'))
    expect(pill.classes()).not.toContain('flash')

    game.resources.setAmount('energy', 999)
    await wrapper.vm.$nextTick()
    expect(pill.classes()).toContain('flash')

    vi.advanceTimersByTime(300)
    await wrapper.vm.$nextTick()
    expect(pill.classes()).not.toContain('flash')
  })

  it('默认速率全零时显示 0 /s', () => {
    const wrapper = mountView(TopBar)

    for (const pill of wrapper.findAll('.res-pill')) {
      expect(pill.find('.r-rate').text()).toBe('0 /s')
    }
  })
})
