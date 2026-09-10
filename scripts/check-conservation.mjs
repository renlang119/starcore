#!/usr/bin/env node
/**
 * check-conservation.mjs — 计数守恒自动检查（v0.73 新增）
 *
 * 背景：星层扩展的「守恒触点」随层数增长已达 10 处，v0.71 设计复查曾靠人工
 * 抓出 4 处关键漏项。本脚本把「数据真值 → 单测断言 → Playwright 硬断言 →
 * 文档计数词表」四方核对机械化，任何一处漏改直接报错退出。
 *
 * 用法：node scripts/check-conservation.mjs
 *   --pw-dir <dir>  Playwright 脚本目录（也可用环境变量 STARCORE_PW_DIR
 *                   指定；两者皆无时跳过该段检查）
 * 退出码：0 = 全部守恒；1 = 存在漂移（差异表打到 stdout）
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const pwDirIdx = args.indexOf('--pw-dir')
const PW_DIR = pwDirIdx >= 0 ? args[pwDirIdx + 1] : process.env.STARCORE_PW_DIR || null

// ---------------------------------------------------------------
// 1. 数据源真值：直接 import TS 数据文件（tsx 不引入，用正则数条目）
//    条目形态稳定：对象以 "  {" 或 "},\n  {" 分隔、id 为首个字段，
//    顶部注释与 Record 常量不匹配 "^\s{2}\{\s*$" 起始的条目块。
// ---------------------------------------------------------------

/** 数 src/data/<file>.ts 中 `export const NAME: X[] = [ ... ]` 的顶层条目数 */
function countArrayEntries(file, exportName) {
  const src = readFileSync(join(ROOT, 'src', 'data', file), 'utf8')
  const anchor = `export const ${exportName}`
  const start = src.indexOf(anchor)
  if (start < 0) throw new Error(`${file} 找不到 export const ${exportName}`)
  // 定位「= [」的数组字面量（跳过 TechDef[] 类型注解里的 [）
  const eq = src.indexOf('=', start)
  const bracket = src.indexOf('[', eq)
  // 匹配到闭合的 ]（顶层，嵌套深度计 Bracket）
  let depth = 0
  let end = -1
  for (let i = bracket; i < src.length; i++) {
    const ch = src[i]
    if (ch === '[') depth++
    else if (ch === ']') {
      depth--
      if (depth === 0) {
        end = i
        break
      }
    }
  }
  const body = src.slice(bracket + 1, end)
  // 去掉块注释与行注释，避免注释里的 { 干扰
  const clean = body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  // 顶层条目 = 深度 1 处的 "id:" 出现数（每个条目必有 id 首字段；
  // 兼容单引号/双引号与 id 非首字段的历史形态）
  let d = 0
  let count = 0
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]
    if (ch === '{' || ch === '[') d++
    else if (ch === '}' || ch === ']') d--
    else if (d === 1 && clean.startsWith('id:', i)) {
      count++
      i += 3
    }
  }
  return count
}

/** 数 Record 常量的键数（ACHIEVEMENT_CATEGORIES / TECH_BRANCHES 等） */
function countRecordKeys(file, exportName) {
  const src = readFileSync(join(ROOT, 'src', 'data', file), 'utf8')
  const anchor = `export const ${exportName}`
  const start = src.indexOf(anchor)
  if (start < 0) throw new Error(`${file} 找不到 export const ${exportName}`)
  // 定位「=」之后的第一个 {（对象字面量）——泛型 Record<A, {…}> 的 { 在 = 前，
  // 但「= {」可能换行（如 ACHIEVEMENT_CATEGORIES），所以取 = 后最近的 {
  const eq = src.indexOf('=', start)
  const brace = src.indexOf('{', eq)
  let depth = 0
  let end = -1
  for (let i = brace; i < src.length; i++) {
    const ch = src[i]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) {
        end = i
        break
      }
    }
  }
  const body = src
    .slice(brace + 1, end)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
  // 顶层键 = 深度 1 处的 "key: {"（缩进不定，TECH_BRANCHES 2 空格 / ACHIEVEMENT_CATEGORIES 4 空格）
  let d = 0
  let count = 0
  for (const line of body.split('\n')) {
    const trimmed = line.trim()
    const opens = (line.match(/[{[]/g) ?? []).length
    const closes = (line.match(/[}\]]/g) ?? []).length
    // d===0 时遇 key: { → 顶层键（自闭合单行 opens==closes，或跨行 opens==closes+1）
    if (
      d === 0 &&
      opens >= 1 &&
      opens - closes >= 0 &&
      /^[A-Za-z_][A-Za-z0-9_]*:\s*\{/.test(trimmed)
    )
      count++
    d += opens - closes
  }
  return count
}

