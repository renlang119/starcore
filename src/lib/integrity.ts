/**
 * integrity.ts — 存档完整性签名（HMAC-SHA256，密钥现场派生）
 *
 * 修改存档数据无法伪造合法校验和，「解 base64 改数字重新导入」的
 * 存档修改器路线失效；剩余路径（逆向 bundle 提取密钥派生逻辑、控制
 * 台改运行时内存）超出本层防御目标。
 *
 * 设计要点：
 * - 密钥由多段代码内碎片经交织展开现场派生，不以完整密钥形态存在于
 *   bundle 文本中；派生输入刻意不含版本串（导出档须跨版本可导入）与
 *   游戏数据表常量（调平衡不得导致存量档验签漂移）。
 * - 纯 TS 实现（FIPS 180-4 SHA-256 + RFC 2104 HMAC），不依赖
 *   Web Crypto，保持存档读写链路的同步语义。
 * - 旧版 fnv1a 校验和已不参与存档校验（测试期硬切，旧档走错误屏的
 *   导出原始档与清除存档重开出口）。
 */

/** 存档完整性密钥碎片（多段分散，组合后仅存在于运行时） */
const _SLICES = ['nebula-anchor', 'starpulse-relay', 'void-cipher', 'quiet-harbor']

/** 32 位右旋（FIPS 180-4 的 ROTR） */
function _rotr(x: number, n: number): number {
  return ((x >>> n) | (x << (32 - n))) >>> 0
}

/** 拼接多段字节 */
function _concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(total)
  let off = 0
  for (const p of parts) {
    out.set(p, off)
    off += p.length
  }
  return out
}

/* ------------------------------------------------------------------ */
/* SHA-256（FIPS 180-4）                                               */
/* ------------------------------------------------------------------ */

const _K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
])

/** SHA-256：消息按 UTF-8 字节处理，输出 32 字节摘要 */
export function sha256Bytes(data: Uint8Array): Uint8Array {
  const bitLen = data.length * 8
  // 填充：补 0x80、补 0 至 56 mod 64、补 8 字节大端位长
  const padded = _concat([
    data,
    new Uint8Array([0x80]),
    new Uint8Array((56 - ((data.length + 1) % 64) + 64) % 64),
    new Uint8Array(8),
  ])
  const dv = new DataView(padded.buffer, padded.byteOffset, padded.byteLength)
  dv.setUint32(padded.length - 8, Math.floor(bitLen / 0x100000000))
  dv.setUint32(padded.length - 4, bitLen >>> 0)

  let h0 = 0x6a09e667
  let h1 = 0xbb67ae85
  let h2 = 0x3c6ef372
  let h3 = 0xa54ff53a
  let h4 = 0x510e527f
  let h5 = 0x9b05688c
  let h6 = 0x1f83d9ab
  let h7 = 0x5be0cd19

  const w = new Uint32Array(64)
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4)
    for (let i = 16; i < 64; i++) {
      const s0 = _rotr(w[i - 15], 7) ^ _rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3)
      const s1 = _rotr(w[i - 2], 17) ^ _rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10)
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0
    }
    let a = h0
    let b = h1
    let c = h2
    let d = h3
    let e = h4
    let f = h5
    let g = h6
    let hh = h7
    for (let i = 0; i < 64; i++) {
      const S1 = _rotr(e, 6) ^ _rotr(e, 11) ^ _rotr(e, 25)
      const ch = (e & f) ^ (~e & g)
      const t1 = (hh + S1 + ch + _K[i] + w[i]) >>> 0
      const S0 = _rotr(a, 2) ^ _rotr(a, 13) ^ _rotr(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const t2 = (S0 + maj) >>> 0
      hh = g
      g = f
      f = e
      e = (d + t1) >>> 0
      d = c
      c = b
      b = a
      a = (t1 + t2) >>> 0
    }
    h0 = (h0 + a) >>> 0
    h1 = (h1 + b) >>> 0
    h2 = (h2 + c) >>> 0
    h3 = (h3 + d) >>> 0
    h4 = (h4 + e) >>> 0
    h5 = (h5 + f) >>> 0
    h6 = (h6 + g) >>> 0
    h7 = (h7 + hh) >>> 0
  }
  const out = new Uint8Array(32)
  const odv = new DataView(out.buffer)
  odv.setUint32(0, h0)
  odv.setUint32(4, h1)
  odv.setUint32(8, h2)
  odv.setUint32(12, h3)
  odv.setUint32(16, h4)
  odv.setUint32(20, h5)
  odv.setUint32(24, h6)
  odv.setUint32(28, h7)
  return out
}

/* ------------------------------------------------------------------ */
/* HMAC-SHA256（RFC 2104）                                             */
/* ------------------------------------------------------------------ */

/** HMAC-SHA256：key 与 msg 接受 UTF-8 串或原始字节，输出 32 字节 */
export function hmacSha256(key: string | Uint8Array, msg: string | Uint8Array): Uint8Array {
  const enc = new TextEncoder()
  const k = typeof key === 'string' ? enc.encode(key) : key
  const inner = typeof msg === 'string' ? enc.encode(msg) : msg
  const block = new Uint8Array(64)
  if (k.length > 64) {
    block.set(sha256Bytes(k))
  } else {
    block.set(k)
  }
  const ipad = new Uint8Array(64 + inner.length)
  const opad = new Uint8Array(96)
  for (let i = 0; i < 64; i++) {
    ipad[i] = block[i] ^ 0x36
    opad[i] = block[i] ^ 0x5c
  }
  ipad.set(inner, 64)
  opad.set(sha256Bytes(ipad), 64)
  return sha256Bytes(opad)
}

/* ------------------------------------------------------------------ */
/* 密钥派生与验签门面                                                  */
/* ------------------------------------------------------------------ */

/** 字节转十六进制串 */
function _toHex(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += b.toString(16).padStart(2, '0')
  return s
}

/**
 * 密钥派生：碎片逐字节做两轮不同位数的循环左移后交织拼接，
 * 再取 SHA-256 十六进制串作密钥。派生输入不含版本串与数据表常量。
 */
function _deriveKey(): string {
  const enc = new TextEncoder()
  const base = _concat(_SLICES.map((s) => enc.encode(s)))
  const mixed: number[] = []
  for (const shift of [3, 11]) {
    for (let i = 0; i < base.length; i++) {
      const v = base[i]
      mixed.push(((v << shift) | (v >>> (8 - shift))) & 0xff)
    }
  }
  return _toHex(sha256Bytes(new Uint8Array(mixed)))
}

/** 派生密钥（模块级缓存一次；运行时组合，bundle 文本无完整密钥） */
const _KEY = _deriveKey()

/**
 * 存档完整性校验和：HMAC-SHA256 十六进制串（64 字符）。
 * 输入为存档 JSON 串；写路径与导入导出共用同一实现。
 */
export function saveSignature(json: string): string {
  return _toHex(hmacSha256(_KEY, json))
}

/** 校验存档完整性（常量时间比较，防逐位试探） */
export function verifySaveSignature(json: string, sig: string): boolean {
  if (typeof sig !== 'string' || sig.length !== 64) return false
  const expected = saveSignature(json)
  let diff = 0
  for (let i = 0; i < 64; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i)
  return diff === 0
}
