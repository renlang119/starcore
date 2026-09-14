/**
 * BuildView.test.ts — 建造视图组件测试
 *
 * 重点测试：
 * 1. 组件挂载与扇区切换
 * 2. 建筑卡渲染与锁定态
 * 3. 升级流程（原子操作通道）与资源扣减
 * 4. 新手引导气泡
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent } from 'vue'
import BuildView from './BuildView.vue'
import { useGameStore } from '@/stores/game'
import { BUILDINGS, SECTORS } from '@/data/buildings'

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
  const wrapper = mount(BuildView, {
    global: {
      plugins: [pinia],
      stubs: {
        Icons: defineComponent({ template: '<svg />' }),
      },
    },
  })
  wrappers.push(wrapper)
  return wrapper
}

describe('BuildView — 挂载与渲染', () => {
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

  it('正常挂载并渲染标题与扇区页签', () => {
    const wrapper = mountView()
    expect(wrapper.find('.build-view').exists()).toBe(true)
    expect(wrapper.text()).toContain('建造')
    // 扇区页签数量 = SECTORS 全部扇区
    expect(wrapper.findAll('.sector-tab').length).toBe(Object.keys(SECTORS).length)
    // 默认选中第一个扇区（energy）
    expect(wrapper.find('.sector-tab.active').text()).toBe(SECTORS.energy.name)
  })

  it('点击扇区页签切换建筑列表', async () => {
    const wrapper = mountView()
    const energyCards = wrapper.findAll('.build-card').length
    expect(energyCards).toBe(BUILDINGS.filter((b) => b.sector === 'energy').length)

    // 切到晶体扇区（第 2 个页签）
    await wrapper.findAll('.sector-tab')[1].trigger('click')
    expect(wrapper.find('.sector-tab.active').text()).toBe(SECTORS.crystal.name)
    expect(wrapper.find('.sector-desc').text()).toBe(SECTORS.crystal.desc)
    expect(wrapper.findAll('.build-card').length).toBe(
      BUILDINGS.filter((b) => b.sector === 'crystal').length
    )
  })

  it('锁定建筑卡显示所需科技', () => {
    const wrapper = mountView()
    // energy 扇区存在需要科技解锁的建筑（如聚变反应堆）
    const lockedCards = wrapper.findAll('.build-card.locked')
    expect(lockedCards.length).toBeGreaterThan(0)
    expect(wrapper.text()).toContain('需要科技：')
  })

  it('解锁建筑卡显示产出与升级按钮', () => {
    const wrapper = mountView()
    // solar_collector 无科技前置，默认解锁
    const firstCard = wrapper.findAll('.build-card').find((c) => !c.classes().includes('locked'))
    expect(firstCard).toBeDefined()
    expect(firstCard!.find('.btn-primary').exists()).toBe(true)
    expect(firstCard!.text()).toContain('Lv.0')
  })
})

describe('BuildView — 升级流程', () => {
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

  it('资源不足时升级按钮禁用', async () => {
    const wrapper = mountView()
    const game = useGameStore()
    game.resources.setAmount('energy', 0)
    await wrapper.vm.$nextTick()
    const btn = wrapper
      .findAll('.build-card')
      .find((c) => !c.classes().includes('locked'))!
      .find('.btn-primary')
    expect(btn.attributes('disabled')).toBeDefined()
  })

  it('点击升级走原子操作：等级 +1 且资源扣减', async () => {
    const wrapper = mountView()
    const game = useGameStore()
    game.resources.setAmount('energy', 1e6)

    const card = wrapper.findAll('.build-card').find((c) => !c.classes().includes('locked'))!
    const btn = card.find('.btn-primary')
    expect(btn.attributes('disabled')).toBeUndefined()

    const before = game.buildings.getLevel('solar_collector')
    await btn.trigger('click')
    await wrapper.vm.$nextTick()

    expect(game.buildings.getLevel('solar_collector')).toBe(before + 1)
    // 初始成本 = baseCost（Lv0），扣减生效
    expect(game.resources.getAmount('energy').toNumber()).toBeLessThan(1e6)
  })

  it('切至 ×10 档位显示可买级数与预计总花费', async () => {
    const wrapper = mountView()
    const game = useGameStore()
    game.resources.setAmount('energy', 30) // 成本 10 / 12 / 14：10 + 12 = 22 ≤ 30 < 36 → 可买 2 级
    await wrapper.vm.$nextTick()

    const bulkBtn = wrapper.findAll('.bulk-toggle .seg-btn').find((b) => b.text() === '×10')
    expect(bulkBtn).toBeTruthy()
    await bulkBtn!.trigger('click')
    await wrapper.vm.$nextTick()

    const costText = wrapper.find('.b-cost').text().replace(/\s+/g, '')
    expect(costText).toBe('可买2级·共22')
  })
})

describe('BuildView — 新手引导', () => {
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

  it('未读时显示引导气泡，确认后消失', async () => {
    const wrapper = mountView()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.onboard-build').exists()).toBe(true)

    await wrapper.find('.onboard-ok').trigger('click')
    await wrapper.vm.$nextTick()
    // build 流程仅 1 步，确认后气泡关闭
    expect(wrapper.find('.onboard-build').exists()).toBe(false)
  })

  it('已读（localStorage 预置）时不显示气泡', () => {
    localStorage.setItem('starcore_onboarding', JSON.stringify({ 'build-upgrade': true }))
    const wrapper = mountView()
    expect(wrapper.find('.onboard-build').exists()).toBe(false)
  })
})