/** 提取 achievements.ts 中指定 id 条目的 threshold / desc 文本 */
function achievementField(id, field) {
  const src = readFileSync(join(ROOT, 'src', 'data', 'achievements.ts'), 'utf8')
  const anchor = `id: '${id}'`
  const start = src.indexOf(anchor)
  if (start < 0) throw new Error(`achievements.ts 找不到 ${anchor}`)
  const seg = src.slice(start, start + 600)
  if (field === 'threshold') {
    // 支持科学计数法形态（如 1e5），避免被截断成 1
    const m = seg.match(/threshold:\s*(\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/)
    return m ? Number(m[1]) : null
  }
  if (field === 'desc') {
    const m = seg.match(/desc:\s*'([^']+)'/)
    return m ? m[1] : null
  }
  return null
}

/** 转生树：买断节点数 / 无限节点数（stores/transcend.ts 的 TREE 数组） */
function transcendTreeStats() {
  const src = readFileSync(join(ROOT, 'src', 'stores', 'transcend.ts'), 'utf8')
  const anchor = 'const DEFAULT_NODES'
  const start = src.indexOf(anchor)
  if (start < 0) throw new Error('transcend.ts 找不到 const DEFAULT_NODES')
  const bracket = src.indexOf('[', src.indexOf('=', start))
  let depth = 0
  let end = -1
  for (let i = bracket; i < src.length; i++) {
    const ch = src[i]
    if (ch === '[') depth++
    else if (ch === ']') {
      depth--
      if (depth === 0) {
        end = i
        break
      }
    }
  }
  const body = src.slice(bracket + 1, end)
  const entries = body.split(/\n\s*\},/).map((x) => x)
  let infinite = 0
  // 条目 id 行缩进不固定（2–4 空格均有），用 \s+ 泛化匹配
  const total = (body.match(/^\s+id: '/gm) ?? []).length
  for (const e of entries) {
    if (/maxLevel:\s*Infinity/.test(e)) infinite++
  }
  return { buyout: total - infinite, infinite }
}

// ---------------------------------------------------------------
// 2. 期望值登记表：每个守恒量的「数据真值取法」
// ---------------------------------------------------------------
const truths = {
  techs: () => countArrayEntries('tech.ts', 'TECHS'),
  techBranches: () => countRecordKeys('tech.ts', 'TECH_BRANCHES'),
  exploreNodes: () => countArrayEntries('explore.ts', 'EXPLORE_NODES'),
  strongholds: () => countArrayEntries('pve.ts', 'STRONGHOLDS'),
  relicPool: () => countArrayEntries('relics.ts', 'RELIC_POOL'),
  achievements: () => countArrayEntries('achievements.ts', 'ACHIEVEMENTS'),
  buildings: () => countArrayEntries('buildings.ts', 'BUILDINGS'),
  achCategories: () => countRecordKeys('achievements.ts', 'ACHIEVEMENT_CATEGORIES'),
  achTech3Threshold: () => achievementField('ach_tech_3', 'threshold'),
  achTech3Desc: () => achievementField('ach_tech_3', 'desc'),
  achRelic4Threshold: () => achievementField('ach_relic_4', 'threshold'),
  achRelic4Desc: () => achievementField('ach_relic_4', 'desc'),
  treeBuyout: () => transcendTreeStats().buyout,
  treeInfinite: () => transcendTreeStats().infinite,
}

const T = {}
for (const [k, fn] of Object.entries(truths)) T[k] = fn()

// ---------------------------------------------------------------
// 3. 断言采集：单测（vitest 文件）与 Playwright 脚本的正则扫描
// ---------------------------------------------------------------
const issues = [] // { area, detail }
const ok = (area, detail) => console.log(`  ✓ ${area}: ${detail}`)
const bad = (area, detail) => {
  console.log(`  ✗ ${area}: ${detail}`)
  issues.push({ area, detail })
}

function scanDir(dir, ext, patterns, nameFilter = null) {
  const hits = []
  if (!existsSync(dir)) return hits
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(ext)) continue
    if (nameFilter && !nameFilter(f)) continue
    const text = readFileSync(join(dir, f), 'utf8')
    for (const p of patterns) {
      for (const m of text.matchAll(p.re)) {
        hits.push({
          file: f,
          path: join(dir, f),
          value: Number(m[1]),
          line: text.slice(0, m.index).split('\n').length,
          raw: m[0],
        })
      }
    }
  }
  return hits
}

