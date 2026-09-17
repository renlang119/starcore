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
import { describe, it, expect, vi } from 'vitest'
import {
  mountView,
  useViewTestHooks,
  vueRouterMock,
  focusTrapMock,
  selectBulk10,
} from '@/tests/view-mount'
import BuildView from './BuildView.vue'
import { useGameStore } from '@/stores/game'
import { BUILDINGS, SECTORS, buildingCost } from '@/data/buildings'

vi.mock('vue-router', () => vueRouterMock())

vi.mock('@/composables/useFocusTrap', () => focusTrapMock())

describe('BuildView — 挂载与渲染', () => {
  useViewTestHooks()

  it('正常挂载并渲染标题与扇区页签', () => {
    const wrapper = mountView(BuildView)
    expect(wrapper.find('.build-view').exists()).toBe(true)
    expect(wrapper.text()).toContain('建造')
    // 扇区页签数量 = SECTORS 全部扇区
    expect(wrapper.findAll('.sector-tab').length).toBe(Object.keys(SECTORS).length)
    // 默认选中第一个扇区（energy）
    expect(wrapper.find('.sector-tab.active').text()).toBe(SECTORS.energy.name)
  })

  it('点击扇区页签切换建筑列表', async () => {
    const wrapper = mountView(BuildView)
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
    const wrapper = mountView(BuildView)
    // energy 扇区存在需要科技解锁的建筑（如聚变反应堆）
    const lockedCards = wrapper.findAll('.build-card.locked')
    expect(lockedCards.length).toBeGreaterThan(0)
    expect(wrapper.text()).toContain('需要科技：')
  })

  it('解锁建筑卡显示产出与升级按钮', () => {
    const wrapper = mountView(BuildView)
    // solar_collector 无科技前置，默认解锁
    const firstCard = wrapper.findAll('.build-card').find((c) => !c.classes().includes('locked'))
    expect(firstCard).toBeDefined()
    expect(firstCard!.find('.btn-primary').exists()).toBe(true)
    expect(firstCard!.text()).toContain('Lv.0')
  })
})

describe('BuildView — 升级流程', () => {
  useViewTestHooks()

  it('资源不足时升级按钮禁用', async () => {
    const wrapper = mountView(BuildView)
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
    const wrapper = mountView(BuildView)
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
    const wrapper = mountView(BuildView)
    const game = useGameStore()
    // 成本曲线由 buildingCost 实算：预算设为「够 2 级、不够第 3 级」（防曲线漂移）
    const c0 = buildingCost(BUILDINGS[0], 0).energy!
    const c1 = buildingCost(BUILDINGS[0], 1).energy!
    const c2 = buildingCost(BUILDINGS[0], 2).energy!
    game.resources.setAmount('energy', c0 + c1 + Math.floor(c2 / 2))
    await wrapper.vm.$nextTick()
    const preview = game.previewUpgradeBuildingSteps(BUILDINGS[0].id, 10)
    expect(preview.count).toBe(2) // 预算设计的档位

    await selectBulk10(wrapper, '.bulk-toggle')

    const costText = wrapper.find('.b-cost').text().replace(/\s+/g, '')
    expect(costText).toBe(`可买${preview.count}级·共能量${preview.cost.energy}`)
    // v1.00 按钮文案按实际可升级级数显示（非段位标称值）
    const card = wrapper.findAll('.build-card').find((c) => c.text().includes('光能收集器'))
    expect(card!.find('button.btn-primary').text()).toBe(`升级 ×${preview.count}`)
  })

  it('段位 ×10 但一级都买不起：按钮退回原文案且禁用', async () => {
    const wrapper = mountView(BuildView)
    const game = useGameStore()
    game.resources.setAmount('energy', 5) // 低于首级成本 10
    await wrapper.vm.$nextTick()

    await selectBulk10(wrapper, '.bulk-toggle')

    const card = wrapper.findAll('.build-card').find((c) => c.text().includes('光能收集器'))
    const btn = card!.find('button.btn-primary')
    expect(btn.text()).toBe('升级')
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('BuildView — 新手引导', () => {
  useViewTestHooks()

  it('未读时显示引导气泡，确认后消失', async () => {
    const wrapper = mountView(BuildView)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.ob-build').exists()).toBe(true)

    await wrapper.find('.onboard-ok').trigger('click')
    await wrapper.vm.$nextTick()
    // build 流程仅 1 步，确认后气泡关闭
    expect(wrapper.find('.ob-build').exists()).toBe(false)
  })

  it('已读（localStorage 预置）时不显示气泡', () => {
    localStorage.setItem('starcore_onboarding', JSON.stringify({ 'build-upgrade': true }))
    const wrapper = mountView(BuildView)
    expect(wrapper.find('.ob-build').exists()).toBe(false)
  })
})
