#!/usr/bin/env node
/**
 * check-locales.mjs — 文案守卫（缺键扫描 + 硬编码中文零残留扫描）
 *
 * 两份真值对照：
 *   · 语言包（src/locales/zh-CN/）：全部可引用键
 *   · 源码字面量调用 t('key')（.ts / .vue；排除测试与语言包、门面自身）
 * 另扫硬编码中文：源码（语言包、门面、测试与 src/tests/ 除外）在掩码注释后
 * 不得出现任何 CJK 字符（.vue 额外掩码 HTML 注释；模板文本与属性值同查）。
 *
 * 用法：node scripts/check-locales.mjs [--strict]
 *   --strict：缺键 / 未使用键 / 非字面量调用 / 硬编码中文残留，任一非零退出 1
 *   （已挂入 `corepack pnpm check` 门禁链）；默认报告模式恒退出 0。
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const strict = process.argv.includes('--strict')

const bundle = (await import(pathToFileURL(join(ROOT, 'src', 'locales', 'zh-CN', 'index.ts')).href))
  .default
const keys = new Set(Object.keys(bundle))

const files = []
const EXCLUDE_DIRS = new Set([
  join(ROOT, 'src', 'locales'),
  join(ROOT, 'src', 'i18n'),
  join(ROOT, 'src', 'tests'),
])
function walk(dir) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name)
    if (ent.isDirectory()) {
      if (EXCLUDE_DIRS.has(p)) continue
      walk(p)
    } else if (/\.(ts|vue)$/.test(ent.name) && !ent.name.endsWith('.test.ts')) {
      files.push(p)
    }
  }
}
walk(join(ROOT, 'src'))

const used = new Map()
const nonLiteral = []
const ANY_T = /(?<![\w.$])t\(/g
for (const f of files) {
  const text = readFileSync(f, 'utf8')
  const rel = relative(ROOT, f)
  const lineOf = (idx) => text.slice(0, idx).split('\n').length
  let m
  while ((m = ANY_T.exec(text)) !== null) {
    const tail = text.slice(m.index)
    const after = tail.match(/^t\(\s*([\s\S])/)
    const ch = after ? after[1] : ''
    if (ch === "'" || ch === '"') {
      const km = tail.match(/^t\(\s*(['"])([^'"]+)\1/)
      if (km) {
        const k = km[2]
        if (!used.has(k)) used.set(k, [])
        used.get(k).push(`${rel}:${lineOf(m.index)}`)
      }
    } else if (ch !== ')' && ch !== '') {
      nonLiteral.push(`${rel}:${lineOf(m.index)}`)
    }
  }
}

const missing = [...used.keys()].filter((k) => !keys.has(k)).sort()
const unused = [...keys].filter((k) => !used.has(k)).sort()

// —— 硬编码中文零残留扫描（注释掩码后任何 CJK 即违规）——
const CJK = /[一-鿿]+/g
function maskComments(src, isVue) {
  let out = src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length))
    .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length))
  if (isVue) out = out.replace(/<!--[\s\S]*?-->/g, (m) => ' '.repeat(m.length))
  return out
}
const residual = []
for (const f of files) {
  const text = readFileSync(f, 'utf8')
  const ms = maskComments(text, f.endsWith('.vue'))
  const rel = relative(ROOT, f)
  let m
  while ((m = CJK.exec(ms)) !== null) {
    const line = ms.slice(0, m.index).split('\n').length
    const snippet = ms.slice(Math.max(0, m.index - 20), m.index + 20).replace(/\n/g, '⏎').trim()
    residual.push(`${rel}:${line}  ${snippet}`)
    if (residual.length >= 40) break
  }
}

console.log(`== 文案守卫扫描（${strict ? '门禁' : '报告'}模式）==`)
console.log(`语言包键数: ${keys.size} | 源码调用键数: ${used.size} | 扫描文件: ${files.length}`)
console.log(`缺键（调用但语言包无此键）: ${missing.length}`)
for (const k of missing) console.log(`  ✗ ${k}  ← ${used.get(k).slice(0, 3).join(', ')}`)
console.log(`未使用键（语言包有但无字面量调用）: ${unused.length}`)
for (const k of unused.slice(0, 80)) console.log(`  · ${k}`)
console.log(`非字面量调用（无法静态核验）: ${nonLiteral.length}`)
for (const s of nonLiteral.slice(0, 40)) console.log(`  ! ${s}`)
console.log(`硬编码中文残留（语言包与测试外源码）: ${residual.length}`)
for (const s of residual.slice(0, 40)) console.log(`  ✗ ${s}`)

if (strict) {
  const bad = []
  if (missing.length > 0) bad.push(`缺键 ${missing.length}`)
  if (unused.length > 0) bad.push(`未使用键 ${unused.length}`)
  if (nonLiteral.length > 0) bad.push(`非字面量调用 ${nonLiteral.length}`)
  if (residual.length > 0) bad.push(`硬编码中文残留 ${residual.length}`)
  if (bad.length > 0) {
    console.error(`\n[strict] 文案守卫未过：${bad.join('、')}，退出码 1`)
    process.exit(1)
  }
  console.log('[strict] 文案守卫全过')
}
