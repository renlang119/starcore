/**
 * storage.ts — 本地持久化封装
 * 使用 localforage（IndexedDB）作为主存，localStorage 作为辅助
 */
import localforage from 'localforage'
import { fnv1a } from '@/lib/random'
import type { UnitId } from '@/data/units'
import { BUILDINGS } from '@/data/buildings'
import { TECHS } from '@/data/tech'
import { UNITS } from '@/data/units'
import { EXPLORE_NODES } from '@/data/explore'
import { STRONGHOLDS } from '@/data/pve'
import { RELIC_POOL, MAX_RELIC_LEVEL } from '@/data/relics'

// —— 有效 ID 集合（用于 validateSaveData 内容范围校验）——
const BUILDING_IDS = new Set(BUILDINGS.map((b) => b.id))
const TECH_IDS = new Set(TECHS.map((t) => t.id))
const UNIT_IDS = new Set<string>(UNITS.map((u) => u.id))
const EXPLORE_NODE_IDS = new Set(EXPLORE_NODES.map((n) => n.id))
const STRONGHOLD_IDS = new Set(STRONGHOLDS.map((s) => s.id))
const RELIC_IDS = new Set(RELIC_POOL.map((r) => r.id))

const STORE = localforage.createInstance({
  name: 'starcore',
  storeName: 'save',
  description: '星核纪元存档',
})

export const SAVE_KEY = 'starcore_save_v1'

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
  /** 编队兵力：同样允许缺键（v0.75 hydrate 缺键补零防 NaN） */
  formations: { id: string; name: string; units: Partial<Record<UnitId, number>> }[]
}
export interface CombatSaveData {
  garrisoned: Record<string, { strongholdId: string; formationId: string; startTime: number }>
  completed: string[]
  /** 无尽远征历史最深层数（v0.60，跨转生保留；旧档缺失默认 0） */
  expeditionBest?: number
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
  /** 本周挑战计数（换周清零） */
  weeklyCounters: {
    battles: number
    explores: number
    researches: number
    upgrades: number
    transcends: number
  }
  /** 挑战所属周标识（YYYY-Www） */
  challengeWeek: string
  /** 本周 3 项挑战 */
  weekChallenges: {
    templateId: string
    kind: 'battles' | 'explores' | 'researches' | 'upgrades' | 'transcends'
    tier: number
    target: number
    rewardDark: number
    claimed: boolean
  }[]
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
}

/** 写入存档（IndexedDB + localStorage 备份，均带 checksum） */
export async function writeSave(data: SaveData): Promise<void> {
  const json = JSON.stringify(data)
  const payload = { d: json, c: _checksum(json) }
  try {
    await STORE.setItem(SAVE_KEY, payload)
  } catch {
    // 存储满或受限时回退到 localStorage
  }
  try {
    localStorage.setItem(SAVE_KEY + '_backup', JSON.stringify(payload))
  } catch {
    /* 忽略配额溢出 */
  }
}

/** 同步写入存档到 localStorage（用于 beforeunload 等来不及等 IndexedDB 的场景） */
export function writeSaveSync(data: SaveData): void {
  try {
    const json = JSON.stringify(data)
    const payload = JSON.stringify({ d: json, c: _checksum(json) })
    localStorage.setItem(SAVE_KEY + '_backup', payload)
  } catch {
    /* 忽略配额溢出 */
  }
}

/** 读档结果：成功 / 版本过新（不静默 hydrate）/ 无档 */
export type SaveReadOutcome =
  { status: 'ok'; data: SaveData } | { status: 'too_new'; version: number } | { status: 'none' }

/** 读取存档（优先 IndexedDB，带 checksum 校验） */
export async function readSave(): Promise<SaveReadOutcome> {
  try {
    const stored = await STORE.getItem<unknown>(SAVE_KEY)
    if (stored) {
      const parsed = _parseStored(stored)
      if (parsed) return parsed
    }
  } catch {
    /* noop */
  }
  try {
    const bak = localStorage.getItem(SAVE_KEY + '_backup')
    if (bak) {
      const parsed = _parseBackup(bak)
      if (parsed) return parsed
    }
  } catch {
    /* noop */
  }
  return { status: 'none' }
}

