/**
 * daily.ts — 每日签到/周期挑战 store（v0.62 玩法扩展方案 7）
 *
 * 职责：
 * - 每日签到：当日首次进游戏自动签到（本地日期字符串判定，放置游戏少一次交互）；
 *   连击 1/3/7 天给节点奖励（7 天封顶循环），断签给回归补偿包（回来总有东西拿）
 * - 周期挑战：每周一（本地时区）换新 3 项，从固定模板池按周标识种子抽取
 *   （同周确定性，FNV-1a 哈希 → 洗牌，与战斗 PRNG 同族）；计数复用成就
 *   终身计数钩子（bump 接线在 game store 各 record 处），换周清零；
 *   完成后手动领取（暗物质 + 签到连击 +1，两个系统勾连）
 *
 * 设计意图：
 * - 量级克制：签到/挑战奖励都是「顺路的糖」（成就奖励同级），不造第二资源轴
 * - 签到/挑战的能量奖励走 resources.gain 入 totals：计入终身成就计数与本轮转生负熵，
 *   是设计行为而非重复计入（量级 5e3-1e5，相对转生阈值 3e5 仅首转前后有感知）
 * - 纯前端单机存档：日期用本地时间即可，奖励量级小，无跨时区刷取收益
 * - 存档容缺：daily 为可选字段，旧档缺失视为未签到过、本周挑战待生成，从当天开始
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { DailySaveData } from '@/lib/storage'
import { fnv1a, mulberry32 } from '@/lib/random'

/** 本地日期字符串 YYYY-MM-DD（toLocaleDateString('sv') 为 ISO 形态） */
export function localDateStr(d = new Date()): string {
  return d.toLocaleDateString('sv')
}

/** ISO 周标识 YYYY-Www（周一为每周起点，与刷新规则一致） */
export function weekStr(d = new Date()): string {
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  // ISO 8601：周四所在年为周年份；周一偏移 4 天
  const dayNum = (t.getDay() + 6) % 7 // 周一=0 … 周日=6
  t.setDate(t.getDate() - dayNum + 3) // 本周四
  const isoYear = t.getFullYear()
  const firstThursday = new Date(isoYear, 0, 4)
  const fDayNum = (firstThursday.getDay() + 6) % 7
  firstThursday.setDate(firstThursday.getDate() - fDayNum + 3)
  const week = 1 + Math.round((t.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000))
  return `${isoYear}-W${String(week).padStart(2, '0')}`
}

/** FNV-1a 字符串哈希（种子源，见 lib/random） */
export const hashStr = fnv1a

/** 挑战模板池：kind 对应 weeklyCounters 键 */
interface ChallengeTemplate {
  templateId: string
  kind: 'battles' | 'explores' | 'researches' | 'upgrades' | 'transcends'
  /** 档位阈值（从低到高） */
  targets: number[]
  /** 完成奖励：暗物质 + 签到连击加成天数 */
  rewardDark: number[]
  name: (target: number) => string
}

export const CHALLENGE_TEMPLATES: ChallengeTemplate[] = [
  {
    templateId: 'wk_battles',
    kind: 'battles',
    targets: [5, 8, 12],
    rewardDark: [3, 5, 8],
    name: (t) => `累计攻克 ${t} 座据点`,
  },
  {
    templateId: 'wk_explores',
    kind: 'explores',
    targets: [6, 10, 15],
    rewardDark: [3, 5, 8],
    name: (t) => `累计完成 ${t} 次探索`,
  },
  {
    templateId: 'wk_researches',
    kind: 'researches',
    targets: [3, 5, 8],
    rewardDark: [3, 5, 8],
    name: (t) => `累计研究 ${t} 项科技`,
  },
  {
    templateId: 'wk_upgrades',
    kind: 'upgrades',
    targets: [40, 70, 100],
    rewardDark: [3, 5, 8],
    name: (t) => `累计升级建筑 ${t} 次`,
  },
  {
    templateId: 'wk_transcends',
    kind: 'transcends',
    targets: [1, 2],
    rewardDark: [8, 12],
    name: (t) => `完成 ${t} 次奇点重启`,
  },
]

