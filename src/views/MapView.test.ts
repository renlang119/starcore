/**
 * MapView.test.ts — 星图/探索视图组件测试
 *
 * 重点测试：
 * 1. 组件挂载与八层星图渲染
 * 2. 节点状态（锁定/可探索/探索中/已完成）
 * 3. 探索流程（原子操作通道）与据点/远征区块
 * 4. 全部完成空状态
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent } from 'vue'
import MapView from './MapView.vue'
import { useGameStore } from '@/stores/game'
import { EXPLORE_NODES, LAYER_INFO } from '@/data/explore'
import { STRONGHOLDS } from '@/data/pve'

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
  const wrapper = mount(MapView, {
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

describe('MapView — 挂载与渲染', () => {
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

  it('正常挂载并渲染八层星图', () => {
    const wrapper = mountView()
    expect(wrapper.find('.map-view').exists()).toBe(true)
    expect(wrapper.text()).toContain('探索星图')
    // 八层区块（orbit/inner/outer/deep/stellar/cluster/arm/galaxy）
    expect(wrapper.findAll('.layer-section').length).toBe(Object.keys(LAYER_INFO).length)
    // 全部节点卡
    expect(wrapper.findAll('.node-card').length).toBe(EXPLORE_NODES.length)
  })

  it('首个节点可探索，深层节点锁定并显示前置', () => {
    const wrapper = mountView()
    // node_orbit 无前置
    const orbitCard = wrapper.findAll('.node-card').find((c) => c.find('.n-name').text() !== '')!
    expect(orbitCard.find('.btn-accent').exists()).toBe(true)
    // 存在锁定节点与「需先完成」提示
    expect(wrapper.findAll('.node-card.locked').length).toBeGreaterThan(0)
    expect(wrapper.text()).toContain('需先完成：')
  })

  it('未解锁据点不显示，远征区块默认置灰', () => {
    const wrapper = mountView()
    // 新档无已完成节点 → 无已解锁据点
    expect(wrapper.find('.stronghold-section').exists()).toBe(false)
    // 远征区块可见但禁用
    expect(wrapper.find('[data-testid="endless-section"]').exists()).toBe(true)
    const endlessCard = wrapper.find('[data-testid="endless-card-locked"]')
    expect(endlessCard.exists()).toBe(true)
    expect(endlessCard.attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('攻克「沉默者旗舰」后开放')
  })
})

describe('MapView — 探索流程', () => {
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

  it('资源不足时探索按钮禁用', () => {
    const wrapper = mountView()
    const game = useGameStore()
    game.resources.setAmount('energy', 0)
    const orbitBtn = wrapper
      .findAll('.node-card')
      .find((c) => c.find('.n-name').text() === '轨道残骸带')!
      .find('.btn-accent')
    expect(orbitBtn.attributes('disabled')).toBeDefined()
  })

  it('点击探索走原子操作：进入探索态并扣减资源、显示进度条', async () => {
    const game = useGameStore()
    // 成本 100 > 新档能量底值 50，须在挂载前备足（disabled 按钮不触发 click）
    game.resources.setAmount('energy', 1e6)
    const wrapper = mountView()

    const orbitCard = wrapper
      .findAll('.node-card')
      .find((c) => c.find('.n-name').text() === '轨道残骸带')!
    await orbitCard.find('.btn-accent').trigger('click')
    await wrapper.vm.$nextTick()

    expect(game.exploration.isExploring('node_orbit')).toBe(true)
    expect(game.resources.getAmount('energy').toNumber()).toBeLessThan(1e6)
    // 探索中卡片出现进度条与 toast 反馈
    expect(wrapper.find('.n-progress').exists()).toBe(true)
    expect(wrapper.find('.toast').exists()).toBe(true)
    expect(wrapper.text()).toContain('探索已开始')
  })

  it('节点完成后显示已完成态与据点区块', async () => {
    const wrapper = mountView()
    const game = useGameStore()
    // 直接完成 node_orbit（raider_1 的前置）
    const prog = game.exploration.progress['node_orbit']
    prog.completed = true
    await wrapper.vm.$nextTick()

    const orbitCard = wrapper
      .findAll('.node-card')
      .find((c) => c.find('.n-name').text() === '轨道残骸带')!
    expect(orbitCard.classes()).toContain('completed')
    expect(orbitCard.find('.n-done').exists()).toBe(true)
    // 据点区块出现（raider_1 requires node_orbit）
    expect(wrapper.find('.stronghold-section').exists()).toBe(true)
    expect(wrapper.text()).toContain('小型掠夺者营地')
  })

  it('攻克沉默者旗舰后远征解锁，点击跳转远征页', async () => {
    const wrapper = mountView()
    const game = useGameStore()
    // 真实玩家态：锚点据点已攻克 + 前沿深度已记录
    game.combat.completedStrongholds.add('silencer_3')
    game.combat.expeditionBest = 1
    await wrapper.vm.$nextTick()

    const endlessCard = wrapper.find('[data-testid="endless-card-unlocked"]')
    expect(endlessCard.exists()).toBe(true)
    expect(endlessCard.text()).toContain('深渊·第 2 层')
    expect(wrapper.text()).toContain('历史最深 第 1 层')
    await endlessCard.trigger('click')
    expect(mockPush).toHaveBeenCalledWith('/battle/endless')
  })

  it('据点卡片点击跳转战斗页', async () => {
    const wrapper = mountView()
    const game = useGameStore()
    game.exploration.progress['node_orbit'].completed = true
    await wrapper.vm.$nextTick()

    await wrapper.find('.stronghold-card').trigger('click')
    expect(mockPush).toHaveBeenCalledWith('/battle/raider_1')
  })
})

describe('MapView — 空状态', () => {
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

  it('全部节点完成后显示空状态', async () => {
    const wrapper = mountView()
    const game = useGameStore()
    for (const n of EXPLORE_NODES) game.exploration.progress[n.id].completed = true
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.empty-state').exists()).toBe(true)
    expect(wrapper.text()).toContain('全宇宙已探索完毕')
    // 星图区块隐藏，据点区块保留（36 据点全部解锁）
    expect(wrapper.findAll('.layer-section').length).toBe(0)
    expect(wrapper.find('.stronghold-section').exists()).toBe(true)
    expect(wrapper.findAll('.stronghold-card').length).toBe(STRONGHOLDS.length)
  })
})
