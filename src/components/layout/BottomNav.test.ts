/**
 * BottomNav.test.ts：底部导航组件测试
 *
 * 覆盖：主/次页签分层渲染、当前路由高亮、点击跳转、
 * 更多面板开合与三种关闭路径（选项跳转/Escape/点外部）。
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mountView, useViewTestHooks, sharedVueRouterMock, routeState } from '@/tests/view-mount'
import { resetProviderSingletons } from '@/tests/reset-providers'
import { NAV_ITEMS } from '@/data/navigation'
import BottomNav from './BottomNav.vue'

// 路由经共享态注入：各用例挂载前置入当前路径
vi.mock('vue-router', () => sharedVueRouterMock())

const primaryCount = NAV_ITEMS.filter((n) => n.tier === 'primary').length
const secondaryCount = NAV_ITEMS.filter((n) => n.tier === 'secondary').length

/** 更多按钮：主次页签之外、带 aria-haspopup 的那个 tab */
function moreButton(wrapper: ReturnType<typeof mountView>) {
  const btn = wrapper.find('.tab[aria-haspopup]')
  expect(btn.exists()).toBe(true)
  return btn
}

describe('BottomNav 底部导航', () => {
  useViewTestHooks()

  beforeEach(() => {
    resetProviderSingletons()
  })

  it('渲染全部主导航项与更多按钮，更多面板初始关闭', () => {
    routeState.path = '/'
    const wrapper = mountView(BottomNav)

    expect(wrapper.findAll('.tab').length).toBe(primaryCount + 1)
    expect(wrapper.find('.more-panel').exists()).toBe(false)
    expect(moreButton(wrapper).attributes('aria-expanded')).toBe('false')
  })

  it('当前路由项高亮并打 aria-current', () => {
    routeState.path = '/tech'
    const wrapper = mountView(BottomNav)

    const techIdx = NAV_ITEMS.filter((n) => n.tier === 'primary').findIndex((n) => n.id === 'tech')
    const tabs = wrapper.findAll('.tab')
    expect(tabs[techIdx].classes()).toContain('active')
    expect(tabs[techIdx].attributes('aria-current')).toBe('page')
    expect(tabs[0].attributes('aria-current')).toBeUndefined()
  })

  it('点击主导航项跳转对应路径', async () => {
    routeState.path = '/'
    const wrapper = mountView(BottomNav)

    await wrapper.findAll('.tab')[0].trigger('click')
    expect(routeState.push).toHaveBeenCalledWith('/')
  })

  it('更多面板开合：点选项后跳转并自动收起', async () => {
    routeState.path = '/'
    const wrapper = mountView(BottomNav)

    await moreButton(wrapper).trigger('click')
    expect(wrapper.find('.more-panel').exists()).toBe(true)
    expect(moreButton(wrapper).attributes('aria-expanded')).toBe('true')
    expect(wrapper.findAll('.more-item').length).toBe(secondaryCount)

    await wrapper.findAll('.more-item')[0].trigger('click')
    expect(routeState.push).toHaveBeenCalledWith('/relic')
    expect(wrapper.find('.more-panel').exists()).toBe(false)
  })

  it('次级页面时更多按钮高亮', () => {
    routeState.path = '/relic'
    const wrapper = mountView(BottomNav)

    expect(moreButton(wrapper).classes()).toContain('active')
  })

  it('Escape 关闭更多面板', async () => {
    routeState.path = '/'
    const wrapper = mountView(BottomNav)

    await moreButton(wrapper).trigger('click')
    expect(wrapper.find('.more-panel').exists()).toBe(true)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.more-panel').exists()).toBe(false)
  })

  it('点击导航容器外部关闭更多面板', async () => {
    routeState.path = '/'
    const wrapper = mountView(BottomNav)

    await moreButton(wrapper).trigger('click')
    expect(wrapper.find('.more-panel').exists()).toBe(true)

    document.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.more-panel').exists()).toBe(false)
  })
})
