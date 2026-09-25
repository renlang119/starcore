/**
 * save/schema.ts — 存档类型契约与版本号（从 storage.ts 拆出）。
 *
 * 各 store 的序列化类型、全量存档接口（SaveData）与版本号常量；
 * 校验（validate）与读写（io）均以本文件的契约为准。
 */
import type { UnitId } from '@/data/units'

/** 存档版本号（测试阶段重新起算；旧版本迁移链已随 v0.73 精简移除） */
export const SAVE_VERSION = 1

// —— 各 store 的序列化类型 ——
export interface ResourceSaveData {
  amounts: Record<string, string>
  totals: Record<string, string>
}
export interface BuildingSaveData {
  levels: Record<string, number>
}
export interface ResearchSaveData {
  completed: string[]
}
export interface MilitarySaveData {
  /** 兵力：允许缺键（旧档可能没有全部兵种，hydrate 缺省补零），键限兵种白名单 */
  owned: Partial<Record<UnitId, number>>
  training: { id: string; unitId: UnitId; count: number; remaining: number; totalTime: number }[]
  /** 编队兵力：同样允许缺键（v0.75 hydrate 缺键补零防 NaN）；
   *  trait 可选（v1.23 方案 7，旧档缺失视为均衡，零迁移） */
  formations: { id: string; name: string; trait?: string; units: Partial<Record<UnitId, number>> }[]
}
export interface CombatSaveData {
  garrisoned: Record<string, { strongholdId: string; formationId: string; startTime: number }>
  completed: string[]
  /** 无尽远征历史最深层数（v0.60，跨转生保留；旧档缺失默认 0） */
  expeditionBest?: number
  /** 已领取的远征里程碑档位（v1.20 可选字段，终身数据与 expeditionBest 同语义；旧档缺失默认空，零迁移） */
  milestonesClaimed?: number[]
}
/**
 * 档案馆存档（v1.18 可选字段：旧档缺失视为空图鉴，向前收集）。
 * enemies = 已遭遇敌方图鉴条目键（`据点id#序号`，语言无关，跨转生保留）。
 */
export interface ArchiveSaveData {
  enemies: string[]
}

/**
 * 随机遭遇事件存档（v1.26 可选字段：旧档缺失视为无挂起、窗口重开）。
 * 本轮数据：挂起与窗口时间戳随转生清空，hardReset 同清。
 */
export interface EncountersSaveData {
  /** 下次可触发时刻（ms 绝对时间戳；重启续窗口防重载即触发） */
  nextTriggerAt: number
  /** 挂起事件 id（白名单在 validate 剥离 / hydrate 过滤） */
  pendingEventId?: string
  /** 挂起时刻（ms；pendingEventId 存在时有效，超时由读取侧/tick 静默失效） */
  pendingAt?: number
}
export interface ExplorationSaveData {
  progress: Record<
    string,
    { nodeId: string; startTime: number; endTime: number; completed: boolean }
  >
}
export interface RelicSaveData {
  owned: { id: string; instanceId: string; obtainedAt: number; level?: number }[]
  equipped: (string | null)[]
}
export interface TranscendSaveData {
  negativeEntropy: string
  totalTranscends: number
  /** id + level */
  tree: { id: string; level: number }[]
}
export interface PlayerSaveData {
  id: string
  name: string
}

/**
 * 成就存档（可选字段）。旧档无此字段，hydrate 时终身计数从零起算，
 * 历史产量不追溯（无数据来源）。
 */
export interface AchievementsSaveData {
  lifetime: {
    /** 终身累计能量/暗物质产出（Decimal 字符串） */
    energy: string
    dark: string
    /** 终身建筑升级次数 */
    upgrades: number
    /** 终身单建筑最高等级 */
    maxBuildingLevel: number
    /** 终身研究完成次数 */
    researches: number
    /** 终身探索完成次数 */
    explores: number
    /** 终身据点攻克次数 */
    battles: number
    /** 终身遗物合成次数（v1.22 可选：旧档缺失视为 0） */
    synths?: number
    /** 终身遗物强化总级数（v1.22 可选：旧档缺失视为 0） */
    enhanceLevels?: number
  }
  /** 已解锁成就：id → 解锁时间戳（ms） */
  unlocked: Record<string, number>
}

/** 每日签到/周期挑战存档（v0.62，可选字段：旧档缺失视为从未签到） */
export interface DailySaveData {
  /** 最后签到日（本地 YYYY-MM-DD） */
  lastCheckIn: string
  /** 连续签到天数 */
  streak: number
  /** 本周挑战计数（换周清零；v1.21 扩四键，旧档缺新键视为 0） */
  weeklyCounters: {
    battles: number
    explores: number
    researches: number
    upgrades: number
    transcends: number
    expedition: number
    synths: number
    enhances: number
    garrisonHours: number
  }
  /** 挑战所属周标识（YYYY-Www） */
  challengeWeek: string
  /** 本周 3 项挑战 */
  weekChallenges: {
    templateId: string
    kind:
      | 'battles'
      | 'explores'
      | 'researches'
      | 'upgrades'
      | 'transcends'
      | 'expedition'
      | 'synths'
      | 'enhances'
      | 'garrisonHours'
    tier: number
    target: number
    rewardDark: number
    claimed: boolean
  }[]
  /** 本周强敌已击败的周标识（v1.24 可选字段：旧档缺失视为未击败，零迁移）。
   *  语义：仅当 claimedWeek === 当前周标识时视为「本周已击败」，跨周自动失效。 */
  weeklyBoss?: { claimedWeek: string }
}

/** 全量存档接口 */
export interface SaveData {
  version: number
  savedAt: number
  player: PlayerSaveData
  /** 终身游玩时长（秒）。入档保存（此前刷新归零）；旧档缺失时按 0 处理 */
  totalPlayTime?: number
  resources: ResourceSaveData
  buildings: BuildingSaveData
  research: ResearchSaveData
  military: MilitarySaveData
  combat: CombatSaveData
  exploration: ExplorationSaveData
  relics: RelicSaveData
  transcend: TranscendSaveData
  /** 成就存档（可选字段）；旧档缺失，hydrate 自动取默认空值 */
  achievements?: AchievementsSaveData
  /** 每日签到/周期挑战（v0.62 可选字段，旧档缺失从容处理） */
  daily?: DailySaveData
  /** 档案馆（v1.18 可选字段，旧档缺失视为空图鉴） */
  archive?: ArchiveSaveData
  /** 随机遭遇事件（v1.26 可选字段，旧档缺失视为无挂起、窗口重开） */
  encounters?: EncountersSaveData
}
