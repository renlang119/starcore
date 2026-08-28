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
