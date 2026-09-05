/**
 * game.test.ts — game.ts 集成测试
 *
 * 测试 tick 循环、离线补算、转生重置的核心流程。
 * 各 Store 需按正确顺序初始化（Pinia createPinia）。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useGameStore } from './game'
import { useResourcesStore } from './resources'
import { useBuildingsStore } from './buildings'
import { useRelicsStore } from './relics'
import { useTranscendStore } from './transcend'
import { useResearchStore } from './research'
import { D } from '@/lib/decimal'
import { rollRelic } from '@/data/relics'
import { setRelicSlotProvider } from './relics'

/** 基础能量采集建筑 ID */
const SOLAR = 'solar_collector'

describe('game store — tick integration', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    // 重置模块级 slotProvider，防止跨测试污染
    setRelicSlotProvider(() => 0)
  })

  it('tryUpgradeBuilding succeeds with enough resources', () => {
    const game = useGameStore()
    const resources = useResourcesStore()
    const buildings = useBuildingsStore()

    resources.setAmount('energy', 500)
    const ok = game.tryUpgradeBuilding(SOLAR)
    expect(ok).toBe(true)
    expect(buildings.getLevel(SOLAR)).toBe(1)
  })

  it('tick runs without error after building upgrade', () => {
    const game = useGameStore()
    const resources = useResourcesStore()

    resources.setAmount('energy', 500)
    game.tryUpgradeBuilding(SOLAR)

    expect(() => game.tick()).not.toThrow()
  })

  it('tick applies resource production', () => {
    const game = useGameStore()
    const resources = useResourcesStore()
    const buildings = useBuildingsStore()

    resources.setAmount('energy', 500)
    game.tryUpgradeBuilding(SOLAR)
    expect(buildings.getLevel(SOLAR)).toBe(1)

    // tick 前记录能量
    const before = resources.getAmount('energy').toNumber()
    game.tick()
    const after = resources.getAmount('energy').toNumber()
    // 升级消耗能量，tick 应增加能量（生产量 > 0）
    expect(after).toBeGreaterThanOrEqual(before)
  })
})

describe('game store — offline gains', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('computeOfflineGains returns null for short elapsed', () => {
    const game = useGameStore()
    const result = game.computeOfflineGains(30)
    expect(result).toBeNull()
  })

  it('computeOfflineGains returns report for long elapsed with buildings', () => {
    const game = useGameStore()
    const resources = useResourcesStore()

    resources.setAmount('energy', 500)
    game.tryUpgradeBuilding(SOLAR)

    const result = game.computeOfflineGains(600)
    expect(result).not.toBeNull()
    expect(result!.duration).toBe(600)
    // 有建筑产出时，gains 应非空
    expect(Object.keys(result!.gains).length).toBeGreaterThan(0)
  })

  it('offline gains are capped at 24 hours', () => {
    const game = useGameStore()

    const result = game.computeOfflineGains(100000)
    expect(result).not.toBeNull()
    expect(result!.duration).toBe(86400)
  })
})

describe('game store — transcend reset', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    // 重置模块级 slotProvider，防止跨测试污染
    setRelicSlotProvider(() => 0)
  })

  it('doTranscend resets buildings but keeps relics', () => {
    const game = useGameStore()
    const resources = useResourcesStore()
    const buildings = useBuildingsStore()
    const relics = useRelicsStore()
    const transcend = useTranscendStore()

    // 准备：升级建筑 + 获取遗物
    resources.setAmount('energy', 1e9)
    game.tryUpgradeBuilding(SOLAR)
    game.tryUpgradeBuilding(SOLAR)
    expect(buildings.getLevel(SOLAR)).toBe(2)

    // 获取遗物
    const testRelic = rollRelic(0)
    relics.obtain(testRelic)
    expect(relics.ownedCount).toBe(1)

    // 积累足够的 total energy 以满足转生条件
    resources.gain('energy', 1e9)

    // 尝试转生
    expect(game.canTranscend()).toBe(true)
    const result = game.doTranscend()
    expect(result).toBe(true)
    // 建筑应重置
    expect(buildings.getLevel(SOLAR)).toBe(0)
    // 遗物应保留
    expect(relics.ownedCount).toBe(1)
    // 转生次数应增加
    expect(transcend.totalTranscends).toBeGreaterThan(0)
  })
})