/** 解析 IndexedDB 存储的值（兼容新格式 { d, c } 和旧格式裸对象） */
function _parseStored(stored: unknown): SaveReadOutcome | null {
  if (!_isObject(stored)) return null
  // 新格式：{ d: json, c: checksum }
  if (typeof stored.d === 'string' && typeof stored.c === 'string') {
    if (_checksum(stored.d) !== stored.c) return null // 校验失败——被篡改或损坏
    try {
      const data = JSON.parse(stored.d)
      const tooNew = _tooNewVersion(data)
      if (tooNew !== null) return { status: 'too_new', version: tooNew }
      if (!_validateAndRepair(data)) return null
      return { status: 'ok', data }
    } catch {
      return null
    }
  }
  // 旧格式兼容：裸 SaveData 对象
  const tooNew = _tooNewVersion(stored)
  if (tooNew !== null) return { status: 'too_new', version: tooNew }
  if (_validateAndRepair(stored)) return { status: 'ok', data: stored as SaveData }
  return null
}

/** 解析 localStorage 备份，验证校验和防篡改 */
function _parseBackup(raw: string): SaveReadOutcome | null {
  try {
    const parsed = JSON.parse(raw)
    // 新格式：{ d: json, c: checksum }
    if (parsed && typeof parsed.d === 'string' && typeof parsed.c === 'string') {
      if (_checksum(parsed.d) !== parsed.c) return null // 校验失败——被篡改或损坏
      const data = JSON.parse(parsed.d)
      const tooNew = _tooNewVersion(data)
      if (tooNew !== null) return { status: 'too_new', version: tooNew }
      if (!_validateAndRepair(data)) return null
      return { status: 'ok', data }
    }
    // 旧格式兼容：直接是 SaveData JSON
    const tooNew = _tooNewVersion(parsed)
    if (tooNew !== null) return { status: 'too_new', version: tooNew }
    if (_validateAndRepair(parsed)) return { status: 'ok', data: parsed as SaveData }
    return null
  } catch {
    return null
  }
}

/** 存档版本高于当前版本 → 返回该版本号（不静默 hydrate 未知结构），否则 null */
function _tooNewVersion(data: unknown): number | null {
  if (!_isObject(data)) return null
  const v = data.version
  if (typeof v === 'number' && isFinite(v) && v > SAVE_VERSION) return v
  return null
}

/**
 * 修复历史存档已知缺陷后再校验：
 * completed 混入非正式据点 id（v0.60 远征胜利会把 'endless' 写入通关集，
 * 主备档双双过不了白名单校验）→ 剥离该条目继续，不整档拒绝。
 */
function _validateAndRepair(data: unknown): data is SaveData {
  if (_isObject(data)) {
    const cb = data.combat
    if (_isObject(cb) && Array.isArray(cb.completed)) {
      cb.completed = cb.completed.filter((id) => typeof id === 'string' && STRONGHOLD_IDS.has(id))
    }
  }
  return validateSaveData(data)
}

/** FNV-1a 校验和——检测存档被篡改或损坏 */
function _checksum(data: string): string {
  return fnv1a(data).toString(16)
}

/** 清除存档 */
export async function clearSave(): Promise<void> {
  try {
    await STORE.removeItem(SAVE_KEY)
  } catch {
    /* noop */
  }
  try {
    localStorage.removeItem(SAVE_KEY + '_backup')
  } catch {
    /* noop */
  }
}

/**
 * 校验存档数据结构完整性与内容范围（防注入/损坏）
 */
