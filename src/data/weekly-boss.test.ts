/**
 * weekly-boss.test.ts：每周强敌（周 Boss）测试（v1.24 可玩内容扩展方案 5）
 *
 * 覆盖：模板轮换确定性（同周同模板、跨周可能换）、深度公式与门槛钳制、
 * 奖励公式（前沿锚 ×1.5 与模板解耦）、合成据点结构、校准锚点
 * （OFFSET 表与校准定稿一致；归一化后总强度随深度单调）；
 * v1.71 帝庭威胁名录：条目池结构（四族 × 8 条非空）、轮换确定性
 * 与覆盖、装配接线（合成据点显示名 = 本周条目）、兜底路径可达。
 */
import { describe, it, expect } from 'vitest'
import {
  WEEKLY_BOSS_ID,
  WEEKLY_BOSS_FLOOR,
  WEEKLY_BOSS_TEMPLATE_IDS,
  WEEKLY_BOSS_OFFSET,
  WEEKLY_BOSS_REWARD_MULT,
  WEEKLY_BOSS_LORE,
  weeklyBossTemplateId,
  weeklyBossDepth,
  weeklyBossReward,
  weeklyBossStronghold,
  weeklyBossLore,
  pickWeeklyBossLore,
} from './weekly-boss'
import { STRONGHOLDS, getStronghold } from './pve'
import { ENDLESS_UNLOCK_STRONGHOLD } from './endless'
import { t } from '@/i18n'

/** 校准脚本的墙位锚（档A/B/C 50% 墙位中位，starcore-v124-boss-calib.py v6） */
const CALIB_WALLS = { A: 33, B: 37, C: 40 } as const

/** 中文断言用（缺键回落键名时不含 CJK，可捕获取词失败） */
const CJK = /[一-鿿]/

describe('weekly-boss 模板轮换', () => {
  it('同周标识确定：任意多次调用同一周返回同一模板', () => {
    for (const wk of ['2026-W38', '2026-W39', '2027-W01']) {
      const first = weeklyBossTemplateId(wk)
      for (let i = 0; i < 5; i++) {
        expect(weeklyBossTemplateId(wk)).toBe(first)
      }
      expect(WEEKLY_BOSS_TEMPLATE_IDS).toContain(first)
    }
  })

  it('跨周可能换模板：连续 12 周覆盖至少 3 种模板', () => {
    const seen = new Set<string>()
    for (let w = 1; w <= 12; w++) {
      seen.add(weeklyBossTemplateId(`2027-W${String(w).padStart(2, '0')}`))
    }
    expect(seen.size).toBeGreaterThanOrEqual(3)
  })
})

describe('weekly-boss 深度公式', () => {
  it('OFFSET 表与校准定稿一致（勿擅自改动，改前须重跑校准）', () => {
    expect(WEEKLY_BOSS_OFFSET).toEqual({
      silencer_3: -1,
      raider_5: 1,
      beast_4: -2,
      ruin_4: 2,
    })
  })

  it('bossDepth = best + OFFSET[模板]（校准锚点附近：卡墙玩家落 50% 墙位）', () => {
    // 档A 卡墙 best≈33：raider_5 周深 34（墙位 33+1 档，胜率带内）
    expect(weeklyBossDepth(33, 'raider_5')).toBe(34)
    expect(weeklyBossDepth(33, 'silencer_3')).toBe(32)
    expect(weeklyBossDepth(33, 'beast_4')).toBe(31)
    expect(weeklyBossDepth(33, 'ruin_4')).toBe(35)
    // 三档墙位附近深度均在合理窗内（[墙−4, 墙+3]，校准扫描范围）
    for (const wall of Object.values(CALIB_WALLS)) {
      for (const tid of WEEKLY_BOSS_TEMPLATE_IDS) {
        const d = weeklyBossDepth(wall, tid)
        expect(d).toBeGreaterThanOrEqual(wall - 4)
        expect(d).toBeLessThanOrEqual(wall + 3)
      }
    }
  })

  it('门槛钳制：低 best 锁定 WEEKLY_BOSS_FLOOR，负数/小数输入钳制', () => {
    expect(WEEKLY_BOSS_FLOOR).toBe(6)
    expect(weeklyBossDepth(0, 'beast_4')).toBe(WEEKLY_BOSS_FLOOR)
    expect(weeklyBossDepth(3, 'beast_4')).toBe(WEEKLY_BOSS_FLOOR) // 3-2=1 → 6
    expect(weeklyBossDepth(-5, 'ruin_4')).toBe(WEEKLY_BOSS_FLOOR)
    expect(weeklyBossDepth(10.9, 'silencer_3')).toBe(9) // floor(10.9)−1
    expect(weeklyBossDepth(Number.NaN, 'raider_5')).toBe(WEEKLY_BOSS_FLOOR)
  })
})

