#!/usr/bin/env node
/**
 * run.mjs — 星核纪元 · 端到端诊断运行器
 *
 * 对本地预览或远程目标运行回归脚本集；默认自动管理本地预览服务的启停。
 *
 * 用法：
 *   node tools/e2e/run.mjs                    # 本地全量回归（自动起停预览，端口自 4173 起自动选择空闲）
 *   node tools/e2e/run.mjs --remote <URL>     # 对远程目标运行重跑集
 *   node tools/e2e/run.mjs <脚本> [...]        # 运行任意脚本清单（默认本地预览）
 *
 * 选项：
 *   --remote <URL>   指定远程目标（等价于设置 SC_URL 环境变量）
 *   --port <N>       指定本地预览端口（缺省自 4173 起自动寻找空闲端口）
 *   --no-start       不管理预览服务，使用已运行中的本地预览（PREVIEW_URL 可指定）
 *   --log-dir <DIR>  日志目录（缺省：系统临时目录下 starcore-e2e）
 *   --help           显示本说明
 *
 * 退出码：0 = 全部通过；1 = 存在失败项
 */
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const E2E_DIR = path.join(ROOT, 'tools', 'e2e')

// —— 清单：本地全量回归（35）/ 远程重跑（25）——
const SUITE = [
  'starcore-baseline-regress.mjs',
  'starcore-v045-release.mjs',
  'starcore-v046-empty-states.mjs',
  'starcore-v048-training-slots.mjs',
  'starcore-v049-action-queue.mjs',
  'starcore-v056-infinite-tree.mjs',
  'starcore-v057-achievements.mjs',
  'starcore-v058-automation.mjs',
  'starcore-v059-stellar-layer.mjs',
  'starcore-v060-endless.mjs',
  'starcore-v061-relic-fusion.mjs',
  'starcore-v062-daily.mjs',
  'starcore-v071-cluster-layer.mjs',
  'starcore-v077-ui-fixes.mjs',
  'starcore-v078-hygiene.mjs',
  'starcore-v081-save-safety.mjs',
  'starcore-v082-wiring.mjs',
  'starcore-v083-guard.mjs',
  'starcore-v084-hygiene.mjs',
  'starcore-smoke.mjs',
  'starcore-v0863-import-confirm.mjs',
  'starcore-v0863-offline-report.mjs',
  'starcore-v090-arm-layer.mjs',
  'starcore-v091-galaxy-layer.mjs',
  'starcore-v092-void-layer.mjs',
  'starcore-v095-error-fallback.mjs',
  'starcore-v095-nav-a11y.mjs',
  'starcore-v115-en-locale.mjs',
  'starcore-v118-archive.mjs',
  'starcore-v122-achievements.mjs',
  'starcore-v123-formation-traits.mjs',
  'starcore-v124-weekly-boss.mjs',
  'starcore-v126-encounter.mjs',
  'starcore-v127-dispatch.mjs',
  'starcore-v135-save-integrity.mjs',
]

