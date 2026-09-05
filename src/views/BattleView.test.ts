/**
 * BattleView.test.ts — 战斗视图组件测试
 *
 * 重点测试：
 * 1. 组件挂载
 * 2. 战斗结果弹窗显示
 * 3. 奖励发放防重入（回归验证）
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import BattleView from './BattleView.vue'
import { useResourcesStore } from '@/stores/resources'
import { useMilitaryStore } from '@/stores/military'

// Mock vue-router
const mockPush = vi.fn()
const mockRouteParams = ref({ id: 'raider_1' })

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: mockRouteParams.value }),
  useRouter: () => ({ push: mockPush }),
  RouterLink: defineComponent({
    props: {
      to: { type: String, required: false, default: '' },
    },
    template: '<a><slot /></a>',
  }),
  RouterView: defineComponent({
    template: '<div />',
  }),
}))

// Mock useFocusTrap
vi.mock('@/composables/useFocusTrap', () => ({
  useFocusTrap: () => {},
}))

let pinia: ReturnType<typeof createPinia>

function setupBattleReady() {
  pinia = createPinia()
  setActivePinia(pinia)

  const resources = useResourcesStore()
  const military = useMilitaryStore()

  // 设置足够资源
  resources.setAmount('energy', 1e6)
  resources.setAmount('crystal', 1e5)
  resources.setAmount('alloy', 1e4)

  // 直接设置编队中有士兵（跳过训练流程）
  military.formations[0].units.assault = 10
  military.owned.assault = 10
}

describe('BattleView — 挂载与渲染', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupBattleReady()
  })

  it('正常挂载并渲染战斗视图', () => {
    const wrapper = mount(BattleView, {
      global: {
        plugins: [pinia],
        stubs: {
          Icons: defineComponent({ template: '<svg />' }),
        },
      },
    })

    expect(wrapper.exists()).toBe(true)
    expect(wrapper.find('.battle-view').exists()).toBe(true)
  })

  it('显示编队信息和驻扎区域', () => {
    const wrapper = mount(BattleView, {
      global: {
        plugins: [pinia],
        stubs: {
          Icons: defineComponent({ template: '<svg />' }),
        },
      },
    })

    // 应包含战斗按钮区域（P1-5 迁移后 class 从 .btn-battle → .btn-accent）
    expect(wrapper.find('.btn-accent').exists() || wrapper.text().includes('出征')).toBe(true)
  })
})

describe('BattleView — 战斗流程与奖励防重入', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupBattleReady()
  })

  it('startBattle 后弹出结果弹窗', async () => {
    const wrapper = mount(BattleView, {
      global: {
        plugins: [pinia],
        stubs: {
          Icons: defineComponent({ template: '<svg />' }),
        },
      },
    })

    const vm = wrapper.vm as any
    vm.startBattle()
    await wrapper.vm.$nextTick()

    // 应显示结果弹窗
    const overlay = wrapper.find('.modal-overlay')
    expect(overlay.exists()).toBe(true)
  })

  it('confirmResult 多次调用只发放一次奖励（回归验证）', async () => {
    const wrapper = mount(BattleView, {
      global: {
        plugins: [pinia],
        stubs: {
          Icons: defineComponent({ template: '<svg />' }),
        },
      },
    })

    const resources = useResourcesStore()
    const vm = wrapper.vm as any

    // 开始战斗
    vm.startBattle()
    await wrapper.vm.$nextTick()

    // 第一次确认结果
    vm.confirmResult()
    await wrapper.vm.$nextTick()
    const afterFirst = resources.getAmount('energy').toNumber()

    // 第二次确认（弹窗已关闭，但函数仍可调用）
    vm.confirmResult()
    await wrapper.vm.$nextTick()
    const afterSecond = resources.getAmount('energy').toNumber()

    // 第二次不应改变资源（rewardsGranted 标志位防重入）
    expect(afterSecond).toBe(afterFirst)
  })

  it('stayHere 后奖励只发放一次', async () => {
    const wrapper = mount(BattleView, {
      global: {
        plugins: [pinia],
        stubs: {
          Icons: defineComponent({ template: '<svg />' }),
        },
      },
    })

    const resources = useResourcesStore()
    const vm = wrapper.vm as any

    vm.startBattle()
    await wrapper.vm.$nextTick()

    vm.stayHere()
    await wrapper.vm.$nextTick()
    const afterFirst = resources.getAmount('energy').toNumber()

    vm.stayHere()
    await wrapper.vm.$nextTick()
    const afterSecond = resources.getAmount('energy').toNumber()

    expect(afterSecond).toBe(afterFirst)
  })
})
