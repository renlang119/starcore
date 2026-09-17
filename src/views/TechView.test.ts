/**
 * TechView.test.ts — 科技视图组件测试
 *
 * 重点测试：
 * 1. 组件挂载与分支筛选
 * 2. 科技状态渲染（completed/available/locked）
 * 3. 研究流程（原子操作通道）与成本乘数
 * 4. 全部完成空状态
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
import TechView from './TechView.vue'
import { useGameStore } from '@/stores/game'
import { TECHS, TECH_BRANCHES } from '@/data/tech'

vi.mock('vue-router', () => vueRouterMock())

vi.mock('@/composables/useFocusTrap', () => focusTrapMock())

describe('TechView — 挂载与筛选', () => {
  useViewTestHooks()

  it('正常挂载，默认「全部」显示所有科技', () => {
    const wrapper = mountView(TechView)
    expect(wrapper.find('.tech-view').exists()).toBe(true)
    expect(wrapper.text()).toContain('科技树')
    // 「全部」+ 各分支页签
    expect(wrapper.findAll('.branch-tab').length).toBe(Object.keys(TECH_BRANCHES).length + 1)
    expect(wrapper.findAll('.tech-card').length).toBe(TECHS.length)
  })

  it('点击分支页签只显示该分支科技', async () => {
    const wrapper = mountView(TechView)
    // 第 2 个页签 = 第一个分支（energy）
    await wrapper.findAll('.branch-tab')[1].trigger('click')
    expect(wrapper.findAll('.tech-card').length).toBe(
      TECHS.filter((t) => t.branch === 'energy').length
    )
    // 切回「全部」
    await wrapper.findAll('.branch-tab')[0].trigger('click')
    expect(wrapper.findAll('.tech-card').length).toBe(TECHS.length)
  })

  it('科技卡按 tier 升序排列', () => {
    const wrapper = mountView(TechView)
    const tiers = wrapper.findAll('.tech-card').map((c) => c.text())
    expect(tiers.length).toBe(TECHS.length)
    // 通过 vm 状态校验排序（activeBranch = 'all' 时 techsToShow 已按 tier 排序）
    const vm = wrapper.vm as any
    const shown = vm.techsToShow as unknown as { tier: number }[]
    for (let i = 1; i < shown.length; i++) {
      expect(shown[i].tier).toBeGreaterThanOrEqual(shown[i - 1].tier)
    }
  })
})

describe('TechView — 状态与成本', () => {
  useViewTestHooks()

  it('前置满足的科技显示「研究」按钮，未满足的显示锁定提示', () => {
    const wrapper = mountView(TechView)
    // 新档：无前置的科技可用，有前置的锁定
    expect(wrapper.findAll('.tech-card.available').length).toBeGreaterThan(0)
    expect(wrapper.findAll('.tech-card.locked').length).toBeGreaterThan(0)
    expect(wrapper.text()).toContain('需要：')
  })

  it('资源不足时研究按钮禁用，充足时可点击', async () => {
    const wrapper = mountView(TechView)
    const game = useGameStore()
    // fusion_tech 无前置，cost { data: 30, energy: 200 }
    const fusionCard = wrapper
      .findAll('.tech-card')
      .find((c) => c.find('.t-name').text() === '聚变点火')!
    const btn = fusionCard.find('.btn-accent')
    expect(btn.exists()).toBe(true)
    expect(btn.attributes('disabled')).toBeDefined()

    game.resources.setAmount('data', 1e6)
    game.resources.setAmount('energy', 1e6)
    await wrapper.vm.$nextTick()
    expect(game.resources.canAfford({ data: 30, energy: 200 })).toBe(true)
    expect(btn.attributes('disabled')).toBeUndefined()
  })

  it('成本乘数生效：complete 后 techCostMult 影响显示成本', async () => {
    const wrapper = mountView(TechView)
    const game = useGameStore()
    const fusionCard = wrapper
      .findAll('.tech-card')
      .find((c) => c.find('.t-name').text() === '聚变点火')!
    const costBefore = fusionCard.find('.t-cost').text()
    expect(game.techCostMult.toNumber()).toBe(1)

    // 完成成本乘数科技（直接置完成态，研究通道已由下方用例覆盖）
    game.research.complete('research_speed')
    await wrapper.vm.$nextTick()
    expect(game.techCostMult.toNumber()).toBeLessThan(1)
    const costAfter = fusionCard.find('.t-cost').text()
    expect(costAfter).not.toBe(costBefore)
  })
})

describe('TechView — 研究流程', () => {
  useViewTestHooks()

  it('点击研究走原子操作：科技完成、资源扣减、状态转为 completed', async () => {
    const wrapper = mountView(TechView)
    const game = useGameStore()
    game.resources.setAmount('data', 1e6)
    game.resources.setAmount('energy', 1e6)

    await wrapper.vm.$nextTick()
    const fusionCard = wrapper
      .findAll('.tech-card')
      .find((c) => c.find('.t-name').text() === '聚变点火')!
    await fusionCard.find('.btn-accent').trigger('click')
    await wrapper.vm.$nextTick()

    expect(game.research.isCompleted('fusion_tech')).toBe(true)
    expect(game.resources.getAmount('data').toNumber()).toBeLessThan(1e6)
    // 卡片出现已完成图标
    const doneCard = wrapper
      .findAll('.tech-card')
      .find((c) => c.find('.t-name').text() === '聚变点火')!
    expect(doneCard.classes()).toContain('completed')
    expect(doneCard.find('.status-done').exists()).toBe(true)
  })

  it('全部完成后显示空状态', async () => {
    const wrapper = mountView(TechView)
    const game = useGameStore()
    for (const t of TECHS) game.research.complete(t.id)
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.empty-state').exists()).toBe(true)
    expect(wrapper.text()).toContain('所有已知科技已研究完成')
  })

  it('分支筛选下空态写分支口径结论（v0.97）', async () => {
    const wrapper = mountView(TechView)
    const game = useGameStore()
    // 完成全部科技后切到单分支：文案写分支结论而非全量结论
    for (const t of TECHS) game.research.complete(t.id)
    await wrapper.vm.$nextTick()
    const branchBtn = wrapper.findAll('.branch-tab').find((b) => b.text() !== '全部')!
    await branchBtn.trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.empty-state').exists()).toBe(true)
    expect(wrapper.text()).toContain('分支的科技已全部研究完成')
    expect(wrapper.text()).not.toContain('所有已知科技已研究完成')
  })
})

describe('TechView — 新手引导', () => {
  useViewTestHooks()

  it('未读时显示引导气泡，已读时不显示', async () => {
    await expectOnboardingBubble(TechView, { selector: '.onboard-tech', stepId: 'tech-research' })
  })
})
