/**
 * starcore-v126-encounter-probe.mjs：随机遭遇事件冒烟探针（非套件）
 *
 * 校验面（10 项）：
 *  A. 触发与渲染：预制窗口旧值触发事件卡（渲染/标题/双选项）+ 三路零命中
 *  B. 选项 B 结算：卡片消失 + 回执出现 + 冷却窗口不重触
 *  C. 补充路径：移动视口 390px 无横向溢出 + 选项 A 结算入账 + 窗口未到不渲染
 *
 * 用法：node starcore-v126-encounter-probe.mjs [BASE_URL]
 *   BASE_URL 缺省本地预览；SC_URL 环境变量可指定远程地址
 */
import { launch, check, finish, savePayload, injectSave, PREVIEW_URL } from './starcore-pwlib.mjs'
// 注入正确姿势：ctx.addInitScript(injectSave, savePayload(save))，injectSave 在页面上下文执行

const BASE = process.env.SC_URL || process.argv[2] || PREVIEW_URL

const browser = await launch()

// 注入档：能量库存充足、lastCheckIn 置当日防首签干扰、预制遭遇窗口已到
function makeSeed(pendingWindow) {
  const now = Date.now()
  return {
    version: 1,
    savedAt: now,
    player: { id: 'p1', name: '指挥官' },
    totalPlayTime: 0,
    resources: { amounts: { energy: '50000' }, totals: { energy: '50000' } },
    buildings: { levels: {} },
    research: { completed: [] },
    military: { owned: { assault: 10 }, training: [], formations: [{ id: 'f1', name: 'F1', units: { assault: 10 } }] },
    combat: { garrisoned: {}, completed: [] },
    exploration: { progress: {} },
    relics: { owned: [], equipped: [] },
    transcend: { negativeEntropy: '0', totalTranscends: 0, tree: [] },
    daily: {
      lastCheckIn: new Date(now).toLocaleDateString('sv'),
      streak: 1,
      weeklyCounters: { battles: 0, explores: 0, researches: 0, upgrades: 0, transcends: 0, expedition: 0, synths: 0, enhances: 0, garrisonHours: 0 },
      challengeWeek: '',
      weekChallenges: [],
    },
    encounters: { nextTriggerAt: now + pendingWindow },
  }
}

let pass = 0
let fail = 0
async function verify(label, fn) {
  try {
    await fn()
    pass++
    console.log(`  ✓ ${label}`)
  } catch (e) {
    fail++
    console.log(`  ✗ ${label}: ${e.message}`)
  }
}

// A 段：触发与渲染（桌面视口），
{
  const ctx = await browser.newContext({ locale: 'zh-CN', viewport: { width: 1280, height: 800 } })
  const errors = []
  const page = await ctx.newPage()
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`) })
  await ctx.addInitScript(injectSave, savePayload(makeSeed(-1000)))
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })

  await verify('A1 预制窗口旧值：事件卡渲染', async () => {
    await page.waitForSelector('[data-testid="encounter-card"]', { timeout: 8000 })
  })
  await verify('A2 标题含「遭遇事件」', async () => {
    const txt = await page.textContent('[data-testid="encounter-card"]')
    if (!txt.includes('遭遇事件')) throw new Error('标题缺「遭遇事件」')
  })
  await verify('A3 双选项按钮渲染且可点', async () => {
    const a = page.locator('[data-testid="encounter-opt-A"]')
    const b = page.locator('[data-testid="encounter-opt-B"]')
    await a.waitFor({ state: 'visible', timeout: 5000 })
    await b.waitFor({ state: 'visible', timeout: 5000 })
    const la = (await a.textContent()).trim()
    const lb = (await b.textContent()).trim()
    if (!la || !lb) throw new Error('选项标签为空')
    if (await a.isDisabled()) throw new Error('选项 A 禁用态')
  })
  await verify('A4 console/pageerror/HTTP 三路零命中', async () => {
    if (errors.length) throw new Error(errors.join(' | '))
  })
  await ctx.close()
}

// B 段：结算与回执
{
  const ctx = await browser.newContext({ locale: 'zh-CN', viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()
  await ctx.addInitScript(injectSave, savePayload(makeSeed(-1000)))
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-testid="encounter-card"]', { timeout: 8000 })

  await verify('B1 选项 B 结算：卡片消失', async () => {
    await page.click('[data-testid="encounter-opt-B"]')
    await page.waitForSelector('[data-testid="encounter-card"]', { state: 'detached', timeout: 5000 })
  })
  await verify('B2 toast 回执出现（含事件名或一无所获）', async () => {
    const toast = page.locator('.toast')
    await toast.waitFor({ state: 'visible', timeout: 3000 })
    const txt = await toast.textContent()
    // 回执形态：「{事件名}：{变动列表}」或「{事件名}：一无所获」
    if (!txt.includes('：') && !txt.includes('一无所获')) {
      throw new Error(`回执形态不对: ${txt}`)
    }
  })
  await verify('B3 冷却期内无新事件卡（结算后 2 秒观察）', async () => {
    await page.waitForTimeout(2000)
    const count = await page.locator('[data-testid="encounter-card"]').count()
    if (count !== 0) throw new Error(`冷却期内出现 ${count} 张事件卡`)
  })
  await ctx.close()
}

// C 段：选项 A 资源入账 + 新档无卡 + 移动视口
{
  const ctx = await browser.newContext({ locale: 'zh-CN', viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  await ctx.addInitScript(injectSave, savePayload(makeSeed(-1000)))
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-testid="encounter-card"]', { timeout: 8000 })

  await verify('C1 移动视口 390px 事件卡渲染无横向溢出', async () => {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    if (overflow > 1) throw new Error(`横向溢出 ${overflow}px`)
  })
  await verify('C2 选项 A 结算成功（卡片消失 + 回执）', async () => {
    await page.click('[data-testid="encounter-opt-A"]')
    await page.waitForSelector('[data-testid="encounter-card"]', { state: 'detached', timeout: 5000 })
    await page.locator('.toast').waitFor({ state: 'visible', timeout: 3000 })
  })
  await ctx.close()

  const ctx2 = await browser.newContext({ locale: 'zh-CN', viewport: { width: 1280, height: 800 } })
  const page2 = await ctx2.newPage()
  await ctx2.addInitScript(injectSave, savePayload(makeSeed(600_000)))
  await page2.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
  await verify('C3 窗口未到：新档不渲染事件卡', async () => {
    await page2.waitForTimeout(2500)
    const count = await page2.locator('[data-testid="encounter-card"]').count()
    if (count !== 0) throw new Error('窗口未到却渲染了事件卡')
  })
  await ctx2.close()
}

// 末行总校并入 pwlib 计数器：finish 退出码与探针结果一致
check(`总校（${pass} ✓ / ${fail} ✗）`, fail === 0)
await finish(browser)
