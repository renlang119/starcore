/**
 * random.ts — 种子化随机与字符串哈希（全项目唯一实现）
 *
 * v0.73 自 combat/daily/storage 三处重复实现收敛而来。
 * 同族算法行为不变：fnv1a 同串同值，mulberry32 同种子同序列，
 * 现有战斗/签到/存档校验测试即守护。
 */

/** FNV-1a 32 位字符串哈希（种子源 / 存档校验和） */
export function fnv1a(str: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** mulberry32 种子化 PRNG（确定性：同种子同序列） */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
