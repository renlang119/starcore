/**
 * ArmyView.test.ts — 部队视图组件测试
 *
 * 重点测试：
 * 1. 组件挂载与战力面板
 * 2. 兵营训练流程与训练槽位
 * 3. 编组操作（编入/撤出/批量确认弹窗）
 * 4. 空状态与新手引导
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import {
  mountView,
  useViewTestHooks,
  vueRouterMock,
  focusTrapMock,
  expectOnboardingBubble,
} from '@/tests/view-mount'
import ArmyView from './ArmyView.vue'
import { useGameStore } from '@/stores/game'
import { useMilitaryStore } from '@/stores/military'
import { UNITS } from '@/data/units'

vi.mock('vue-router', () => vueRouterMock())

vi.mock('@/composables/useFocusTrap', () => focusTrapMock())

describe('ArmyView — 挂载与空状态', () => {
  useViewTestHooks()

  it('正常挂载并渲染战力面板与页签', () => {
    const wrapper = mountView(ArmyView, {
      stubs: { Transition: { template: '<div><slot /></div>' } },
    })
    expect(wrapper.find('.army-view').exists()).toBe(true)
    expect(wrapper.text()).toContain('部队')
    expect(wrapper.text()).toContain('总攻击')
    expect(wrapper.findAll('.tab').length).toBe(2)
    // 新档军事科技未解锁 → 空状态引导
    expect(wrapper.find('.empty-state').exists()).toBe(true)
    expect(wrapper.text()).toContain('尚未组建部队')
  })

  it('已解锁但无部队时显示轻提示，且不遮挡训练入口', async () => {
    const wrapper = mountView(ArmyView, {
      stubs: { Transition: { template: '<div><slot /></div>' } },
    })
    const game = useGameStore()
    game.research.complete('military_basic')
    expect(game.military.isUnlocked(UNITS[0], game.research.completed)).toBe(true)
    await wrapper.vm.$nextTick()
    // 兵营页：轻提示 + 单位卡并存（空态不遮挡卡片）
    expect(wrapper.text()).toContain('部队尚未组建')
    expect(wrapper.findAll('.unit-card').length).toBe(UNITS.length)
  })

  it('解锁军事后仍锁定的单位卡显示所需科技', async () => {
    const wrapper = mountView(ArmyView, {
      stubs: { Transition: { template: '<div><slot /></div>' } },
    })
    const game = useGameStore()
    game.research.complete('military_basic')
    await wrapper.vm.$nextTick()
    // 突击/护卫/重装解锁，灵能者仍需 adv_units
    expect(wrapper.findAll('.unit-card.locked').length).toBe(1)
    expect(wrapper.text()).toContain('需要科技：')
  })
})

describe('ArmyView — 兵营训练', () => {
  useViewTestHooks()

  async function setupUnlocked() {
    const game = useGameStore()
    game.research.complete('military_basic')
    game.resources.setAmount('energy', 1e6)
    game.resources.setAmount('alloy', 1e5)
    return game
  }

  it('训练数量调整与训练任务入队', async () => {
    const wrapper = mountView(ArmyView, {
      stubs: { Transition: { template: '<div><slot /></div>' } },
    })
    const game = await setupUnlocked()
    await wrapper.vm.$nextTick()

    // 突击兵卡：+10 → 数量 10（按钮序：-10/-1/+1/+10）
    const assaultCard = wrapper
      .findAll('.unit-card')
      .find((c) => c.find('.u-name').text().includes('突击兵'))!
    await assaultCard.findAll('.count-btn')[3].trigger('click') // +10
    expect(assaultCard.find('.count-display').text()).toBe('10')

    await assaultCard.find('.btn-accent').trigger('click')
    await wrapper.vm.$nextTick()
    expect(game.military.trainingQueue.length).toBe(1)
    expect(game.military.trainingQueue[0].unitId).toBe('assault')
    expect(game.military.trainingQueue[0].count).toBe(10)
    // 资源扣减（assault 成本 50 能量 + 10 合金 × 10）
    expect(game.resources.getAmount('energy').toNumber()).toBe(1e6 - 500)
    expect(game.resources.getAmount('alloy').toNumber()).toBe(1e5 - 100)
    // 训练队列区块渲染
    expect(wrapper.find('.train-queue').exists()).toBe(true)
    expect(wrapper.text()).toContain('训练中（1/1）')
  })

  it('数量为 0 时训练按钮禁用', async () => {
    const wrapper = mountView(ArmyView, {
      stubs: { Transition: { template: '<div><slot /></div>' } },
    })
    await setupUnlocked()
    await wrapper.vm.$nextTick()
    const assaultCard = wrapper
      .findAll('.unit-card')
      .find((c) => c.find('.u-name').text().includes('突击兵'))!
    expect(assaultCard.find('.btn-accent').attributes('disabled')).toBeDefined()
  })

  it('满槽后训练按钮禁用并显示提示', async () => {
    const wrapper = mountView(ArmyView, {
      stubs: { Transition: { template: '<div><slot /></div>' } },
    })
    const game = await setupUnlocked()
    // 直接塞满 1 个训练槽
    game.military.startTraining(
      'guard',
      5,
      () => true,
      () => true
    )
    await wrapper.vm.$nextTick()

    const assaultCard = wrapper
      .findAll('.unit-card')
      .find((c) => c.find('.u-name').text().includes('突击兵'))!
    expect(assaultCard.find('.btn-accent').attributes('disabled')).toBeDefined()
    expect(wrapper.find('.slot-hint').exists()).toBe(true)
  })
})

describe('ArmyView — 编组操作', () => {
  useViewTestHooks()

  async function setupWithTroops() {
    const wrapper = mountView(ArmyView, {
      stubs: { Transition: { template: '<div><slot /></div>' } },
    })
    const game = useGameStore()
    // 预置编队
    const military = useMilitaryStore()
    military.owned.assault = 50
    military.owned.guard = 30
    await wrapper.findAll('.tab')[1].trigger('click') // 切到编组
    return { wrapper, game, military }
  }

  it('切换到编组页渲染编队卡与操作按钮', async () => {
    const { wrapper } = await setupWithTroops()
    expect(wrapper.findAll('.formation-card').length).toBe(useMilitaryStore().formations.length)
    expect(wrapper.text()).toContain('先锋编队')
    expect(wrapper.text()).toContain('库存 50')
    expect(wrapper.text()).toContain('编入 0')
    expect(wrapper.findAll('.fu-btn-wide').length).toBeGreaterThan(0)
  })

  it('小数量全入直接执行，不弹确认窗', async () => {
    const { wrapper, military } = await setupWithTroops()
    // 第一行的全入按钮（assault 库存 50 ≤ 100）
    const firstRow = wrapper.find('.f-unit-row')
    await firstRow.find('.fu-btn-wide').trigger('click')
    await wrapper.vm.$nextTick()

    expect(military.formations[0].units.assault).toBe(50)
    expect(military.owned.assault).toBe(0)
    expect(wrapper.find('.modal-overlay').exists()).toBe(false)
  })

  it('大数量全入弹确认窗，确认后执行', async () => {
    const { wrapper, military } = await setupWithTroops()
    military.owned.assault = 150
    await wrapper.vm.$nextTick()

    const firstRow = wrapper.find('.f-unit-row')
    await firstRow.find('.fu-btn-wide').trigger('click')
    await wrapper.vm.$nextTick()

    // 弹窗出现且未执行
    expect(wrapper.find('.modal-overlay').exists()).toBe(true)
    expect(wrapper.text()).toContain('确认全入')
    expect(wrapper.text()).toContain('150')
    expect(military.formations[0].units.assault).toBe(0)

    await wrapper.find('.btn-accent').trigger('click') // 确认
    await wrapper.vm.$nextTick()
    expect(military.formations[0].units.assault).toBe(150)
    expect(wrapper.find('.modal-overlay').exists()).toBe(false)
  })

  it('编入与撤出走 store 原子操作', async () => {
    const { wrapper, military } = await setupWithTroops()
    const firstRow = wrapper.find('.f-unit-row')
    const btns = firstRow.findAll('.fu-btn')
    // +10（索引 3）
    await btns[3].trigger('click')
    expect(military.formations[0].units.assault).toBe(10)
    expect(military.owned.assault).toBe(40)
    // -1（索引 1）
    await btns[1].trigger('click')
    expect(military.formations[0].units.assault).toBe(9)
    expect(military.owned.assault).toBe(41)
  })

  it('编队卡为纯内容容器，无伪选择语义（v0.96）', async () => {
    const { wrapper } = await setupWithTroops()
    const card = wrapper.find('.formation-card')
    // 选择状态无任何消费方，卡片不再带交互语义
    expect(card.attributes('role')).toBeUndefined()
    expect(card.attributes('tabindex')).toBeUndefined()
    // 编队操作仍由行内按钮承担
    expect(card.findAll('.fu-btn').length).toBeGreaterThan(0)
  })

  it('编入编队后「已拥有」保持全量口径（v0.95）', async () => {
    const { wrapper, military } = await setupWithTroops()
    const game = useGameStore()
    game.research.complete('military_basic')
    // 编组页全入 50 突击兵：库存清零、编队 50
    const firstRow = wrapper.find('.f-unit-row')
    await firstRow.find('.fu-btn-wide').trigger('click')
    await wrapper.vm.$nextTick()
    expect(military.owned.assault).toBe(0)
    expect(military.formations[0].units.assault).toBe(50)
    // 切回兵营：卡片「已拥有」仍为全量 50
    await wrapper.findAll('.tab')[0].trigger('click')
    await wrapper.vm.$nextTick()
    const assaultCard = wrapper
      .findAll('.unit-card')
      .find((c) => c.find('.u-name').text().includes('突击兵'))!
    expect(assaultCard.find('.u-count').text()).toContain('已拥有：50')
  })
})

describe('ArmyView — 编队特性（v1.23 方案 7）', () => {
  useViewTestHooks()

  async function setupFormationTab() {
    const wrapper = mountView(ArmyView, {
      stubs: { Transition: { template: '<div><slot /></div>' } },
    })
    const military = useMilitaryStore()
    military.owned.assault = 20
    await wrapper.findAll('.tab')[1].trigger('click') // 切到编组
    await wrapper.vm.$nextTick()
    return { wrapper, military }
  }

  it('每支编队渲染特性选择器，默认均衡选中', async () => {
    const { wrapper } = await setupFormationTab()
    const pickers = wrapper.findAll('[data-testid^="trait-picker-"]')
    expect(pickers.length).toBe(3)
    const first = pickers[0]
    expect(first.findAll('.seg-btn').length).toBe(5)
    // 无 trait 字段时均衡高亮
    expect(first.find('[data-testid="trait-f1-balanced"].active').exists()).toBe(true)
  })

  it('点击特性切换选中态并入库，效果描述展开', async () => {
    const { wrapper, military } = await setupFormationTab()
    await wrapper.find('[data-testid="trait-f1-assault_doctrine"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(military.formations[0].trait).toBe('assault_doctrine')
    expect(wrapper.find('[data-testid="trait-f1-assault_doctrine"].active').exists()).toBe(true)
    expect(wrapper.find('[data-testid="trait-f1-balanced"].active').exists()).toBe(false)
    // 描述行展开且为中文文案
    const desc = wrapper.find('[data-testid="trait-desc"]')
    expect(desc.exists()).toBe(true)
    expect(desc.text()).toContain('攻击 +12%')
  })

  it('切回均衡后 trait 字段删除、均衡重新高亮', async () => {
    const { wrapper, military } = await setupFormationTab()
    await wrapper.find('[data-testid="trait-f1-bastion_doctrine"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(military.formations[0].trait).toBe('bastion_doctrine')
    await wrapper.find('[data-testid="trait-f1-balanced"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(military.formations[0].trait).toBeUndefined()
    expect(wrapper.find('[data-testid="trait-f1-balanced"].active').exists()).toBe(true)
  })

  it('三支编队选择器互相独立', async () => {
    const { wrapper, military } = await setupFormationTab()
    await wrapper.find('[data-testid="trait-f1-logistics_doctrine"]').trigger('click')
    await wrapper.find('[data-testid="trait-f2-counter_doctrine"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(military.formations[0].trait).toBe('logistics_doctrine')
    expect(military.formations[1].trait).toBe('counter_doctrine')
    expect(military.formations[2].trait).toBeUndefined()
  })
})

describe('ArmyView — 新手引导', () => {
  useViewTestHooks()

  it('未读时显示引导气泡，已读时不显示', async () => {
    await expectOnboardingBubble(ArmyView, {
      selector: '.ob-army',
      stepId: 'army-train',
      stubs: { Transition: { template: '<div><slot /></div>' } },
    })
  })
})