function validateSaveData(data: unknown): data is SaveData {
  if (data == null || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (
    typeof d.version !== 'number' ||
    !isFinite(d.version) ||
    d.version < 1 ||
    d.version > SAVE_VERSION
  )
    return false
  if (typeof d.savedAt !== 'number' || !isFinite(d.savedAt) || d.savedAt < 0) return false
  if (d.player != null && !_isObject(d.player)) return false
  // totalPlayTime（可选字段）：存在则必须是非负有限数字
  if (
    d.totalPlayTime !== undefined &&
    (typeof d.totalPlayTime !== 'number' || !isFinite(d.totalPlayTime) || d.totalPlayTime < 0)
  )
    return false

  // resources: amounts/totals 必须是非负有限数字字符串
  if (!_isObject(d.resources)) return false
  const res = d.resources as Record<string, unknown>
  if (!_isNonNegNumberStrRecord(res.amounts)) return false
  if (!_isNonNegNumberStrRecord(res.totals)) return false

  // buildings: levels key 必须是有效建筑 ID，value 必须是非负整数
  if (!_isObject(d.buildings)) return false
  if (!_isValidIdNumberRecord((d.buildings as Record<string, unknown>).levels, BUILDING_IDS, true))
    return false

  // research: completed 数组元素必须是有效科技 ID
  if (!_isObject(d.research)) return false
  const research = d.research as Record<string, unknown>
  if (!Array.isArray(research.completed)) return false
  if (!research.completed.every((id: unknown) => typeof id === 'string' && TECH_IDS.has(id)))
    return false

  // military: owned key 必须是有效兵种 ID，value 非负整数（兵力不可为小数）
  if (!_isObject(d.military)) return false
  const mil = d.military as Record<string, unknown>
  if (!_isValidIdNumberRecord(mil.owned, UNIT_IDS, true)) return false
  // training: 条目结构 + unitId 白名单 + 数字字段有限（防 NaN 任务占死训练槽）
  if (!Array.isArray(mil.training)) return false
  if (
    !mil.training.every((t: unknown) => {
      if (!_isObject(t)) return false
      if (typeof t.id !== 'string') return false
      if (typeof t.unitId !== 'string' || !UNIT_IDS.has(t.unitId)) return false
      for (const k of ['count', 'remaining', 'totalTime']) {
        if (typeof t[k] !== 'number' || !isFinite(t[k]) || (t[k] as number) < 0) return false
      }
      return true
    })
  )
    return false
  // formations: 条目结构 + units 键白名单 + 值有限（防缺键加法产 NaN）
  if (!Array.isArray(mil.formations)) return false
  if (
    !mil.formations.every((f: unknown) => {
      if (!_isObject(f)) return false
      if (typeof f.id !== 'string' || typeof f.name !== 'string') return false
      if (!_isObject(f.units)) return false
      for (const [uid, n] of Object.entries(f.units)) {
        if (!UNIT_IDS.has(uid)) return false
        if (typeof n !== 'number' || !isFinite(n) || n < 0) return false
      }
      return true
    })
  )
    return false

  // combat: completed 元素必须是有效据点 ID；garrisoned 键与条目须在据点白名单内
  if (!_isObject(d.combat)) return false
  const cb = d.combat as Record<string, unknown>
  if (cb.garrisoned !== undefined) {
    if (!_isObject(cb.garrisoned)) return false
    for (const [sid, g] of Object.entries(cb.garrisoned)) {
      if (!STRONGHOLD_IDS.has(sid)) return false
      if (!_isObject(g)) return false
      if (typeof g.strongholdId !== 'string' || !STRONGHOLD_IDS.has(g.strongholdId)) return false
      if (typeof g.formationId !== 'string') return false
      if (typeof g.startTime !== 'number' || !isFinite(g.startTime) || g.startTime < 0) return false
    }
  }
  if (!Array.isArray(cb.completed)) return false
  if (!cb.completed.every((id: unknown) => typeof id === 'string' && STRONGHOLD_IDS.has(id)))
    return false

  // exploration: progress 条目须结构合法且时间戳有限；未知节点条目丢弃（hydrate 只取已知节点）
  if (!_isObject(d.exploration)) return false
  const expProg = (d.exploration as Record<string, unknown>).progress
  if (!_isObject(expProg)) return false
  for (const [key, val] of Object.entries(expProg)) {
    if (!EXPLORE_NODE_IDS.has(key)) continue
    if (!_isObject(val)) return false
    const p = val as Record<string, unknown>
    if (p.nodeId !== key) return false
    if (
      typeof p.startTime !== 'number' ||
      !isFinite(p.startTime) ||
      p.startTime < 0 ||
      typeof p.endTime !== 'number' ||
      !isFinite(p.endTime) ||
      p.endTime < 0 ||
      typeof p.completed !== 'boolean'
    )
      return false
  }

  // relics: owned 条目的 id 必须是有效遗物 ID；level（v0.70 可选字段）非负整数 ≤ MAX_RELIC_LEVEL
  if (!_isObject(d.relics)) return false
  const rl = d.relics as Record<string, unknown>
  if (!Array.isArray(rl.owned)) return false
  if (
    !rl.owned.every((r: unknown) => {
      if (!_isObject(r) || typeof r.id !== 'string' || !RELIC_IDS.has(r.id)) return false
      if (typeof r.instanceId !== 'string' || typeof r.obtainedAt !== 'number') return false
      if (r.level !== undefined) {
        if (
          !Number.isInteger(r.level) ||
          (r.level as number) < 0 ||
          (r.level as number) > MAX_RELIC_LEVEL
        )
          return false
      }
      return true
    })
  )
    return false
  if (!Array.isArray(rl.equipped)) return false
  if (!rl.equipped.every((e: unknown) => e === null || typeof e === 'string')) return false

  // transcend: tree 条目结构校验（id + 非负整数 level）
  if (!_isObject(d.transcend)) return false
  const tc = d.transcend as Record<string, unknown>
  if (tc.negativeEntropy !== undefined && !_isNonNegNumberStr(tc.negativeEntropy)) return false
  if (typeof tc.totalTranscends !== 'number' && tc.totalTranscends !== undefined) return false
  if (!Array.isArray(tc.tree)) return false
  if (
    !tc.tree.every((n: unknown) => {
      if (!_isObject(n) || typeof n.id !== 'string') return false
      return (
        typeof n.level === 'number' &&
        Number.isInteger(n.level) &&
        n.level >= 0 &&
        isFinite(n.level)
      )
    })
  )
    return false

  // achievements（可选字段）：存在则校验结构；id 白名单在 hydrate 层过滤
  if (d.achievements !== undefined) {
    if (!_isObject(d.achievements)) return false
    const ach = d.achievements as Record<string, unknown>
    if (!_isObject(ach.lifetime)) return false
    const lt = ach.lifetime as Record<string, unknown>
    for (const k of ['energy', 'dark']) {
      if (typeof lt[k] !== 'string' || !_isNonNegNumberStr(lt[k])) return false
    }
    for (const k of ['upgrades', 'maxBuildingLevel', 'researches', 'explores', 'battles']) {
      if (typeof lt[k] !== 'number' || !isFinite(lt[k]) || (lt[k] as number) < 0) return false
    }
    if (!_isObject(ach.unlocked)) return false
    for (const v of Object.values(ach.unlocked as Record<string, unknown>)) {
      if (typeof v !== 'number' || !isFinite(v) || v < 0) return false
    }
  }

  // daily（可选字段）：结构校验。挑战条目的 kind/target/rewardDark 不可信存档值，
  // 由 hydrate 按模板池 + tier 重推导（防伪造 target:0 白领奖励）
  if (d.daily !== undefined) {
    if (!_isObject(d.daily)) return false
    const dl = d.daily as Record<string, unknown>
    if (typeof dl.lastCheckIn !== 'string') return false
    if (typeof dl.streak !== 'number' || !isFinite(dl.streak) || dl.streak < 0) return false
    if (!_isObject(dl.weeklyCounters)) return false
    const wc = dl.weeklyCounters as Record<string, unknown>
    for (const k of ['battles', 'explores', 'researches', 'upgrades', 'transcends']) {
      if (typeof wc[k] !== 'number' || !isFinite(wc[k]) || (wc[k] as number) < 0) return false
    }
    if (typeof dl.challengeWeek !== 'string') return false
    if (!Array.isArray(dl.weekChallenges)) return false
    for (const c of dl.weekChallenges) {
      if (!_isObject(c)) return false
      if (typeof c.templateId !== 'string') return false
      if (typeof c.tier !== 'number' || !isFinite(c.tier) || c.tier < 0) return false
      if (typeof c.claimed !== 'boolean') return false
    }
  }
  return true
}

function _isObject(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v)
}

