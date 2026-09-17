/**
 * HomeView.test.ts — 首页（编排层 + 板块组件）测试
 *
 * 重点测试：
 * 1. 编排层挂载：五板块齐备
 * 2. HeroCore 核心视觉与跳转
 * 3. 行动队列（可执行/进行中/兜底口径）
 * 4. DailyCard 签到卡渲染
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import { mountView, useViewTestHooks, vueRouterMock, focusTrapMock } from '@/tests/view-mount'
import HomeView from './HomeView.vue'
import { useGameStore } from '@/stores/game'
import { localDateStr, STREAK_CYCLE, WEEK_CHALLENGE_COUNT } from '@/stores/daily'
import { EXPLORE_NODES } from '@/data/explore'
import { exploredNodes } from '@/tests/fixtures'

const mockPush = vi.fn()

vi.mock('vue-router', () => vueRouterMock({ push: () => mockPush }))

vi.mock('@/composables/useFocusTrap', () => focusTrapMock())

describe('HomeView — 编排层', () => {
  useViewTestHooks()

  it('正常挂载：五板块渲染齐备', () => {
    const wrapper = mountView(HomeView, {
      stubs: { Transition: { template: '<div><slot /></div>' } },
    })
    expect(wrapper.find('.home').exists()).toBe(true)
    // Hero / 行动队列 / 快速操作 / 签到卡 / 概况
    expect(wrapper.find('.hero').exists()).toBe(true)
    expect(wrapper.find('.action-queue').exists()).toBe(true)
    expect(wrapper.find('.quick-actions').exists()).toBe(true)
    expect(wrapper.find('[data-testid="daily-card"]').exists()).toBe(true)
    expect(wrapper.find('.overview').exists()).toBe(true)
  })

  it('文明概况渲染统计项', () => {
    const wrapper = mountView(HomeView, {
      stubs: { Transition: { template: '<div><slot /></div>' } },
    })
    expect(wrapper.text()).toContain('文明概况')
    expect(wrapper.findAll('.overview-grid li').length).toBeGreaterThan(0)
  })
})

describe('HomeView — HeroCore', () => {
  useViewTestHooks()

  it('核心能量值随资源变化', async () => {
    const wrapper = mountView(HomeView, {
      stubs: { Transition: { template: '<div><slot /></div>' } },
    })
    const game = useGameStore()
    game.resources.setAmount('energy', 123456)
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.core-value').text()).not.toBe('0')
    expect(wrapper.find('.core-label').text()).toBe('星核能量')
  })

  it('点击核心跳转建造页', async () => {
    const wrapper = mountView(HomeView, {
      stubs: { Transition: { template: '<div><slot /></div>' } },
    })
    await wrapper.find('.core-visual').trigger('click')
    expect(mockPush).toHaveBeenCalledWith('/build')
  })
})

describe('HomeView — 行动队列', () => {
  useViewTestHooks()

  it('可执行行动项渲染（新档有可升级建筑）', () => {
    const wrapper = mountView(HomeView, {
      stubs: { Transition: { template: '<div><slot /></div>' } },
    })
    expect(wrapper.text()).toContain('行动队列')
    // 新档默认能量 50 恰好可升级首批建筑 → 出现可升级条目
    expect(wrapper.text()).toContain('个建筑可升级')
  })

  it('探索进行中显示进度条目（0% 起步）', async () => {
    const wrapper = mountView(HomeView, {
      stubs: { Transition: { template: '<div><slot /></div>' } },
    })
    const game = useGameStore()
    game.resources.setAmount('energy', 1e6)
    game.exploration.startExplore(
      'node_orbit',
      game.exploreMult,
      (c) => game.resources.canAfford(c),
      (c) => game.resources.spendCost(c)
    )
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('探索 轨道残骸带')
    expect(wrapper.text()).toContain('0%')
  })

  it('无任何行动时显示建造/研究兜底入口', async () => {
    const wrapper = mountView(HomeView, {
      stubs: { Transition: { template: '<div><slot /></div>' } },
    })
    const game = useGameStore()
    // 全资源清零 → 无可升级/可研究；全部探索完成 → 无待探索 → 落入兜底分支
    for (const r of ['energy', 'crystal', 'alloy', 'data', 'dark'] as const) {
      game.resources.setAmount(r, 0)
    }
    // 全部节点完成（由数据表派生，新增节点自动跟随）
    exploredNodes(...EXPLORE_NODES.map((n) => n.id))
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('行动队列')
    expect(wrapper.text()).toContain('建造')
    expect(wrapper.text()).toContain('研究')
  })
})

describe('HomeView — DailyCard', () => {
  useViewTestHooks()

  it('未签到时显示待签到，连击 0', () => {
    const wrapper = mountView(HomeView, {
      stubs: { Transition: { template: '<div><slot /></div>' } },
    })
    const badge = wrapper.find('[data-testid="checkin-badge"]')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toContain('待签到')
    expect(wrapper.find('[data-testid="streak-count"]').text()).toContain('0 天')
    // 7 个进度点
    expect(wrapper.findAll('[data-testid="streak-dots"] .dot').length).toBe(STREAK_CYCLE)
  })

  it('签到后显示今日已签与连击天数', async () => {
    const wrapper = mountView(HomeView, {
      stubs: { Transition: { template: '<div><slot /></div>' } },
    })
    const game = useGameStore()
    game.daily.onTickCheckIn()
    await wrapper.vm.$nextTick()

    expect(game.daily.lastCheckIn).toBe(localDateStr())
    const badge = wrapper.find('[data-testid="checkin-badge"]')
    expect(badge.text()).toContain('今日已签')
    expect(badge.text()).toContain('连击 1 天')
  })

  it('周挑战三项渲染', async () => {
    const wrapper = mountView(HomeView, {
      stubs: { Transition: { template: '<div><slot /></div>' } },
    })
    const game = useGameStore()
    game.daily.ensureWeek()
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('[data-testid="challenge-list"] .challenge-row').length).toBe(
      WEEK_CHALLENGE_COUNT
    )
  })
})
