/**
 * encounters.ts — 随机遭遇事件定义（v1.26 可玩内容扩展方案 8）
 *
 * 在线挂机时的低频决策点：每个事件恰两个选项（稳收益 vs 风险赌注），
 * 玩家不处理则过期消失。设计红线：
 * - 量级克制：奖励是「顺路的糖」，折算能量当量 4.4e3–9.2e3（签到同级口径），
 *   不锚玩家进度、不造第二资源轴
 * - 纯增量：不碰战斗公式；存档为可选字段零迁移（store 侧见 encounters.ts）
 * - 随机即时事件用 Math.random（无需确定性重放；fnv1a/mulberry32 保留给周期刷新类）
 *
 * 数值口径：10 模板全部经 EV 核验表程序化断言（每事件两选项期望差 ≤15%、
 * 赌注类高方差 / 资源类低方差、量级带内），调整数值前先改核验表再同步此处。
 */

import { t } from '@/i18n'

/** 事件奖励：资源键 → 数量；负值仅允许 alloy（损失结果，结算侧至多扣空） */
export interface EncounterRewards {
  energy?: number
  alloy?: number
  data?: number
  dark?: number
  /** 收编突击兵数量（走军事 store 入库存，不经训练队列） */
  units?: number
}

export interface EncounterOption {
  /** 选项按钮标签（数据实体字段：模块加载时取词，UI 读字段不做动态键拼接） */
  label: string
  /** 结果分布：概率 + 奖励（概率和恒为 1） */
  chances: { p: number; rewards: EncounterRewards }[]
}

export type EncounterFlavor = 'resource' | 'military' | 'explore' | 'gamble'

export interface EncounterDef {
  id: string
  flavor: EncounterFlavor
  name: string
  desc: string
  optA: EncounterOption
  optB: EncounterOption
}

/** 触发间隔下限（秒，均匀随机窗口下界） */
export const ENCOUNTER_INTERVAL_MIN = 480
/** 触发间隔上限（秒，均匀随机窗口上界） */
export const ENCOUNTER_INTERVAL_MAX = 900
/** 挂起过期时限（毫秒）：超时未处理静默失效，不代选 */
export const ENCOUNTER_EXPIRE_MS = 60_000

/**
 * 事件池：10 模板，四类风味——资源类 4 / 军事类 2 / 探索类 1 / 风险赌注类 3。
 * 数值与核验表同源；文案经语言包 content.encounters 域取词。
 */