describe('weekly-boss 奖励', () => {
  it('奖励 = 前沿合成据点（best+1 钳门槛）× 1.5，与模板解耦', () => {
    const base = getStronghold(ENDLESS_UNLOCK_STRONGHOLD)!
    expect(WEEKLY_BOSS_REWARD_MULT).toBe(1.5)
    // best=20：锚深 21，energy = round(round(base.energy × 1.35^20) × 1.5)（锚点先取整）
    const rs = Math.pow(1.35, 20)
    const r = weeklyBossReward(20)
    expect(r.energy).toBe(Math.round(Math.round(base.rewards.energy! * rs) * 1.5))
    expect(r.dark).toBe(Math.round(Math.round(base.rewards.dark! * rs) * 1.5))
    // 同一 best 不同周/模板：奖励一致（解耦语义）
    expect(weeklyBossReward(20)).toEqual(weeklyBossReward(20))
    // 门槛：best=1 → 锚深 6（非 2）
    const floorR = weeklyBossReward(1)
    const rsFloor = Math.pow(1.35, 5)
    expect(floorR.energy).toBe(Math.round(Math.round(base.rewards.energy! * rsFloor) * 1.5))
  })

  it('非法输入钳制；奖励随 best 单调不减', () => {
    expect(weeklyBossReward(-3).energy).toBe(weeklyBossReward(0).energy)
    let prev = 0
    for (const best of [6, 10, 20, 30]) {
      const cur = weeklyBossReward(best).energy!
      expect(cur).toBeGreaterThan(prev)
      prev = cur
    }
  })
})

describe('weekly-boss 合成据点', () => {
  it('固定 id、不入 STRONGHOLDS 表、idle 为空（不驻扎）', () => {
    expect(WEEKLY_BOSS_ID).toBe('weekly_boss')
    expect(STRONGHOLDS.some((s) => s.id === WEEKLY_BOSS_ID)).toBe(false)
    const s = weeklyBossStronghold(30, '2026-W38')
    expect(s.id).toBe(WEEKLY_BOSS_ID)
    expect(Object.keys(s.idle).length).toBe(0)
    // type/tier 随模板走（克制关系与据点类色系一致）
    const tpl = STRONGHOLDS.find((x) => x.id === weeklyBossTemplateId('2026-W38'))!
    expect(s.type).toBe(tpl.type)
    expect(s.tier).toBe(tpl.tier)
  })

  it('编成 = 模板 × 归一 × endlessScale(深度)，克制关系保留，敌方名称带前缀', () => {
    const wk = '2026-W40'
    const tid = weeklyBossTemplateId(wk)
    const s = weeklyBossStronghold(30, wk)
    const tpl = getStronghold(tid)!
    expect(s.enemies.length).toBe(tpl.enemies.length)
    s.enemies.forEach((e, i) => {
      expect(e.unitId).toBe(tpl.enemies[i]!.unitId)
      expect(e.count).toBe(tpl.enemies[i]!.count)
      expect(e.counteredBy).toEqual(tpl.enemies[i]!.counteredBy)
      expect(e.name).toContain('·')
      expect(e.attack).toBeGreaterThan(0)
      expect(e.hp).toBeGreaterThan(0)
    })
  })

  it('归一不变量：同深度下四模板合成总强度一致（取整误差内）', () => {
    // 每模板取能落到同一目标深度的 best：best = 目标深度 - OFFSET；
    // 模板所属周标识经轮换表反查（同周确定性已由上方用例覆盖）
    const targetDepth = 30
    const weekFor = (tid: string): string => {
      for (let w = 1; w <= 53; w++) {
        const wk = `2026-W${String(w).padStart(2, '0')}`
        if (weeklyBossTemplateId(wk) === tid) return wk
      }
      throw new Error(`no week maps to ${tid}`)
    }
    const powers = WEEKLY_BOSS_TEMPLATE_IDS.map((tid) => {
      const best = targetDepth - WEEKLY_BOSS_OFFSET[tid]
      expect(weeklyBossDepth(best, tid)).toBe(targetDepth) // 前置自证同深度
      const s = weeklyBossStronghold(best, weekFor(tid))
      return s.enemies.reduce((a, e) => a + (e.attack + e.defense + e.hp) * e.count, 0)
    })
    const max = Math.max(...powers)
    const min = Math.min(...powers)
    expect((max - min) / max).toBeLessThan(0.01)
  })

  it('深度越大强度越高：同周 best=20 vs best=30 的编成攻/血更大', () => {
    const wk = '2026-W41'
    const low = weeklyBossStronghold(20, wk)
    const high = weeklyBossStronghold(30, wk)
    for (let i = 0; i < low.enemies.length; i++) {
      expect(high.enemies[i]!.attack).toBeGreaterThanOrEqual(low.enemies[i]!.attack)
      expect(high.enemies[i]!.hp).toBeGreaterThanOrEqual(low.enemies[i]!.hp)
    }
  })

  it('结构兼容战斗系统：战斗系统消费的字段齐全', () => {
    const s = weeklyBossStronghold(10, '2026-W42')
    expect(s.enemies.length).toBeGreaterThan(0)
    for (const e of s.enemies) {
      expect(e.unitId).toBeTruthy()
      expect(e.name).toBeTruthy()
      expect(e.count).toBeGreaterThan(0)
      expect(e.counteredBy).toBeDefined()
    }
  })
})

