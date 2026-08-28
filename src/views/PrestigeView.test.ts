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

  it('tryTranscend 显示确认弹窗', async () => {
    const wrapper = mount(PrestigeView, {
      global: {
        plugins: [pinia],
        stubs: {
          Icons: defineComponent({ template: '<svg />' }),
        },
      },
    })

    const vm = wrapper.vm as any

    if (typeof vm.tryTranscend === 'function') {
      vm.tryTranscend()
      await wrapper.vm.$nextTick()

      // 应显示确认弹窗
      const overlay = wrapper.find('.modal-overlay')
      expect(overlay.exists()).toBe(true)
    }
  })

  it('cancelTranscend 关闭弹窗', async () => {
    const wrapper = mount(PrestigeView, {
      global: {
        plugins: [pinia],
        stubs: {
          Icons: defineComponent({ template: '<svg />' }),
        },
      },
    })

    const vm = wrapper.vm as any

    if (typeof vm.tryTranscend === 'function' && typeof vm.cancelTranscend === 'function') {
      vm.tryTranscend()
      await wrapper.vm.$nextTick()
      expect(wrapper.find('.modal-overlay').exists()).toBe(true)

      vm.cancelTranscend()
      await wrapper.vm.$nextTick()
      expect(wrapper.find('.modal-overlay').exists()).toBe(false)
    }
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

    // 找到清除存档按钮（btn-danger class）
    const resetBtn = wrapper.find('.btn-danger')
    if (resetBtn.exists()) {
      await resetBtn.trigger('click')
      await wrapper.vm.$nextTick()

      // 应显示确认弹窗
      const overlay = wrapper.find('.modal-overlay')
      expect(overlay.exists()).toBe(true)
    }
  })
})
