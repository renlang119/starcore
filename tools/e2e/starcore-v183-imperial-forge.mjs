// 星核纪元 v1.83 专项回归：炉域倾贡与档案节七
// A. 锁定态：六座全接管但 auditEverPassed=false → 炉域卡锁定文案、无进入按钮
// B. 进入链：巡检已过种子档 → 进入按钮 → 点击后稳定度/点名在场，档案节七 3 卡当帧可见
// C. 倾贡链：进入后连投两次（回填 +24，首投即产出）→ 档位爬升与计数断言
// D. 成就页：帝庭纪事分区 8 卡渲染（57 卡基线由 v057/v122 覆盖）
// 时间控制：绝对时间戳制（page.clock 禁用惯例）；点名周键由应用 getCurrentWeek 推出
import { launch, finish, check, savePayload, injectSave, BASE_URL } from './starcore-pwlib.mjs'

const BASE = BASE_URL
const REQ_NODES = [
  'node_galaxy_hub',
  'node_arm_gate',
  'node_arm_spine',
  'node_arm_cradle',
  'node_galaxy_range',
  'node_galaxy_halo',
]

let pass = 0
let fail = 0
const FAILURES = []
async function v(label, fn) {
  try {
    await fn()
    pass++
    console.log(`  ✓ ${label}`)
  } catch (e) {
    fail++
    FAILURES.push(`${label}: ${e.message}`)
    check(`${label}: ${e.message}`, false)
  }
}

/** 全接管种子档；auditPassed=true 时巡检已过 + auditEverPassed 置位（炉域可进入） */
function seedImperial({ auditPassed = false } = {}) {
  const now = Date.now()
  const progress = {}
  for (const id of REQ_NODES) progress[id] = { nodeId: id, startTime: 0, endTime: 0, completed: true }
  const ids = ['imp_pass', 'imp_audit', 'imp_guard', 'imp_verdict', 'imp_echo', 'imp_court']
  const capturedAt = {}
  for (const id of ids) capturedAt[id] = 0
  return {
    version: 1,
    savedAt: now,
    player: { id: 'p1', name: '指挥官' },
    totalPlayTime: 0,
    resources: {
      amounts: { energy: '1e18', alloy: '1e18', crystal: '1e18', data: '1e6', dark: '1e15' },
      totals: { energy: '1e18', alloy: '1e18', crystal: '1e18', data: '1e6', dark: '1e15' },
    },
    buildings: { levels: {} },
    research: { completed: ['military_basic'] },
    military: {
      owned: { assault: 999_999_999, guard: 999_999_999, heavy: 999_999_999, psionic: 999_999_999 },
      training: [],
      formations: [
        {
          id: 'f1',
          name: '一队',
          units: {
            assault: 999_999_999,
            guard: 999_999_999,
            heavy: 999_999_999,
            psionic: 999_999_999,
          },
        },
      ],
    },
    combat: { garrisoned: {}, completed: ['silencer_3'], expeditionBest: 34 },
    exploration: { progress },
    relics: { owned: [], equipped: [] },
    transcend: { negativeEntropy: '0', totalTranscends: 0, tree: [] },
    daily: {
      lastCheckIn: new Date().toLocaleDateString('sv'),
      streak: 1,
      weeklyCounters: {
        battles: 0,
        explores: 0,
        researches: 0,
        upgrades: 0,
        transcends: 0,
        expedition: 0,
        synths: 0,
        enhances: 0,
        garrisonHours: 0,
      },
      challengeWeek: '',
      weekChallenges: [],
    },
    imperial: {
      completed: ids,
      everCompleted: ids,
      tiers: {},
      capturedAt,
      lastClaimAt: now,
      ...(auditPassed
        ? {
            audit: {
              week: '2020-W01',
              targetId: 'imp_pass',
              deadline: now + 86_400_000,
              status: 'passed',
            },
            auditEverPassed: true,
          }
        : {
            audit: {
              week: '2020-W01',
              targetId: 'imp_pass',
              deadline: now + 86_400_000,
              status: 'pending',
            },
          }),
    },
  }
}

async function newPage(browser, save, path, waitMs = 2000) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  page.on('console', (m) => {
    if (m.type() === 'error') console.log('    [console.error] ' + m.text().slice(0, 200))
  })
  page.on('pageerror', (e) => console.log('    [pageerror] ' + String(e).slice(0, 200)))
  await ctx.addInitScript(injectSave, savePayload(save))
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(waitMs)
  return { ctx, page }
}

/** 关掉新手引导弹窗（若在场），避免遮挡与误点 */
async function dismissOnboarding(page) {
  const btn = page.locator('button', { hasText: '知道了' }).first()
  if (await btn.isVisible().catch(() => false)) {
    await btn.click().catch(() => {})
    await page.waitForTimeout(300)
  }
}