const REMOTE = [
  'starcore-v045-release.mjs',
  'starcore-v056-infinite-tree.mjs',
  'starcore-v057-achievements.mjs',
  'starcore-v058-automation.mjs',
  'starcore-v060-endless.mjs',
  'starcore-v062-daily.mjs',
  'starcore-v081-save-safety.mjs',
  'starcore-v082-wiring.mjs',
  'starcore-v083-guard.mjs',
  'starcore-v084-hygiene.mjs',
  'starcore-v086-bulk-upgrade.mjs',
  'starcore-v0863-import-confirm.mjs',
  'starcore-v0863-offline-report.mjs',
  'starcore-v087-security.mjs',
  'starcore-v092-void-layer.mjs',
  'starcore-v095-error-fallback.mjs',
  'starcore-v095-nav-a11y.mjs',
  'starcore-v115-en-locale.mjs',
  'starcore-v118-archive.mjs',
  'starcore-v122-achievements.mjs',
  'starcore-v123-formation-traits.mjs',
  'starcore-v124-weekly-boss.mjs',
  'starcore-v126-encounter.mjs',
  'starcore-v127-dispatch.mjs',
  'starcore-v135-save-integrity.mjs',
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function printHelp() {
  console.log(`星核纪元 · 端到端诊断运行器

用法：
  node tools/e2e/run.mjs                    本地全量回归（自动起停预览，自动选择空闲端口）
  node tools/e2e/run.mjs --remote <URL>     对远程目标运行重跑集
  node tools/e2e/run.mjs <脚本> [...]        运行任意脚本清单（默认本地预览）

选项：
  --remote <URL>   指定远程目标（等价于设置 SC_URL 环境变量）
  --port <N>       指定本地预览端口（缺省自 4173 起自动寻找空闲端口）
  --no-start       不管理预览服务，使用已运行中的本地预览（PREVIEW_URL 可指定）
  --log-dir <DIR>  日志目录（缺省：系统临时目录下 starcore-e2e）
  --help           显示本说明`)
}

// —— 参数解析 ——
const argv = process.argv.slice(2)
let remote = process.env.SC_URL || null
let port = null
let noStart = false
let logDir = path.join(os.tmpdir(), 'starcore-e2e')
const scripts = []
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  if (a === '--') continue
  else if (a === '--remote') {
    const v = argv[++i]
    if (!v || v.startsWith('--')) {
      console.error('--remote 需要一个地址参数')
      process.exit(2)
    }
    remote = v
  } else if (a === '--port') {
    port = Number(argv[++i])
    if (!Number.isInteger(port) || port <= 0 || port > 65535) {
      console.error('--port 需要一个有效端口号')
      process.exit(2)
    }
  } else if (a === '--no-start') noStart = true
  else if (a === '--log-dir') {
    const v = argv[++i]
    if (!v) {
      console.error('--log-dir 需要一个目录路径')
      process.exit(2)
    }
    logDir = v
  } else if (a === '--help' || a === '-h') {
    printHelp()
    process.exit(0)
  } else if (a.startsWith('--')) {
    console.error(`未知选项：${a}`)
    printHelp()
    process.exit(2)
  } else scripts.push(a)
}

const mode = remote ? 'remote' : 'local'
const list = scripts.length ? scripts : mode === 'remote' ? REMOTE : SUITE

for (const s of list) {
  if (!fs.existsSync(path.join(E2E_DIR, s))) {
    console.error(`脚本不存在：${s}`)
    process.exit(2)
  }
}

// —— 预览服务生命周期 ——
let previewProc = null

function freePort(start) {
  return new Promise((resolve, reject) => {
    let p = start
    const probe = () => {
      if (p > start + 100) return reject(new Error(`未找到空闲端口（自 ${start} 起）`))
      const srv = net.createServer()
      srv.once('error', () => {
        p += 1
        probe()
      })
      srv.once('listening', () => srv.close(() => resolve(p)))
      srv.listen(p, '127.0.0.1')
    }
    probe()
  })
}

function portFree(p) {
  return new Promise((resolve) => {
    const srv = net.createServer()
    srv.once('error', () => resolve(false))
    srv.once('listening', () => srv.close(() => resolve(true)))
    srv.listen(p, '127.0.0.1')
  })
}

async function reachable(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(2500) })
    return r.status >= 200 && r.status < 500
  } catch {
    return false
  }
}

async function waitForUp(url, totalMs) {
  const end = Date.now() + totalMs
  while (Date.now() < end) {
    if (await reachable(url + '/')) return true
    await sleep(400)
  }
  return false
}

