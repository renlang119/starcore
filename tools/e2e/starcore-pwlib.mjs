// 星核纪元 · 端到端共享库（starcore-pwlib）
//
// 提供：浏览器解析与启动 / 断言计数与收尾 / 存档签名载荷 / 存档注入 / 带存档种子的新页面。
// 浏览器：STARCORE_CHROMIUM 显式指定 → Playwright 缓存（跨平台）→ 系统浏览器。
// 目标基址：SC_URL 优先（远程目标），缺省本地预览（PREVIEW_URL 可覆盖端口）。
// 存档构造：签名辅助仅供自动化测试构造合法存档（签名实现见 src/lib/integrity.ts）。
// 注意：本文件是库不是脚本，勿加入运行器清单。
import { chromium } from 'playwright-core'
import { resolveChromium } from '../lib/chromium.mjs'

// 存档签名：直接引用仓库 integrity 模块（Node 原生类型剥离加载），
const INTEGRITY_TS = new URL('../../src/lib/integrity.ts', import.meta.url)
const { saveSignature } = await import(INTEGRITY_TS.href)

// 浏览器可执行文件：解析链统一由 tools/lib/chromium.mjs 提供
const _chromium = resolveChromium()
if (!_chromium) {
  throw new Error(
    '未找到可用的 Chromium。运行 npx --yes playwright install chromium 安装，或用 STARCORE_CHROMIUM 指定可执行文件路径。',
  )
}
export const EXE = _chromium.path

// 目标基址：SC_URL 优先（远程目标），缺省本地预览（PREVIEW_URL 可覆盖端口），
export const PREVIEW_URL = process.env.PREVIEW_URL || 'http://127.0.0.1:4173'
export const BASE_URL = process.env.SC_URL || PREVIEW_URL

// 浏览器启动（统一 --no-sandbox；附加选项透传，如 { headless: true }），
// 缺省强制 zh-CN 浏览器语言（站点多语言）：--lang 打底，
// 并包装 newContext 注入默认 locale，Playwright 上下文缺省 locale=en-US
// 会盖过 --lang，不设则自动匹配英文包致中文断言全灭；单脚本需英文语境时
// 用 newContext({ locale: 'en-US' }) 显式覆盖（展开序保证显式优先）。
export async function launch(opts = {}) {
  const { args = [], ...rest } = opts
  const browser = await chromium.launch({
    executablePath: EXE,
    args: ['--no-sandbox', '--lang=zh-CN', ...args],
    ...rest,
  })
  const origNewContext = browser.newContext.bind(browser)
  browser.newContext = (ctxOpts = {}) =>
    origNewContext({ locale: 'zh-CN', ...ctxOpts })
  return browser
}

// 断言计数与收尾：check 记失败数，finish 关浏览器、打印汇总、按失败数退出
let fail = 0
export function check(name, cond) {
  console.log(`  ${cond ? '✓' : '✗'} ${name}`)
  if (!cond) fail++
}
export function failCount() {
  return fail
}
export async function finish(browser) {
  await browser.close()
  console.log(fail === 0 ? '\n===== 结果: 全部通过 =====' : `\n===== 结果: ${fail} 项失败 =====`)
  process.exit(fail === 0 ? 0 : 1)
}

// 存档载荷：HMAC-SHA256 签名，与应用读档口径一致（仅供自动化测试构造合法存档），
export function checksum(str) {
  return saveSignature(str)
}

// SCB1- 导入码：带签名载荷 Base64（与应用导出同构；仅供自动化测试构造合法存档）
export function saveCode(save) {
  const json = typeof save === 'string' ? save : JSON.stringify(save)
  return 'SCB1-' + Buffer.from(JSON.stringify({ d: json, c: checksum(json) }), 'utf8').toString('base64')
}

// 存档对象（或已序列化的 JSON 串）→ 备份键载荷（仅供自动化测试构造合法存档）
export function savePayload(save) {
  const json = typeof save === 'string' ? save : JSON.stringify(save)
  return JSON.stringify({ d: json, c: checksum(json) })
}

// addInitScript 注入体：备份键写入载荷 + 主键清除 + 引导预置已读
// （须自包含不可引用闭包，Playwright 按源码序列化进页面执行）
export function injectSave(p) {
  localStorage.setItem('starcore_save_v1_backup', p)
  localStorage.removeItem('starcore_save_v1')
  localStorage.setItem('starcore_onboarding', JSON.stringify({}))
}

// 带存档种子的新页面：注入备份档后跳转指定路径
// opts: viewport（缺省 1280x900）/ waitMs（跳转后等待，缺省 1200）/ extraCtx（附加 context 选项）/ base（缺省 BASE_URL）
export async function newSeededPage(browser, save, path, opts = {}) {
  const {
    viewport = { width: 1280, height: 900 },
    waitMs = 1200,
    extraCtx = {},
    base = BASE_URL,
  } = opts
  const ctx = await browser.newContext({ viewport, ...extraCtx })
  await ctx.addInitScript(injectSave, savePayload(save))
  const page = await ctx.newPage()
  await page.goto(base + path, { waitUntil: 'networkidle' })
  await page.waitForTimeout(waitMs)
  return page
}
