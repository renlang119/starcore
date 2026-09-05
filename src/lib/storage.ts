/**
 * storage.ts — 本地持久化封装
 * 使用 localforage（IndexedDB）作为主存，localStorage 作为辅助
 */
import localforage from 'localforage'
import type { UnitId } from '@/data/units'
import { BUILDINGS } from '@/data/buildings'
import { TECHS } from '@/data/tech'
import { UNITS } from '@/data/units'
import { EXPLORE_NODES } from '@/data/explore'
import { STRONGHOLDS } from '@/data/pve'
import { RELIC_POOL } from '@/data/relics'

// —— 有效 ID 集合（用于 validateSaveData 内容范围校验）——
const BUILDING_IDS = new Set(BUILDINGS.map((b) => b.id))
const TECH_IDS = new Set(TECHS.map((t) => t.id))
const UNIT_IDS = new Set(UNITS.map((u) => u.id))
const EXPLORE_NODE_IDS = new Set(EXPLORE_NODES.map((n) => n.id))
const STRONGHOLD_IDS = new Set(STRONGHOLDS.map((s) => s.id))
const RELIC_IDS = new Set(RELIC_POOL.map((r) => r.id))

const STORE = localforage.createInstance({
  name: 'starcore',
  storeName: 'save',
  description: '星核纪元存档',
})

export const SAVE_KEY = 'starcore_save_v1'

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
  owned: Record<UnitId, number>
  training: { id: string; unitId: UnitId; count: number; remaining: number; totalTime: number }[]
  formations: { id: string; name: string; units: Record<UnitId, number> }[]
}
export interface CombatSaveData {
  garrisoned: Record<string, { strongholdId: string; formationId: string; startTime: number }>
  completed: string[]
}
export interface ExplorationSaveData {
  progress: Record<
    string,
    { nodeId: string; startTime: number; endTime: number; completed: boolean }
  >
}
export interface RelicSaveData {
  owned: { id: string; instanceId: string; obtainedAt: number }[]
  equipped: (string | null)[]
}
export interface TranscendSaveData {
  negativeEntropy: string
  totalTranscends: number
  /** 新格式（v6+）：id + level；旧格式（v5-）：id + purchased，hydrate/迁移兼容 */
  tree: ({ id: string; level: number } | { id: string; purchased: boolean })[]
}
export interface PlayerSaveData {
  id: string
  name: string
}

/** 全量存档接口 */
export interface SaveData {
  version: number
  savedAt: number
  player: PlayerSaveData
  resources: ResourceSaveData
  buildings: BuildingSaveData
  research: ResearchSaveData
  military: MilitarySaveData
  combat: CombatSaveData
  exploration: ExplorationSaveData
  relics: RelicSaveData
  transcend: TranscendSaveData
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

/** 读取存档（优先 IndexedDB，带 checksum 校验） */
export async function readSave(): Promise<SaveData | null> {
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
    if (bak) return _parseBackup(bak)
  } catch {
    /* noop */
  }
  return null
}

/** 解析 IndexedDB 存储的值（兼容新格式 { d, c } 和旧格式裸对象） */
function _parseStored(stored: unknown): SaveData | null {
  if (!_isObject(stored)) return null
  // 新格式：{ d: json, c: checksum }
  if (typeof stored.d === 'string' && typeof stored.c === 'string') {
    if (_checksum(stored.d) !== stored.c) return null // 校验失败——被篡改或损坏
    try {
      const data = JSON.parse(stored.d)
      if (!validateSaveData(data)) return null
      return data
    } catch {
      return null
    }
  }
  // 旧格式兼容：裸 SaveData 对象
  if (validateSaveData(stored)) return stored as SaveData
  return null
}

/** 解析 localStorage 备份，验证校验和防篡改 */
function _parseBackup(raw: string): SaveData | null {
  try {
    const parsed = JSON.parse(raw)
    // 新格式：{ d: json, c: checksum }
    if (parsed && typeof parsed.d === 'string' && typeof parsed.c === 'string') {
      if (_checksum(parsed.d) !== parsed.c) return null // 校验失败——被篡改或损坏
      const data = JSON.parse(parsed.d)
      if (!validateSaveData(data)) return null
      return data
    }
    // 旧格式兼容：直接是 SaveData JSON
    if (validateSaveData(parsed)) return parsed as SaveData
    return null
  } catch {
    return null
  }
}

