/**
 * BattleView.test.ts — 战斗视图组件测试
 *
 * 重点测试：
 * 1. 组件挂载
 * 2. 战斗结果弹窗显示
 * 3. 奖励发放时机与防重复（回归验证）
 * 4. 远征深度上限封顶
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import BattleView from './BattleView.vue'
import { useResourcesStore } from '@/stores/resources'
import { useMilitaryStore } from '@/stores/military'
import { useCombatStore } from '@/stores/combat'
import { useExplorationStore } from '@/stores/exploration'
import { ENDLESS_STRONGHOLD_ID } from '@/data/endless'

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

function mountBattle() {
  return mount(BattleView, {
    global: {
      plugins: [pinia],
      stubs: {
        Icons: defineComponent({ template: '<svg />' }),
      },
    },
  })
}

function explored(...nodeIds: string[]) {
  const exploration = useExplorationStore()
  const progress: Record<
    string,
    { nodeId: string; startTime: number; endTime: number; completed: boolean }
  > = {}
  for (const id of nodeIds) {
    progress[id] = { nodeId: id, startTime: 0, endTime: 0, completed: true }
  }
  exploration.hydrate({ progress })
}

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

    // 战斗按钮区域存在（P1-5 迁移后 class 从 .btn-battle → .btn-accent）
    expect(wrapper.find('[data-testid="battle-start"]').exists()).toBe(true)
  })
})

describe('BattleView — 驻扎守卫与确认', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRouteParams.value = { id: 'raider_1' }
    setupBattleReady()
  })

  it('未攻克据点驻扎按钮禁用', () => {
    const wrapper = mountBattle()
    const btn = wrapper.find('[data-testid="battle-garrison"]')
    expect(btn.exists()).toBe(true)
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('已攻克可驻扎：点击弹出收益确认，确认后进入驻扎态', async () => {
    explored('node_orbit')
    const combat = useCombatStore()
    combat.completedStrongholds.add('raider_1')
    const wrapper = mountBattle()
    const btn = wrapper.find('[data-testid="battle-garrison"]')
    expect((btn.element as HTMLButtonElement).disabled).toBe(false)
    await btn.trigger('click')
    const modal = wrapper.find('.garrison-confirm-modal')
    expect(modal.exists()).toBe(true)
    expect(modal.text()).toContain('挂机驻扎')
    await modal.find('.btn-accent').trigger('click')
    expect(combat.garrisoned['raider_1']?.formationId).toBe('f1')
  })
})

describe('BattleView — 无尽远征深度步进', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRouteParams.value = { id: ENDLESS_STRONGHOLD_ID }
    setupBattleReady()
  })

  afterEach(() => {
    mockRouteParams.value = { id: 'raider_1' }
  })

  it('进页跟随前沿且加号禁用，退至深度 1 后减号禁用', async () => {
    const combat = useCombatStore()
    combat.expeditionBest = 2 // 前沿 = best+1 = 3
    const wrapper = mountBattle()
    const minus = wrapper.find('[data-testid="endless-depth-minus"]')
    const plus = wrapper.find('[data-testid="endless-depth-plus"]')
    expect(minus.exists()).toBe(true)
    // 初始深度自动跟随前沿 3：前沿徽标在、加号禁用、减号可用
    expect(wrapper.find('[data-testid="endless-depth-value"]').text()).toContain('前沿')
    expect((plus.element as HTMLButtonElement).disabled).toBe(true)
    expect((minus.element as HTMLButtonElement).disabled).toBe(false)
    await minus.trigger('click')
    await minus.trigger('click')
    expect(wrapper.find('[data-testid="endless-depth-value"]').text()).toContain('第 1 层')
    expect((minus.element as HTMLButtonElement).disabled).toBe(true) // 深度 1 触底禁用
  })
})

describe('BattleView — 战斗流程与奖励发放', () => {
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

  it('胜利奖励在战斗结算时即时到账，弹窗动作与重复调用不再发放', async () => {
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
    const before = resources.getAmount('energy').toNumber()

    // 开始战斗（raider_1 奖励能量 500，结算即到账）
    vm.startBattle()
    await wrapper.vm.$nextTick()
    const afterBattle = resources.getAmount('energy').toNumber()
    expect(afterBattle).toBe(before + 500)

    // 弹窗动作与重复调用不再发放（防重复）
    vm.confirmResult()
    vm.stayHere()
    vm.confirmResult()
    await wrapper.vm.$nextTick()
    expect(resources.getAmount('energy').toNumber()).toBe(afterBattle)
  })
})

describe('BattleView — 远征深度上限', () => {
  it('前沿达到最大深度时选择封顶，不出现超过上限的层数', async () => {
    mockRouteParams.value = { id: 'endless' }
    pinia = createPinia()
    setActivePinia(pinia)
    const combat = useCombatStore()
    combat.completedStrongholds.add('silencer_3')
    combat.expeditionBest = 999

    const wrapper = mount(BattleView, {
      global: {
        plugins: [pinia],
        stubs: {
          Icons: defineComponent({ template: '<svg />' }),
        },
      },
    })
    await wrapper.vm.$nextTick()

    const depthText = wrapper.find('[data-testid="endless-depth-value"]').text()
    expect(depthText).toContain('第 999 层')
    expect(depthText).not.toContain('1000')
    expect(wrapper.find('.depth-frontier').exists()).toBe(true)

    mockRouteParams.value = { id: 'raider_1' }
  })
})