describe('weekly-boss 帝庭威胁名录（v1.71）', () => {
  it('四族池结构：每族 8 条、条目名族内不重复、name/origin 均为非空中文', () => {
    expect(WEEKLY_BOSS_TEMPLATE_IDS.length).toBe(4)
    for (const tid of WEEKLY_BOSS_TEMPLATE_IDS) {
      const pool = WEEKLY_BOSS_LORE[tid]
      expect(pool.length, tid).toBe(8)
      expect(new Set(pool.map((e) => e.name)).size, tid).toBe(8)
      for (const e of pool) {
        expect(e.name.length, tid).toBeGreaterThan(0)
        expect(e.origin.length, tid).toBeGreaterThan(0)
        expect(e.name, tid).toMatch(CJK)
        expect(e.origin, tid).toMatch(CJK)
      }
    }
  })

  it('同周条目确定：同模板同周任意多次调用返回同一条目', () => {
    for (const wk of ['2026-W38', '2026-W39', '2027-W01']) {
      for (const tid of WEEKLY_BOSS_TEMPLATE_IDS) {
        const a = weeklyBossLore(tid, wk)
        const b = weeklyBossLore(tid, wk)
        expect(a, `${tid} ${wk}`).toBeDefined()
        expect(a).toEqual(b)
      }
    }
  })

  it('跨周轮换覆盖：固定模板连续 24 周至少出现 4 个不同条目', () => {
    const weeks = Array.from({ length: 24 }, (_, i) => `2026-W${String(20 + i).padStart(2, '0')}`)
    for (const tid of WEEKLY_BOSS_TEMPLATE_IDS) {
      const names = new Set(weeks.map((wk) => weeklyBossLore(tid, wk)!.name))
      expect(names.size, tid).toBeGreaterThanOrEqual(4)
    }
  })

  it('装配接线：合成据点显示名为「每周强敌·条目名」（连投四周验证换装）', () => {
    for (const wk of ['2026-W38', '2026-W39', '2026-W40', '2026-W41']) {
      const def = weeklyBossStronghold(10, wk)
      const lore = weeklyBossLore(weeklyBossTemplateId(wk), wk)!
      expect(def.name, wk).toBe(`每周强敌·${lore.name}`)
      expect(def.desc, wk).toBe(lore.origin)
      // 敌方名前缀口径不变（每周强敌·单位名）
      for (const e of def.enemies) expect(e.name, wk).toContain('每周强敌·')
    }
  })

  it('兜底路径：空池与未知模板返回 undefined；通用回退键仍可解析', () => {
    expect(pickWeeklyBossLore([], '2026-W41')).toBeUndefined()
    expect(weeklyBossLore('no_such_template', '2026-W41')).toBeUndefined()
    expect(t('content.weeklyBoss.name', { d: 6 })).toMatch(CJK)
    expect(t('content.weeklyBoss.desc', { d: 6 })).toMatch(CJK)
    expect(t('content.weeklyBoss.prefix')).toMatch(CJK)
  })
})
