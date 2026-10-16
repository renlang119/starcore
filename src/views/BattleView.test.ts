/**
 * BattleView.test.ts：战斗视图组件测试
 *
 * 重点测试：
 * 1. 组件挂载
 * 2. 战斗结果弹窗显示
 * 3. 奖励发放时机与防重复（回归验证）
 * 4. 远征深度上限封顶
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  mountView,
  useViewTestHooks,
  sharedVueRouterMock,
  focusTrapMock,
  routeState,
} from '@/tests/view-mount'
import BattleView from './BattleView.vue'
import { useResourcesStore } from '@/stores/resources'
import { useMilitaryStore } from '@/stores/military'
import { useCombatStore } from '@/stores/combat'
import { ENDLESS_STRONGHOLD_ID } from '@/data/endless'
import { WEEKLY_BOSS_ID } from '@/data/weekly-boss'
import { useGameStore } from '@/stores/game'
import { exploredNodes } from '@/tests/fixtures'
import { resetProviderSingletons } from '@/tests/reset-providers'

vi.mock('vue-router', () => sharedVueRouterMock())

vi.mock('@/composables/useFocusTrap', () => focusTrapMock())

// isolate:false 下旧 pinia 的 provider 残留闭包会把 active pinia 切回旧实例，
// 致组件与直取 store 读不到同一实例（连跑泄漏）；全文件统一前置重置。
beforeEach(() => {
  resetProviderSingletons()
})

function mountBattle() {
  return mountView(BattleView)
}

function setupBattleReady() {
  const resources = useResourcesStore()
  const military = useMilitaryStore()

  // 设置足够资源
  resources.setAmount('energy', 1e6)
  resources.setAmount('crystal', 1e5)
  resources.setAmount('alloy', 1e4)

  // 直接设置编队中有士兵（跳过训练流程）
  military.formations[0].units.assault = 10
  military.owned.assault = 10
}

describe('BattleView — 挂载与渲染', () => {
  useViewTestHooks()

  beforeEach(() => {
    routeState.params = { id: 'raider_1' }
    setupBattleReady()
  })

  it('正常挂载并渲染战斗视图', () => {
    const wrapper = mountBattle()

    expect(wrapper.exists()).toBe(true)
    expect(wrapper.find('.battle-view').exists()).toBe(true)
  })

  it('显示编队信息和驻扎区域', () => {
    const wrapper = mountBattle()

    // 战斗按钮区域存在（迁移后 class 从 .btn-battle → .btn-accent）
    expect(wrapper.find('[data-testid="battle-start"]').exists()).toBe(true)
  })
})

describe('BattleView — 驻扎守卫与确认', () => {
  useViewTestHooks()

  beforeEach(() => {
    routeState.params = { id: 'raider_1' }
    setupBattleReady()
  })

  it('未攻克据点驻扎按钮禁用', () => {
    const wrapper = mountBattle()
    const btn = wrapper.find('[data-testid="battle-garrison"]')
    expect(btn.exists()).toBe(true)
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('已攻克可驻扎：点击弹出收益确认，确认后进入驻扎态', async () => {
    exploredNodes('node_orbit')
    const combat = useCombatStore()
    combat.completedStrongholds.add('raider_1')
    const wrapper = mountBattle()
    const btn = wrapper.find('[data-testid="battle-garrison"]')
    expect((btn.element as HTMLButtonElement).disabled).toBe(false)
    await btn.trigger('click')
    const modal = wrapper.find('.garrison-confirm-modal')
    expect(modal.exists()).toBe(true)
    expect(modal.text()).toContain('挂机驻扎')
    await modal.find('.btn-accent').trigger('click')
    expect(combat.garrisoned['raider_1']?.formationId).toBe('f1')
  })
})

describe('BattleView — 无尽远征深度步进', () => {
  useViewTestHooks()

  beforeEach(() => {
    routeState.params = { id: ENDLESS_STRONGHOLD_ID }
    setupBattleReady()
  })

  it('进页跟随前沿且加号禁用，退至深度 1 后减号禁用', async () => {
    const combat = useCombatStore()
    combat.expeditionBest = 2 // 前沿 = best+1 = 3
    const wrapper = mountBattle()
    const minus = wrapper.find('[data-testid="endless-depth-minus"]')
    const plus = wrapper.find('[data-testid="endless-depth-plus"]')
    expect(minus.exists()).toBe(true)
    // 初始深度自动跟随前沿 3：前沿徽标在、加号禁用、减号可用
    expect(wrapper.find('[data-testid="endless-depth-value"]').text()).toContain('前沿')
    expect((plus.element as HTMLButtonElement).disabled).toBe(true)
    expect((minus.element as HTMLButtonElement).disabled).toBe(false)
    await minus.trigger('click')
    await minus.trigger('click')
    expect(wrapper.find('[data-testid="endless-depth-value"]').text()).toContain('第 1 层')
    expect((minus.element as HTMLButtonElement).disabled).toBe(true) // 深度 1 触底禁用
  })
})

describe('BattleView — 战斗流程与奖励发放', () => {
  useViewTestHooks()

  beforeEach(() => {
    routeState.params = { id: 'raider_1' }
    setupBattleReady()
  })

  it('startBattle 后战报播完弹出结果弹窗', async () => {
    vi.useFakeTimers()
    const wrapper = mountBattle()

    const vm = wrapper.vm as any
    vm.startBattle()
    await wrapper.vm.$nextTick()
    // 战报播完前弹窗不出场（v1.56 战斗过程演出）
    vi.advanceTimersByTime(6000)
    await wrapper.vm.$nextTick()

    // 应显示结果弹窗
    const overlay = wrapper.find('.modal-overlay')
    expect(overlay.exists()).toBe(true)
    vi.useRealTimers()
  })

  it('胜利奖励在战斗结算时即时到账，弹窗动作与重复调用不再发放', async () => {
    const wrapper = mountBattle()

    const resources = useResourcesStore()
    const vm = wrapper.vm as any
    const before = resources.getAmount('energy').toNumber()

    // 开始战斗（raider_1 奖励能量 500，结算即到账）
    vm.startBattle()
    await wrapper.vm.$nextTick()
    const afterBattle = resources.getAmount('energy').toNumber()
    expect(afterBattle).toBe(before + 500)

    // 弹窗动作与重复调用不再发放（防重复）
    vm.skipPlayback()
    vm.confirmResult()
    // v1.66 路由语义显式断言（知秋复核增强）：胜利确认跳转星图 /map
    expect(routeState.push).toHaveBeenCalledWith('/map')
    vm.stayHere()
    vm.confirmResult()
    await wrapper.vm.$nextTick()
    expect(resources.getAmount('energy').toNumber()).toBe(afterBattle)
  })
})

describe('BattleView — 战报逐条播出（v1.56）', () => {
  useViewTestHooks()

  // matchMedia 托管：共享 worker 下他文件（TopBar/AppShell）的文件级桩
  // 不可配置且 matches 取值不定，本组用例须自行钉死环境（默认非减动效）。
  // 不可配置桩只能换值还原；属性不存在时用可配置 defineProperty、用后删除。
  let priorMm: PropertyDescriptor | undefined
  function stubMatchMedia(matches: boolean) {
    const stub = (query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
      dispatchEvent: vi.fn(),
    })
    if (priorMm && !priorMm.configurable) {
      ;(window as { matchMedia?: unknown }).matchMedia = stub
    } else {
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        writable: true,
        value: stub,
      })
    }
  }
  function restoreMatchMedia() {
    if (priorMm && !priorMm.configurable) {
      ;(window as { matchMedia?: unknown }).matchMedia = priorMm.value
    } else if (priorMm) {
      Object.defineProperty(window, 'matchMedia', priorMm)
    } else {
      delete (window as { matchMedia?: unknown }).matchMedia
    }
    priorMm = undefined
  }

  beforeEach(() => {
    routeState.params = { id: 'raider_1' }
    setupBattleReady()
    vi.useFakeTimers()
    priorMm = Object.getOwnPropertyDescriptor(window, 'matchMedia')
    stubMatchMedia(false)
  })
  afterEach(() => {
    vi.useRealTimers()
    restoreMatchMedia()
  })

  it('弹窗延后出场：战报逐条递增，播完弹窗出现', async () => {
    const wrapper = mountBattle()
    const vm = wrapper.vm as any
    vm.startBattle()
    await wrapper.vm.$nextTick()
    // 弹窗不立即出现，播出进行中
    expect(wrapper.find('.modal-overlay').exists()).toBe(false)
    expect(vm.playing).toBe(true)

    vi.advanceTimersByTime(260)
    await wrapper.vm.$nextTick()
    const early = wrapper.findAll('.log-entry').length
    expect(early).toBeGreaterThan(0)

    vi.advanceTimersByTime(700)
    await wrapper.vm.$nextTick()
    const later = wrapper.findAll('.log-entry').length
    expect(later).toBeGreaterThan(early)

    // 播完：弹窗出场、播出态结束、战报补全
    vi.advanceTimersByTime(6000)
    await wrapper.vm.$nextTick()
    expect(vm.playing).toBe(false)
    expect(wrapper.find('.modal-overlay').exists()).toBe(true)
  })

  it('skipPlayback 立即补全战报并弹出结果弹窗', async () => {
    const wrapper = mountBattle()
    const vm = wrapper.vm as any
    vm.startBattle()
    await wrapper.vm.$nextTick()
    expect(vm.playing).toBe(true)
    vm.skipPlayback()
    await wrapper.vm.$nextTick()
    expect(vm.playing).toBe(false)
    expect(wrapper.find('.modal-overlay').exists()).toBe(true)
    expect(vm.displayedLog.length).toBe(vm.battleLog.length)
  })

  it('减动效偏好不播出，结算后弹窗即出', async () => {
    stubMatchMedia(true)
    const wrapper = mountBattle()
    const vm = wrapper.vm as any
    vm.startBattle()
    await wrapper.vm.$nextTick()
    expect(vm.playing).toBe(false)
    expect(wrapper.find('.modal-overlay').exists()).toBe(true)
  })

  it('播放期出征按钮禁用，重复 startBattle 不重置播出', async () => {
    const wrapper = mountBattle()
    const vm = wrapper.vm as any
    vm.startBattle()
    await wrapper.vm.$nextTick()
    const btn = wrapper.find('[data-testid="battle-start"]')
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)

    vi.advanceTimersByTime(260)
    await wrapper.vm.$nextTick()
    const before = vm.displayedLog.length
    const logRef = vm.battleLog
    vm.startBattle()
    await wrapper.vm.$nextTick()
    expect(vm.battleLog).toBe(logRef)

    vi.advanceTimersByTime(300)
    await wrapper.vm.$nextTick()
    expect(vm.displayedLog.length).toBeGreaterThan(before)
  })

  it('Esc 跳过播出：战报补全并弹出结果弹窗', async () => {
    const wrapper = mountBattle()
    const vm = wrapper.vm as any
    vm.startBattle()
    await wrapper.vm.$nextTick()
    expect(vm.playing).toBe(true)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()
    expect(vm.playing).toBe(false)
    expect(wrapper.find('.modal-overlay').exists()).toBe(true)
    expect(vm.displayedLog.length).toBe(vm.battleLog.length)
  })

  it('播出中卸载视图：播放定时器随作用域清理', async () => {
    const wrapper = mountBattle()
    const vm = wrapper.vm as any
    vm.startBattle()
    await wrapper.vm.$nextTick()
    expect(vm.playing).toBe(true)
    wrapper.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('BattleView — 远征深度上限', () => {
  useViewTestHooks()

  it('前沿达到最大深度时选择封顶，不出现超过上限的层数', async () => {
    routeState.params = { id: 'endless' }
    const combat = useCombatStore()
    combat.completedStrongholds.add('silencer_3')
    combat.expeditionBest = 999

    const wrapper = mountBattle()
    await wrapper.vm.$nextTick()

    const depthText = wrapper.find('[data-testid="endless-depth-value"]').text()
    expect(depthText).toContain('第 999 层')
    expect(depthText).not.toContain('1000')
    expect(wrapper.find('.depth-frontier').exists()).toBe(true)
  })
})

describe('BattleView — 战损结算与驻扎切换（v1.61 补测）', () => {
  useViewTestHooks()

  beforeEach(() => {
    routeState.params = { id: 'raider_1' }
    setupBattleReady()
  })

  it('编队全灭：清空编队、自动撤驻并提示', async () => {
    const wrapper = mountBattle()
    const combat = useCombatStore()
    exploredNodes('node_orbit')
    combat.completedStrongholds.add('raider_1')
    expect(combat.garrison('raider_1', 'f1')).toBe(true)
    const military = useMilitaryStore()
    ;(combat as unknown as { resolveBattle: unknown }).resolveBattle = () => ({
      victory: false,
      log: [{ round: 1, msg: 'demo', side: 'system' }],
      rewards: {},
      losses: { assault: 10 },
      rounds: 1,
    })
    const vm = wrapper.vm as any
    const shown: string[] = []
    vi.spyOn(vm.toast, 'show').mockImplementation((...args: unknown[]) => {
      shown.push(String(args[0]))
    })
    vm.startBattle()
    await wrapper.vm.$nextTick()
    expect(military.formations[0].units.assault).toBe(0)
    expect(combat.garrisoned['raider_1']).toBeUndefined()
    expect(shown.some((m) => m.includes('全军覆没'))).toBe(true)
    expect(shown.some((m) => m.includes('已从驻扎撤回'))).toBe(true)
  })

  it('败局弹窗：失败标题无奖励块，确认后停留原页不跳转（v1.66 补测）', async () => {
    const wrapper = mountBattle()
    const combat = useCombatStore()
    ;(combat as unknown as { resolveBattle: unknown }).resolveBattle = () => ({
      victory: false,
      log: [{ round: 1, msg: 'demo', side: 'system' }],
      rewards: {},
      losses: { assault: 4 },
      rounds: 1,
    })
    const vm = wrapper.vm as any
    vm.startBattle()
    await wrapper.vm.$nextTick()

    // 失败标题出场、无战利品区块（BattleResultModal defeat 分支）
    const overlay = wrapper.find('.modal-overlay')
    expect(overlay.exists()).toBe(true)
    expect(wrapper.find('.result-title').text()).toBe('失 败')
    expect(wrapper.find('.result-rewards').exists()).toBe(false)

    // v1.66 路由语义显式断言（知秋复核增强）：败局确认停留战斗页，不跳 /map
    vm.confirmResult()
    await wrapper.vm.$nextTick()
    expect(routeState.push).not.toHaveBeenCalled()
    expect(wrapper.find('.modal-overlay').exists()).toBe(false)
  })

  it('部分战损：编队减员并提示', async () => {
    const wrapper = mountBattle()
    const combat = useCombatStore()
    ;(combat as unknown as { resolveBattle: unknown }).resolveBattle = () => ({
      victory: true,
      log: [{ round: 1, msg: 'demo', side: 'system' }],
      rewards: {},
      losses: { assault: 4 },
      rounds: 1,
    })
    const military = useMilitaryStore()
    const vm = wrapper.vm as any
    const shown: string[] = []
    vi.spyOn(vm.toast, 'show').mockImplementation((...args: unknown[]) => {
      shown.push(String(args[0]))
    })
    vm.startBattle()
    await wrapper.vm.$nextTick()
    expect(military.formations[0].units.assault).toBe(6)
    expect(shown.some((m) => m.includes('损失 4 支部队'))).toBe(true)
  })

  it('已驻扎时点击驻扎按钮：直接撤回，不再弹确认', async () => {
    exploredNodes('node_orbit')
    const combat = useCombatStore()
    combat.completedStrongholds.add('raider_1')
    const wrapper = mountBattle()
    expect(combat.garrison('raider_1', 'f1')).toBe(true)
    const btn = wrapper.find('[data-testid="battle-garrison"]')
    expect((btn.element as HTMLButtonElement).disabled).toBe(false)
    await btn.trigger('click')
    expect(combat.garrisoned['raider_1']).toBeUndefined()
    expect(wrapper.find('.garrison-confirm-modal').exists()).toBe(false)
  })

  it('编队被他处占用：确认驻扎被拒、弹窗收合并提示', async () => {
    exploredNodes('node_orbit', 'node_inner')
    routeState.params = { id: 'raider_2' }
    const combat = useCombatStore()
    combat.completedStrongholds.add('raider_1')
    combat.completedStrongholds.add('raider_2')
    const wrapper = mountBattle()
    expect(combat.garrison('raider_1', 'f1')).toBe(true)
    const vm = wrapper.vm as any
    const shown: string[] = []
    vi.spyOn(vm.toast, 'show').mockImplementation((...args: unknown[]) => {
      shown.push(String(args[0]))
    })
    const btn = wrapper.find('[data-testid="battle-garrison"]')
    expect((btn.element as HTMLButtonElement).disabled).toBe(false)
    await btn.trigger('click')
    const modal = wrapper.find('.garrison-confirm-modal')
    expect(modal.exists()).toBe(true)
    await modal.find('.btn-accent').trigger('click')
    expect(combat.garrisoned['raider_2']).toBeUndefined()
    expect(wrapper.find('.garrison-confirm-modal').exists()).toBe(false)
    expect(shown.some((m) => m.includes('无法驻扎'))).toBe(true)
  })
})

describe('BattleView — 每周强敌（v1.61 补测）', () => {
  useViewTestHooks()

  beforeEach(() => {
    routeState.params = { id: WEEKLY_BOSS_ID }
    setupBattleReady()
    const combat = useCombatStore()
    combat.completedStrongholds.add('silencer_3')
    combat.expeditionBest = 6
  })

  it('本周已击败：出战短路，不结算不重复发奖', async () => {
    const game = useGameStore()
    game.daily.claimWeeklyBoss()
    const combat = useCombatStore()
    const spy = vi.spyOn(combat, 'resolveBattle')
    const resources = useResourcesStore()
    const before = resources.getAmount('energy').toNumber()
    const wrapper = mountBattle()
    const vm = wrapper.vm as any
    vm.startBattle()
    await wrapper.vm.$nextTick()
    expect(spy).not.toHaveBeenCalled()
    expect(resources.getAmount('energy').toNumber()).toBe(before)
    expect(wrapper.find('.modal-overlay').exists()).toBe(false)
    const btn = wrapper.find('[data-testid="battle-start"]')
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
    spy.mockRestore()
  })

  it('周 Boss 胜利：记账本周已击败并即时发放奖励', async () => {
    const wrapper = mountBattle()
    const combat = useCombatStore()
    ;(combat as unknown as { resolveBattle: unknown }).resolveBattle = () => ({
      victory: true,
      log: [{ round: 1, msg: 'demo', side: 'system' }],
      rewards: { energy: 500 },
      losses: {},
      rounds: 1,
    })
    const resources = useResourcesStore()
    const before = resources.getAmount('energy').toNumber()
    const vm = wrapper.vm as any
    vm.startBattle()
    await wrapper.vm.$nextTick()
    expect(useGameStore().daily.isWeeklyBossDefeated()).toBe(true)
    expect(resources.getAmount('energy').toNumber()).toBe(before + 500)
    expect(wrapper.find('.modal-overlay').exists()).toBe(true)
  })
})

describe('BattleView — 对阵舞台血条回放（v1.65）', () => {
  useViewTestHooks()

  // matchMedia 托管：共享 worker 下他文件桩不可配置且 matches 取值不定，
  // 本组用例须自行钉死环境（默认非减动效）。用法同 v1.56 组。
  let priorMm: PropertyDescriptor | undefined
  function stubMatchMedia(matches: boolean) {
    const stub = (query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
      dispatchEvent: vi.fn(),
    })
    if (priorMm && !priorMm.configurable) {
      ;(window as { matchMedia?: unknown }).matchMedia = stub
    } else {
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        writable: true,
        value: stub,
      })
    }
  }
  function restoreMatchMedia() {
    if (priorMm && !priorMm.configurable) {
      ;(window as { matchMedia?: unknown }).matchMedia = priorMm.value
    } else if (priorMm) {
      Object.defineProperty(window, 'matchMedia', priorMm)
    } else {
      delete (window as { matchMedia?: unknown }).matchMedia
    }
    priorMm = undefined
  }

  beforeEach(() => {
    routeState.params = { id: 'raider_1' }
    setupBattleReady()
    vi.useFakeTimers()
    priorMm = Object.getOwnPropertyDescriptor(window, 'matchMedia')
    stubMatchMedia(false)
  })
  afterEach(() => {
    vi.useRealTimers()
    restoreMatchMedia()
  })

  it('舞台随演出出现并随步进推进帧；播完后随演出面隐去', async () => {
    const wrapper = mountBattle()
    const vm = wrapper.vm as any
    vm.startBattle()
    await wrapper.vm.$nextTick()
    // 首条战报入场前舞台未渲染
    expect(wrapper.find('[data-testid="battle-stage"]').exists()).toBe(false)

    vi.advanceTimersByTime(260)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="battle-stage"]').exists()).toBe(true)
    const frameEarly = vm.stageFrame
    expect(frameEarly).toBeTruthy()

    vi.advanceTimersByTime(700)
    await wrapper.vm.$nextTick()
    // 帧随步进推进（引用换新），且敌方血池不回升
    expect(vm.stageFrame).not.toBe(frameEarly)
    expect(vm.stageFrame.enemy.totalHp).toBeLessThanOrEqual(frameEarly.enemy.totalHp)

    vi.advanceTimersByTime(6000)
    await wrapper.vm.$nextTick()
    // 播完：弹窗出场、舞台随演出面隐去、帧定格为最终状态（全胜敌方血池归零）
    expect(wrapper.find('.modal-overlay').exists()).toBe(true)
    expect(wrapper.find('[data-testid="battle-stage"]').exists()).toBe(false)
    expect(vm.stageFrame.enemy.totalHp).toBe(0)
  })

  it('点击舞台跳过播出：立即补全并弹出结果弹窗', async () => {
    const wrapper = mountBattle()
    const vm = wrapper.vm as any
    vm.startBattle()
    await wrapper.vm.$nextTick()
    vi.advanceTimersByTime(260)
    await wrapper.vm.$nextTick()
    const stage = wrapper.find('[data-testid="battle-stage"]')
    expect(stage.exists()).toBe(true)
    await stage.trigger('click')
    await wrapper.vm.$nextTick()
    expect(vm.playing).toBe(false)
    expect(wrapper.find('.modal-overlay').exists()).toBe(true)
    expect(vm.displayedLog.length).toBe(vm.battleLog.length)
  })

  it('减动效偏好：不出舞台，结算后弹窗即出', async () => {
    stubMatchMedia(true)
    const wrapper = mountBattle()
    const vm = wrapper.vm as any
    vm.startBattle()
    await wrapper.vm.$nextTick()
    expect(vm.playing).toBe(false)
    expect(wrapper.find('[data-testid="battle-stage"]').exists()).toBe(false)
    expect(wrapper.find('.modal-overlay').exists()).toBe(true)
  })
})
