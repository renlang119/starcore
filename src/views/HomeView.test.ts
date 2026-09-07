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
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent } from 'vue'
import HomeView from './HomeView.vue'
import { useGameStore } from '@/stores/game'
import { localDateStr } from '@/stores/daily'

const mockPush = vi.fn()

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: {} }),
  useRouter: () => ({ push: mockPush }),
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
  const wrapper = mount(HomeView, {
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

describe('HomeView — 编排层', () => {
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

  it('正常挂载：五板块渲染齐备', () => {
    const wrapper = mountView()
    expect(wrapper.find('.home').exists()).toBe(true)
    // Hero / 行动队列 / 快速操作 / 签到卡 / 概况
    expect(wrapper.find('.hero').exists()).toBe(true)
    expect(wrapper.find('.action-queue').exists()).toBe(true)
    expect(wrapper.find('.quick-actions').exists()).toBe(true)
    expect(wrapper.find('[data-testid="daily-card"]').exists()).toBe(true)
    expect(wrapper.find('.overview').exists()).toBe(true)
  })

  it('文明概况渲染统计项', () => {
    const wrapper = mountView()
    expect(wrapper.text()).toContain('文明概况')
    expect(wrapper.findAll('.overview-grid li').length).toBeGreaterThan(0)
  })
})

describe('HomeView — HeroCore', () => {
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

  it('核心能量值随资源变化', async () => {
    const wrapper = mountView()
    const game = useGameStore()
    game.resources.setAmount('energy', 123456)
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.core-value').text()).not.toBe('0')
    expect(wrapper.find('.core-label').text()).toBe('星核能量')
  })

  it('点击核心跳转建造页', async () => {
    const wrapper = mountView()
    await wrapper.find('.core-visual').trigger('click')
    expect(mockPush).toHaveBeenCalledWith('/build')
  })
})

describe('HomeView — 行动队列', () => {
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

  it('可执行行动项渲染（新档有可升级建筑）', () => {
    const wrapper = mountView()
    expect(wrapper.text()).toContain('行动队列')
    // 新档默认能量 50 恰好可升级首批建筑 → 出现可升级条目
    expect(wrapper.text()).toContain('个建筑可升级')
  })

  it('探索进行中显示进度条目（0% 起步）', async () => {
    const wrapper = mountView()
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
    const wrapper = mountView()
    const game = useGameStore()
    // 全资源清零 → 无可升级/可研究；全部探索完成 → 无待探索 → 落入兜底分支
    for (const r of ['energy', 'crystal', 'alloy', 'data', 'dark'] as const) {
      game.resources.setAmount(r, 0)
    }
    for (const n of game.exploration.progress ? Object.keys(game.exploration.progress) : []) {
      game.exploration.progress[n].completed = true
    }
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('行动队列')
    expect(wrapper.text()).toContain('建造')
    expect(wrapper.text()).toContain('研究')
  })
})

describe('HomeView — DailyCard', () => {
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

  it('未签到时显示待签到，连击 0', () => {
    const wrapper = mountView()
    const badge = wrapper.find('[data-testid="checkin-badge"]')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toContain('待签到')
    expect(wrapper.find('[data-testid="streak-count"]').text()).toContain('0 天')
    // 7 个进度点
    expect(wrapper.findAll('[data-testid="streak-dots"] .dot').length).toBe(7)
  })

  it('签到后显示今日已签与连击天数', async () => {
    const wrapper = mountView()
    const game = useGameStore()
    game.daily.onTickCheckIn()
    await wrapper.vm.$nextTick()

    expect(game.daily.lastCheckIn).toBe(localDateStr())
    const badge = wrapper.find('[data-testid="checkin-badge"]')
    expect(badge.text()).toContain('今日已签')
    expect(badge.text()).toContain('连击 1 天')
  })

  it('周挑战三项渲染', async () => {
    const wrapper = mountView()
    const game = useGameStore()
    game.daily.ensureWeek()
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('[data-testid="challenge-list"] .challenge-row').length).toBe(3)
  })
})
