#!/usr/bin/env node
/**
 * diagnose.mjs：星核纪元 · 环境自检（tools 诊断工具集）
 *
 * 检测当前环境与仓库状态，缺件时给出修复指引；加 --fix 对可修复项执行白名单修复。
 *
 * 用法：node tools/diagnose.mjs [--fix]
 *   --fix  对白名单缺件执行修复（corepack / 依赖 / 构建产物 / 浏览器），逐项打印
 *
 * 退出码：0 = 无失败项；1 = 存在失败项（必需要求未满足）
 */
import fs from 'node:fs'
import os from 'node:os'
import net from 'node:net'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolveChromium } from './lib/chromium.mjs'

const FIX = process.argv.slice(2).includes('--fix')
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const PREVIEW_PORT = 4173

const results = []
function record(level, name, detail, hint = '', fixer = null) {
  results.push({ level, name, detail, hint, fixer })
}
const ok = (name, detail) => record('ok', name, detail)
const info = (name, detail) => record('info', name, detail)
const warn = (name, detail, hint = '', fixer = null) => record('warn', name, detail, hint, fixer)
const fail = (name, detail, hint = '', fixer = null) => record('fail', name, detail, hint, fixer)

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { encoding: 'utf8', ...opts })
}

function readPackageJson() {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
  } catch {
    return null
  }
}

function versionAtLeast(current, needed) {
  const c = current.split('.').map(Number)
  const n = needed.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const a = c[i] || 0
    const b = n[i] || 0
    if (a !== b) return a > b
  }
  return true
}

