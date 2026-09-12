/**
 * starcore-v087-sim.test.ts — 时间加速全玩法仿真（临时 QA 批，不入常规测试基线）
 *
 * 模拟玩家推进：建造→科技→军事训练→探索→转生→负熵购买→批量升级→自动化协议，
 * 每阶段 vitest fake timer 大步推进 tick（模拟数小时游戏时间），断言：
 * 1. 数值守恒（资源收支 = 建筑产出×时长 + 签到 + 探索奖励，无蒸发无凭空）
 * 2. 阶段推进无死锁（每阶段完成后有可达的下一动作）
 * 3. 转生闭环（重置范围正确）
 * 4. 长时间加速下无 NaN/Infinity/负值泄漏
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useGameStore } from '@/stores/game'
import { useResourcesStore } from '@/stores/resources'
import { useBuildingsStore } from '@/stores/buildings'
import { useResearchStore } from '@/stores/research'
import { useMilitaryStore } from '@/stores/military'
import { useExplorationStore } from '@/stores/exploration'
import { useTranscendStore } from '@/stores/transcend'
import { TECHS } from '@/data/tech'
import { D } from '@/lib/decimal'
import { setRelicSlotProvider } from '@/stores/relics'

const SOLAR = 'solar_collector'

/** 健康断言：全资源有限非负 */
function expectFiniteNonNegative(resources: ReturnType<typeof useResourcesStore>) {
  for (const [k, v] of Object.entries(resources.amounts)) {
    expect(v.isFinite(), `${k} 有限`).toBe(true)
    expect(v.gte(0), `${k} 非负`).toBe(true)
  }
}