// —— 3a. 单测硬断言 ——
console.log('\n== 单测断言（src/**/*.test.ts）==')
const unitDir = join(ROOT, 'src')
const unitTests = []
;(function walk(d) {
  for (const f of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, f.name)
    if (f.isDirectory()) walk(p)
    else if (f.name.endsWith('.test.ts')) unitTests.push(p)
  }
})(unitDir)

function scanUnitOptional(re, label, expectOf) {
  const found = []
  for (const p of unitTests) {
    const text = readFileSync(p, 'utf8')
    for (const m of text.matchAll(re))
      found.push({ file: p.replace(ROOT + '/', ''), value: Number(m[1]) })
  }
  if (found.length === 0) {
    console.log(`  - ${label}: 无直测断言（存在等价守护即可）`)
    return
  }
  const wrong = found.filter((f) => f.value !== expectOf)
  if (wrong.length > 0) {
    for (const w of wrong) bad(label, `${w.file} 断言 ${w.value} ≠ 真值 ${expectOf}`)
  } else ok(label, `${found.length} 处断言全部 = ${expectOf}`)
}

function scanUnit(re, label, expectOf) {
  const found = []
  for (const p of unitTests) {
    const text = readFileSync(p, 'utf8')
    for (const m of text.matchAll(re)) {
      found.push({ file: p.replace(ROOT + '/', ''), value: Number(m[1]) })
    }
  }
  if (found.length === 0) {
    bad(label, '未找到任何断言（守恒断言丢失？）')
    return
  }
  const wrong = found.filter((f) => f.value !== expectOf)
  if (wrong.length > 0) {
    for (const w of wrong) bad(label, `${w.file} 断言 ${w.value} ≠ 真值 ${expectOf}`)
  } else {
    ok(label, `${found.length} 处断言全部 = ${expectOf}`)
  }
}

scanUnit(/TECHS\)\.toHaveLength\((\d+)\)/g, '科技总数（TECHS toHaveLength）', T.techs)
scanUnit(/EXPLORE_NODES\)\.toHaveLength\((\d+)\)/g, '探索节点数（EXPLORE_NODES）', T.exploreNodes)
scanUnit(/ACHIEVEMENTS\)\.toHaveLength\((\d+)\)/g, '成就总数（ACHIEVEMENTS）', T.achievements)
scanUnit(/BUILDINGS\)\.toHaveLength\((\d+)\)/g, '建筑总数（BUILDINGS）', T.buildings)
scanUnitOptional(
  /RELIC_POOL[\s\S]{0,40}?toHaveLength\((\d+)\)/g,
  '遗物种数（RELIC_POOL 直测）',
  T.relicPool
)
scanUnit(
  /RELIC_SETS\.flatMap[\s\S]{0,60}?toHaveLength\((\d+)\)/g,
  '遗物种数（套装成员并集等价断言）',
  T.relicPool
)
scanUnit(/!isInfiniteNode\([^)]*\)\)+\.toHaveLength\((\d+)\)/g, '转生买断节点数', T.treeBuyout)
scanUnit(/[^!]isInfiniteNode\([^)]*\)\)+\.toHaveLength\((\d+)\)/g, '转生无限节点数', T.treeInfinite)
scanUnit(/Object\.keys\(TECH_BRANCHES\)\)\.toHaveLength\((\d+)\)/g, '科技分支数', T.techBranches)