async function startPreview(pickPort) {
  if (!fs.existsSync(path.join(ROOT, 'dist', 'index.html'))) {
    console.error('dist/ 未生成：先运行 `corepack pnpm build` 或 `corepack pnpm diagnose --fix`。')
    process.exit(2)
  }
  const p = pickPort || (await freePort(4173))
  const log = fs.openSync(path.join(logDir, 'preview.log'), 'w')
  previewProc = spawn('corepack', ['pnpm', 'preview', '--port', String(p), '--host', '127.0.0.1'], {
    cwd: ROOT,
    detached: process.platform !== 'win32',
    stdio: ['ignore', log, log],
  })
  const url = `http://127.0.0.1:${p}`
  if (!(await waitForUp(url, 60000))) {
    console.error(`预览服务启动失败（详见 ${path.join(logDir, 'preview.log')}）。`)
    await stopPreview(p)
    process.exit(2)
  }
  return { url, port: p }
}

async function stopPreview(p) {
  const proc = previewProc
  if (!proc) return
  previewProc = null
  try {
    if (process.platform !== 'win32') process.kill(-proc.pid, 'SIGTERM')
    else proc.kill('SIGTERM')
  } catch {
    /* 已退出 */
  }
  if (p) {
    for (let i = 0; i < 20; i++) {
      await sleep(200)
      if (await portFree(p)) return
    }
    try {
      if (process.platform !== 'win32') process.kill(-proc.pid, 'SIGKILL')
      else proc.kill('SIGKILL')
    } catch {
      /* 忽略 */
    }
  }
}

let targetPort = null
let cleaningUp = false
async function cleanup() {
  if (cleaningUp) return
  cleaningUp = true
  await stopPreview(targetPort)
}
process.on('SIGINT', () => {
  cleanup().finally(() => process.exit(130))
})
process.on('SIGTERM', () => {
  cleanup().finally(() => process.exit(143))
})

// —— 主流程 ——
async function main() {
  let target
  if (mode === 'remote') {
    target = remote.replace(/\/+$/, '')
    if (!(await waitForUp(target, 8000))) {
      console.error(`远程目标不可达：${target}`)
      process.exit(2)
    }
  } else if (noStart) {
    target = (process.env.PREVIEW_URL || `http://127.0.0.1:${port || 4173}`).replace(/\/+$/, '')
    if (!(await waitForUp(target, 8000))) {
      console.error(`本地预览不可达：${target}（先启动预览，或去掉 --no-start 由运行器自动起停）。`)
      process.exit(2)
    }
  } else {
    const started = await startPreview(port)
    target = started.url
    targetPort = started.port
  }

  console.log('===== 星核纪元 · 端到端诊断 =====')
  console.log(`模式：${mode === 'remote' ? '远程重跑' : '本地回归'}（${list.length} 个脚本）`)
  console.log(`目标：${target}`)
  console.log(`日志：${logDir}`)
  console.log('')

  const env = { ...process.env }
  if (mode === 'remote') {
    env.SC_URL = target
    delete env.PREVIEW_URL
  } else {
    env.PREVIEW_URL = target
    delete env.SC_URL
  }

  let pass = 0
  let fail = 0
  const failed = []
  for (const s of list) {
    const logPath = path.join(logDir, `${s}.log`)
    const fd = fs.openSync(logPath, 'w')
    const res = spawnSync('node', [s], { cwd: E2E_DIR, env, stdio: ['ignore', fd, fd] })
    fs.closeSync(fd)
    if (res.status === 0) {
      console.log(`PASS  ${s}`)
      pass += 1
    } else {
      console.log(`FAIL  ${s}`)
      fail += 1
      failed.push(s)
    }
  }

  await cleanup()

  console.log('')
  console.log(
    `E2E_DONE mode=${mode} target=${target} pass=${pass} fail=${fail} log_dir=${logDir}${failed.length ? ` failed:[${failed.join(' ')}]` : ''}`,
  )
  if (failed.length) console.log(`失败脚本的明细日志见 ${logDir}/<脚本名>.log（搜「✗」定位失败项）。`)
  process.exit(fail ? 1 : 0)
}

// —— 日志目录准备（仅清理同名 .log，不动目录内其他文件）——
fs.mkdirSync(logDir, { recursive: true })
for (const f of fs.readdirSync(logDir)) {
  if (f.endsWith('.log')) fs.rmSync(path.join(logDir, f))
}

main()
