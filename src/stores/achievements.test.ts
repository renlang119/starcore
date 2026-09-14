/**
 * achievements.test.ts — 成就/里程碑 store 测试（v0.57）
 *
 * 覆盖：
 * 1. 定义表完整性（37 成就、id 唯一、类别合法、阈值正数）
 * 2. 终身计数累计与阈值解锁（含 toast 入队）
 * 3. 外部现值指标（relicsOwned/transcends/playtime 走 provider）
 * 4. 效果聚合（getMult 连乘，EffectSource 语义）
 * 5. serialize/hydrate 往返 + 旧档（undefined）兼容 + 非法数据防御
 * 6. reset（hardReset 用）清空
 * 7. 集成：game store 转生保留成就 / hardReset 清成就 / tick 采集终身能量
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAchievementsStore, setAchievementExternalProviders } from './achievements'
import { ACHIEVEMENTS, ACHIEVEMENT_CATEGORIES, ACHIEVEMENT_IDS } from '@/data/achievements'
import { useGameStore } from './game'
import { useResourcesStore } from './resources'
import { setRelicSlotProvider } from './relics'

let store: ReturnType<typeof useAchievementsStore>

beforeEach(() => {
  setActivePinia(createPinia())
  store = useAchievementsStore()
  // 默认外部指标全 0（各测试可自行覆盖）
  setAchievementExternalProviders({
    relicsOwned: () => 0,
    relicKinds: () => 0,
    transcends: () => 0,
    playtime: () => 0,
    expeditionBest: () => 0,
  })
})

describe('achievements — 定义表完整性', () => {
  it('共 37 个成就，id 唯一', () => {
    expect(ACHIEVEMENTS).toHaveLength(37)
    expect(ACHIEVEMENT_IDS.size).toBe(37)
  })

  it('类别/指标/阈值/效果字段合法', () => {
    for (const def of ACHIEVEMENTS) {
      expect(ACHIEVEMENT_CATEGORIES[def.category]).toBeDefined()
      expect(def.threshold).toBeGreaterThan(0)
      expect(def.effects.length).toBeGreaterThan(0)
      expect(def.icon.startsWith('i-')).toBe(true)
      for (const e of def.effects) expect(e.value).toBeGreaterThan(1)
    }
  })

  it('prestige_mult 奖励仅 1 个成就（欧米茄传承）且封顶 1.1', () => {
    const prestigeAchs = ACHIEVEMENTS.filter((a) =>
      a.effects.some((e) => e.type === 'prestige_mult')
    )
    expect(prestigeAchs).toHaveLength(1)
    expect(prestigeAchs[0].id).toBe('ach_relic_4')
    expect(prestigeAchs[0].effects.find((e) => e.type === 'prestige_mult')!.value).toBe(1.1)
  })
})

describe('achievements — 终身计数与解锁', () => {
  it('能量达阈值解锁对应成就并入 toast 队列', () => {
    store.addEnergy(1e5)
    const fresh = store.checkAndUnlock()
    expect(fresh.map((a) => a.id)).toContain('ach_energy_1')
    expect(store.isUnlocked('ach_energy_1')).toBe(true)
    expect(store.toastQueue.some((t) => t.id === 'ach_energy_1')).toBe(true)
    // 未达第二档
    expect(store.isUnlocked('ach_energy_2')).toBe(false)
  })

  it('重复 checkAndUnlock 不重复解锁/入队', () => {
    store.addEnergy(1e5)
    store.checkAndUnlock()
    const again = store.checkAndUnlock()
    expect(again).toHaveLength(0)
    expect(store.toastQueue.filter((t) => t.id === 'ach_energy_1')).toHaveLength(1)
  })

  it('一次大额入账跨档解锁多个成就', () => {
    store.addEnergy(1e9)
    const fresh = store.checkAndUnlock()
    const ids = fresh.map((a) => a.id)
    expect(ids).toContain('ach_energy_1')
    expect(ids).toContain('ach_energy_2')
    expect(ids).toContain('ach_energy_3')
    expect(ids).not.toContain('ach_energy_4')
  })

  it('整数指标：升级次数与单建筑最高等级', () => {
    for (let i = 0; i < 50; i++) store.recordUpgrade(i % 10 === 0 ? 50 : 3)
    expect(store.metricValue('upgrades')).toBe(50)
    expect(store.metricValue('maxBuildingLevel')).toBe(50)
    const fresh = store.checkAndUnlock()
    expect(fresh.map((a) => a.id)).toContain('ach_build_1')
    expect(fresh.map((a) => a.id)).toContain('ach_build_4')
  })

  it('研究/探索/战斗计数各自独立', () => {
    store.recordResearch()
    store.recordExplore()
    store.recordBattle()
    expect(store.metricValue('researches')).toBe(1)
    expect(store.metricValue('explores')).toBe(1)
    expect(store.metricValue('battles')).toBe(1)
  })

  it('progressOf 归一 0~1', () => {
    store.addEnergy(5e4)
    expect(store.progressOf('energy', 1e5)).toBeCloseTo(0.5)
    store.addEnergy(1e6)
    expect(store.progressOf('energy', 1e5)).toBe(1)
  })
})

describe('achievements — 外部现值指标', () => {
  it('relicsOwned/relicKinds/transcends/playtime 走 provider', () => {
    setAchievementExternalProviders({
      relicsOwned: () => 25,
      relicKinds: () => 20,
      transcends: () => 10,
      playtime: () => 180000,
      expeditionBest: () => 0,
    })
    const fresh = store.checkAndUnlock()
    const ids = fresh.map((a) => a.id)
    expect(ids).toContain('ach_relic_4') // 集齐 20 种
    expect(ids).toContain('ach_transcend_4') // 10 次转生
    expect(ids).toContain('ach_time_3') // 50h
  })

  it('ach_relic_4 按种类数判定：持有件数多但种类不足不解锁（v0.61 修正）', () => {
    setAchievementExternalProviders({
      relicsOwned: () => 25, // 件数够（含重复）
      relicKinds: () => 18, // 种类不足 20
      transcends: () => 0,
      playtime: () => 0,
      expeditionBest: () => 0,
    })
    const fresh = store.checkAndUnlock()
    expect(fresh.map((a) => a.id)).not.toContain('ach_relic_4')
    expect(store.isUnlocked('ach_relic_4')).toBe(false)
  })

  it('provider 未注入时指标为 0（不误解锁）', () => {
    setAchievementExternalProviders({
      relicsOwned: () => 0,
      relicKinds: () => 0,
      transcends: () => 0,
      playtime: () => 0,
      expeditionBest: () => 0,
    })
    const fresh = store.checkAndUnlock()
    expect(fresh).toHaveLength(0)
  })

  it('远征深度走 provider：D10/D20 里程碑阈值边界（v0.69）', () => {
    // 9 层：不到首档
    setAchievementExternalProviders({
      relicsOwned: () => 0,
      relicKinds: () => 0,
      transcends: () => 0,
      playtime: () => 0,
      expeditionBest: () => 9,
    })
    expect(store.checkAndUnlock().map((a) => a.id)).not.toContain('ach_battle_4')
    // 10 层：解锁首档、不到二档
    setAchievementExternalProviders({
      relicsOwned: () => 0,
      relicKinds: () => 0,
      transcends: () => 0,
      playtime: () => 0,
      expeditionBest: () => 10,
    })
    const fresh = store.checkAndUnlock()
    expect(fresh.map((a) => a.id)).toContain('ach_battle_4')
    expect(fresh.map((a) => a.id)).not.toContain('ach_battle_5')
    // 20 层：二档解锁，攻防加成连乘 1.05 × 1.08
    setAchievementExternalProviders({
      relicsOwned: () => 0,
      relicKinds: () => 0,
      transcends: () => 0,
      playtime: () => 0,
      expeditionBest: () => 20,
    })
    expect(store.checkAndUnlock().map((a) => a.id)).toContain('ach_battle_5')
    expect(store.getMult('combat_mult', 'attack').toNumber()).toBeCloseTo(1.05 * 1.08, 10)
    expect(store.getMult('combat_mult', 'defense').toNumber()).toBeCloseTo(1.05 * 1.08, 10)
  })
})

describe('achievements — 效果聚合（EffectSource）', () => {
  it('解锁产出类成就 → production_mult(all) 连乘', () => {
    store.addEnergy(1e7) // 解锁 ach_energy_1(+1%) + ach_energy_2(+2%)
    store.checkAndUnlock()
    expect(store.getMult('production_mult', 'energy').toNumber()).toBeCloseTo(1.01 * 1.02, 10)
    expect(store.getMult('production_mult', 'crystal').toNumber()).toBeCloseTo(1.01 * 1.02, 10)
  })

  it('战斗类成就攻防成对', () => {
    store.recordBattle()
    store.recordBattle()
    store.recordBattle()
    store.recordBattle()
    store.recordBattle()
    store.recordBattle()
    store.recordBattle()
    store.recordBattle() // 8 次 → ach_battle_1（攻防 +5%）
    store.checkAndUnlock()
    expect(store.getMult('combat_mult', 'attack').toNumber()).toBeCloseTo(1.05, 10)
    expect(store.getMult('combat_mult', 'defense').toNumber()).toBeCloseTo(1.05, 10)
  })

  it('未解锁任何成就时 getMult = 1', () => {
    expect(store.getMult('production_mult', 'energy').toNumber()).toBe(1)
    expect(store.getMult('offline_bonus').toNumber()).toBe(1)
  })
})

describe('achievements — serialize / hydrate', () => {
  it('往返一致', () => {
    store.addEnergy(123456)
    store.addDark(789)
    store.recordUpgrade(12)
    store.recordResearch()
    store.checkAndUnlock()
    const data = store.serialize()
    expect(data.lifetime.energy).toBe('123456')
    expect(data.lifetime.upgrades).toBe(1)
    expect(data.lifetime.maxBuildingLevel).toBe(12)
    expect(data.unlocked['ach_energy_1']).toBeGreaterThan(0)

    setActivePinia(createPinia())
    const fresh = useAchievementsStore()
    fresh.hydrate(data)
    expect(fresh.metricValue('energy')).toBe(123456)
    expect(fresh.metricValue('dark')).toBe(789)
    expect(fresh.metricValue('upgrades')).toBe(1)
    expect(fresh.metricValue('maxBuildingLevel')).toBe(12)
    expect(fresh.isUnlocked('ach_energy_1')).toBe(true)
  })

  it('旧档 undefined → 从零起算不崩', () => {
    expect(() => store.hydrate(undefined)).not.toThrow()
    expect(store.metricValue('energy')).toBe(0)
    expect(store.unlockedCount).toBe(0)
  })

  it('防御：未知成就 id / 非法时间戳 / 负数计数被过滤', () => {
    store.hydrate({
      lifetime: {
        energy: '100',
        dark: '5',
        upgrades: -3, // 负数丢弃 → 保持默认 0
        maxBuildingLevel: 2.7, // 小数向下取整
        researches: NaN,
        explores: 0,
        battles: 0,
      },
      unlocked: {
        ach_energy_1: 1700000000000,
        ach_fake_hacked: 1, // 未知 id 丢弃
        ach_dark_1: -5, // 非法时间戳丢弃
      },
    })
    expect(store.metricValue('upgrades')).toBe(0)
    expect(store.metricValue('maxBuildingLevel')).toBe(2)
    expect(store.metricValue('researches')).toBe(0)
    expect(store.isUnlocked('ach_energy_1')).toBe(true)
    expect(store.isUnlocked('ach_fake_hacked')).toBe(false)
    expect(store.isUnlocked('ach_dark_1')).toBe(false)
    expect(store.unlockedCount).toBe(1)
  })

  it('toast 队列：shiftToast 逐条消费', () => {
    store.addEnergy(1e7)
    store.checkAndUnlock()
    expect(store.toastQueue.length).toBe(2)
    store.shiftToast()
    expect(store.toastQueue).toHaveLength(1)
    store.shiftToast()
    expect(store.toastQueue).toHaveLength(0)
  })
})

describe('achievements — reset', () => {
  it('reset 清空终身计数/解锁/队列（hardReset 用）', () => {
    store.addEnergy(1e9)
    store.recordUpgrade(99)
    store.checkAndUnlock()
    expect(store.unlockedCount).toBeGreaterThan(0)
    store.reset()
    expect(store.metricValue('energy')).toBe(0)
    expect(store.metricValue('upgrades')).toBe(0)
    expect(store.unlockedCount).toBe(0)
    expect(store.toastQueue).toHaveLength(0)
  })
})

describe('game store 集成 — 转生保留 / hardReset 清空 / tick 采集', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    setRelicSlotProvider(() => 0)
  })

  it('tick 后终身能量跟随 totals 增长，产出类成就解锁', async () => {
    const game = useGameStore()
    const resources = useResourcesStore()
    const achv = game.achievements
    // v0.62 起 tick 会触发每日签到发奖（首签 +2e4 能量入 totals，差值采集照计终身）。
    // 签到也烧在第一个 tick：此后 totals=2e4，终身=2e4
    game.lastTickTime = Date.now() - 1000
    game.tick()
    // 直接抬高 totals 模拟本轮产出（tick 差值采集）：2e4 + 2e5
    resources.gain('energy', 2e5)
    game.lastTickTime = Date.now() - 1000
    game.tick()
    expect(achv.metricValue('energy')).toBe(2.2e5) // 首签 2e4 + 本轮 2e5（签到计入终身是设计行为）
    expect(achv.isUnlocked('ach_energy_1')).toBe(true)
    // 快照已对齐：再 tick 不重复计入（签到只发一次，之后无额外增量）
    game.lastTickTime = Date.now() - 1000
    game.tick()
    expect(achv.metricValue('energy')).toBe(2.2e5)
  })

  it('升级建筑计入终身 upgrades（tryUpgradeBuilding 钩子）', () => {
    const game = useGameStore()
    const resources = useResourcesStore()
    resources.setAmount('energy', 1e6)
    const first = BUILDING_FIRST_ID
    game.tryUpgradeBuilding(first)
    expect(game.achievements.metricValue('upgrades')).toBe(1)
    expect(game.achievements.metricValue('maxBuildingLevel')).toBe(1)
  })

  it('doTranscend 保留成就与终身计数（转生不清）', () => {
    const game = useGameStore()
    const resources = useResourcesStore()
    resources.gain('energy', 1e9)
    game.lastTickTime = Date.now() - 1000
    game.tick()
    expect(game.achievements.isUnlocked('ach_energy_1')).toBe(true)
    const energyBefore = game.achievements.metricValue('energy')

    expect(game.canTranscend()).toBe(true)
    game.doTranscend()
    // 成就保留
    expect(game.achievements.isUnlocked('ach_energy_1')).toBe(true)
    // 终身能量不缩水（转生前采集，totals 重置不影响终身计数）
    expect(game.achievements.metricValue('energy')).toBeGreaterThanOrEqual(energyBefore)
    // 转生次数成就解锁
    expect(game.achievements.isUnlocked('ach_transcend_1')).toBe(true)
  })
})

const BUILDING_FIRST_ID = 'solar_collector'
