/**
 * RelicView.test.ts — 遗物视图组件测试
 *
 * 重点测试：
 * 1. 组件挂载与装备槽
 * 2. 装备/卸下与槽位
 * 3. 合成工坊（选材模式/稀有度一致性/合成产物）
 * 4. 套装区块与图鉴计数
 * 5. 丢弃二次确认
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import { mountView, useViewTestHooks, vueRouterMock, focusTrapMock } from '@/tests/view-mount'
import RelicView from './RelicView.vue'
import { useRelicsStore } from '@/stores/relics'
import { useGameStore } from '@/stores/game'
import { RELIC_POOL, RELIC_SETS, getRelicById } from '@/data/relics'

vi.mock('vue-router', () => vueRouterMock())

vi.mock('@/composables/useFocusTrap', () => focusTrapMock())

describe('RelicView — 挂载与空状态', () => {
  useViewTestHooks()

  it('正常挂载：装备槽、合成工坊、套装区块齐备', () => {
    const wrapper = mountView(RelicView, {
      stubs: { Transition: { template: '<div><slot /></div>' } },
    })
    expect(wrapper.find('.relic-view').exists()).toBe(true)
    expect(wrapper.text()).toContain('遗物')
    // 槽位数 = maxSlots（默认 4 + 转生加成，由 store 派生）
    expect(wrapper.findAll('.slot').length).toBe(useRelicsStore().maxSlots)
    expect(wrapper.find('[data-testid="fusion-section"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="sets-section"]').exists()).toBe(true)
    expect(wrapper.findAll('.set-row').length).toBe(RELIC_SETS.length)
  })

  it('无遗物时图鉴显示空状态', () => {
    const wrapper = mountView(RelicView, {
      stubs: { Transition: { template: '<div><slot /></div>' } },
    })
    expect(wrapper.text()).toContain('尚未发现遗物')
    expect(wrapper.find('.relic-list').exists()).toBe(false)
  })
})

describe('RelicView — 装备与卸下', () => {
  useViewTestHooks()

  it('点装备按钮装到首个空槽，再点同槽卸下', async () => {
    const wrapper = mountView(RelicView, {
      stubs: { Transition: { template: '<div><slot /></div>' } },
    })
    const relics = useRelicsStore()
    relics.obtain(RELIC_POOL[0]) // r_energy_1
    await wrapper.vm.$nextTick()

    // 图鉴 1 件 1 种
    expect(wrapper.text()).toContain('1 件 / 1 种')
    const card = wrapper.find('.relic-card')
    await card.find('[data-testid="equip-button"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(relics.isEquipped(relics.owned[0].instanceId)).toBe(true)
    expect(wrapper.find('.slot-filled').exists()).toBe(true)
    expect(wrapper.text()).toContain('已装备')
    // 已装备后卡面装备按钮转为禁用的「已装备」
    const equipBtn = card.find('[data-testid="equip-button"]')
    expect(equipBtn.text()).toBe('已装备')
    expect(equipBtn.attributes('disabled')).toBeDefined()

    // 点已填充的槽位 → 卸下
    await wrapper.find('.slot-filled').trigger('click')
    await wrapper.vm.$nextTick()
    expect(relics.isEquipped(relics.owned[0].instanceId)).toBe(false)
  })

  it('装备遗物产生「当前效果」区块', async () => {
    const wrapper = mountView(RelicView, {
      stubs: { Transition: { template: '<div><slot /></div>' } },
    })
    const relics = useRelicsStore()
    relics.obtain(RELIC_POOL[0])
    await wrapper.vm.$nextTick()
    await wrapper.find('.relic-card [data-testid="equip-button"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.active-effects').exists()).toBe(true)
    expect(wrapper.findAll('.eff-tag').length).toBeGreaterThan(0)
  })
})

describe('RelicView — 合成工坊', () => {
  useViewTestHooks()

  it('选材模式开关与选材回填', async () => {
    const wrapper = mountView(RelicView, {
      stubs: { Transition: { template: '<div><slot /></div>' } },
    })
    const relics = useRelicsStore()
    relics.obtain(RELIC_POOL[0])
    relics.obtain(RELIC_POOL[1])
    relics.obtain(RELIC_POOL[2]) // 三件 common
    await wrapper.vm.$nextTick()

    // 开启选材模式
    await wrapper.find('[data-testid="select-mode-button"]').trigger('click')
    expect(wrapper.text()).toContain('选材中')
    expect(wrapper.find('.fusion-slot.filled').exists()).toBe(false)

    // 依次点 3 张卡的选材按钮
    const cards = wrapper.findAll('.relic-card')
    for (const c of cards) await c.find('[data-testid="select-material-button"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('.fusion-slot.filled').length).toBe(3)
    expect(wrapper.findAll('.relic-card.material-selected').length).toBe(3)
    // 材料稀有度提示出现
    expect(wrapper.text()).toContain('材料稀有度：普通')
  })

  it('稀有度混选被 toast 拒绝', async () => {
    const wrapper = mountView(RelicView, {
      stubs: { Transition: { template: '<div><slot /></div>' } },
    })
    const relics = useRelicsStore()
    relics.obtain(RELIC_POOL[0]) // common
    relics.obtain(RELIC_POOL.find((r) => r.id === 'r_energy_2')!) // rare
    await wrapper.vm.$nextTick()

    await wrapper.find('[data-testid="select-mode-button"]').trigger('click')
    const cards = wrapper.findAll('.relic-card')
    await cards[0].find('[data-testid="select-material-button"]').trigger('click') // common
    await cards[1].find('[data-testid="select-material-button"]').trigger('click') // rare → 拒绝
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('材料稀有度须一致')
    // 仅 1 件入选
    expect(wrapper.findAll('.fusion-slot.filled').length).toBe(1)
  })

  it('合成成功：3 件 common → 1 件 rare，材料消耗，产物弹窗出现', async () => {
    const wrapper = mountView(RelicView, {
      stubs: { Transition: { template: '<div><slot /></div>' } },
    })
    const relics = useRelicsStore()
    relics.obtain(RELIC_POOL[0])
    relics.obtain(RELIC_POOL[1])
    relics.obtain(RELIC_POOL[2])
    await wrapper.vm.$nextTick()

    await wrapper.find('[data-testid="select-mode-button"]').trigger('click')
    for (const c of wrapper.findAll('.relic-card'))
      await c.find('[data-testid="select-material-button"]').trigger('click')
    await wrapper.vm.$nextTick()

    const fusionBtn = wrapper.find('[data-testid="fusion-button"]')
    expect(fusionBtn.attributes('disabled')).toBeUndefined()
    await fusionBtn.trigger('click')
    await wrapper.vm.$nextTick()

    // 弹窗 + 产物为 rare
    expect(wrapper.text()).toContain('合成成功')
    expect(wrapper.find('[data-testid="synth-product-rare"]').exists()).toBe(true)
    // owned 变化：3 → 1
    expect(relics.owned.length).toBe(1)
    expect(relics.owned[0].rarity).toBe('rare')
  })

  it('不足 3 件时合成按钮禁用', async () => {
    const wrapper = mountView(RelicView, {
      stubs: { Transition: { template: '<div><slot /></div>' } },
    })
    const relics = useRelicsStore()
    relics.obtain(RELIC_POOL[0])
    relics.obtain(RELIC_POOL[1])
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="fusion-button"]').attributes('disabled')).toBeDefined()
  })
})

describe('RelicView — 套装', () => {
  useViewTestHooks()

  it('装备 2 件同系遗物激活 partial 套装', async () => {
    const wrapper = mountView(RelicView, {
      stubs: { Transition: { template: '<div><slot /></div>' } },
    })
    const relics = useRelicsStore()
    // 掠夺者战团成员：r_energy_1 / r_alloy_1（均 common）
    const a = relics.obtain(RELIC_POOL.find((r) => r.id === 'r_energy_1')!)
    const b = relics.obtain(RELIC_POOL.find((r) => r.id === 'r_alloy_1')!)
    await wrapper.vm.$nextTick()

    await wrapper.find('.relic-card [data-testid="equip-button"]').trigger('click') // 装备 a
    const cardB = wrapper.findAll('.relic-card').find((c) => c.text().includes('合金碎屑'))!
    await cardB.find('[data-testid="equip-button"]').trigger('click') // 装备 b
    await wrapper.vm.$nextTick()

    const row = wrapper.find('[data-testid="set-row-raiders"]')
    expect(row.exists()).toBe(true)
    expect(row.classes()).toContain('active')
    expect(row.text()).toContain('2/3')
    // 套装加成进入效果列表
    expect(relics.equippedEffects.length).toBe(3) // 2 遗物 + 1 套装
    void a
    void b
  })
})

describe('RelicView — 丢弃', () => {
  useViewTestHooks()

  it('丢弃需两次点击确认，已装备遗物禁用丢弃', async () => {
    const wrapper = mountView(RelicView, {
      stubs: { Transition: { template: '<div><slot /></div>' } },
    })
    const relics = useRelicsStore()
    const r1 = relics.obtain(RELIC_POOL[0])
    relics.obtain(RELIC_POOL[1])
    relics.equip(r1.instanceId, 0) // 装备第一件
    await wrapper.vm.$nextTick()

    const cards = wrapper.findAll('.relic-card')
    const equippedCard = cards[0]
    const discardBtn = equippedCard.find('.discard-btn')
    expect(discardBtn.attributes('disabled')).toBeDefined()
    expect(discardBtn.text()).toBe('请先卸下')

    // 未装备卡：第一次点击 → 待确认文案；第二次 → 确认丢弃
    const freeBtn = cards[1].find('.discard-btn')
    await freeBtn.trigger('click')
    await wrapper.vm.$nextTick()
    expect(freeBtn.text()).toBe('确认丢弃？')
    expect(relics.owned.length).toBe(2)

    await freeBtn.trigger('click')
    await wrapper.vm.$nextTick()
    expect(relics.owned.length).toBe(1)
  })
})

describe('RelicView — 强化（v0.70）', () => {
  useViewTestHooks()

  it('打开强化面板：显示等级与下一级成本', async () => {
    const wrapper = mountView(RelicView, {
      stubs: { Transition: { template: '<div><slot /></div>' } },
    })
    const game = useGameStore()
    game.relics.obtain(getRelicById('r_energy_3')!) // epic
    await wrapper.vm.$nextTick()

    await wrapper.find('[data-testid="enhance-button"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="enhance-modal"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="enhance-level"]').text()).toContain('0 / 20')
    // epic 首级成本 25M
    expect(wrapper.find('[data-testid="enhance-cost"]').text()).toContain('25M')
  })

  it('强化成功：等级+1、能量扣除、卡面 Lv 与效果 label 更新', async () => {
    const wrapper = mountView(RelicView, {
      stubs: { Transition: { template: '<div><slot /></div>' } },
    })
    const game = useGameStore()
    game.resources.setAmount('energy', 1e8)
    game.relics.obtain(getRelicById('r_energy_3')!)
    await wrapper.vm.$nextTick()

    await wrapper.find('[data-testid="enhance-button"]').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="enhance-confirm"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(game.relics.owned[0].level).toBe(1)
    expect(wrapper.find('[data-testid="relic-level-badge"]').text()).toBe('Lv1')
    // 卡面与面板内 label 更新为强化后值（Lv1 epic：+40% → +42%）
    expect(wrapper.text()).toContain('能量产出 +42%')
    expect(wrapper.find('[data-testid="enhance-level"]').text()).toContain('1 / 20')
    // 能量扣除：10 亿 - 2500 万 = 7500 万
    expect(game.resources.getAmount('energy').toNumber()).toBe(1e8 - 2.5e7)
  })

  it('能量不足：按钮禁用且等级不变（一级都买不起时禁用）', async () => {
    const wrapper = mountView(RelicView, {
      stubs: { Transition: { template: '<div><slot /></div>' } },
    })
    const game = useGameStore()
    game.relics.obtain(getRelicById('r_energy_3')!) // 新档能量 50，远低于 25M
    await wrapper.vm.$nextTick()

    await wrapper.find('[data-testid="enhance-button"]').trigger('click')
    await wrapper.vm.$nextTick()

    // 规范口径：一级都买不起时禁用（disabled，点击不再 toast）
    expect(
      (wrapper.find('[data-testid="enhance-confirm"]').element as HTMLButtonElement).disabled
    ).toBe(true)
    expect(game.relics.owned[0].level).toBe(0)
    expect(wrapper.find('[data-testid="relic-level-badge"]').exists()).toBe(false)
  })

  it('段位 ×100 的按钮文案按实际可完成级数显示（v1.00）', async () => {
    const wrapper = mountView(RelicView, {
      stubs: { Transition: { template: '<div><slot /></div>' } },
    })
    const game = useGameStore()
    // epic 首级 25M、每级 ×1.5：25 + 37.5 = 62.5M ≤ 100M < +56.25M → 可完成 2 级
    game.resources.setAmount('energy', 1e8)
    game.relics.obtain(getRelicById('r_energy_3')!)
    await wrapper.vm.$nextTick()

    await wrapper.find('[data-testid="enhance-button"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="enhance-confirm"]').text()).toBe('强化')

    await wrapper
      .findAll('.enhance-actions .seg-btn')
      .find((b) => b.text() === '×100')!
      .trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="enhance-confirm"]').text()).toBe('强化 ×2')
    // 与实扣一致：点一次只完成 2 级（不是标称的 100 级）
    await wrapper.find('[data-testid="enhance-confirm"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(game.relics.owned[0].level).toBe(2)
    expect(wrapper.find('[data-testid="relic-level-badge"]').text()).toBe('Lv2')
  })
})
