/**
 * save/codec.ts：存档导入导出编码（从 storage.ts 拆出）。
 *
 * 导出格式：Base64(JSON { d, c }) 文本编码，前缀 SCB1-（StarCore Base64
 * v1）标识现行格式，c 为 HMAC-SHA256 存档签名（lib/integrity.ts）。
 *
 * ⚠️ 安全边界声明：
 * Base64 编码不是加密。任何人都能通过 atob() 解码。
 * 这是纯前端单机放置游戏的固有约束，客户端无法实现真正的机密性。
 * 修改存档数据无法伪造合法签名，「解 base64 改数字重新导入」的修
 * 改器路线失效；剩余路径（逆向提取签名密钥、控制台改运行时内存）
 * 超出本层防御目标。
 * 旧前缀 SCB- / SCE- 不带签名，v1.35 起导入一律拒绝（测试期硬切，
 * 旧导出文本须重新导出）。
 */
import type { SaveData } from './schema'
import { tooNewVersion, validateAndRepair } from './validate'
import { saveSignature, verifySaveSignature } from '@/lib/integrity'

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

/** 导出存档为 Base64 字符串（前缀 SCB1-，带 keyed 签名） */
export async function exportSave(data: SaveData): Promise<string> {
  const json = JSON.stringify(data)
  return 'SCB1-' + _toB64(JSON.stringify({ d: json, c: saveSignature(json) }))
}

/** 从编码字符串导入存档（验签 + 完整性校验；仅接受 SCB1- 现行格式） */
export async function importSave(code: string): Promise<ImportResult> {
  const trimmed = code.trim()
  if (!trimmed) return { ok: false, reason: 'invalid' }

  // 仅现行 SCB1- 格式；旧 SCB- / SCE- 无签名一律拒绝（防修改器通道）
  if (trimmed.startsWith('SCB1-')) {
    try {
      const json = _fromB64(trimmed.slice(5))
      const payload = JSON.parse(json) as unknown
      if (
        payload === null ||
        typeof payload !== 'object' ||
        typeof (payload as Record<string, unknown>).d !== 'string' ||
        typeof (payload as Record<string, unknown>).c !== 'string'
      ) {
        return { ok: false, reason: 'invalid' }
      }
      const { d, c } = payload as { d: string; c: string }
      if (!verifySaveSignature(d, c)) return { ok: false, reason: 'corrupted' }
      const data = JSON.parse(d)
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
