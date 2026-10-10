/**
 * SideNav.test.ts：侧栏导航组件测试
 *
 * 覆盖：导航项渲染与当前路由高亮、点击跳转、折叠切换与 localStorage 记忆、
 * 旧键迁移（v0.84）、负熵统计。
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mountView, useViewTestHooks, sharedVueRouterMock, routeState } from '@/tests/view-mount'
import { resetProviderSingletons } from '@/tests/reset-providers'
import { NAV_ITEMS } from '@/data/navigation'
import { t } from '@/i18n'
import SideNav from './SideNav.vue'

// 路由经共享态注入：各用例挂载前置入当前路径
vi.mock('vue-router', () => sharedVueRouterMock())

describe('SideNav 侧栏导航', () => {
  useViewTestHooks()

  beforeEach(() => {
    resetProviderSingletons()
  })

  it('渲染全部导航项，当前路由项高亮并打 aria-current', () => {
    routeState.path = '/build'
    const wrapper = mountView(SideNav)

    const items = wrapper.findAll('.nav-item')
    expect(items.length).toBe(NAV_ITEMS.length)

    const buildIdx = NAV_ITEMS.findIndex((n) => n.id === 'build')
    expect(items[buildIdx].classes()).toContain('active')
    expect(items[buildIdx].attributes('aria-current')).toBe('page')
    expect(items[0].classes()).not.toContain('active')
    expect(items[0].attributes('aria-current')).toBeUndefined()
  })

  it('点击导航项跳转对应路径', async () => {
    routeState.path = '/'
    const wrapper = mountView(SideNav)

    const items = wrapper.findAll('.nav-item')
    const techIdx = NAV_ITEMS.findIndex((n) => n.id === 'tech')
    await items[techIdx].trigger('click')
    expect(routeState.push).toHaveBeenCalledWith('/tech')
  })

  it('折叠切换写入 localStorage 并切换 collapsed 形态', async () => {
    routeState.path = '/'
    const wrapper = mountView(SideNav)
    expect(wrapper.find('.side-nav').classes()).not.toContain('collapsed')

    await wrapper.find('.collapse-toggle').trigger('click')
    expect(wrapper.find('.side-nav').classes()).toContain('collapsed')
    expect(localStorage.getItem('starcore_sidenav_collapsed')).toBe('true')

    await wrapper.find('.collapse-toggle').trigger('click')
    expect(wrapper.find('.side-nav').classes()).not.toContain('collapsed')
    expect(localStorage.getItem('starcore_sidenav_collapsed')).toBe('false')
  })

  it('已存折叠状态时挂载即折叠', () => {
    routeState.path = '/'
    localStorage.setItem('starcore_sidenav_collapsed', 'true')

    const wrapper = mountView(SideNav)
    expect(wrapper.find('.side-nav').classes()).toContain('collapsed')
    // 折叠态导航项带 aria-label 供读屏
    expect(wrapper.find('.nav-item').attributes('aria-label')).toBe(t('nav.home'))
  })

  it('旧冒号键读取后迁移为新键并清除旧键', () => {
    routeState.path = '/'
    localStorage.setItem('starcore:sidenav-collapsed', 'true')

    const wrapper = mountView(SideNav)
    expect(wrapper.find('.side-nav').classes()).toContain('collapsed')
    expect(localStorage.getItem('starcore_sidenav_collapsed')).toBe('true')
    expect(localStorage.getItem('starcore:sidenav-collapsed')).toBeNull()
  })

  it('底部统计区显示负熵数值', () => {
    routeState.path = '/'
    const wrapper = mountView(SideNav)

    const stat = wrapper.find('.side-footer .stat')
    expect(stat.exists()).toBe(true)
    expect(stat.text()).toContain(t('resources.negEntropy'))
    expect(stat.find('.val').text()).toBe('0')
  })
})