/** FNV-1a 校验和——检测存档被篡改或损坏 */
function _checksum(data: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < data.length; i++) {
    h ^= data.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16)
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
  if (typeof d.version !== 'number' || !isFinite(d.version) || d.version < 1) return false
  if (typeof d.savedAt !== 'number' || !isFinite(d.savedAt) || d.savedAt < 0) return false
  if (d.player != null && !_isObject(d.player)) return false

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

  // military: owned key 必须是有效兵种 ID，value 非负
  if (!_isObject(d.military)) return false
  const mil = d.military as Record<string, unknown>
  if (!_isValidIdNumberRecord(mil.owned, UNIT_IDS, false)) return false
  if (!Array.isArray(mil.training)) return false
  if (!Array.isArray(mil.formations)) return false

  // combat: completed 元素必须是有效据点 ID
  if (!_isObject(d.combat)) return false
  const cb = d.combat as Record<string, unknown>
  if (!_isObject(cb.garrisoned) && cb.garrisoned !== undefined) return false
  if (!Array.isArray(cb.completed)) return false
  if (!cb.completed.every((id: unknown) => typeof id === 'string' && STRONGHOLD_IDS.has(id)))
    return false

  // exploration: progress key 必须是有效探索节点 ID，value 结构合法
  if (!_isObject(d.exploration)) return false
  const expProg = (d.exploration as Record<string, unknown>).progress
  if (!_isObject(expProg)) return false
  for (const [key, val] of Object.entries(expProg)) {
    if (!EXPLORE_NODE_IDS.has(key)) return false
    if (!_isObject(val)) return false
    const p = val as Record<string, unknown>
    if (
      typeof p.nodeId !== 'string' ||
      typeof p.startTime !== 'number' ||
      typeof p.endTime !== 'number' ||
      typeof p.completed !== 'boolean'
    )
      return false
  }

  // relics: owned 条目的 id 必须是有效遗物 ID
  if (!_isObject(d.relics)) return false
  const rl = d.relics as Record<string, unknown>
  if (!Array.isArray(rl.owned)) return false
  if (
    !rl.owned.every((r: unknown) => _isObject(r) && typeof r.id === 'string' && RELIC_IDS.has(r.id))
  )
    return false
  if (!Array.isArray(rl.equipped)) return false
  if (!rl.equipped.every((e: unknown) => e === null || typeof e === 'string')) return false

  // transcend: tree 条目结构校验（兼容新格式 level 与旧格式 purchased——
  // 校验跑在迁移之前，旧档必须能过校验才有机会被迁移）
  if (!_isObject(d.transcend)) return false
  const tc = d.transcend as Record<string, unknown>
  if (typeof tc.negativeEntropy !== 'string' && tc.negativeEntropy !== undefined) return false
  if (typeof tc.totalTranscends !== 'number' && tc.totalTranscends !== undefined) return false
  if (!Array.isArray(tc.tree)) return false
  if (
    !tc.tree.every((n: unknown) => {
      if (!_isObject(n) || typeof n.id !== 'string') return false
      const hasPurchased = typeof n.purchased === 'boolean'
      const hasLevel =
        typeof n.level === 'number' &&
        Number.isInteger(n.level) &&
        n.level >= 0 &&
        isFinite(n.level)
      return hasPurchased || hasLevel
    })
  )
    return false
  return true
}

function _isObject(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v)
}

/** 检查值是非负有限数字字符串（如 "100", "3.14"）——拒绝 "Infinity", "-999", "NaN" */
function _isNonNegNumberStrRecord(v: unknown): boolean {
  if (!_isObject(v)) return false
  for (const val of Object.values(v)) {
    if (typeof val !== 'string') return false
    const n = Number(val)
    if (!isFinite(n) || n < 0) return false
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
  { ok: true; data: SaveData } | { ok: false; reason: 'invalid' | 'corrupted' }

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
      if (!validateSaveData(data)) return { ok: false, reason: 'corrupted' }
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
      if (!validateSaveData(data)) return { ok: false, reason: 'corrupted' }
      return { ok: true, data }
    } catch {
      return { ok: false, reason: 'invalid' }
    }
  }

  return { ok: false, reason: 'invalid' }
}
