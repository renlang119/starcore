/**
 * SettingsView.test.ts — 设置视图组件测试（v1.13）
 *
 * 重点测试：
 * 1. 页面渲染（标题与两区块：存档管理 / 语言）
 * 2. 语言区块交互（自动 ↔ 手动选择持久化）
 * 3. 存档管理二次确认（自转生页迁入的清除存档流程）
 *
 * 注：jsdom 的 location.reload 不可替换（不可配置），整页刷新路径由
 * Playwright 真浏览器守护（v109 专项）；此处只断言选择态与持久化。
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import { vueRouterMock, focusTrapMock, mountView, useViewTestHooks } from '@/tests/view-mount'
import SettingsView from './SettingsView.vue'
import { NAV_ITEMS } from '@/data/navigation'
import { reloadPage } from '@/lib/reload'

vi.mock('vue-router', () => vueRouterMock({ push: () => vi.fn() }))
vi.mock('@/composables/useFocusTrap', () => focusTrapMock())
// jsdom 的 location.reload 不可替换：刷新以模块替身注入并断言
vi.mock('@/lib/reload', () => ({ reloadPage: vi.fn() }))

describe('SettingsView — 渲染', () => {
  useViewTestHooks()

  it('渲染标题与两区块（存档管理 + 语言）', () => {
    const wrapper = mountView(SettingsView)

    expect(wrapper.find('.settings-view').exists()).toBe(true)
    expect(wrapper.text()).toContain('设置')
    expect(wrapper.find('.save-section').exists()).toBe(true)
    expect(wrapper.text()).toContain('存档管理')
    expect(wrapper.text()).toContain('语言')
  })
})

describe('SettingsView — 语言区块', () => {
  useViewTestHooks()

  it('默认「自动」选中且未持久化', () => {
    const wrapper = mountView(SettingsView)
    const items = wrapper.findAll('.lang-item')

    expect(items.length).toBe(2)
    expect(items[0].text()).toContain('自动')
    expect(items[0].attributes('aria-checked')).toBe('true')
    expect(localStorage.getItem('starcore_locale')).toBeNull()
  })

  it('选择「简体中文」即持久化、切换选中态并刷新', async () => {
    const wrapper = mountView(SettingsView)

    await wrapper.findAll('.lang-item')[1].trigger('click')
    const items = wrapper.findAll('.lang-item')
    expect(localStorage.getItem('starcore_locale')).toBe('zh-CN')
    expect(items[1].attributes('aria-checked')).toBe('true')
    expect(items[0].attributes('aria-checked')).toBe('false')
    expect(vi.mocked(reloadPage)).toHaveBeenCalledTimes(1)
  })

  it('已有持久化选择时对应语言选中，可切回「自动」清除', async () => {
    localStorage.setItem('starcore_locale', 'zh-CN')
    const wrapper = mountView(SettingsView)

    expect(wrapper.findAll('.lang-item')[1].attributes('aria-checked')).toBe('true')
    await wrapper.findAll('.lang-item')[0].trigger('click')
    const items = wrapper.findAll('.lang-item')
    expect(localStorage.getItem('starcore_locale')).toBeNull()
    expect(items[0].attributes('aria-checked')).toBe('true')
    expect(vi.mocked(reloadPage)).toHaveBeenCalledTimes(1)
  })
})

describe('SettingsView — 存档管理（自转生页迁入）', () => {
  useViewTestHooks()

  it('导出 / 手动保存 / 导入按钮在列', () => {
    const wrapper = mountView(SettingsView)

    expect(wrapper.text()).toContain('导出存档')
    expect(wrapper.text()).toContain('手动保存')
    expect(wrapper.text()).toContain('导入存档')
  })

  it('点击清除存档显示二次确认（含永久清除警示）', async () => {
    const wrapper = mountView(SettingsView)

    const resetBtn = wrapper.findAll('button').find((b) => b.text().includes('清除存档'))
    expect(resetBtn).toBeTruthy()
    await resetBtn!.trigger('click')
    await wrapper.vm.$nextTick()

    const overlay = wrapper.find('.modal-overlay')
    expect(overlay.exists()).toBe(true)
    expect(overlay.text()).toContain('永久清除')
  })
})

describe('导航数据 — 设置项', () => {
  it('设置 = 次级导航项 /settings', () => {
    const item = NAV_ITEMS.find((n) => n.id === 'settings')

    expect(item).toBeTruthy()
    expect(item!.tier).toBe('secondary')
    expect(item!.path).toBe('/settings')
    expect(item!.icon).toBe('i-nav-settings')
  })
})