// 成就阈值联动（ach_tech_3 threshold = 科技总数；ach_relic_4 threshold = 遗物种数）
if (T.achTech3Threshold !== T.techs) {
  bad('ach_tech_3 阈值联动', `threshold ${T.achTech3Threshold} ≠ 科技总数 ${T.techs}`)
} else ok('ach_tech_3 阈值联动', `threshold = 科技总数 = ${T.techs}`)
if (!new RegExp(`累计完成 ${T.techs} 项`).test(achievementField('ach_tech_3', 'desc') ?? '')) {
  bad('ach_tech_3 文案联动', `desc「${T.achTech3Desc}」未含「${T.techs} 项」`)
} else ok('ach_tech_3 文案联动', `desc 含「${T.techs} 项」`)
if (T.achRelic4Threshold !== T.relicPool) {
  bad('ach_relic_4 阈值联动', `threshold ${T.achRelic4Threshold} ≠ 遗物种数 ${T.relicPool}`)
} else ok('ach_relic_4 阈值联动', `threshold = 遗物种数 = ${T.relicPool}`)
if (!new RegExp(`全部 ${T.relicPool} 种`).test(T.achRelic4Desc ?? '')) {
  bad('ach_relic_4 文案联动', `desc「${T.achRelic4Desc}」未含「${T.relicPool} 种」`)
} else ok('ach_relic_4 文案联动', `desc 含「${T.relicPool} 种」`)

// —— 3b. Playwright 硬断言 ——
if (PW_DIR === null) {
  console.log('\n== Playwright 硬断言 ==')
  console.log(
    '  （未提供 --pw-dir / STARCORE_PW_DIR，跳过该段；将脚本目录以绝对路径传入即启用）'
  )
} else if (PW_DIR === undefined || PW_DIR === true || String(PW_DIR).startsWith('-')) {
  bad('Playwright 目录', '--pw-dir 缺少目录参数（请补绝对路径，如 --pw-dir <脚本目录>），本次跳过该段')
} else {
  console.log('\n== Playwright 硬断言（' + PW_DIR + '/starcore-*.mjs）==')
  const pwPatterns = [
    { re: /\.tech-card'\)\.count\(\)\) === (\d+)/g, label: '科技卡数', expect: T.techs },
    { re: /\.ach-card'\)\.count\(\)\) === (\d+)/g, label: '成就卡数', expect: T.achievements },
    { re: /sections\.count\(\)\) === (\d+)/g, label: '成就分区数', expect: T.achCategories },
    {
      re: /已解锁据点 (\d+) 个（实际 \$\{shCount\}/g,
      label: '据点全解锁口径',
      expect: T.strongholds,
      mode: 'max',
    },
  ]
  const pwFiles = existsSync(PW_DIR)
    ? readdirSync(PW_DIR).filter((f) => f.startsWith('starcore-') && f.endsWith('.mjs'))
    : []
  if (pwFiles.length === 0) bad('Playwright 目录', `${PW_DIR} 未找到 starcore-*.mjs`)
  for (const p of pwPatterns) {
    // 只扫套件脚本 starcore-*.mjs，非套件脚本（诊断/overlay 等）不参与守恒断言
    const found = scanDir(PW_DIR, '.mjs', [p], (f) => f.startsWith('starcore-'))
    if (found.length === 0) {
      console.log(`  - ${p.label}: 无断言（跳过）`)
      continue
    }
    if (p.mode === 'max') {
      // 据点口径：套件含全解锁场景（应等于真值）与局部场景（如 9/10 节点解锁 14 个）。
      // 局部值不参与等于比对，但不得超真值；且必须存在一条等于真值的全解锁断言。
      const over = found.filter((f) => f.value > p.expect)
      const maxV = Math.max(...found.map((f) => f.value))
      if (over.length > 0) {
        for (const w of over)
          bad(p.label, `${w.file}:${w.line} 断言 ${w.value} 超过真值 ${p.expect}`)
      } else if (maxV !== p.expect) {
        bad(p.label, `最大断言 ${maxV} ≠ 全解锁真值 ${p.expect}`)
      } else {
        ok(p.label, `${found.length} 处断言（最大 ${maxV} = 全解锁口径）`)
      }
      continue
    }
    const wrong = found.filter((f) => f.value !== p.expect)
    if (wrong.length > 0) {
      for (const w of wrong) bad(p.label, `${w.file}:${w.line} 断言 ${w.value} ≠ 真值 ${p.expect}`)
    } else {
      ok(p.label, `${found.length} 处断言全部 = ${p.expect}`)
    }
  }
  // 「N 卡/汇总 N/34」等模板串里的成就数
  const achTpl = scanDir(
    PW_DIR,
    '.mjs',
    [{ re: /(\d+) 张成就卡/g }, { re: /汇总 (\d+)\/(\d+)/g }],
    (f) => f.startsWith('starcore-')
  )
  // 豁免：同一字符串内的成就数为「解锁数/总数」形态时取分母（汇总 N/M 取 M），
  // 解锁数随场景变化是合法的
  for (const h of achTpl.filter((h) => h.raw.includes('张成就卡') || h.raw.includes('汇总'))) {
    const nums = [...h.raw.matchAll(/\d+/g)].map((x) => Number(x[0]))
    const total = h.raw.includes('张成就卡') ? nums[0] : nums[1]
    if (total !== T.achievements)
      bad(
        '成就卡数（模板串）',
        `${h.file}:${h.line}「${h.raw.trim()}」总数 ${total} ≠ ${T.achievements}`
      )
  }
}

// —— 3c. 文档计数词表 ——
console.log('\n== 文档计数词表（README + docs）==')
// symbol 总数真值：7 个图标 SFC 的 <symbol 计数（须在 docRules 定义前算好）
function countSymbols() {
  const dir = join(ROOT, 'src', 'components', 'ui', 'icons')
  let n = 0
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.vue')) continue
    n += (readFileSync(join(dir, f), 'utf8').match(/<symbol\s/g) ?? []).length
  }
  return n
}
T.symbols = countSymbols()
// 测试基线真值：src 递归数 .test.ts 文件与 it( 用例数
function testBaseline() {
  let files = 0
  let cases = 0
  ;(function walk(d) {
    for (const f of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, f.name)
      if (f.isDirectory()) walk(p)
      else if (f.name.endsWith('.test.ts')) {
        files++
        cases += (readFileSync(p, 'utf8').match(/\bit\(/g) ?? []).length
      }
    }
  })(join(ROOT, 'src'))
  return { files, cases }
}
const baseline = testBaseline()
T.testFiles = baseline.files
T.testCases = baseline.cases

