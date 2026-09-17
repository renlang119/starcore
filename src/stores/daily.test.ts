/**
 * daily.test.ts — 每日签到/周期挑战测试（v0.62 玩法扩展方案 7）
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import {
  useDailyStore,
  localDateStr,
  weekStr,
  streakReward,
  RETURN_GIFT,
  STREAK_CYCLE,
  CHALLENGE_TEMPLATES,
  type WeeklyChallenge,
} from './daily'

/** 周挑战条目工厂（v1.04 收敛 10 份字面量；默认 wk_battles 形态，按字段覆盖） */
function ch(templateId: string, over: Partial<WeeklyChallenge> = {}): WeeklyChallenge {
  return { templateId, kind: 'battles', tier: 0, target: 5, rewardDark: 3, claimed: false, ...over }
}

/** 构造指定日期（本地时区） */
function dateOf(y: number, m: number, d: number): Date {
  return new Date(y, m - 1, d)
}

describe('daily — 日期/周工具', () => {
  it('localDateStr 输出 YYYY-MM-DD', () => {
    expect(localDateStr(dateOf(2026, 9, 6))).toBe('2026-09-06')
    expect(localDateStr(dateOf(2026, 1, 3))).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('weekStr：同一自然周内稳定、跨周变化、周一起点', () => {
    // 2026-09-06 是周日，2026-09-07 是周一（新一周）
    const sun = weekStr(dateOf(2026, 9, 6))
    const mon = weekStr(dateOf(2026, 9, 7))
    expect(sun).toMatch(/^\d{4}-W\d{2}$/)
    expect(mon).toMatch(/^\d{4}-W\d{2}$/)
    expect(mon).not.toBe(sun)
    expect(weekStr(dateOf(2026, 9, 5))).toBe(sun) // 同周（周六）
    expect(weekStr(dateOf(2026, 9, 8))).toBe(mon) // 同周（周二）
  })

  it('streakReward：1/3/7 天节点，7 天循环', () => {
    expect(streakReward(1)).toEqual({ energy: 2e4, dark: 0 })
    expect(streakReward(3)?.dark).toBe(3)
    expect(streakReward(7)?.dark).toBe(7)
    expect(streakReward(4)).toBeNull()
    expect(streakReward(8)).toEqual(streakReward(1)) // 循环
    expect(STREAK_CYCLE).toBe(7)
  })
})

describe('daily — 签到', () => {
  let store: ReturnType<typeof useDailyStore>
  beforeEach(() => {
    setActivePinia(createPinia())
    store = useDailyStore()
  })

  it('全新档首签：连击 1，普通日无节点奖励保底能量', () => {
    const r = store.onTickCheckIn(dateOf(2026, 9, 7))! // 周一
    expect(r.streakDay).toBe(1)
    expect(r.returned).toBe(false)
    expect(r.energy).toBe(2e4)
  })

  it('同日重复 tick 不重复签到', () => {
    const d = dateOf(2026, 9, 7)
    store.onTickCheckIn(d)
    expect(store.onTickCheckIn(d)).toBeNull()
  })

  it('连续签到连击递增，第 3 天有暗物质', () => {
    store.onTickCheckIn(dateOf(2026, 9, 7))
    const r = store.onTickCheckIn(dateOf(2026, 9, 8))!
    expect(r.streakDay).toBe(2)
    const r3 = store.onTickCheckIn(dateOf(2026, 9, 9))!
    expect(r3.streakDay).toBe(3)
    expect(r3.dark).toBe(3)
  })

  it('连击 7 天封顶后第 8 天回到节点 1', () => {
    for (let i = 0; i < 7; i++) store.onTickCheckIn(dateOf(2026, 9, 1 + i))
    const r8 = store.onTickCheckIn(dateOf(2026, 9, 8))!
    expect(r8.streakDay).toBe(8)
    expect(r8.energy).toBe(streakReward(8)!.energy) // 循环节点 1 的奖励
  })

  it('断签：连击清零 + 回归补偿包', () => {
    store.onTickCheckIn(dateOf(2026, 9, 7))
    store.onTickCheckIn(dateOf(2026, 9, 8))
    // 跳过 9/9、9/10，9/11 回来
    const r = store.onTickCheckIn(dateOf(2026, 9, 11))!
    expect(r.returned).toBe(true)
    expect(r.streakDay).toBe(1)
    expect(r.energy).toBe(2e4 + RETURN_GIFT.energy)
    expect(r.dark).toBe(0 + RETURN_GIFT.dark)
  })
})

describe('daily — 周挑战', () => {
  let store: ReturnType<typeof useDailyStore>
  beforeEach(() => {
    setActivePinia(createPinia())
    store = useDailyStore()
  })

  it('ensureWeek 生成 3 项不重复模板的挑战', () => {
    store.ensureWeek(dateOf(2026, 9, 7))
    expect(store.weekChallenges).toHaveLength(3)
    const ids = store.weekChallenges.map((c) => c.templateId)
    expect(new Set(ids).size).toBe(3)
    for (const c of store.weekChallenges) {
      expect(c.target).toBeGreaterThan(0)
      expect(c.rewardDark).toBeGreaterThan(0)
      expect(c.claimed).toBe(false)
    }
  })

  it('种子确定性：同周生成一致，跨周不同', () => {
    store.ensureWeek(dateOf(2026, 9, 7))
    const a = JSON.stringify(store.weekChallenges.map((c) => [c.templateId, c.tier]))
    const store2 = useDailyStore()
    store2.ensureWeek(dateOf(2026, 9, 10)) // 同周（周四）
    const b = JSON.stringify(store2.weekChallenges.map((c) => [c.templateId, c.tier]))
    expect(a).toBe(b)
    store2.ensureWeek(dateOf(2026, 9, 14)) // 下周一
    const c = JSON.stringify(store2.weekChallenges.map((x) => [x.templateId, x.tier]))
    expect(c).not.toBe(a)
  })

  it('换周清零计数', () => {
    store.ensureWeek(dateOf(2026, 9, 7))
    store.bump('battles')
    store.bump('battles')
    expect(store.weeklyCounters.battles).toBe(2)
    store.ensureWeek(dateOf(2026, 9, 14)) // 下周一
    expect(store.weeklyCounters.battles).toBe(0)
  })

  it('bump 计数 → 完成判定 → 领取', () => {
    store.ensureWeek(dateOf(2026, 9, 7))
    const c = store.weekChallenges.find((x) => x.kind === 'researches') ?? store.weekChallenges[0]
    const kind = c.kind
    for (let i = 0; i < c.target; i++) store.bump(kind)
    expect(store.claimable(c)).toBe(true)
    const before = store.streak
    const reward = store.claim(c.templateId)!
    expect(reward.dark).toBe(c.rewardDark)
    expect(reward.streakBonus).toBe(1)
    expect(store.streak).toBe(before + 1) // 勾连：连击 +1
    expect(store.claim(c.templateId)).toBeNull() // 已领
  })

  it('未达成不可领取', () => {
    store.ensureWeek(dateOf(2026, 9, 7))
    const c = store.weekChallenges[0]
    expect(store.claimable(c)).toBe(false)
    expect(store.claim(c.templateId)).toBeNull()
  })
})

describe('daily — 存档', () => {
  it('serialize/hydrate 往返：同周（真实周）保留计数与挑战', () => {
    setActivePinia(createPinia())
    const store = useDailyStore()
    // 用真实当前周构造存档：hydrate 尾部的周判定走「同周保留」真实路径，
    // 不依赖运行周与假日期是否巧合一致
    const now = new Date()
    store.onTickCheckIn(now)
    store.ensureWeek(now)
    store.bump('battles')
    const data = store.serialize()

    setActivePinia(createPinia())
    const other = useDailyStore()
    other.hydrate(data)
    expect(other.lastCheckIn).toBe(data.lastCheckIn)
    expect(other.streak).toBe(data.streak)
    expect(other.weeklyCounters.battles).toBe(1)
    expect(other.weekChallenges).toEqual(data.weekChallenges)
  })

  it('跨周 hydrate：旧周存档加载后重掷并清零计数', () => {
    setActivePinia(createPinia())
    const store = useDailyStore()
    store.hydrate({
      lastCheckIn: '2020-01-01',
      streak: 9,
      weeklyCounters: { battles: 99, explores: 99, researches: 99, upgrades: 99, transcends: 99 },
      challengeWeek: '2020-W01',
      weekChallenges: [
        ch('wk_battles'),
        ch('wk_explores', { kind: 'explores', target: 6 }),
        ch('wk_researches', { kind: 'researches', target: 3 }),
      ],
    })
    expect(store.challengeWeek).toBe(weekStr())
    expect(store.weeklyCounters.battles).toBe(0)
    expect(store.weekChallenges).toHaveLength(3)
  })

  it('旧档无 daily 字段：hydrate(undefined) 不抛错，之后 ensureWeek 可用', () => {
    setActivePinia(createPinia())
    const store = useDailyStore()
    expect(() => store.hydrate(undefined)).not.toThrow()
    expect(store.streak).toBe(0)
    expect(store.weekChallenges).toHaveLength(0)
    store.ensureWeek()
    expect(store.weekChallenges).toHaveLength(3)
  })

  it('损坏条目（未知 templateId）被过滤：列表不完整时重掷补全 3 项', () => {
    setActivePinia(createPinia())
    const store = useDailyStore()
    store.hydrate({
      lastCheckIn: '2026-09-07',
      streak: 3,
      weeklyCounters: { battles: 1, explores: 0, researches: 0, upgrades: 0, transcends: 0 },
      challengeWeek: weekStr(),
      weekChallenges: [ch('wk_battles'), ch('wk_hacked', { target: 1, rewardDark: 999 })],
    })
    // 过滤后仅剩 1 项（不足 3）→ 重掷补全，未知模板不会存活
    expect(store.weekChallenges).toHaveLength(3)
    expect(
      store.weekChallenges.every((c) =>
        CHALLENGE_TEMPLATES.some((t) => t.templateId === c.templateId)
      )
    ).toBe(true)
  })

  // —— v0.75：伪造挑战条目按模板重推导（防 target:0 白领奖励）——

  it('伪造 target/rewardDark/kind：hydrate 一律按模板重推导', () => {
    setActivePinia(createPinia())
    const store = useDailyStore()
    store.hydrate({
      lastCheckIn: '2026-09-07',
      streak: 1,
      weeklyCounters: { battles: 0, explores: 0, researches: 0, upgrades: 0, transcends: 0 },
      challengeWeek: weekStr(),
      weekChallenges: [
        ch('wk_battles', { kind: 'upgrades' as never, target: 0, rewardDark: 999999 }),
        ch('wk_explores', { kind: 'explores', target: 6 }),
        ch('wk_researches', { kind: 'researches', target: 3 }),
      ],
    })
    // 3 项齐全（含伪造项）→ 列表完整不重掷，伪造值逐项按模板重推导
    expect(store.weekChallenges).toHaveLength(3)
    const c = store.weekChallenges.find((x) => x.templateId === 'wk_battles')!
    expect(c.kind).toBe('battles') // 模板 kind，非存档伪造值
    expect(c.target).toBe(5) // 模板 targets[0]
    expect(c.rewardDark).toBe(3) // 模板 rewardDark[0]
    // 伪造 target:0 不再恒真可领
    expect(store.claimable(c)).toBe(false)
    expect(store.claim(c.templateId)).toBeNull()
  })

  it('tier 越界/非整数条目丢弃：过滤后列表不完整即重掷补全（同周保留计数）', () => {
    setActivePinia(createPinia())
    const store = useDailyStore()
    store.hydrate({
      lastCheckIn: '2026-09-07',
      streak: 1,
      weeklyCounters: { battles: 2, explores: 0, researches: 0, upgrades: 0, transcends: 0 },
      challengeWeek: weekStr(),
      weekChallenges: [
        ch('wk_battles', { tier: 99, target: 1, rewardDark: 1 }),
        ch('wk_explores', { kind: 'explores', tier: 1.5, target: 1, rewardDark: 1 }),
      ],
    })
    // 两项均非法被丢弃 → 列表不完整 → 重掷为 3 项；同周修复保留计数
    expect(store.weekChallenges).toHaveLength(3)
    expect(store.weeklyCounters.battles).toBe(2)
    for (const c of store.weekChallenges) {
      const tpl = CHALLENGE_TEMPLATES.find((t) => t.templateId === c.templateId)!
      expect(c.tier).toBeGreaterThanOrEqual(0)
      expect(c.tier).toBeLessThan(tpl.targets.length)
    }
  })

  it('空表 + 当前周（退化/外部存档）：加载即补掷 3 项，不留整周空窗', () => {
    setActivePinia(createPinia())
    const store = useDailyStore()
    store.hydrate({
      lastCheckIn: '2026-09-07',
      streak: 1,
      weeklyCounters: { battles: 3, explores: 0, researches: 0, upgrades: 0, transcends: 0 },
      challengeWeek: weekStr(),
      weekChallenges: [],
    })
    expect(store.weekChallenges).toHaveLength(3)
    expect(store.weeklyCounters.battles).toBe(3) // 同一周内补掷不清计数
  })

  it('hardReset 语义：reset() 全清', () => {
    setActivePinia(createPinia())
    const store = useDailyStore()
    store.onTickCheckIn(dateOf(2026, 9, 7))
    store.ensureWeek(dateOf(2026, 9, 7))
    store.reset()
    expect(store.lastCheckIn).toBe('')
    expect(store.streak).toBe(0)
    expect(store.weekChallenges).toHaveLength(0)
  })
})

describe('daily — 模板池完整性', () => {
  it('模板 ≥5 组（3 选有变化空间），kind 与计数器键对齐', () => {
    expect(CHALLENGE_TEMPLATES.length).toBeGreaterThanOrEqual(5)
    const kinds = ['battles', 'explores', 'researches', 'upgrades', 'transcends']
    for (const t of CHALLENGE_TEMPLATES) {
      expect(kinds).toContain(t.kind)
      expect(t.targets).toHaveLength(t.rewardDark.length)
      for (const target of t.targets) expect(target).toBeGreaterThan(0)
    }
  })
})
