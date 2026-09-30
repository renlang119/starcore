// 离线报告核验：注入 3h 前 lastSeen → 应弹离线报告 → 继续按钮关闭
import { launch, savePayload, BASE_URL as URL } from './starcore-pwlib.mjs';

let fails = 0
const ok = (name, cond, extra = '') => {
  console.log(`  ${cond ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
  if (!cond) fails++
}

const browser = await launch({ headless: true })
const ctx = await browser.newContext()
// 注入一档 lastSeen 为 3 小时前的存档（触发离线结算 ≥300s 弹报告）
const seedSave = {
  version: 1,
  // savedAt 置 3h 前：init 后 first tick 的 dt≈3h 触发离线补算与报告弹窗
  savedAt: Date.now() - 3 * 3600 * 1000,
  player: { id: 'p1', name: '离线测试' },
  totalPlayTime: 0,
  resources: { amounts: { energy: '50000' }, totals: { energy: '50000' } },
  buildings: { levels: { solar_collector: 5 } },
  research: { completed: [] },
  military: { owned: {}, training: [], formations: [] },
  combat: { garrisoned: {}, completed: [] },
  exploration: { progress: {} },
  relics: { owned: [], equipped: [null, null, null, null, null] },
  transcend: { negativeEntropy: '0', totalTranscends: 0, tree: [] },
}
await ctx.addInitScript((p) => {
  localStorage.setItem('starcore_save_v1_backup', p)
}, savePayload(seedSave))
const page = await ctx.newPage()
await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)

// 1. 离线报告应弹出（ModalOverlay 结构）
const modal = page.locator('.modal-overlay')
ok('离线报告弹出（收敛后 ModalOverlay 遮罩）', (await modal.count()) > 0)
const dialog = page.locator('[role="dialog"]')
ok('role=dialog 结构保留', (await dialog.count()) > 0)
const text = await page.evaluate(() => document.querySelector('.modal')?.textContent || '')
ok('标题为离线收益报告', text.includes('离线收益报告'))
ok('含建筑产出区块', text.includes('建筑产出'))
ok('遮罩无 lighter 遗留类', (await page.locator('.modal-overlay.lighter').count()) === 0)

// 2. 继续按钮关闭
await page.locator('button', { hasText: '继续' }).first().click()
await page.waitForTimeout(600)
ok('点继续后弹窗关闭', (await page.locator('.modal-overlay').count()) === 0)
ok('主页内容可见', await page.evaluate(() => document.body.innerText.includes('星核')))

await browser.close()
console.log(fails === 0 ? '\n===== 全部通过 =====' : `\n===== ${fails} 项失败 =====`)
process.exit(fails === 0 ? 0 : 1)
