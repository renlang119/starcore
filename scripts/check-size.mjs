#!/usr/bin/env node
/**
 * check-size.mjs：产物体积预算检查（v1.67 新增）
 *
 * 背景：构建产物 gzip 体积随版本自然增长（v1.67 首跑基线约 222.6 KiB，
 * 共 49 个文件），
 * 「无意识劣化」需要一道显式门禁拦住：对 dist 内 js/css/html 产物做 gzip
 * 汇总，与预算常量对比，超额即退出码 1（check 链与 CI 同权挂红）。
 * 口径：只计 js/css/html（运行时增量主体）；图标、字体、分享图等静态资源
 * 基本恒定，不随业务代码膨胀，不入预算面。
 * 预算上调须随版本显式 bump 并在 changelog 登记理由，不得顺手改大消化劣化。
 *
 * 用法：node scripts/check-size.mjs [--warn-only]
 *   --warn-only  超额仅告警不阻塞（特殊情形临时放行的逃生口，不入常态链）
 * 退出码：0 = 预算内（或 --warn-only 放行）；1 = 超预算 / dist 缺失 / 零匹配
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname, resolve, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(ROOT, 'dist')
// 预算 280 KiB（v1.81 起）：v1.80 收官 255.8/256 后帝庭界面版实测 +4.3 KiB
// 触顶；按 issue #21 计划随内容版显式上调 24 KiB，登记于 changelog v1.81
const BUDGET = 280 * 1024
const WARN_ONLY = process.argv.includes('--warn-only')
const EXTS = new Set(['.js', '.css', '.html'])

if (!existsSync(DIST)) {
  console.error('dist/ 不存在：先运行 corepack pnpm build 再做体积预算检查')
  process.exit(1)
}

// 递归收集产物
const files = []
;(function walk(d) {
  for (const f of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, f.name)
    if (f.isDirectory()) walk(p)
    else if (EXTS.has(extname(f.name).toLowerCase())) files.push(p)
  }
})(DIST)

// 零匹配守卫（v1.70 补）：dist 存在但扩展名零命中（如产物形态变更、
// 意外清空）时不再静默 0 KiB 假绿，按检查失败处理
if (files.length === 0) {
  console.error('dist/ 存在但零匹配产物文件（js/css/html）：产物形态异常，体积检查失败')
  process.exit(1)
}

let total = 0
const rows = files
  .map((p) => {
    const gz = gzipSync(readFileSync(p)).length
    total += gz
    return { file: p.slice(DIST.length + 1), gz }
  })
  .sort((a, b) => b.gz - a.gz)

const kb = (n) => `${(n / 1024).toFixed(1)} KiB`
console.log('== 产物体积预算（gzip 合计，仅 js/css/html） ==')
console.log(
  `预算 ${kb(BUDGET)} ｜ 实况 ${kb(total)}（${files.length} 个文件）｜ 余量 ${kb(Math.max(BUDGET - total, 0))}`
)
console.log('最大 8 项：')
for (const r of rows.slice(0, 8)) console.log(`  ${String(r.gz).padStart(7)} B  ${r.file}`)

if (total > BUDGET) {
  const over = `超预算 ${kb(total - BUDGET)}`
  if (WARN_ONLY) {
    console.warn(`\n⚠ ${over}（--warn-only：仅告警不阻塞）`)
    process.exit(0)
  }
  console.error(`\n✗ ${over}：体积门禁挂红。上调预算须随版本显式 bump 并在 changelog 登记理由`)
  process.exit(1)
}
console.log('\n全部在预算内 ✓')
