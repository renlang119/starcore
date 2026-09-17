/**
 * PrestigeView.test.ts — 转生视图组件测试
 *
 * 重点测试：
 * 1. 组件挂载正确性
 * 2. 转生确认流程
 * 3. 清除存档确认流程
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import PrestigeView from './PrestigeView.vue'
import { useResourcesStore } from '@/stores/resources'
import { useTranscendStore } from '@/stores/transcend'
import { D } from '@/lib/decimal'

// Mock useFocusTrap
vi.mock('@/composables/useFocusTrap', () => ({
  useFocusTrap: () => {},
}))

let pinia: ReturnType<typeof createPinia>

describe('PrestigeView — 挂载与渲染', () => {
  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
  })

  it('正常挂载并渲染', () => {
    const wrapper = mount(PrestigeView, {
      global: {
        plugins: [pinia],
        stubs: {
          Icons: defineComponent({ template: '<svg />' }),
        },
      },
    })

    expect(wrapper.exists()).toBe(true)
    expect(wrapper.find('.prestige-view').exists()).toBe(true)
  })

  it('显示转生相关文本', () => {
    const wrapper = mount(PrestigeView, {
      global: {
        plugins: [pinia],
        stubs: {
          Icons: defineComponent({ template: '<svg />' }),
        },
      },
    })

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
    const wrapper = mount(PrestigeView, {
      global: {
        plugins: [pinia],
        stubs: {
          Icons: defineComponent({ template: '<svg />' }),
        },
      },
    })

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
    const wrapper = mount(PrestigeView, {
      global: {
        plugins: [pinia],
        stubs: {
          Icons: defineComponent({ template: '<svg />' }),
        },
      },
    })

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

describe('PrestigeView — 清除存档确认', () => {
  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
  })

  it('点击清除存档按钮显示确认弹窗', async () => {
    const wrapper = mount(PrestigeView, {
      global: {
        plugins: [pinia],
        stubs: {
          Icons: defineComponent({ template: '<svg />' }),
        },
      },
    })

    // 清除存档按钮（v0.83 校正后按文本找，现显式断言不再条件包裹）
    const resetBtn = wrapper.findAll('button').find((b) => b.text().includes('清除存档'))
    expect(resetBtn).toBeTruthy()
    await resetBtn!.trigger('click')
    await wrapper.vm.$nextTick()

    // 应显示确认弹窗（含永久清除警示）
    const overlay = wrapper.find('.modal-overlay')
    expect(overlay.exists()).toBe(true)
    expect(overlay.text()).toContain('永久清除')
  })
})

describe('PrestigeView — 无限天赋批量预览', () => {
  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
  })

  it('切至 ×10 档位显示可买级数与预计总花费', async () => {
    const transcend = useTranscendStore()
    // 成本 5 / 8 / 12：5 + 8 + 12 = 25 ≤ 30，加第四级 42 > 30 → 可买 3 级
    transcend.negativeEntropy = D(30)

    const wrapper = mount(PrestigeView, {
      global: {
        plugins: [pinia],
        stubs: {
          Icons: defineComponent({ template: '<svg />' }),
        },
      },
    })

    const bulkBtn = wrapper
      .findAll('.infinite-title .bulk-toggle .seg-btn')
      .find((b) => b.text() === '×10')
    expect(bulkBtn).toBeTruthy()
    await bulkBtn!.trigger('click')
    await wrapper.vm.$nextTick()

    const card = wrapper.findAll('.infinite-node').find((c) => c.text().includes('奇点共振'))
    expect(card).toBeDefined()
    const costText = card!.find('.node-cost').text().replace(/\s+/g, '')
    expect(costText).toBe('可买3级·共25负熵')
    // v1.00 按钮文案按实际可购买级数显示（非段位标称值）
    expect(card!.find('button').text()).toBe('购买 ×3')
  })

  it('段位 ×10 但一级都买不起：按钮退回原文案且禁用', async () => {
    const transcend = useTranscendStore()
    transcend.negativeEntropy = D(0)

    const wrapper = mount(PrestigeView, {
      global: {
        plugins: [pinia],
        stubs: { Icons: defineComponent({ template: '<svg />' }) },
      },
    })

    await wrapper
      .findAll('.infinite-title .bulk-toggle .seg-btn')
      .find((b) => b.text() === '×10')!
      .trigger('click')
    await wrapper.vm.$nextTick()

    const card = wrapper.findAll('.infinite-node').find((c) => c.text().includes('奇点共振'))
    const btn = card!.find('button')
    expect(btn.text()).toBe('购买')
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
  })
})