describe('时间加速全玩法仿真', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    setRelicSlotProvider(() => 0)
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  /** 大步推进：先推 fake 时钟（供 Date.now），再按步进手动 tick（与生产 setInterval 同频） */
  function advance(game: ReturnType<typeof useGameStore>, seconds: number, stepSec = 1) {
    for (let done = 0; done < seconds; done += stepSec) {
      vi.advanceTimersByTime(stepSec * 1000)
      game.tick()
    }
  }

  it('阶段一：建造产出与时间严格线性（数值守恒基线）', () => {
    const game = useGameStore()
    const resources = useResourcesStore()
    const buildings = useBuildingsStore()
    resources.setAmount('energy', 100)
    advance(game, 1) // 消化首 tick 自动签到（普通日 +5000）
    for (let i = 0; i < 5; i++) game.tryUpgradeBuilding(SOLAR)
    const prod = buildings.getProduction(SOLAR, game.productionMults).energy.toNumber()
    expect(prod).toBeGreaterThan(0)
    const before = resources.getAmount('energy').toNumber()
    advance(game, 600) // 加速 10 分钟
    const gained = resources.getAmount('energy').toNumber() - before
    expect(Math.abs(gained - prod * 600)).toBeLessThan(2)
    expectFiniteNonNegative(resources)
  })

  it('阶段二：科技→解锁→训练链路无死锁推进', () => {
    const game = useGameStore()
    const resources = useResourcesStore()
    const military = useMilitaryStore()
    const research = useResearchStore()
    resources.setAmount('energy', 1e6)
    resources.setAmount('alloy', 1e4)
    resources.setAmount('data', 1e3)
    advance(game, 1) // 消化首 tick 签到
    for (const t of TECHS.filter((x) => x.branch === 'military').slice(0, 3)) {
      if (research.available(t)) game.tryResearch(t.id)
    }
    // 基础训练槽=1（v0.48 设计）：逐个入队→等完成→再入队，与真实玩家节奏一致
    let trained = 0
    for (let round = 0; round < 5; round++) {
      const ok = military.startTraining(
        'assault',
        1,
        (c) => resources.canAfford(c),
        (c) => resources.spendCost(c)
      )
      if (!ok) break
      advance(game, 10) // assault trainTime=5s，10s 必完成
      trained++
    }
    expect(trained).toBe(5)
    expect(military.getOwned('assault')).toBe(5)
    expectFiniteNonNegative(resources)
  })

  it('阶段三：探索全流程（2h 加速）——完成、发奖、解锁链', () => {
    const game = useGameStore()
    const resources = useResourcesStore()
    const exploration = useExplorationStore()
    resources.setAmount('energy', 1e6)
    resources.setAmount('data', 1e3)
    advance(game, 1)
    // node_orbit(30s) → node_inner(120s，前置 orbit)
    const ok1 = exploration.startExplore(
      'node_orbit',
      game.exploreMult,
      (c) => resources.canAfford(c),
      (c) => resources.spendCost(c)
    )
    expect(ok1).toBe(true)
    advance(game, 35)
    expect(exploration.isCompleted('node_orbit')).toBe(true)
    // orbit 完成后 inner 解锁（前置链）
    const ok2 = exploration.startExplore(
      'node_inner',
      game.exploreMult,
      (c) => resources.canAfford(c),
      (c) => resources.spendCost(c)
    )
    expect(ok2).toBe(true)
    advance(game, 130)
    expect(exploration.isCompleted('node_inner')).toBe(true)
    // 奖励入账：能量应显著高于注额减成本
    expect(resources.getAmount('energy').toNumber()).toBeGreaterThan(1e6)
    expectFiniteNonNegative(resources)
  })

  it('阶段四：转生闭环——重置范围与保留范围精确', () => {
    const game = useGameStore()
    const resources = useResourcesStore()
    const buildings = useBuildingsStore()
    const transcend = useTranscendStore()
    // 玩家路径：研究聚变点火（30 data + 200 energy）解锁聚变反应堆，堆高产能后转生
    // 先经 gain() 走一步生产把首 tick 变现（setAmount 不入 totals，属测试注入语义）
    resources.setAmount('energy', 1e7)
    resources.setAmount('data', 1000)
    advance(game, 1)
    expect(game.tryResearch('fusion_tech')).toBe(true)
    for (let i = 0; i < 40; i++) game.tryUpgradeBuilding('fusion_reactor')
    advance(game, 60)
    // 1e6 注入额 + 40 级 fusion（160/s × 60s = 9600）不足门槛 → 直接
    // 用 gain() 补足 totals 模拟长挂机积累（gain 是玩家获得能量的统一通道）
    resources.gain('energy', 1e6)
    const totalEnergyBefore = resources.getTotal('energy').toNumber()
    expect(totalEnergyBefore).toBeGreaterThan(3e5)
    const gain = game.previewTranscendGain()
    expect(gain.gt(0)).toBe(true)
    expect(game.doTranscend()).toBe(true)
    expect(buildings.getLevel('fusion_reactor')).toBe(0)
    expect(transcend.negativeEntropy.gte(gain)).toBe(true)
    // totals 随转生清零（3.14 设计意图：防白嫖负熵，成就侧已先采集终身计数）
    expect(resources.getTotal('energy').toNumber()).toBeLessThan(totalEnergyBefore)
    // 转生后负熵可购买（批量）
    transcend.negativeEntropy = D(1000)
    expect(transcend.purchaseNodeSteps('t_inf_prod', 10)).toBe(10)
    expectFiniteNonNegative(resources)
  })

  it('阶段五：极端加速（12h×2）+ 批量压力，无 NaN/Infinity', () => {
    const game = useGameStore()
    const resources = useResourcesStore()
    const buildings = useBuildingsStore()
    resources.setAmount('energy', 1e9)
    game.tryUpgradeBuildingSteps(SOLAR, 50)
    advance(game, 43200, 30)
    game.tryUpgradeBuildingSteps(SOLAR, 100)
    advance(game, 43200, 30)
    expectFiniteNonNegative(resources)
    expect(buildings.getLevel(SOLAR)).toBeGreaterThan(50)
  }, 30_000)

  it('阶段六：自动化协议长跑——买协议后挂机自动升级', () => {
    const game = useGameStore()
    const resources = useResourcesStore()
    const transcend = useTranscendStore()
    resources.setAmount('energy', 1e6)
    advance(game, 1)
    transcend.negativeEntropy = D(100)
    expect(transcend.purchaseNode('t_auto_build')).toBe(true)
    advance(game, 1800, 2) // 30 分钟，2s 步进
    expect(useBuildingsStore().getLevel(SOLAR)).toBeGreaterThan(0)
    expectFiniteNonNegative(resources)
  }, 30_000)
})
