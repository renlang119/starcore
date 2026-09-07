/**
 * AchievementsView.test.ts — 成就视图组件测试
 *
 * 重点测试：
 * 1. 组件挂载与汇总面板
 * 2. 分类分区与卡片渲染
 * 3. 解锁态（时间戳）与进行中态（进度条）
 * 4. 加成汇总计算
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent } from 'vue'
import AchievementsView from './AchievementsView.vue'
import { useGameStore } from '@/stores/game'
import { ACHIEVEMENTS, ACHIEVEMENT_CATEGORIES, groupByCategory } from '@/data/achievements'

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
  const wrapper = mount(AchievementsView, {
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

describe('AchievementsView — 挂载与汇总', () => {
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

  it('正常挂载：汇总面板显示 0/总数与未获得加成', () => {
    const wrapper = mountView()
    expect(wrapper.find('.achievements-view').exists()).toBe(true)
    expect(wrapper.text()).toContain('成就殿堂')
    expect(wrapper.find('.count-num').text()).toBe('0')
    expect(wrapper.find('.count-total').text()).toContain(String(ACHIEVEMENTS.length))
    expect(wrapper.find('.bonus-value').text()).toBe('尚未获得加成')
  })

  it('按分类分区渲染全部 31 个成就卡片', () => {
    const wrapper = mountView()
    const groups = groupByCategory()
    expect(wrapper.findAll('.ach-section').length).toBe(groups.length)
    expect(wrapper.findAll('.ach-card').length).toBe(ACHIEVEMENTS.length)
    // 分区标题来自 ACHIEVEMENT_CATEGORIES
    for (const [cat] of groups) {
      expect(wrapper.text()).toContain(ACHIEVEMENT_CATEGORIES[cat].label)
    }
  })
})

describe('AchievementsView — 解锁与进度', () => {
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

  it('未解锁成就显示进度条与当前值/阈值', () => {
    const wrapper = mountView()
    // 新档全部未解锁 → 全部有进度条
    expect(wrapper.findAll('.ach-progress').length).toBe(ACHIEVEMENTS.length)
    expect(wrapper.findAll('.bar-fill').length).toBe(ACHIEVEMENTS.length)
    // 首个能量成就（ach_energy_1，阈值 1e5）进度 0
    const firstCard = wrapper.findAll('.ach-card')[0]
    expect(firstCard.text()).toContain('0 /')
  })

  it('解锁成就显示时间戳与高亮态', async () => {
    const wrapper = mountView()
    const game = useGameStore()
    game.achievements.unlocked['ach_energy_1'] = Date.now()
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('.ach-card.unlocked').length).toBe(1)
    expect(wrapper.findAll('.ach-done').length).toBe(1)
    expect(wrapper.text()).toContain('✓ 已解锁')
    // 汇总计数更新
    expect(wrapper.find('.count-num').text()).toBe('1')
  })

  it('解锁带加成的成就后汇总面板显示加成预览', async () => {
    const wrapper = mountView()
    const game = useGameStore()
    // ach_energy_1: prod(1) → production_mult 1.01 → +1%
    game.achievements.unlocked['ach_energy_1'] = Date.now()
    await wrapper.vm.$nextTick()

    const bonus = wrapper.find('.bonus-value').text()
    expect(bonus).not.toBe('尚未获得加成')
    expect(bonus).toContain('全产出 +1%')
  })

  it('进度条宽度随终身计数增长', async () => {
    const wrapper = mountView()
    const game = useGameStore()
    // 首个建造成就 metric=upgrades：计数 0 → 1，进度条从 0 宽变为有宽
    const firstBuildCard = () =>
      wrapper.findAll('.ach-card').find((c) => c.text().includes('累计升级'))!
    await wrapper.vm.$nextTick()
    const before = firstBuildCard().find('.bar-fill').attributes('style') ?? ''
    game.achievements.recordUpgrade(1)
    await wrapper.vm.$nextTick()
    const after = firstBuildCard().find('.bar-fill').attributes('style') ?? ''
    expect(before).not.toBe(after)
    expect(after).toContain('width')
    // 进度文本出现 1 / 阈值
    expect(firstBuildCard().text()).toContain('1 /')
  })
})