/**
 * 检查值是非负有限数字字符串（如 "100"、"3.14"、"1e+61"）——
 * 白名单形态判定：空串/空白/Infinity/NaN/负数/前导符号一律拒绝
 * （此前用 Number(v) 判定，Number('')===0 会放行空串，deser 时抛 DecimalError）
 */
function _isNonNegNumberStr(v: unknown): boolean {
  return typeof v === 'string' && /^\d+(\.\d+)?([eE][+-]?\d+)?$/.test(v)
}

function _isNonNegNumberStrRecord(v: unknown): boolean {
  if (!_isObject(v)) return false
  for (const val of Object.values(v)) {
    if (!_isNonNegNumberStr(val)) return false
  }
  return true
}

/** 检查 Record 的 key 在有效 ID 集合内，value 为非负数字（intOnly=true 时还需整数） */
function _isValidIdNumberRecord(v: unknown, validIds: Set<string>, intOnly: boolean): boolean {
  if (!_isObject(v)) return false
  for (const [key, val] of Object.entries(v)) {
    if (!validIds.has(key)) return false
    if (typeof val !== 'number' || !isFinite(val) || val < 0) return false
    if (intOnly && !Number.isInteger(val)) return false
  }
  return true
}

// ─── 导出编码 ──────────────────────────────────────────────
//
// 方案：Base64 编码 + FNV-1a 校验和
// 前缀 SCB-（StarCore Base64）标识新格式，旧 SCE- 格式在导入时兼容
//
// ⚠️ 安全边界声明：
// Base64 编码不是加密。任何人都能通过 atob() 解码。
// 这是纯前端单机放置游戏的固有约束——客户端无法实现真正的机密性。
// 当前方案足以过滤：
//   ✓ 直接查看 localStorage 的肉眼可读
//   ✓ 无意识的复制粘贴
// 不足以防御：
//   ✗ 有目的的查看/篡改（atob 即可解码）
//   ✗ 精确篡改（FNV-1a 仅检测意外损坏，非 HMAC）
// 若需更高安全性，需要引入服务端签名验证。

