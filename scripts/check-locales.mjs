#!/usr/bin/env node
/**
 * check-locales.mjs — 文案缺键扫描
 *
 * 两份真值对照：
 *   · 语言包（src/locales/zh-CN/）：全部可引用键
 *   · 源码字面量调用 t('key')（.ts / .vue；排除测试与语言包、门面自身）
 * 输出：缺键（有调用无定义）、未使用键（有定义无调用）、非字面量调用清单。
 *
 * 用法：node scripts/check-locales.mjs [--strict]
 *   --strict：存在缺键时退出 1（供质量关卡串接）；默认报告模式恒退出 0。
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
const EXCLUDE_DIRS = new Set([join(ROOT, 'src', 'locales'), join(ROOT, 'src', 'i18n')])
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

console.log('== 文案缺键扫描（报告模式）==')
console.log(`语言包键数: ${keys.size} | 源码调用键数: ${used.size} | 扫描文件: ${files.length}`)
console.log(`缺键（调用但语言包无此键）: ${missing.length}`)
for (const k of missing) console.log(`  ✗ ${k}  ← ${used.get(k).slice(0, 3).join(', ')}`)
console.log(`未使用键（语言包有但无字面量调用）: ${unused.length}`)
for (const k of unused.slice(0, 80)) console.log(`  · ${k}`)
console.log(`非字面量调用（无法静态核验）: ${nonLiteral.length}`)
for (const s of nonLiteral.slice(0, 40)) console.log(`  ! ${s}`)
if (strict && missing.length > 0) {
  console.error(`\n[strict] 存在 ${missing.length} 处缺键，退出码 1`)
  process.exit(1)
}