export const ENCOUNTERS: EncounterDef[] = [
  // —— 资源类 4：B 选项「稳中略好」，低方差 ——
  {
    id: 'enc_flux',
    flavor: 'resource',
    name: t('content.encounters.enc_flux.name'),
    desc: t('content.encounters.enc_flux.desc'),
    optA: {
      label: t('content.encounters.enc_flux.optA'),
      chances: [{ p: 1, rewards: { energy: 8000 } }],
    },
    optB: {
      label: t('content.encounters.enc_flux.optB'),
      chances: [
        { p: 0.8, rewards: { energy: 10600 } },
        { p: 0.2, rewards: { energy: 3400 } },
      ],
    },
  },
  {
    id: 'enc_vein',
    flavor: 'resource',
    name: t('content.encounters.enc_vein.name'),
    desc: t('content.encounters.enc_vein.desc'),
    optA: {
      label: t('content.encounters.enc_vein.optA'),
      chances: [{ p: 1, rewards: { alloy: 4800 } }],
    },
    optB: {
      label: t('content.encounters.enc_vein.optB'),
      chances: [
        { p: 0.8, rewards: { alloy: 6300 } },
        { p: 0.2, rewards: { alloy: 1500 } },
      ],
    },
  },
  {
    id: 'enc_signal',
    flavor: 'resource',
    name: t('content.encounters.enc_signal.name'),
    desc: t('content.encounters.enc_signal.desc'),
    optA: {
      label: t('content.encounters.enc_signal.optA'),
      chances: [{ p: 1, rewards: { data: 900 } }],
    },
    optB: {
      label: t('content.encounters.enc_signal.optB'),
      chances: [
        { p: 0.5, rewards: { data: 1450 } },
        { p: 0.5, rewards: { data: 550 } },
      ],
    },
  },
  {
    id: 'enc_depot',
    flavor: 'resource',
    name: t('content.encounters.enc_depot.name'),
    desc: t('content.encounters.enc_depot.desc'),
    optA: {
      label: t('content.encounters.enc_depot.optA'),
      chances: [{ p: 1, rewards: { energy: 6000, alloy: 400 } }],
    },
    optB: {
      label: t('content.encounters.enc_depot.optB'),
      chances: [
        { p: 0.65, rewards: { energy: 9200, alloy: 600 } },
        { p: 0.35, rewards: { energy: 2500, alloy: 300 } },
      ],
    },
  },
  // —— 军事类 2：收编 vs 折现 / 稳拆 vs 赌核心 ——
  {
    id: 'enc_salvage',
    flavor: 'military',
    name: t('content.encounters.enc_salvage.name'),
    desc: t('content.encounters.enc_salvage.desc'),
    optA: {
      label: t('content.encounters.enc_salvage.optA'),
      chances: [{ p: 1, rewards: { alloy: 2800, data: 280 } }],
    },
    optB: {
      label: t('content.encounters.enc_salvage.optB'),
      chances: [
        { p: 0.6, rewards: { alloy: 6400, data: 400 } },
        { p: 0.4, rewards: { alloy: -1400 } },
      ],
    },
  },
  {
    id: 'enc_recruit',
    flavor: 'military',
    name: t('content.encounters.enc_recruit.name'),
    desc: t('content.encounters.enc_recruit.desc'),
    optA: {
      label: t('content.encounters.enc_recruit.optA'),
      chances: [{ p: 1, rewards: { units: 80 } }],
    },
    optB: {
      label: t('content.encounters.enc_recruit.optB'),
      chances: [{ p: 1, rewards: { energy: 4400, alloy: 400 } }],
    },
  },
  // —— 探索类 1：暗物质独家产出 vs 大额能源 ——
  {
    id: 'enc_beacon',
    flavor: 'explore',
    name: t('content.encounters.enc_beacon.name'),
    desc: t('content.encounters.enc_beacon.desc'),
    optA: {
      label: t('content.encounters.enc_beacon.optA'),
      chances: [{ p: 1, rewards: { data: 90, dark: 1 } }],
    },
    optB: {
      label: t('content.encounters.enc_beacon.optB'),
      chances: [
        { p: 0.85, rewards: { energy: 9600 } },
        { p: 0.15, rewards: { energy: 2000 } },
      ],
    },
  },
  // —— 赌注类 3：高方差同期望，「翻倍 or 白忙」 ——
  {
    id: 'enc_well',
    flavor: 'gamble',
    name: t('content.encounters.enc_well.name'),
    desc: t('content.encounters.enc_well.desc'),
    optA: {
      label: t('content.encounters.enc_well.optA'),
      chances: [{ p: 1, rewards: { energy: 7000 } }],
    },
    optB: {
      label: t('content.encounters.enc_well.optB'),
      chances: [
        { p: 0.35, rewards: { energy: 22000 } },
        { p: 0.65, rewards: {} },
      ],
    },
  },
  {
    id: 'enc_core',
    flavor: 'gamble',
    name: t('content.encounters.enc_core.name'),
    desc: t('content.encounters.enc_core.desc'),
    optA: {
      label: t('content.encounters.enc_core.optA'),
      chances: [{ p: 1, rewards: { alloy: 4400 } }],
    },
    optB: {
      label: t('content.encounters.enc_core.optB'),
      chances: [
        { p: 0.5, rewards: { alloy: 9600 } },
        { p: 0.25, rewards: { alloy: 2000 } },
        { p: 0.25, rewards: { alloy: -1300 } },
      ],
    },
  },
  {
    id: 'enc_wager',
    flavor: 'gamble',
    name: t('content.encounters.enc_wager.name'),
    desc: t('content.encounters.enc_wager.desc'),
    optA: {
      label: t('content.encounters.enc_wager.optA'),
      chances: [{ p: 1, rewards: { energy: 4400, alloy: 400 } }],
    },
    optB: {
      label: t('content.encounters.enc_wager.optB'),
      chances: [
        { p: 0.4, rewards: { energy: 12000 } },
        { p: 0.6, rewards: {} },
      ],
    },
  },
]

/** 事件 id 白名单（存档校验剥离未知挂起 id 用） */
export const ENCOUNTER_IDS = new Set<string>(ENCOUNTERS.map((e) => e.id))

/** 按 id 取事件定义（未知 id 返回 undefined，调用方自行兜底） */
export function getEncounter(id: string): EncounterDef | undefined {
  return ENCOUNTERS.find((e) => e.id === id)
}

/** 按选项分布掷一次结果；随机源可注入（测试固定分支），缺省 Math.random */
export function rollOutcome(
  opt: EncounterOption,
  rand: () => number = Math.random
): EncounterRewards {
  let roll = rand()
  for (const c of opt.chances) {
    roll -= c.p
    if (roll < 0) return { ...c.rewards }
  }
  // 浮点兜底：概率和为 1 时不可达，退化返回末位结果
  return { ...opt.chances[opt.chances.length - 1]!.rewards }
}

/** 下一次触发间隔（毫秒，均匀随机窗口） */
export function rollIntervalMs(): number {
  return (
    ENCOUNTER_INTERVAL_MIN * 1000 +
    Math.random() * (ENCOUNTER_INTERVAL_MAX - ENCOUNTER_INTERVAL_MIN) * 1000
  )
}