const browser = await launch()

// A. 锁定态：巡检未过 → 炉域卡锁定
console.log('== A. 炉域锁定态 ==')
{
  const { ctx, page } = await newPage(browser, seedImperial(), '/map', 2500)
  await dismissOnboarding(page)
  await v('A1 炉域卡锁定文案在场（六座已接管但巡检未过）', async () => {
    const card = page.locator('[data-testid="imperial-forge"]')
    await card.waitFor({ state: 'visible', timeout: 8000 })
    const txt = await card.textContent()
    if (!txt.includes('六座')) throw new Error('锁定提示缺位: ' + txt.slice(0, 80))
  })
  await v('A2 无进入按钮', async () => {
    if (await page.locator('[data-testid="imperial-forge-enter"]').count())
      throw new Error('锁定态出现进入按钮')
  })
  await ctx.close()
}

// B. 进入链：巡检已过 → 进入 → 面板与档案节七
console.log('== B. 进入链 ==')
{
  const { ctx, page } = await newPage(browser, seedImperial({ auditPassed: true }), '/map', 2500)
  await dismissOnboarding(page)
  await v('B1 解锁态显示进入按钮', async () => {
    await page.locator('[data-testid="imperial-forge-enter"]').waitFor({
      state: 'visible',
      timeout: 8000,
    })
  })
  await v('B2 点击进入：稳定度条与点名提示在场', async () => {
    await page.locator('[data-testid="imperial-forge-enter"]').click()
    await page.waitForTimeout(600)
    await page.locator('[data-testid="imperial-forge-stability"]').waitFor({
      state: 'visible',
      timeout: 8000,
    })
    const stab = await page.locator('[data-testid="imperial-forge-stability"]').textContent()
    if (!stab.includes('0/100')) throw new Error('初始稳定度非 0: ' + stab)
    await page.locator('[data-testid="imperial-forge-pick"]').waitFor({
      state: 'visible',
      timeout: 8000,
    })
    const pick = await page.locator('[data-testid="imperial-forge-pick"]').textContent()
    if (!pick.includes('×3')) throw new Error('点名提示缺 ×3: ' + pick)
    // 四个投入按钮（四选一，不含数据）
    for (const r of ['energy', 'crystal', 'alloy', 'dark']) {
      if (!(await page.locator(`[data-testid="imperial-forge-tribute-${r}"]`).count()))
        throw new Error(`投入按钮缺位: ${r}`)
    }
    if (await page.locator('[data-testid="imperial-forge-tribute-data"]').count())
      throw new Error('出现 data 投入按钮（套利隔离破坏）')
  })

  await v('B2b SPA 内部导航：首次进入后档案节七当帧可见（含 imp_19 首条）', async () => {
    // 不用 page.goto（文档级导航会重放 addInitScript 种子档覆盖运行时状态）；
    // SideNav 为 SPA 内部路由跳转，状态保留，覆盖尾点定案的「当帧可见」链路
    const navBtn = page.locator('.nav-item', { hasText: '档案馆' })
    await navBtn.waitFor({ state: 'visible', timeout: 8000 })
    await navBtn.click()
    await page.waitForTimeout(1200)
    const cards = page.locator('[data-testid="archive-imperial-forge-card"]')
    await cards.first().waitFor({ state: 'visible', timeout: 8000 })
    const n = await cards.count()
    if (n !== 3) throw new Error(`炉域节卡数 ${n} ≠ 3`)
    const body = await page.evaluate(() => document.body.innerText)
    if (!body.includes('已归档 21 / 21')) throw new Error('计数未达 21/21')
    if (!body.includes('炉口的另一侧')) throw new Error('imp_19 首条缺位')
  })
  await ctx.close()

// B3. 读回保留：forgeEntered 置位档注入新 context（hydrate 白名单真实路径），
// 档案节七可见（当帧置位链路由单测 ArchiveView.test 覆盖）
console.log('== B3. 档案节七读回 ==')
{
  const seed = seedImperial({ auditPassed: true })
  // validate 对 achievements 存在时强制必填（energy/dark 数字符串 + 五整数键），缺则整档被拒
  seed.achievements = {
    lifetime: {
      energy: '0',
      dark: '0',
      upgrades: 0,
      maxBuildingLevel: 0,
      researches: 0,
      explores: 0,
      battles: 0,
      forgeEntered: 1,
    },
    unlocked: {},
  }
  const { ctx, page } = await newPage(browser, seed, '/archive', 2500)
  await dismissOnboarding(page)
  await v('B3 forgeEntered 读回：档案节七 3 卡与 21/21 计数在场', async () => {
    const card = page.locator('[data-testid="archive-imperial-forge-card"]').first()
    await card.waitFor({ state: 'visible', timeout: 8000 })
    const n = await page.locator('[data-testid="archive-imperial-forge-card"]').count()
    if (n !== 3) throw new Error(`炉域节卡数 ${n} ≠ 3`)
    if ((await page.locator('[data-testid="archive-imperial-forge-locked"]').count()) !== 0)
      throw new Error('锁定提示仍在场')
    const text = await page.evaluate(() => document.body.innerText)
    if (!text.includes('已归档 21 / 21')) throw new Error('计数未达 21/21')
  })
  await ctx.close()
}
}