export interface WeeklyChallenge {
  templateId: string
  kind: ChallengeTemplate['kind']
  /** 档位索引 */
  tier: number
  target: number
  rewardDark: number
  /** 已领取 */
  claimed: boolean
}

/** 连击节点奖励：第 1/3/7 天，7 天封顶循环 */
export const STREAK_CYCLE = 7
export function streakReward(day: number): { energy: number; dark: number } | null {
  const d = ((day - 1) % STREAK_CYCLE) + 1
  if (d === 1) return { energy: 2e4, dark: 0 }
  if (d === 3) return { energy: 5e4, dark: 3 }
  if (d === 7) return { energy: 1e5, dark: 7 }
  return null
}

/** 断签回归补偿包 */
export const RETURN_GIFT = { energy: 5e4, dark: 2 }

export const useDailyStore = defineStore('daily', () => {
  const lastCheckIn = ref('') // YYYY-MM-DD，空 = 从未签到
  const streak = ref(0)
  const weeklyCounters = ref({ battles: 0, explores: 0, researches: 0, upgrades: 0, transcends: 0 })
  const challengeWeek = ref('')
  const weekChallenges = ref<WeeklyChallenge[]>([])

  /** 今日已签到 */
  const checkedInToday = computed(() => lastCheckIn.value === localDateStr())
  const currentWeek = computed(() => weekStr())

  /**
   * 每秒 tick 调用：换天自动签到（含断签补偿判定）+ 换周重掷。
   * 字符串比较，开销忽略。返回本次签到奖励（无则 null），供 UI 浮层提示。
   */
  function onTickCheckIn(
    now = new Date()
  ): { energy: number; dark: number; streakDay: number; returned: boolean } | null {
    ensureWeek(now)
    const today = localDateStr(now)
    if (lastCheckIn.value === today) return null
    // 断签判定：上次签到不是昨天 → 连击清零 + 回归补偿
    const yesterday = localDateStr(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))
    const returned = lastCheckIn.value !== '' && lastCheckIn.value !== yesterday
    if (returned) {
      streak.value = 0
    }
    streak.value++
    lastCheckIn.value = today
    const reward = streakReward(streak.value) ?? { energy: 5e3, dark: 0 }
    if (returned) {
      // 回归补偿叠加在普通签到奖励之上
      return {
        energy: reward.energy + RETURN_GIFT.energy,
        dark: reward.dark + RETURN_GIFT.dark,
        streakDay: streak.value,
        returned: true,
      }
    }
    return { ...reward, streakDay: streak.value, returned: false }
  }

  /** 周标识不一致 → 重掷 3 项挑战 + 清计数（种子 = 周标识哈希，同周确定） */
  function ensureWeek(now = new Date()): void {
    const wk = weekStr(now)
    if (challengeWeek.value === wk) return
    challengeWeek.value = wk
    weeklyCounters.value = { battles: 0, explores: 0, researches: 0, upgrades: 0, transcends: 0 }
    const rng = mulberry32(hashStr(wk))
    // 洗牌模板池取 3
    const pool = [...CHALLENGE_TEMPLATES]
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[pool[i], pool[j]] = [pool[j], pool[i]]
    }
    weekChallenges.value = pool.slice(0, 3).map((t) => {
      const tier = Math.floor(rng() * t.targets.length)
      return {
        templateId: t.templateId,
        kind: t.kind,
        tier,
        target: t.targets[tier],
        rewardDark: t.rewardDark[tier],
        claimed: false,
      }
    })
  }

  /** 终身计数钩子转发（game store 各 record 处调用） */
  function bump(kind: keyof typeof weeklyCounters.value): void {
    if (weeklyCounters.value[kind] !== undefined) weeklyCounters.value[kind]++
  }

  /** 挑战进度（0~1） */
  function progressOf(c: WeeklyChallenge): number {
    return Math.min(1, weeklyCounters.value[c.kind] / c.target)
  }
  /** 是否已完成且未领取 */
  function claimable(c: WeeklyChallenge): boolean {
    return !c.claimed && weeklyCounters.value[c.kind] >= c.target
  }

  /** 领取挑战奖励：暗物质 + 连击 +1。返回奖励（暗物质量），未达成/已领返回 null */
  function claim(templateId: string): { dark: number; streakBonus: number } | null {
    const c = weekChallenges.value.find((x) => x.templateId === templateId)
    if (!c || c.claimed || weeklyCounters.value[c.kind] < c.target) return null
    c.claimed = true
    streak.value++ // 勾连：挑战完成给连击 +1（可跳过断签判定提前到下一节点）
    return { dark: c.rewardDark, streakBonus: 1 }
  }

  function reset(): void {
    lastCheckIn.value = ''
    streak.value = 0
    weeklyCounters.value = { battles: 0, explores: 0, researches: 0, upgrades: 0, transcends: 0 }
    challengeWeek.value = ''
    weekChallenges.value = []
  }

  function serialize(): DailySaveData {
    return {
      lastCheckIn: lastCheckIn.value,
      streak: streak.value,
      weeklyCounters: { ...weeklyCounters.value },
      challengeWeek: challengeWeek.value,
      weekChallenges: weekChallenges.value.map((c) => ({ ...c })),
    }
  }

  function hydrate(data: DailySaveData | undefined): void {
    if (!data) return
    if (typeof data.lastCheckIn === 'string') lastCheckIn.value = data.lastCheckIn
    if (typeof data.streak === 'number' && isFinite(data.streak) && data.streak >= 0) {
      streak.value = Math.floor(data.streak)
    }
    if (data.weeklyCounters && typeof data.weeklyCounters === 'object') {
      const wc = data.weeklyCounters
      for (const k of ['battles', 'explores', 'researches', 'upgrades', 'transcends'] as const) {
        const v = wc[k]
        if (typeof v === 'number' && isFinite(v) && v >= 0) weeklyCounters.value[k] = Math.floor(v)
      }
    }
    if (typeof data.challengeWeek === 'string') challengeWeek.value = data.challengeWeek
    if (Array.isArray(data.weekChallenges)) {
      // 只认模板池内条目，且 kind/target/rewardDark 一律按 templateId+tier 重推导，
      // 不信存档值（防伪造 target:0 / rewardDark 白领奖励；tier 越界条目丢弃）
      weekChallenges.value = data.weekChallenges
        .map((c): WeeklyChallenge | null => {
          const tpl = CHALLENGE_TEMPLATES.find((t) => t.templateId === c?.templateId)
          if (!tpl) return null
          const tier = c.tier
          if (
            typeof tier !== 'number' ||
            !Number.isInteger(tier) ||
            tier < 0 ||
            tier >= tpl.targets.length
          )
            return null
          return {
            templateId: tpl.templateId,
            kind: tpl.kind,
            tier,
            target: tpl.targets[tier],
            rewardDark: tpl.rewardDark[tier],
            claimed: c.claimed === true,
          }
        })
        .filter((c): c is WeeklyChallenge => c !== null)
    }
    // 存档周标识落后于当前周（跨周回来）→ 立即重掷，等下一次 onTickCheckIn 也可
    ensureWeek()
  }

  return {
    lastCheckIn,
    streak,
    weeklyCounters,
    challengeWeek,
    weekChallenges,
    checkedInToday,
    currentWeek,
    onTickCheckIn,
    ensureWeek,
    bump,
    progressOf,
    claimable,
    claim,
    reset,
    serialize,
    hydrate,
  }
})
