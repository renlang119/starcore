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
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent } from 'vue'
import ArmyView from './ArmyView.vue'
import { useGameStore } from '@/stores/game'
import { useMilitaryStore } from '@/stores/military'
import { UNITS } from '@/data/units'

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: {} }),
  useRouter: () => ({ push: vi.fn() }),
  RouterLink: defineComponent({
    props: { to: { type: String, required: false, default: '' } },
    template: '<a><slot /></a>',
  }),
  RouterView: defineComponent({ template: '<div />' }),
}))

vi.mock('@/composables/useFocusTrap', () => ({
  useFocusTrap: () => {},
}))

let pinia: ReturnType<typeof createPinia>
const wrappers: VueWrapper[] = []

function mountView() {
  const wrapper = mount(ArmyView, {
    global: {
      plugins: [pinia],
      stubs: {
        Icons: defineComponent({ template: '<svg />' }),
        Transition: { template: '<div><slot /></div>' },
      },
    },
  })
  wrappers.push(wrapper)
  return wrapper
}

describe('ArmyView — 挂载与空状态', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    pinia = createPinia()
    setActivePinia(pinia)
  })

  afterEach(() => {
    for (const w of wrappers) w.unmount()
    wrappers.length = 0
  })

  it('正常挂载并渲染战力面板与页签', () => {
    const wrapper = mountView()
    expect(wrapper.find('.army-view').exists()).toBe(true)
    expect(wrapper.text()).toContain('部队')
    expect(wrapper.text()).toContain('总攻击')
    expect(wrapper.findAll('.tab').length).toBe(2)
    // 新档军事科技未解锁 → 空状态引导
    expect(wrapper.find('.empty-state').exists()).toBe(true)
    expect(wrapper.text()).toContain('尚未组建部队')
  })

  it('已解锁但无部队时显示轻提示，且不遮挡训练入口', async () => {
    const wrapper = mountView()
    const game = useGameStore()
    game.research.complete('military_basic')
    expect(game.military.isUnlocked(UNITS[0], game.research.completed)).toBe(true)
    await wrapper.vm.$nextTick()
    // 兵营页：轻提示 + 单位卡并存（空态不遮挡卡片）
    expect(wrapper.text()).toContain('部队尚未组建')
    expect(wrapper.findAll('.unit-card').length).toBe(UNITS.length)
  })

  it('解锁军事后仍锁定的单位卡显示所需科技', async () => {
    const wrapper = mountView()
    const game = useGameStore()
    game.research.complete('military_basic')
    await wrapper.vm.$nextTick()
    // 突击/护卫/重装解锁，灵能者仍需 adv_units
    expect(wrapper.findAll('.unit-card.locked').length).toBe(1)
    expect(wrapper.text()).toContain('需要科技：')
  })
})

describe('ArmyView — 兵营训练', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    pinia = createPinia()
    setActivePinia(pinia)
  })

  afterEach(() => {
    for (const w of wrappers) w.unmount()
    wrappers.length = 0
  })

  async function setupUnlocked() {
    const game = useGameStore()
    game.research.complete('military_basic')
    game.resources.setAmount('energy', 1e6)
    game.resources.setAmount('alloy', 1e5)
    return game
  }

  it('训练数量调整与训练任务入队', async () => {
    const wrapper = mountView()
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
    const wrapper = mountView()
    await setupUnlocked()
    await wrapper.vm.$nextTick()
    const assaultCard = wrapper
      .findAll('.unit-card')
      .find((c) => c.find('.u-name').text().includes('突击兵'))!
    expect(assaultCard.find('.btn-accent').attributes('disabled')).toBeDefined()
  })

  it('满槽后训练按钮禁用并显示提示', async () => {
    const wrapper = mountView()
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
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    pinia = createPinia()
    setActivePinia(pinia)
  })

  afterEach(() => {
    for (const w of wrappers) w.unmount()
    wrappers.length = 0
  })

  async function setupWithTroops() {
    const wrapper = mountView()
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
    expect(wrapper.findAll('.formation-card').length).toBe(3)
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

  it('编队卡点击选中', async () => {
    const { wrapper } = await setupWithTroops()
    const cards = wrapper.findAll('.formation-card')
    expect(cards[0].classes()).toContain('selected')
    await cards[1].trigger('click')
    expect(cards[1].classes()).toContain('selected')
    expect(cards[0].classes()).not.toContain('selected')
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

describe('ArmyView — 新手引导', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    pinia = createPinia()
    setActivePinia(pinia)
  })

  afterEach(() => {
    for (const w of wrappers) w.unmount()
    wrappers.length = 0
  })

  it('未读时显示引导气泡，已读时不显示', async () => {
    const wrapper = mountView()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.onboard-army').exists()).toBe(true)
    wrapper.unmount()

    localStorage.setItem('starcore_onboarding', JSON.stringify({ 'army-train': true }))
    const wrapper2 = mountView()
    wrappers.push(wrapper2)
    await wrapper2.vm.$nextTick()
    expect(wrapper2.find('.onboard-army').exists()).toBe(false)
  })
})