describe('game store — 自动化 QoL（v0.58）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    setRelicSlotProvider(() => 0)
  })

  /** 给 store 购买指定转生节点 */
  function buyNodes(ids: string[]) {
    const game = useGameStore()
    const transcend = useTranscendStore()
    transcend.negativeEntropy = D(1e6)
    for (const id of ids) expect(transcend.purchaseNode(id)).toBe(true)
    return game
  }

  it('未购建造协议：tick 不自动升级建筑', () => {
    const game = useGameStore()
    const resources = useResourcesStore()
    const buildings = useBuildingsStore()
    resources.setAmount('energy', 1e6)
    game.lastTickTime = Date.now() - 1000
    game.tick()
    expect(buildings.getLevel(SOLAR)).toBe(0)
  })

  it('购买建造协议：tick 自动升级（且成就钩子联动）', () => {
    const game = buyNodes(['t_auto_build'])
    const resources = useResourcesStore()
    const buildings = useBuildingsStore()
    resources.setAmount('energy', 1e6)
    game.lastTickTime = Date.now() - 1000
    game.tick()
    expect(buildings.getLevel(SOLAR)).toBe(1)
    // 每建筑每 tick 至多 1 级
    expect(buildings.getLevel('crystal_mine')).toBe(1)
    // 成就钩子联动：自动升级计入终身计数
    expect(game.achievements.metricValue('upgrades')).toBeGreaterThanOrEqual(2)
  })

  it('建造协议尊重科技解锁门槛（未解锁高阶建筑不买）', () => {
    const game = buyNodes(['t_auto_build'])
    const resources = useResourcesStore()
    const buildings = useBuildingsStore()
    resources.setAmount('energy', 1e9)
    game.lastTickTime = Date.now() - 1000
    game.tick()
    // fusion_reactor requires fusion_tech，未研究则不被自动升级
    expect(buildings.getLevel('fusion_reactor')).toBe(0)
    // 而 SOLAR（无 requires）已升
    expect(buildings.getLevel(SOLAR)).toBeGreaterThanOrEqual(1)
  })

  it('购买研究协议：tick 自动完成可用科技（成就联动）', () => {
    const game = buyNodes(['t_auto_research'])
    const resources = useResourcesStore()
    const research = useResearchStore()
    resources.setAmount('data', 1e6)
    resources.setAmount('energy', 1e9)
    game.lastTickTime = Date.now() - 1000
    game.tick()
    expect(research.count).toBeGreaterThan(0)
    // 首个可研究科技是 fusion_tech（无 requires）
    expect(research.isCompleted('fusion_tech')).toBe(true)
    expect(game.achievements.metricValue('researches')).toBe(research.count)
  })

  it('购买探索协议：tick 自动开始可探索节点', () => {
    const game = buyNodes(['t_auto_explore'])
    const resources = useResourcesStore()
    resources.setAmount('energy', 1e6)
    game.lastTickTime = Date.now() - 1000
    game.tick()
    // node_orbit 无前置且买得起 → 已开始探索
    expect(game.exploration.isExploring('node_orbit')).toBe(true)
    const startTime = game.exploration.progress['node_orbit'].startTime
    const energyBefore = resources.getAmount('energy').toNumber()
    // 已在探索中的节点不会重复开始（isExploring 挡），不会重复扣探索费
    game.lastTickTime = Date.now() - 1000
    game.tick()
    expect(game.exploration.progress['node_orbit'].startTime).toBe(startTime)
    expect(resources.getAmount('energy').toNumber()).toBe(energyBefore)
  })

  it('三个协议独立：只买探索协议不建造', () => {
    const game = buyNodes(['t_auto_explore'])
    const resources = useResourcesStore()
    const buildings = useBuildingsStore()
    resources.setAmount('energy', 1e6)
    game.lastTickTime = Date.now() - 1000
    game.tick()
    expect(game.autoExplore).toBe(true)
    expect(game.autoBuild).toBe(false)
    expect(buildings.getLevel(SOLAR)).toBe(0)
  })
})
