// 导入二次确认核验：弹窗出现 / 取消不执行 / 确认才替换
import { saveCode, launch, savePayload, BASE_URL as URL } from './starcore-pwlib.mjs';

let fails = 0
const ok = (name, cond, extra = '') => {
  console.log(`  ${cond ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
  if (!cond) fails++
}

const browser = await launch()
const ctx = await browser.newContext()
const seedSave = {
  version: 1,
  savedAt: Date.now(),
  player: { id: 'p1', name: '原始档' },
  totalPlayTime: 0,
  resources: { amounts: { energy: '50000' }, totals: { energy: '50000' } },
  buildings: { levels: { solar_collector: 3 } },
  research: { completed: [] },
  military: { owned: {}, training: [], formations: [] },
  combat: { garrisoned: {}, completed: [] },
  exploration: { progress: {} },
  relics: { owned: [], equipped: [null, null, null, null, null] },
  transcend: { negativeEntropy: '0', totalTranscends: 7, tree: [] },
}
await ctx.addInitScript((p) => {
  localStorage.setItem('starcore_save_v1_backup', p)
  // 预置引导已读，避免气泡干扰
  localStorage.setItem('starcore_onboarding', JSON.stringify({ home: true, build: true, tech: true, map: true, army: true, relic: true, prestige: true }))
}, savePayload(seedSave))
const page = await ctx.newPage()
await page.goto(URL + '/settings', { waitUntil: 'networkidle' })
await page.waitForTimeout(800)

// 构造一份 totalTranscends=0 的替换档
const readRaw = await page.evaluate(() => localStorage.getItem('starcore_save_v1_backup'))
const d = JSON.parse(JSON.parse(readRaw).d)
d.transcend.totalTranscends = 0
d.player.name = '替换档'
const json = JSON.stringify(d)
const code = saveCode(json)

const readTranscends = () =>
  page.evaluate(() => {
    const raw = localStorage.getItem('starcore_save_v1_backup')
    return raw ? JSON.parse(JSON.parse(raw).d).transcend.totalTranscends : null
  })

// 1. 填码点导入 → 确认弹窗出现（不直接执行）
await page.locator('textarea').first().fill(code)
await page.locator('button', { hasText: '导入存档' }).first().click()
await page.waitForTimeout(400)
const dialogVisible = await page.locator('[role="dialog"]').count()
ok('点导入弹出确认弹窗', dialogVisible > 0)
const dialogText = await page.evaluate(() => document.querySelector('.modal')?.textContent || '')
ok('弹窗含替换警示语义', dialogText.includes('完全替换') && dialogText.includes('不可恢复'))
ok('弹窗标题确认导入存档', dialogText.includes('确认导入存档'))
ok('弹窗出现后存档未被替换（仍为 7）', (await readTranscends()) === 7)

// 2. 点遮罩取消 → 不执行
await page.locator('.modal-overlay').first().click({ position: { x: 10, y: 10 } })
await page.waitForTimeout(400)
ok('点遮罩后弹窗关闭', (await page.locator('[role="dialog"]').count()) === 0)
ok('取消后存档仍未被替换', (await readTranscends()) === 7)

// 3. 重新点导入 → 确认 → 执行替换
await page.locator('button', { hasText: '导入存档' }).first().click()
await page.waitForTimeout(400)
await page.locator('button', { hasText: '确认导入' }).first().click()
await page.waitForTimeout(1500)
ok('确认后存档被替换（totalTranscends=0）', (await readTranscends()) === 0)

await browser.close()
console.log(fails === 0 ? '\n===== 全部通过 =====' : `\n===== ${fails} 项失败 =====`)
process.exit(fails === 0 ? 0 : 1)
