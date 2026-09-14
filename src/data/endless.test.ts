/**
 * endless.test.ts — 无尽远征模式测试（v0.60 玩法扩展方案 5）
 */
import { describe, it, expect } from 'vitest'
import {
  ENDLESS_STRONGHOLD_ID,
  ENDLESS_UNLOCK_STRONGHOLD,
  endlessScale,
  endlessRewardScale,
  endlessUnlocked,
  endlessEnemies,
  endlessStronghold,
  ENEMY_GROWTH,
  REWARD_GROWTH,
} from './endless'
import { getStronghold, STRONGHOLDS } from './pve'

describe('endless 缩放公式', () => {
  it('敌方缩放：D1 = 0.5，D2 = 0.5×1.25，指数增长', () => {
    expect(endlessScale(1)).toBeCloseTo(0.5)
    expect(endlessScale(2)).toBeCloseTo(0.5 * ENEMY_GROWTH)
    expect(endlessScale(5)).toBeCloseTo(0.5 * Math.pow(ENEMY_GROWTH, 4))
    // 无限缩放：数值严格递增
    expect(endlessScale(10)).toBeGreaterThan(endlessScale(9))
  })

  it('奖励缩放：D1 = 1，指数增长且快于敌方（越深越值得打）', () => {
    expect(endlessRewardScale(1)).toBe(1)
    expect(endlessRewardScale(2)).toBeCloseTo(REWARD_GROWTH)
    expect(endlessRewardScale(10)).toBeGreaterThan(endlessScale(10))
  })
})

describe('endless 解锁判定', () => {
  it('本轮攻克沉默者旗舰后解锁', () => {
    expect(endlessUnlocked(new Set())).toBe(false)
    expect(endlessUnlocked(new Set(['raider_1', 'beast_4']))).toBe(false)
    expect(endlessUnlocked(new Set([ENDLESS_UNLOCK_STRONGHOLD]))).toBe(true)
  })
})

describe('endless 敌方编成', () => {
  it('深度 1：模板 × 0.5（取最强模板编制）', () => {
    const enemies = endlessEnemies(1)
    expect(enemies.length).toBeGreaterThan(0)
    const base = STRONGHOLDS.find((s) => s.id === 'silencer_3')!
    expect(enemies.length).toBe(base.enemies.length)
    for (let i = 0; i < enemies.length; i++) {
      expect(enemies[i].attack).toBe(Math.round(base.enemies[i].attack * 0.5))
      expect(enemies[i].hp).toBe(Math.round(base.enemies[i].hp * 0.5))
      // 克制关系随模板保留
      expect(enemies[i].counteredBy).toEqual(base.enemies[i].counteredBy)
    }
  })

  it('深度越深敌方越强；命名带深渊前缀与深度号', () => {
    const d1 = endlessEnemies(1)
    const d3 = endlessEnemies(3)
    const sum = (es: typeof d1) => es.reduce((a, e) => a + (e.attack + e.hp) * e.count, 0)
    expect(sum(d3)).toBeGreaterThan(sum(d1))
    // 模板强度归一化：相邻深度总强度单调（轮换不跳变）
    const power = (d: number) =>
      endlessEnemies(d).reduce((a, e) => a + (e.attack + e.defense + e.hp) * e.count, 0)
    for (let d = 2; d <= 8; d++) {
      expect(power(d)).toBeGreaterThan(power(d - 1))
    }
    expect(d1.every((e) => e.name.includes('深渊'))).toBe(true)
    expect(d1.some((e) => e.name.includes('第1层'))).toBe(true)
  })

  it('编成按深度轮换 4 类模板（克制关系随模板变化）', () => {
    // D1=silencer_3, D2=raider_5, D3=beast_4, D4=ruin_4, D5=silencer_3 循环
    expect(endlessEnemies(1)[0].counteredBy).toEqual(
      getStronghold('silencer_3')!.enemies[0].counteredBy
    )
    expect(endlessEnemies(2)[0].counteredBy).toEqual(
      getStronghold('raider_5')!.enemies[0].counteredBy
    )
    expect(endlessEnemies(5)[0].counteredBy).toEqual(
      getStronghold('silencer_3')!.enemies[0].counteredBy
    )
  })

  it('四模板轮换位均产出非空编成（空编成属配置错误，函数直接抛错）', () => {
    for (let d = 1; d <= 8; d++) {
      const enemies = endlessEnemies(d)
      expect(enemies.length).toBeGreaterThan(0)
      expect(enemies.every((e) => e.count > 0)).toBe(true)
    }
  })

  it('非法深度（0/负数/小数）钳制为正整数', () => {
    expect(endlessEnemies(0).length).toBe(endlessEnemies(1).length)
    expect(endlessStronghold(2.7).name).toContain('第2层')
  })
})

describe('endless 合成据点', () => {
  it('固定 id、奖励 = 旗舰基准 × 深度缩放', () => {
    const base = getStronghold(ENDLESS_UNLOCK_STRONGHOLD)!
    const d1 = endlessStronghold(1)
    expect(d1.id).toBe(ENDLESS_STRONGHOLD_ID)
    expect(d1.rewards.energy).toBe(base.rewards.energy)
    expect(d1.rewards.dark).toBe(base.rewards.dark)
    const d3 = endlessStronghold(3)
    expect(d3.rewards.energy).toBe(Math.round(base.rewards.energy! * Math.pow(REWARD_GROWTH, 2)))
    expect(d3.rewards.dark).toBe(Math.round(base.rewards.dark! * Math.pow(REWARD_GROWTH, 2)))
  })

  it('遗物掉率与稀有度偏向随深度上升且封顶', () => {
    expect(endlessStronghold(1).rewards.relicChance).toBeCloseTo(0.55)
    expect(endlessStronghold(9).rewards.relicChance).toBeCloseTo(0.95)
    expect(endlessStronghold(9).rewards.relicRarityBias).toBeCloseTo(0.95)
    expect(endlessStronghold(50).rewards.relicChance).toBeLessThanOrEqual(0.95)
    expect(endlessStronghold(50).rewards.relicRarityBias).toBeLessThanOrEqual(1)
  })

  it('远征据点不驻扎：idle 为空', () => {
    expect(Object.keys(endlessStronghold(1).idle).length).toBe(0)
  })

  it('合成据点可直接走 resolveBattle（结构兼容战斗系统）', () => {
    const s = endlessStronghold(1)
    // 结构完整性：战斗系统消费的字段齐全（store 集成已由 combat.test.ts 覆盖）
    expect(s.enemies.length).toBeGreaterThan(0)
    for (const e of s.enemies) {
      expect(e.unitId).toBeTruthy()
      expect(e.name).toBeTruthy()
      expect(e.count).toBeGreaterThan(0)
      expect(e.counteredBy).toBeDefined()
    }
  })
})
