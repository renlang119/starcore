/**
 * starcore-v124-boss-probe.mjs — v1.24 周 Boss 冒烟探针（非套件）
 *
 * 两档状态 × 本地预览（SC_URL 可指定远程）：
 *   A. 全新档：/map 周 Boss 卡锁定态；直接访问 /battle/weekly_boss 不崩
 *   B. 解锁档（注入 silencer_3 + best=5）：/map 卡解锁态 + 奖励预览；
 *      战斗页渲染 Boss 编成、隐藏驻扎按钮与深度面板；console/pageerror 双路监听
 */
import { launch, check, finish, savePayload, injectSave, BASE_URL } from './starcore-pwlib.mjs'

const BASE = BASE_URL
import fs from 'node:fs'
const OUT = process.env.OUT || '/tmp/v124-probe'
fs.mkdirSync(OUT, { recursive: true })

const browser = await launch()

try {
  // ---------- A. 全新档 ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    const page = await ctx.newPage()
    const consoleErrs = []
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrs.push(m.text())
    })
    page.on('pageerror', (e) => consoleErrs.push(String(e)))

    await page.goto(BASE + '/map', { waitUntil: 'networkidle' })
    await page.waitForTimeout(600)
    const locked = page.locator('[data-testid="weekly-boss-locked"]')
    check('A1 新档周 Boss 卡锁定态可见', await locked.isVisible())
    check('A2 锁定态禁用', await locked.isDisabled())
    check(
      'A3 锁定文案',
      (await locked.textContent()).includes('攻克沉默者旗舰后开放')
    )

    await page.goto(BASE + '/battle/weekly_boss', { waitUntil: 'networkidle' })
    await page.waitForTimeout(600)
    // 未解锁：应用渲染空态/返回按钮，不允许整页崩（无 pageerror 即可）
    check('A4 未解锁直访战斗页不崩（console 双路零异常）', consoleErrs.length === 0)
    await ctx.close()
  }

  // ---------- B. 解锁档（注入） ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    const game = {
      version: 1,
      savedAt: Date.now(),
      resources: {
        amounts: { energy: '1e9', crystal: '1e6', alloy: '1e6', data: '1e6', dark: '500' },
        totals: { energy: '1e9', dark: '500' },
      },
      buildings: { levels: {} },
      research: { completed: [] },
      military: {
        owned: { assault: 8000, guard: 6400, heavy: 6400, psionic: 3200 },
        training: [],
        formations: [
          {
            id: 'f1',
            name: '主力',
            units: { assault: 3000, guard: 2000, heavy: 2000, psionic: 1000 },
          },
          { id: 'f2', name: '二队', units: {} },
          { id: 'f3', name: '三队', units: {} },
        ],
      },
      combat: { completed: ['silencer_3'], expeditionBest: 5, garrisoned: {} },
      exploration: { progress: {} },
      relics: { owned: [], equipped: [] },
      transcend: { negativeEntropy: '0', totalTranscends: 0, tree: [] },
    }
    await ctx.addInitScript(injectSave, savePayload(game))
    const page = await ctx.newPage()
    const consoleErrs = []
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrs.push(m.text())
    })
    page.on('pageerror', (e) => consoleErrs.push(String(e)))

    await page.goto(BASE + '/map', { waitUntil: 'networkidle' })
    await page.waitForTimeout(600)
    const open = page.locator('[data-testid="weekly-boss-open"]')
    check('B1 解锁档周 Boss 卡可点击态', await open.isVisible())
    check('B2 卡面显示本周考题', (await open.textContent()).includes('本周考题：'))
    check('B3 卡面奖励预览含暗物质', (await open.textContent()).includes('暗物质'))

    await page.goto(BASE + '/battle/weekly_boss', { waitUntil: 'networkidle' })
    await page.waitForTimeout(600)
    check('B4 战斗页渲染 Boss 标题', (await page.locator('.s-name').first().textContent()).includes('周强敌'))
    check('B5 敌方编成渲染', (await page.locator('.enemy-card').count()) > 0)
    check('B6 驻扎按钮隐藏', (await page.locator('[data-testid="battle-garrison"]').count()) === 0)
    check('B7 深度面板隐藏', (await page.locator('[data-testid="endless-depth-panel"]').count()) === 0)
    const deploy = page.locator('[data-testid="battle-start"]')
    check('B8 出战按钮可用', !(await deploy.isDisabled()))
    await page.screenshot({ path: OUT + '/boss-battle.png', fullPage: true })
    check('B9 解锁档 console 双路零异常', consoleErrs.length === 0)
    await ctx.close()
  }

  await finish(browser)
} catch (e) {
  console.error('探针异常:', e)
  await finish(browser)
}