const docFiles = [
  { p: join(ROOT, 'README.md'), name: 'README.md' },
  { p: join(ROOT, 'docs', '游戏数值设定规范.md'), name: '游戏数值设定规范.md' },
  { p: join(ROOT, 'docs', '游戏设定与架构.md'), name: '游戏设定与架构.md' },
  { p: join(ROOT, 'docs', '图标设计规范.md'), name: '图标设计规范.md' },
]
// 宽匹配规则（v0.83）：「数字 + 关键词邻域」——数字两侧出现关键词即命中，
// 不要求完整短语，覆盖「47 项，8 大分支」「20 种，分属 5 资源扇区」「14 买断 +
// 4 无限」「34 个，9 类里程碑」等分隔形态。规则顺序即优先级：先长形态后短形态，
// 命中即消费（同一段文本不被两条规则重复计数）。
const docRules = [
  { re: /(\d+)\s*(?:大\s*)?分支/, label: '科技分支（N 分支）', expect: T.techBranches },
  { re: /(\d+)\s*项科技/, label: '科技（N 项科技）', expect: T.techs },
  { re: /科技\s*(\d+)/, label: '科技（科技 N）', expect: T.techs },
  { re: /(\d+)\s*(?:个|座)?\s*据点/, label: '据点（N 据点）', expect: T.strongholds },
  { re: /(\d+)\s*种建筑/, label: '建筑（N 种建筑）', expect: T.buildings },
  { re: /(\d+)\s*(?:个|项)?\s*里程碑/, label: '成就（N 里程碑）', expect: T.achievements },
  { re: /成就\s*(\d+)\s*类/, label: '成就类别（成就 N 类）', expect: T.achCategories },
  { re: /成就\s*(\d+)(?!\s*类)/, label: '成就（成就 N）', expect: T.achievements },
  { re: /(\d+)\s*种稀有度池/, label: '遗物（N 种稀有度池）', expect: T.relicPool },
  {
    re: /池[^。\d]{0,12}(\d+)\s*种（common/,
    label: '遗物池（N 种（common…）',
    expect: T.relicPool,
  },
  { re: /(\d+)\s*个节点/, label: '探索节点（N 个节点）', expect: T.exploreNodes },
  { re: /(\d+)\s*节点（星核层/, label: '探索节点（N 节点（星核层）', expect: T.exploreNodes },
  { re: /(\d+)\s*买断/, label: '转生买断（N 买断）', expect: T.treeBuyout },
  { re: /(\d+)\s*无限/, label: '转生无限（N 无限）', expect: T.treeInfinite },
  { re: /symbol 总数\s*(\d+)/, label: '图标 symbol 总数', expect: T.symbols },
  { re: /(\d+)\s*个 symbol/, label: '图标 symbol（N 个 symbol）', expect: T.symbols },
  { re: /全部 (\d+) 个图标/, label: '图标（全部 N 个图标）', expect: T.symbols },
  {
    re: /(\d+)\s*个测试文件\s*(\d+)\s*个?用例/,
    label: '测试基线（N 文件 M 用例）',
    expect: T.testFiles,
    secondExpect: () => T.testCases,
  },
]
// 豁免上下文：层级局部口径（如「6 节点 5 据点，」= 星团层局部，非全量 21）
const docContextExempt = [
  /\d+ 节点 \d+ 据点/,
  /\d+ 节点 \d+ 据点，/, // 逗号结尾的层内口径
  /\d+ 买断协议节点/, // 「3 买断协议节点」= 自动协议子集，非全量买断 14
  /协议节点（/, // 协议节点括号说明行
  /总数 \d+→\d+/, // 版本历史行「symbol 总数 87→89」= 当时点口径，非现值
  /→\d+。/, // 版本历史行尾态
]

