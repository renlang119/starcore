/**
 * save/codec.ts — 存档导入导出编码（从 storage.ts 拆出）。
 *
 * 导出格式：Base64(JSON) 文本编码，前缀 SCB-（StarCore Base64）标识现行
 * 格式，旧 SCE- 前缀在导入时按同格式兼容（不带 FNV-1a 校验和；完整性由
 * JSON.parse 与存档结构校验兜底）。
 *
 * ⚠️ 安全边界声明：
 * Base64 编码不是加密。任何人都能通过 atob() 解码。
 * 这是纯前端单机放置游戏的固有约束——客户端无法实现真正的机密性。
 * 当前方案足以过滤：
 *   ✓ 直接查看 localStorage 的肉眼可读
 *   ✓ 无意识的复制粘贴
 * 不足以防御：
 *   ✗ 有目的的查看/篡改（atob 即可解码）
 * 若需更高安全性，需要引入服务端签名验证。
 */
import type { SaveData } from './schema'
import { tooNewVersion, validateAndRepair } from './validate'

/** 导入结果类型 */
export type ImportResult =
  { ok: true; data: SaveData } | { ok: false; reason: 'invalid' | 'corrupted' | 'too_new' }

/** UTF-8 字符串 → Base64（TextEncoder 标准实现；escape/unescape 已废弃） */
function _toB64(str: string): string {
  const bytes = new TextEncoder().encode(str)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

/** Base64 → UTF-8 字符串 */
function _fromB64(b64: string): string {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

/** 导出存档为 Base64 字符串（前缀 SCB-） */
export async function exportSave(data: SaveData): Promise<string> {
  const json = JSON.stringify(data)
  return 'SCB-' + _toB64(json)
}

/** 从编码字符串导入存档（含完整性校验，兼容旧 SCE- 前缀） */
export async function importSave(code: string): Promise<ImportResult> {
  const trimmed = code.trim()
  if (!trimmed) return { ok: false, reason: 'invalid' }

  // SCB-（现行）与 SCE-（旧前缀兼容）均为 Base64(JSON)，解析路径相同
  if (trimmed.startsWith('SCB-') || trimmed.startsWith('SCE-')) {
    try {
      const json = _fromB64(trimmed.slice(4))
      const data = JSON.parse(json)
      const tooNew = tooNewVersion(data)
      if (tooNew !== null) return { ok: false, reason: 'too_new' }
      if (!validateAndRepair(data)) return { ok: false, reason: 'corrupted' }
      return { ok: true, data }
    } catch {
      return { ok: false, reason: 'invalid' }
    }
  }

  return { ok: false, reason: 'invalid' }
}