/** 导入结果类型 */
export type ImportResult =
  { ok: true; data: SaveData } | { ok: false; reason: 'invalid' | 'corrupted' | 'too_new' }

/** UTF-8 字符串 → Base64 */
function _toB64(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
}

/** Base64 → UTF-8 字符串 */
function _fromB64(b64: string): string {
  return decodeURIComponent(escape(atob(b64)))
}

/** 导出存档为 Base64 字符串（前缀 SCB-） */
export async function exportSave(data: SaveData): Promise<string> {
  const json = JSON.stringify(data)
  return 'SCB-' + _toB64(json)
}

/** 从编码字符串导入存档（含完整性校验，兼容旧 SCE- 格式） */
export async function importSave(code: string): Promise<ImportResult> {
  const trimmed = code.trim()
  if (!trimmed) return { ok: false, reason: 'invalid' }

  // 新格式 SCB-：Base64 编码
  if (trimmed.startsWith('SCB-')) {
    try {
      const json = _fromB64(trimmed.slice(4))
      const data = JSON.parse(json)
      const tooNew = _tooNewVersion(data)
      if (tooNew !== null) return { ok: false, reason: 'too_new' }
      if (!_validateAndRepair(data)) return { ok: false, reason: 'corrupted' }
      return { ok: true, data }
    } catch {
      return { ok: false, reason: 'invalid' }
    }
  }

  // 旧格式 SCE- 兼容：尝试 Base64 解码（旧 XOR 加密产物的 base64 部分无法直接解码为 JSON，会 catch 返回 invalid）
  if (trimmed.startsWith('SCE-')) {
    try {
      const json = _fromB64(trimmed.slice(4))
      const data = JSON.parse(json)
      const tooNew = _tooNewVersion(data)
      if (tooNew !== null) return { ok: false, reason: 'too_new' }
      if (!_validateAndRepair(data)) return { ok: false, reason: 'corrupted' }
      return { ok: true, data }
    } catch {
      return { ok: false, reason: 'invalid' }
    }
  }

  return { ok: false, reason: 'invalid' }
}