// 命中清单输出（消除「仅报漂移」的覆盖错觉）：每条规则命中数可见
const ruleHits = new Map()
for (const d of docFiles) {
  if (!existsSync(d.p)) {
    bad('文档缺失', d.name)
    continue
  }
  const text = readFileSync(d.p, 'utf8')
  for (const r of docRules) {
    for (const m of text.matchAll(new RegExp(r.re, 'g'))) {
      const v = Number(m[1])
      const ctx = text.slice(Math.max(0, m.index - 24), m.index + m[0].length + 14)
      if (docContextExempt.some((ex) => ex.test(ctx))) continue
      ruleHits.set(r.label, (ruleHits.get(r.label) ?? 0) + 1)
      const line = text.slice(0, m.index).split('\n').length
      // 双数字规则（测试基线 N 文件 M 用例）分别校验
      if (r.secondExpect) {
        const m2 = m[2] !== undefined ? Number(m[2]) : null
        const exp2 = r.secondExpect()
        if (v !== r.expect || m2 !== exp2) {
          bad(
            `${d.name} · ${r.label}`,
            `第 ${line} 行「${m[0]}」= ${v}/${m2} ≠ 真值 ${r.expect}/${exp2}`
          )
        }
        continue
      }
      if (v !== r.expect) {
        bad(`${d.name} · ${r.label}`, `第 ${line} 行「${m[0]}」= ${v} ≠ 真值 ${r.expect}`)
      }
    }
  }
}
console.log('  命中清单（规则: 命中处数，覆盖可见）:')
for (const [label, n] of ruleHits) console.log(`    · ${label}: ${n} 处`)
for (const r of docRules) {
  if (!ruleHits.has(r.label)) console.log(`    · ${r.label}: 0 处（无覆盖）`)
}
console.log('  （漂移会逐条列出；无漂移仅打命中清单）')

// —— 3d. 汇总 ——
console.log('\n== 汇总 ==')
if (issues.length === 0) {
  console.log(
    `全部守恒 ✓（数据真值：科技 ${T.techs} / 分支 ${T.techBranches} / 节点 ${T.exploreNodes} / 据点 ${T.strongholds} / 遗物 ${T.relicPool} / 建筑 ${T.buildings} / 成就 ${T.achievements}（${T.achCategories} 类）/ 转生买断 ${T.treeBuyout}+无限 ${T.treeInfinite}）`
  )
  process.exit(0)
} else {
  console.log(`发现 ${issues.length} 处计数漂移：`)
  for (const [i, x] of issues.entries()) console.log(`  ${i + 1}. [${x.area}] ${x.detail}`)
  process.exit(1)
}
