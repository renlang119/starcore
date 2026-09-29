/**
 * integrity.test.ts — 存档完整性签名测试
 *
 * 覆盖：SHA-256 / HMAC-SHA256 标准向量（RFC 4231、FIPS 180-4 示例）、
 * 长密钥分支、密钥派生稳定性、saveSignature/verifySaveSignature 门面、
 * 篡改检测（改任一字节即验签失败）。
 */
import { describe, it, expect } from 'vitest'
import { sha256Bytes, hmacSha256, saveSignature, verifySaveSignature } from './integrity'

const hex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

describe('sha256Bytes 标准向量', () => {
  it('空串向量（FIPS 180-4）', () => {
    expect(hex(sha256Bytes(new TextEncoder().encode('')))).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    )
  })

  it('abc 向量（FIPS 180-4）', () => {
    expect(hex(sha256Bytes(new TextEncoder().encode('abc')))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    )
  })

  it('两块长度消息（448 位，填充边界）', () => {
    // 「abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq」NIST 示例
    const msg = 'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'
    expect(hex(sha256Bytes(new TextEncoder().encode(msg)))).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1'
    )
  })

  it('跨多块长消息（200 字符，跨 4 块）', () => {
    // 向量由 node crypto 标准库离线生成，覆盖多块级联正确性
    const msg = 'a'.repeat(200)
    expect(hex(sha256Bytes(new TextEncoder().encode(msg)))).toBe(
      'c2a908d98f5df987ade41b5fce213067efbcc21ef2240212a41e54b5e7c28ae5'
    )
    // 自洽性：同串同值、异串异值
    expect(hex(sha256Bytes(new TextEncoder().encode(msg)))).toBe(
      hex(sha256Bytes(new TextEncoder().encode(msg)))
    )
    expect(hex(sha256Bytes(new TextEncoder().encode(msg + 'a')))).not.toBe(
      hex(sha256Bytes(new TextEncoder().encode(msg)))
    )
  })
})

describe('hmacSha256 标准向量（RFC 4231）', () => {
  it('TC1：20 字节 0x0b 密钥', () => {
    const key = new Uint8Array(20).fill(0x0b)
    expect(hex(hmacSha256(key, 'Hi There'))).toBe(
      'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7'
    )
  })

  it('TC2：Jefe 密钥（含实现内既有覆盖口径）', () => {
    expect(hex(hmacSha256('Jefe', 'what do ya want for nothing?'))).toBe(
      '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843'
    )
  })

  it('TC6：131 字节长密钥（> 64 触发密钥先哈希分支）', () => {
    const key = Uint8Array.from({ length: 131 }, (_, i) => i)
    expect(hex(hmacSha256(key, 'Test Using Larger Than Block-Size Key - Hash Key First'))).toBe(
      'd3a7e18455d60dc2770832b7373c29927745976a2cf1c0040ee11d0688406a30'
    )
  })

  it('TC7：长密钥长消息', () => {
    const key = new Uint8Array(131).fill(0xaa)
    const msg =
      'This is a test using a larger than block-size key and a larger than block-size data. ' +
      'The key needs to be hashed before being used by the HMAC algorithm.'
    expect(hex(hmacSha256(key, msg))).toBe(
      '9b09ffa71b942fcb27635fbcd5b0e944bfdc63644f0713938a7f51535c3a35e2'
    )
  })
})

describe('saveSignature / verifySaveSignature 门面', () => {
  it('输出为 64 字符十六进制串', () => {
    const sig = saveSignature('{"version":1}')
    expect(sig).toMatch(/^[0-9a-f]{64}$/)
  })

  it('同串同值、异串异值', () => {
    expect(saveSignature('aaa')).toBe(saveSignature('aaa'))
    expect(saveSignature('aaa')).not.toBe(saveSignature('aab'))
  })

  it('verify 通过合法签名、拒绝篡改（任一字节变动）', () => {
    const json = JSON.stringify({ version: 1, resources: { amounts: { energy: '100' } } })
    const sig = saveSignature(json)
    expect(verifySaveSignature(json, sig)).toBe(true)
    // 篡改 d
    const tampered = json.replace('100', '999')
    expect(tampered).not.toBe(json)
    expect(verifySaveSignature(tampered, sig)).toBe(false)
    // 篡改签名本身（末位翻位）
    const lastHex = sig[sig.length - 1]
    const flipped = lastHex === '0' ? '1' : '0'
    expect(verifySaveSignature(json, sig.slice(0, -1) + flipped)).toBe(false)
    // 长度/类型异常
    expect(verifySaveSignature(json, '')).toBe(false)
    expect(verifySaveSignature(json, sig.slice(1))).toBe(false)
    expect(verifySaveSignature(json, undefined as unknown as string)).toBe(false)
  })

  it('密钥派生跨模块加载稳定（同进程多次取值一致）', () => {
    // 派生在模块级缓存；重复调用门面等价于跨次读取稳定性
    const a = saveSignature('stability-probe')
    const b = saveSignature('stability-probe')
    expect(a).toBe(b)
  })
})