async function checkNode() {
  const required = (readPackageJson()?.engines?.node) || '>=22.18'
  const m = /(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(required)
  const need = m ? `${m[1]}.${m[2] || 0}.${m[3] || 0}` : '22.18.0'
  if (versionAtLeast(process.versions.node, need)) {
    ok('Node 版本', `v${process.versions.node}（要求 ${required}）`)
  } else {
    fail('Node 版本', `v${process.versions.node}（要求 ${required}）`, '升级 Node 后重试；安装包自带下面各项所需组件。')
  }

  // 类型剥离探针：以仅含可擦除语法的 .ts 文件验证动态加载能力
  const probe = path.join(os.tmpdir(), `starcore-diagnose-probe-${process.pid}.ts`)
  try {
    fs.writeFileSync(probe, 'export const diagnoseProbe: number = 42\n')
    const mod = await import(pathToFileURL(probe).href)
    if (mod.diagnoseProbe === 42) {
      ok('TypeScript 类型剥离', '可用（检查链与诊断工具依赖该能力）')
    } else {
      fail('TypeScript 类型剥离', '探针结果异常', '请升级 Node 后重试。')
    }
  } catch {
    fail(
      'TypeScript 类型剥离',
      '不可用',
      '需要 Node 22.18 及以上；更低版本可在命令中附加 --experimental-strip-types 临时启用。',
    )
  } finally {
    try {
      fs.unlinkSync(probe)
    } catch {
      /* 清理失败忽略 */
    }
  }
}

function checkCorepackAndPnpm() {
  const cp = run('corepack', ['--version'])
  if (cp.error || cp.status !== 0) {
    fail('corepack', '不可用', 'corepack 随 Node 安装包提供；若缺失请重新安装 Node 或执行 npm i -g corepack。')
    return
  }
  ok('corepack', cp.stdout.trim())

  const pm = run('corepack', ['pnpm', '--version'], { timeout: 120000 })
  if (pm.error || pm.status !== 0) {
    const pinned = readPackageJson()?.packageManager || 'pnpm@9.15.4'
    fail(
      'pnpm',
      '未能解析（首次使用需联网获取）',
      `检查网络后重试；或手动执行 corepack install -g ${pinned}。`,
      { label: `获取 pnpm（corepack install -g ${pinned}）`, cmd: 'corepack', args: ['install', '-g', pinned] },
    )
    return
  }
  ok('pnpm', pm.stdout.trim())
}

function checkDeps() {
  const ready =
    fs.existsSync(path.join(ROOT, 'node_modules', '.pnpm')) &&
    fs.existsSync(path.join(ROOT, 'node_modules', 'vite'))
  if (ready) {
    ok('依赖安装', 'node_modules 就绪')
  } else {
    fail(
      '依赖安装',
      'node_modules 缺失或不完整',
      '运行 corepack pnpm install 安装依赖。',
      { label: '安装依赖（pnpm install --frozen-lockfile）', cmd: 'corepack', args: ['pnpm', 'install', '--frozen-lockfile'] },
    )
  }
}

function checkDist() {
  if (fs.existsSync(path.join(ROOT, 'dist', 'index.html'))) {
    ok('构建产物', 'dist/ 已生成')
  } else {
    warn(
      '构建产物',
      'dist/ 未生成（端到端诊断需要）',
      '运行 corepack pnpm build 生成。',
      { label: '构建产物（pnpm build）', cmd: 'corepack', args: ['pnpm', 'build'] },
    )
  }
}

function checkBrowser() {
  const hit = resolveChromium()
  if (hit) {
    ok('浏览器', `${hit.path}（${hit.source}）`)
    return
  }
  const hasLocalCli = fs.existsSync(path.join(ROOT, 'node_modules', '.bin', 'playwright'))
  const fixer = hasLocalCli
    ? { label: '获取浏览器（playwright install chromium）', cmd: 'corepack', args: ['pnpm', 'exec', 'playwright', 'install', 'chromium'] }
    : { label: '获取浏览器（npx playwright install chromium）', cmd: 'npx', args: ['--yes', 'playwright', 'install', 'chromium'] }
  warn(
    '浏览器',
    '未找到可用 Chromium（端到端诊断需要）',
    '运行 npx --yes playwright install chromium 安装；或用 STARCORE_CHROMIUM 指定自定义浏览器路径。',
    fixer,
  )
}

function checkPython() {
  const py = run('python3', ['--version'])
  if (py.error || py.status !== 0) {
    warn('Python3', '未找到（数值校验工具需要，可选）', '安装 Python 3.8 及以上即可使用数值校验工具。')
    return
  }
  ok('Python3', (py.stdout || py.stderr).trim().replace(/^Python\s+/, ''))
}

function checkPort(port) {
  return new Promise((resolve) => {
    const srv = net.createServer()
    let settled = false
    const done = (fn) => {
      if (!settled) {
        settled = true
        fn()
      }
    }
    srv.once('error', (err) => {
      if (err && err.code === 'EADDRINUSE') {
        warn(`端口 ${port}`, '已被占用（端到端诊断将自动另选空闲端口；若占用者为本项目预览服务可直接复用）')
      } else {
        info(`端口 ${port}`, `未完成检测（${err && err.code ? err.code : '未知情况'}）`)
      }
      done(resolve)
    })
    srv.once('listening', () => {
      srv.close(() => {
        ok(`端口 ${port}`, '可用')
        done(resolve)
      })
    })
    srv.listen(port, '127.0.0.1')
  })
}

function checkRepo() {
  const name = readPackageJson()?.name
  if (name !== 'starcore') {
    fail('仓库', '未在星核纪元仓库根目录运行', '请在仓库根目录执行 node tools/diagnose.mjs。')
    return
  }
  const branch = run('git', ['-C', ROOT, 'rev-parse', '--abbrev-ref', 'HEAD'])
  if (branch.status === 0) {
    const st = run('git', ['-C', ROOT, 'status', '--porcelain'])
    const dirty = (st.stdout || '').trim() ? st.stdout.trim().split('\n').length : 0
    info('Git', `分支 ${branch.stdout.trim()}${dirty ? `，${dirty} 处未提交改动（开发中属正常）` : ''}`)
  } else {
    info('Git', '不在 git 工作树内（独立副本）')
  }
}

async function collect() {
  results.length = 0
  await checkNode()
  checkCorepackAndPnpm()
  checkDeps()
  checkDist()
  checkBrowser()
  checkPython()
  await checkPort(PREVIEW_PORT)
  checkRepo()
}

function counts() {
  return {
    fail: results.filter((r) => r.level === 'fail').length,
    warn: results.filter((r) => r.level === 'warn').length,
  }
}

function printReport() {
  console.log('===== 星核纪元 · 环境自检 =====')
  const mark = { ok: '✓', fail: '✗', warn: '!', info: '·' }
  for (const r of results) {
    console.log(`${mark[r.level]} ${r.name}：${r.detail}`)
    if (r.hint && r.level !== 'ok') console.log(`   → ${r.hint}`)
  }
  const { fail: f, warn: w } = counts()
  console.log(`===== 汇总：${f ? `${f} 项失败` : '必需项全部通过'}${w ? `，${w} 项提醒` : ''} =====`)
}

async function applyFixes() {
  const fixables = results.filter((r) => (r.level === 'fail' || r.level === 'warn') && r.fixer)
  if (!fixables.length) {
    console.log('--fix：没有需要修复的缺件。')
    return false
  }
  console.log('--fix：将执行以下修复')
  for (const r of fixables) console.log(`  · ${r.fixer.label}`)
  let ran = false
  for (const r of fixables) {
    console.log(`\n> ${r.fixer.label}`)
    const res = spawnSync(r.fixer.cmd, r.fixer.args, {
      cwd: ROOT,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    })
    if (res.status === 0) ran = true
    else console.log(`  （该步未成功，退出码：${res.status}）`)
  }
  return ran
}

await collect()
printReport()

if (FIX) {
  const { fail: f0, warn: w0 } = counts()
  if (f0 || w0) {
    const ran = await applyFixes()
    if (ran) {
      console.log('\n===== 修复后复检 =====')
      await collect()
      printReport()
    }
  } else {
    console.log('--fix：没有需要修复的缺件。')
  }
}

const { fail: f, warn: w } = counts()
if (!f && !w) console.log('环境就绪。可运行 `corepack pnpm check` 执行全量关卡。')
else if (!f) console.log('必需项就绪（存在提醒项，按需处理）。')
process.exit(f ? 1 : 0)