// C. 倾贡链：首投回填无产出 → 次投起有回礼
console.log('== C. 倾贡链 ==')
{
  const { ctx, page } = await newPage(
    browser,
    seedImperial({ auditPassed: true }),
    '/map',
    2500
  )
  await dismissOnboarding(page)
  await page.locator('[data-testid="imperial-forge-enter"]').click()
  await page.waitForTimeout(500)
  await v('C1 首投：稳定度 0→24（回填 +24 复审版）', async () => {
    await page.locator('[data-testid="imperial-forge-tribute-energy"]').click()
    await page.waitForTimeout(600)
    const stab = await page.locator('[data-testid="imperial-forge-stability"]').textContent()
    if (!stab.includes('24/100')) throw new Error('首投后稳定度非 24: ' + stab)
  })
  await v('C2 次投稳定度 48（档位爬升）', async () => {
    await page.locator('[data-testid="imperial-forge-tribute-energy"]').click()
    await page.waitForTimeout(600)
    const stab = await page.locator('[data-testid="imperial-forge-stability"]').textContent()
    const stabM = stab.match(/(\d+)\/100/)
    const stabN = stabM ? parseInt(stabM[1], 10) : -1
    if (!(stabN >= 47 && stabN <= 48))
      throw new Error(`次投后稳定度异常（预期 47~48，含运行时衰减容差）: ${stab}`)
    // 注：data 入账与 forgeTributes 写入由单测覆盖（imperial-game.test 倾贡链）；
    // e2e 不跨页 goto 断运行时计数（addInitScript 导航重放种子档会覆盖 achievements），
    // 改为种子档读回：预置 forgeTributes 的成就页进度显示走 hydrate 白名单真实路径
  })
  await ctx.close()
}

// C3. 倾贡计数读回：预置 forgeTributes 的种子档注入（hydrate 白名单），
// 成就页「添柴人」进度 2 / 100 在场
console.log('== C3. 倾贡计数读回 ==')
{
  const seed = seedImperial({ auditPassed: true })
  seed.achievements = {
    lifetime: {
      energy: '0',
      dark: '0',
      upgrades: 0,
      maxBuildingLevel: 0,
      researches: 0,
      explores: 0,
      battles: 0,
      forgeTributes: 2,
    },
    unlocked: {},
  }
  const { ctx, page } = await newPage(browser, seed, '/achievements', 2500)
  await dismissOnboarding(page)
  await v('C3 forgeTributes 读回：添柴人进度 2/100', async () => {
    const section = page.locator('.ach-section', { hasText: '帝庭纪事' })
    await section.waitFor({ state: 'visible', timeout: 8000 })
    const feeder = section.locator('.ach-card', { hasText: '添柴人' })
    await feeder.waitFor({ state: 'visible', timeout: 8000 })
    const feederText = await feeder.textContent()
    if (!/2\s*\/\s*100/.test(feederText))
      throw new Error(`添柴人进度非 2/100: ${feederText.slice(0, 120)}`)
  })
  await ctx.close()
}

// D. 成就页帝庭纪事分区 8 卡
console.log('== D. 成就页帝庭纪事 ==')
{
  const { ctx, page } = await newPage(
    browser,
    seedImperial({ auditPassed: true }),
    '/achievements',
    2000
  )
  await v('D1 帝庭纪事分区与 8 卡渲染', async () => {
    const section = page.locator('.ach-section', { hasText: '帝庭纪事' })
    await section.waitFor({ state: 'visible', timeout: 8000 })
    const cards = await section.locator('.ach-card').count()
    if (cards !== 8) throw new Error(`帝庭类卡数 ${cards} ≠ 8`)
    const body = await section.textContent()
    for (const name of ['贡道首驿', '炉口之下', '添柴人', '听炉的人']) {
      if (!body.includes(name)) throw new Error(`卡缺位: ${name}`)
    }
  })
  await ctx.close()
}

if (FAILURES.length) {
  console.log(`\n失败 ${FAILURES.length} 项:`)
  for (const f of FAILURES) console.log('  ✗ ' + f)
}
await finish(browser)
