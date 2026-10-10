/**
 * AppShell.test.ts：应用壳组件测试
 *
 * 覆盖：桌面/移动双形态导航挂载（useBreakpoint 契约）、战斗页移动端返回钮、
 * 路由 meta 内容区宽版/网格版 class、常驻槽位（TopBar/弹窗/提示）、
 * 存档失败与派遣回执的全局轻提示 watch。
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { defineComponent } from 'vue'
import { mountView, useViewTestHooks, sharedVueRouterMock, routeState } from '@/tests/view-mount'
import { resetProviderSingletons } from '@/tests/reset-providers'
import { t } from '@/i18n'
import { useGameStore } from '@/stores/game'
import AppShell from './AppShell.vue'

// jsdom 无 matchMedia：matches 可变，各用例挂载前置入桌面/移动形态
let mockMatches = true
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: mockMatches,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }),
})

// 路由经共享态注入：各用例挂载前置入 path/meta
vi.mock('vue-router', () => sharedVueRouterMock())

// 子件全部换桩：本件只验壳的挂载契约，子件各有专测
const stubs = {
  SideNav: defineComponent({ template: '<nav class="stub-sidenav" />' }),
  BottomNav: defineComponent({ template: '<nav class="stub-bottomnav" />' }),
  TopBar: defineComponent({ template: '<header class="stub-topbar" />' }),
  OfflineReport: defineComponent({ template: '<div class="stub-offline" />' }),
  AchievementToast: defineComponent({ template: '<div class="stub-achtoast" />' }),
  RouterView: defineComponent({ template: '<div class="stub-routerview" />' }),
}

function mountShell(opts?: { path?: string; desktop?: boolean; meta?: Record<string, unknown> }) {
  routeState.path = opts?.path ?? '/'
  mockMatches = opts?.desktop ?? true
  routeState.meta = { ...(opts?.meta ?? {}) }
  return mountView(AppShell, { stubs })
}

describe('AppShell 应用壳', () => {
  useViewTestHooks()

  beforeEach(() => {
    resetProviderSingletons()
  })

  it('桌面形态挂载 SideNav 与常驻槽位，不挂载 BottomNav', () => {
    const wrapper = mountShell({ desktop: true })

    expect(wrapper.find('.stub-sidenav').exists()).toBe(true)
    expect(wrapper.find('.stub-bottomnav').exists()).toBe(false)
    expect(wrapper.find('.stub-topbar').exists()).toBe(true)
    expect(wrapper.find('.stub-offline').exists()).toBe(true)
    expect(wrapper.find('.stub-achtoast').exists()).toBe(true)
    expect(wrapper.find('.stub-routerview').exists()).toBe(true)
  })

  it('移动形态挂载 BottomNav，不挂载 SideNav', () => {
    const wrapper = mountShell({ desktop: false })

    expect(wrapper.find('.stub-bottomnav').exists()).toBe(true)
    expect(wrapper.find('.stub-sidenav').exists()).toBe(false)
  })

  it('战斗页移动端显示浮动返回钮并跳回首页，桌面端不显示', async () => {
    const wrapper = mountShell({ path: '/battle/s1', desktop: false })

    const back = wrapper.find('.extra-nav button')
    expect(back.exists()).toBe(true)
    await back.trigger('click')
    expect(routeState.push).toHaveBeenCalledWith('/')

    const desktopWrapper = mountShell({ path: '/battle/s1', desktop: true })
    expect(desktopWrapper.find('.extra-nav').exists()).toBe(false)
  })

  it('非战斗页不显示浮动返回钮', () => {
    const wrapper = mountShell({ path: '/build', desktop: false })
    expect(wrapper.find('.extra-nav').exists()).toBe(false)
  })

  it('路由 meta.wide 与 meta.grid 控制内容区 class', () => {
    const wide = mountShell({ meta: { wide: true } })
    expect(wide.find('main.content').classes()).toContain('content--wide')
    expect(wide.find('main.content').classes()).not.toContain('content--grid')

    const grid = mountShell({ meta: { grid: true } })
    expect(grid.find('main.content').classes()).toContain('content--grid')
    expect(grid.find('main.content').classes()).not.toContain('content--wide')

    const plain = mountShell()
    expect(plain.find('main.content').classes()).not.toContain('content--wide')
    expect(plain.find('main.content').classes()).not.toContain('content--grid')
  })

  it('存档写失败时弹出常驻轻提示', async () => {
    const game = useGameStore()
    const wrapper = mountShell()
    expect(wrapper.find('.toast').exists()).toBe(false)

    game.saveFailed = true
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.toast').exists()).toBe(true)
    expect(wrapper.find('.toast').text()).toBe(t('save.storageFull'))
  })

  it('派遣回执聚合为一条轻提示', async () => {
    const game = useGameStore()
    const wrapper = mountShell()

    const zero = { energy: 0, crystal: 0, alloy: 0, data: 0, dark: 0 }
    game.lastDispatchResolution = {
      squad1: { ...zero, energy: 100 },
      squad2: { ...zero, energy: 50, crystal: 5 },
    }
    await wrapper.vm.$nextTick()
    const toast = wrapper.find('.toast')
    expect(toast.exists()).toBe(true)
    expect(toast.text()).toContain(t('army.dispatchTitle'))
  })
})
