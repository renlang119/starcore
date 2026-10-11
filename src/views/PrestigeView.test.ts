/**
 * PrestigeView.test.ts：转生视图组件测试
 *
 * 重点测试：
 * 1. 组件挂载正确性
 * 2. 转生确认流程
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import PrestigeView from './PrestigeView.vue'
import { useResourcesStore } from '@/stores/resources'
import { useTranscendStore, nextCost } from '@/stores/transcend'
import { selectBulk10 } from '@/tests/view-mount'
import { resetProviderSingletons } from '@/tests/reset-providers'
import { D } from '@/lib/decimal'

// Mock useFocusTrap
vi.mock('@/composables/useFocusTrap', () => ({
  useFocusTrap: () => {},
}))

let pinia: ReturnType<typeof createPinia>

function mountPrestige() {
  return mount(PrestigeView, {
    global: {
      plugins: [pinia],
      stubs: { Icons: defineComponent({ template: '<svg />' }) },
    },
  })
}

describe('PrestigeView — 挂载与渲染', () => {
  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
  })

  it('正常挂载并渲染', () => {
    const wrapper = mountPrestige()

    expect(wrapper.exists()).toBe(true)
    expect(wrapper.find('.prestige-view').exists()).toBe(true)
  })

  it('显示转生相关文本', () => {
    const wrapper = mountPrestige()

    expect(wrapper.text()).toContain('奇点重启')
  })
})

describe('PrestigeView — 转生确认流程', () => {
  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)

    const resources = useResourcesStore()
    // 设置足够转生的资源（total energy 需 >= 3e5）
    resources.setAmount('energy', 1e9)
    resources.gain('energy', 1e9) // 增加 total energy
  })

  it('点击执行奇点重启打开确认弹窗：重置与保留清单与转生行为一致', async () => {
    const wrapper = mountPrestige()

    const btn = wrapper.find('.btn-transcend')
    expect(btn.exists()).toBe(true)
    expect(btn.attributes('disabled')).toBeUndefined()
    await btn.trigger('click')
    await wrapper.vm.$nextTick()

    // 应显示确认弹窗，且清单覆盖转生实际会清掉与保留的内容
    const overlay = wrapper.find('.modal-overlay')
    expect(overlay.exists()).toBe(true)
    expect(overlay.text()).toContain('所有据点攻克记录与驻扎状态')
    expect(overlay.text()).toContain('成就与终身计数')
  })

  it('取消关闭弹窗且不触发转生', async () => {
    const wrapper = mountPrestige()

    const btn = wrapper.find('.btn-transcend')
    expect(btn.exists()).toBe(true)
    await btn.trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.modal-overlay').exists()).toBe(true)

    const cancelBtn = wrapper.findAll('.modal-overlay button').find((b) => b.text() === '取消')
    expect(cancelBtn).toBeTruthy()
    await cancelBtn!.trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.modal-overlay').exists()).toBe(false)
    // 取消不触发转生：转生次数不变
    expect(useTranscendStore().totalTranscends).toBe(0)
  })
})

describe('PrestigeView — 转生仪式（v1.55）', () => {
  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    resetProviderSingletons()

    const resources = useResourcesStore()
    resources.setAmount('energy', 1e9)
    resources.gain('energy', 1e9)
  })

  it('确认重启后播全屏仪式：收益与次数，点击关闭', async () => {
    const wrapper = mountPrestige()
    await wrapper.find('.btn-transcend').trigger('click')
    await wrapper.vm.$nextTick()
    const confirmBtn = wrapper.findAll('.modal-overlay button').find((b) => b.text() === '确认重启')
    expect(confirmBtn).toBeTruthy()
    await confirmBtn!.trigger('click')
    await wrapper.vm.$nextTick()

    // 仪式 overlay 出现：标题 / 负熵收益 / 第 1 次重启；确认弹窗已关闭
    const overlay = wrapper.find('.ceremony-overlay')
    expect(overlay.exists()).toBe(true)
    expect(overlay.text()).toContain('奇点重启')
    expect(overlay.text()).toContain('负熵')
    expect(overlay.text()).toContain('第 1 次奇点重启')
    expect(wrapper.find('.modal-overlay').exists()).toBe(false)
    // 转生已执行（次数 +1、资源重置）
    expect(useTranscendStore().totalTranscends).toBe(1)

    // 点击任意处关闭仪式
    await overlay.trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.ceremony-overlay').exists()).toBe(false)
  })

  it('仪式自动关闭：4 秒后 overlay 消失', async () => {
    vi.useFakeTimers()
    try {
      const wrapper = mountPrestige()
      await wrapper.find('.btn-transcend').trigger('click')
      await wrapper.vm.$nextTick()
      const confirmBtn = wrapper
        .findAll('.modal-overlay button')
        .find((b) => b.text() === '确认重启')
      await confirmBtn!.trigger('click')
      await wrapper.vm.$nextTick()
      expect(wrapper.find('.ceremony-overlay').exists()).toBe(true)

      await vi.advanceTimersByTimeAsync(4000)
      await wrapper.vm.$nextTick()
      expect(wrapper.find('.ceremony-overlay').exists()).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('PrestigeView — 无限天赋批量预览', () => {
  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
  })

  it('切至 ×10 档位显示可买级数与预计总花费', async () => {
    const transcend = useTranscendStore()
    // 成本曲线由 nextCost 实算：预算设为「够 3 级、不够第 4 级」（防曲线漂移）
    const node = transcend.tree.find((n) => n.id === 't_inf_prod')!
    transcend.negativeEntropy = D(nextCost(node, 0) + nextCost(node, 1) + nextCost(node, 2) + 1)
    const preview = transcend.previewPurchaseSteps('t_inf_prod', 10)
    expect(preview.count).toBe(3) // 预算设计的档位

    const wrapper = mountPrestige()
    await selectBulk10(wrapper, '.infinite-title .bulk-toggle')

    const card = wrapper.findAll('.infinite-node').find((c) => c.text().includes('奇点共振'))
    expect(card).toBeDefined()
    const costText = card!.find('.node-cost').text().replace(/\s+/g, '')
    expect(costText).toBe(`可买${preview.count}级·共${preview.cost}负熵`)
    // v1.00 按钮文案按实际可购买级数显示（非段位标称值）
    expect(card!.find('button').text()).toBe(`购买 ×${preview.count}`)
  })

  it('段位 ×10 但一级都买不起：按钮退回原文案且禁用', async () => {
    const transcend = useTranscendStore()
    transcend.negativeEntropy = D(0)

    const wrapper = mountPrestige()

    await selectBulk10(wrapper, '.infinite-title .bulk-toggle')

    const card = wrapper.findAll('.infinite-node').find((c) => c.text().includes('奇点共振'))
    const btn = card!.find('button')
    expect(btn.text()).toBe('购买')
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
  })
})
