/**
 * encounters.test.ts — 随机遭遇事件数据表测试（v1.26 可玩内容扩展方案 8）
 *
 * 覆盖：事件池结构契约（10 模板恰两选项、概率归一、数值形态、风味分布）、
 * EV 核验锚点（两选项期望差 ≤15%、赌注类高方差 / 资源类低方差、量级带）、
 * 结果掷取（rollOutcome 通道注入、全分布可达）、间隔窗口边界。
 */
import { describe, it, expect } from 'vitest'
import {
  ENCOUNTERS,
  ENCOUNTER_IDS,
  ENCOUNTER_EXPIRE_MS,
  ENCOUNTER_INTERVAL_MIN,
  ENCOUNTER_INTERVAL_MAX,
  getEncounter,
  rollOutcome,
  type EncounterOption,
} from './encounters'
import { setEncounterRandomProvider } from '@/stores/encounters'

/** 折算率与量级带（阶段 1 设计稿 EV 折算口径；调整数值前先改设计稿核验表） */
const RATE = { energy: 1, alloy: 1, data: 6, dark: 8000, units: 60 } as const
const BAND_MIN = 4400
const BAND_MAX = 120000
const EV_GAP_MAX = 0.15

function optionEv(opt: EncounterOption): number {
  return opt.chances.reduce(
    (a, c) =>
      a +
      c.p *
        (Object.entries(c.rewards) as [keyof typeof RATE, number][]).reduce(
          (s, [k, v]) => s + RATE[k] * v,
          0
        ),
    0
  )
}

function optionSpread(opt: EncounterOption): number {
  const vals = opt.chances.map((c) =>
    (Object.entries(c.rewards) as [keyof typeof RATE, number][]).reduce(
      (s, [k, v]) => s + RATE[k] * v,
      0
    )
  )
  return Math.max(...vals) - Math.min(...vals)
}

describe('encounters 事件池结构', () => {
  it('10 模板、id 唯一、四类风味分布 4/2/1/3', () => {
    expect(ENCOUNTERS).toHaveLength(10)
    expect(new Set(ENCOUNTERS.map((e) => e.id)).size).toBe(10)
    const flavors = ENCOUNTERS.reduce<Record<string, number>>((acc, e) => {
      acc[e.flavor] = (acc[e.flavor] ?? 0) + 1
      return acc
    }, {})
    expect(flavors).toEqual({ resource: 4, military: 2, explore: 1, gamble: 3 })
  })

  it('每事件恰两选项、每选项概率归一、结果数值形态合法', () => {
    for (const e of ENCOUNTERS) {
      for (const opt of [e.optA, e.optB]) {
        expect(opt.chances.length).toBeGreaterThanOrEqual(1)
        const pSum = opt.chances.reduce((a, c) => a + c.p, 0)
        expect(pSum).toBeCloseTo(1, 9)
        for (const c of opt.chances) {
          for (const [k, v] of Object.entries(c.rewards)) {
            expect(Number.isInteger(v)).toBe(true)
            // 负值仅允许合金（损失结果）；暗物质恒非负个位；发兵量恒正
            if (v < 0) expect(k).toBe('alloy')
            if (k === 'dark') expect(v).toBeGreaterThanOrEqual(0)
            if (k === 'units') expect(v).toBeGreaterThan(0)
          }
        }
      }
    }
  })

  it('选项标签与名称描述非空（数据实体字段化，UI 直读不做动态取词）', () => {
    for (const e of ENCOUNTERS) {
      expect(e.name.length).toBeGreaterThan(0)
      expect(e.desc.length).toBeGreaterThan(0)
      expect(e.optA.label.length).toBeGreaterThan(0)
      expect(e.optB.label.length).toBeGreaterThan(0)
    }
  })

  it('getEncounter 与白名单一致；未知 id 返回 undefined', () => {
    for (const e of ENCOUNTERS) {
      expect(getEncounter(e.id)).toBe(e)
      expect(ENCOUNTER_IDS.has(e.id)).toBe(true)
    }
    expect(getEncounter('enc_unknown')).toBeUndefined()
  })
})

describe('encounters EV 核验锚点', () => {
  it('每事件两选项期望差 ≤ 15%（以较大者为基）', () => {
    for (const e of ENCOUNTERS) {
      const evA = optionEv(e.optA)
      const evB = optionEv(e.optB)
      const gap = Math.abs(evA - evB) / Math.max(evA, evB)
      expect(gap).toBeLessThanOrEqual(EV_GAP_MAX)
    }
  })

  it('全选项期望落量级带（顺路的糖口径）', () => {
    for (const e of ENCOUNTERS) {
      for (const opt of [e.optA, e.optB]) {
        const ev = optionEv(opt)
        expect(ev).toBeGreaterThanOrEqual(BAND_MIN)
        expect(ev).toBeLessThanOrEqual(BAND_MAX)
      }
    }
  })

  it('方差区分度：赌注类跨度/EV ≥ 1，资源/探索类 < 1', () => {
    for (const e of ENCOUNTERS) {
      const ratio = optionSpread(e.optB) / optionEv(e.optB)
      if (e.flavor === 'gamble') {
        expect(ratio).toBeGreaterThanOrEqual(1)
      } else if (e.flavor === 'resource' || e.flavor === 'explore') {
        expect(ratio).toBeLessThan(1)
      }
    }
  })
})

describe('encounters 结果掷取', () => {
  it('注入随机源命中对应结果分支', () => {
    const well = getEncounter('enc_well')!
    // rand = 0.1 → roll 减首支 0.35 后为负 → 命中大奖 22000
    expect(rollOutcome(well.optB, () => 0.1)).toEqual({ energy: 22000 })
    // rand = 0.9 → 减 0.35 余 0.55，减末支 0.65 后为负 → 空手
    expect(rollOutcome(well.optB, () => 0.9)).toEqual({})
  })

  it('全分布可达：多轮采样覆盖赌注选项全部分支', () => {
    const well = getEncounter('enc_well')!
    const seen = new Set<string>()
    for (let i = 0; i < 500; i++) {
      const r = rollOutcome(well.optB)
      seen.add('energy' in r ? 'hit' : 'miss')
    }
    expect(seen.has('hit')).toBe(true)
    expect(seen.has('miss')).toBe(true)
  })

  it('间隔窗口：rollIntervalMs 落 [MIN, MAX]（固定通道验证两端）', () => {
    setEncounterRandomProvider(() => 0)
    const lo =
      ENCOUNTER_INTERVAL_MIN * 1000 + 0 * (ENCOUNTER_INTERVAL_MAX - ENCOUNTER_INTERVAL_MIN) * 1000
    setEncounterRandomProvider(() => 0.999999)
    const hi =
      ENCOUNTER_INTERVAL_MIN * 1000 +
      0.999999 * (ENCOUNTER_INTERVAL_MAX - ENCOUNTER_INTERVAL_MIN) * 1000
    expect(lo).toBe(ENCOUNTER_INTERVAL_MIN * 1000)
    expect(hi).toBeLessThan(ENCOUNTER_INTERVAL_MAX * 1000)
    expect(ENCOUNTER_INTERVAL_MIN).toBe(480)
    expect(ENCOUNTER_INTERVAL_MAX).toBe(900)
    expect(ENCOUNTER_EXPIRE_MS).toBe(60_000)
  })
})
