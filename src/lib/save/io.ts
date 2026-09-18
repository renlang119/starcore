/**
 * save/io.ts — 存档读写通道（从 storage.ts 拆出）。
 *
 * localforage（IndexedDB）作为主存，localStorage 作为辅助/备份；
 * 写路径双通道共用 { d, c } 校验载荷。读路径双通道都尝试并取较新一档，
 * 严格区分「无档」与「有值但损坏」，版本过新优先报错。
 */
import localforage from 'localforage'
import { fnv1a } from '@/lib/random'
import type { SaveData } from './schema'
import { tooNewVersion, validateAndRepair } from './validate'

const STORE = localforage.createInstance({
  name: 'starcore',
  storeName: 'save',
  description: '星核纪元存档',
})

const SAVE_KEY = 'starcore_save_v1'

/** FNV-1a 校验和——检测存档被篡改或损坏 */
function _checksum(data: string): string {
  return fnv1a(data).toString(16)
}

/** 拼 { d, c } 校验载荷（checksum 防篡改/损坏，写路径双通道共用） */
function _encodePayload(data: SaveData): { d: string; c: string } {
  const json = JSON.stringify(data)
  return { d: json, c: _checksum(json) }
}

/** 写入存档（IndexedDB + localStorage 备份，均带 checksum）。
 * 返回是否至少有一个通道写入成功；双通道全失败（配额/隐私模式/受限环境）
 * 返回 false，由调用方给玩家可见反馈，避免整段进度只在内存。 */
export async function writeSave(data: SaveData): Promise<boolean> {
  const payload = _encodePayload(data)
  let ok = false
  try {
    await STORE.setItem(SAVE_KEY, payload)
    ok = true
  } catch {
    // 存储满或受限时回退到 localStorage
  }
  try {
    localStorage.setItem(SAVE_KEY + '_backup', JSON.stringify(payload))
    ok = true
  } catch {
    /* 忽略配额溢出 */
  }
  return ok
}

/** 同步写入存档到 localStorage（用于 beforeunload 等来不及等 IndexedDB 的场景）。
 * 返回备份通道是否写入成功。 */
export function writeSaveSync(data: SaveData): boolean {
  try {
    localStorage.setItem(SAVE_KEY + '_backup', JSON.stringify(_encodePayload(data)))
    return true
  } catch {
    /* 忽略配额溢出 */
    return false
  }
}

/** 读档结果：成功 / 版本过新（不静默 hydrate）/ 存储有值但损坏（不静默清档）/ 无档 */
export type SaveReadOutcome =
  | { status: 'ok'; data: SaveData }
  | { status: 'too_new'; version: number }
  | { status: 'corrupt'; raw?: string }
  | { status: 'none' }

/** 读取存档：IndexedDB 主存与 localStorage 备份双通道都尝试，取 savedAt 更新的一档 */
export async function readSave(): Promise<SaveReadOutcome> {
  let best: SaveReadOutcome | null = null
  let bestSavedAt = -1
  let sawAnyValue = false // 双通道是否真的存在过存储值（区分「无档」与「有值但损坏」）
  let rawBackup: string | null = null
  let tooNew: SaveReadOutcome | null = null // 任一通道出现版本过新即记录（见下方优先级说明）
  // savedAt 相同（含双档都不可用的 -1 垫底值）时后到者（localStorage 备份）落座；
  // 用 >= 而非 >，保证 -1 垫底值也能落座
  const consider = (candidate: SaveReadOutcome, savedAt: number): void => {
    if (savedAt >= bestSavedAt) {
      best = candidate
      bestSavedAt = savedAt
    }
  }
  try {
    const stored = await STORE.getItem<unknown>(SAVE_KEY)
    if (stored) {
      sawAnyValue = true
      const parsed = _parseStored(stored)
      if (parsed) {
        if (parsed.status === 'too_new') tooNew = parsed
        else consider(parsed, _savedAtOf(parsed))
      }
    }
  } catch {
    /* noop */
  }
  try {
    const bak = localStorage.getItem(SAVE_KEY + '_backup')
    if (bak) {
      sawAnyValue = true
      rawBackup = bak
      const parsed = _parseBackup(bak)
      if (parsed) {
        if (parsed.status === 'too_new') tooNew = parsed
        else consider(parsed, _savedAtOf(parsed))
      }
    }
  } catch {
    /* noop */
  }
  // 版本过新优先报错（v0.93）：too_new 表示该档由更新版本写入，静默采用旧备份
  // 会让随后的自动存档把新版主档覆盖掉（静默回滚不可逆）。宁可进错误屏
  // （可导出原始档），也不降级；同样优先于 corrupt 的诊断并列。
  if (tooNew) return tooNew
  if (best) return best
  // 有存储值但都不可用：报告 corrupt（附原始备份载荷供导出），
  // 与「无档」严格区分——后续流程不得静默清档或用空状态覆盖
  if (sawAnyValue) return { status: 'corrupt', raw: rawBackup ?? undefined }
  return { status: 'none' }
}

/** 从读档结果提取 savedAt（不可用/损坏档返回 -1，在双档比较中垫底） */
function _savedAtOf(outcome: SaveReadOutcome): number {
  if (outcome.status === 'ok' && typeof outcome.data.savedAt === 'number') {
    return outcome.data.savedAt
  }
  return -1
}

/** 解析已 JSON.parse 的值（兼容新格式 { d, c } 和旧格式裸对象，v1.03 收敛双入口） */
function _parsePayload(value: unknown): SaveReadOutcome | null {
  if (!_isObject(value)) return null
  // 新格式：{ d: json, c: checksum }
  if (typeof value.d === 'string' && typeof value.c === 'string') {
    if (_checksum(value.d) !== value.c) return null // 校验失败——被篡改或损坏
    try {
      const data = JSON.parse(value.d)
      const tooNew = tooNewVersion(data)
      if (tooNew !== null) return { status: 'too_new', version: tooNew }
      if (!validateAndRepair(data)) return null
      return { status: 'ok', data }
    } catch {
      return null
    }
  }
  // 旧格式兼容：裸 SaveData 对象
  const tooNew = tooNewVersion(value)
  if (tooNew !== null) return { status: 'too_new', version: tooNew }
  if (validateAndRepair(value)) return { status: 'ok', data: value as SaveData }
  return null
}

/** 解析 IndexedDB 存储的值 */
function _parseStored(stored: unknown): SaveReadOutcome | null {
  return _parsePayload(stored)
}

/** 解析 localStorage 备份，验证校验和防篡改 */
function _parseBackup(raw: string): SaveReadOutcome | null {
  try {
    return _parsePayload(JSON.parse(raw))
  } catch {
    return null
  }
}

function _isObject(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v)
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

/** 清空主档与备份档（与 clearSave 同实现）。
 * 供测试隔离使用（isolate:false 下 IndexedDB/localStorage 跨用例残留，
 * 如「双档取新」用例写入的主档会盖掉后续用例的备份档断言）。 */
export { clearSave as clearAllSaves }
