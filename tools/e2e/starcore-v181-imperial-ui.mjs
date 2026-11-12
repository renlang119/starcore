// 星核纪元 v1.81 专项回归：帝庭据点线界面版
// A. 解锁与渲染：银盘枢纽未完成锁定 / 全解锁后贡道区 + 6 座 + 池 + 巡检卡渲染
// B. 接管一场：接管入口进战斗页 / 出征胜利 / 回图已接管态（整备 1/3）
// C. 领取贡赋：池积 11 小时后领取入账 / 池清零
// D. 整备一次：接管态整备 1→2（成本入账校验由 store 单测覆盖）
// E. 巡检迎战：tick 自动生成 pending / 迎战胜利 passed（下周 +10%）
// F. 巡检打点：pending 态打点 / passed(paid) 无加成
// G. 逾期停摆：预置 overdue / 目标卡停摆标记 + 迎战恢复入口
// 时间控制：绝对时间戳制（lastClaimAt / audit.deadline 预置拨时，page.clock 禁用惯例）
import { launch, finish, savePayload, injectSave, BASE_URL } from './starcore-pwlib.mjs'

const BASE = BASE_URL
const HOUR = 3_600_000
/** 全部探索节点 id（从应用侧数据表读取会引入构建依赖，此处按档内惯例硬列锚点；
 *  贡道区只判 node_galaxy_hub 与 6 座 requires，其余节点不注入不影响本专项） */
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
    console.log(`  ✗ ${label}: ${e.message}`)
  }
}

function localDateStr(d = new Date()) {
  return d.toLocaleDateString('sv')
}

/** 种子档：全解锁（REQ_NODES 完成）+ best=34（A 档）+ 强编队保证必胜 */
function makeSeed({ withoutHub = false, imperial, best = 34 } = {}) {
  const now = Date.now()
  const progress = {}
  for (const id of REQ_NODES) progress[id] = { nodeId: id, startTime: 0, endTime: 0, completed: true }
  if (withoutHub) delete progress.node_galaxy_hub
  const save = {
    version: 1,
    savedAt: now,
    player: { id: 'p1', name: '指挥官' },
    totalPlayTime: 0,
    resources: {
      amounts: { energy: '1e18', alloy: '1e18', crystal: '1e18', data: '1e18', dark: '1e15' },
      totals: { energy: '1e18', alloy: '1e18', crystal: '1e18', data: '1e18', dark: '1e15' },
    },
    buildings: { levels: {} },
    research: { completed: ['military_basic'] },
    military: {
      owned: { assault: 999_999, guard: 999_999, heavy: 999_999, psionic: 999_999 },
      training: [],
      formations: [
        {
          id: 'f1',
          name: '一队',
          units: { assault: 999_999, guard: 999_999, heavy: 999_999, psionic: 999_999 },
        },
      ],
    },
    combat: { garrisoned: {}, completed: ['silencer_3'], expeditionBest: best },
    exploration: { progress },
    relics: { owned: [], equipped: [] },
    transcend: { negativeEntropy: '0', totalTranscends: 0, tree: [] },
    daily: {
      lastCheckIn: localDateStr(),
      streak: 1,
      weeklyCounters: {
        battles: 0, explores: 0, researches: 0, upgrades: 0, transcends: 0,
        expedition: 0, synths: 0, enhances: 0, garrisonHours: 0,
      },
      challengeWeek: '',
      weekChallenges: [],
    },
  }
  if (imperial !== undefined) save.imperial = imperial
  return save
}

/** 预置接管档：6 座全接管（可选 lastClaimAt 拨早攒池 / 预置巡检态） */
function capturedAll({ lastClaimAt, audit } = {}) {
  const ids = ['imp_pass', 'imp_audit', 'imp_guard', 'imp_verdict', 'imp_echo', 'imp_court']
  const capturedAt = {}
  for (const id of ids) capturedAt[id] = Date.now() - 24 * HOUR
  return {
    completed: [...ids],
    everCompleted: [...ids],
    tiers: {},
    capturedAt,
    lastClaimAt: lastClaimAt ?? Date.now() - 24 * HOUR,
    ...(audit ? { audit } : {}),
  }
}

async function gotoMap(browser, seed, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  await ctx.addInitScript(injectSave, savePayload(seed))
  await page.goto(BASE + '/map', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(opts.waitMs ?? 1500)
  return { ctx, page }
}

/** 打一场并回星图（等结果弹窗 → 确认） */
async function fightAndBack(page) {
  await page.locator('[data-testid="battle-start"]').first().click()
  await page.waitForSelector('.modal, [data-testid*="result"], .result', { timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(1200)
  // 战报播出收尾后弹窗出现：确认按钮回到星图
  for (let i = 0; i < 30; i++) {
    const txt = await page.locator('body').innerText()
    if (txt.includes('胜 利') || txt.includes('Victory')) break
    await page.waitForTimeout(1000)
  }
  // 弹窗内「返回星图」按钮（btn-secondary）；页头同名按钮被弹窗遮罩盖住不可点
  const confirm = page.locator('button.btn-secondary', { hasText: '返回星图' }).first()
  await confirm.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {})
  // Toast（接管成功/战损）浮层短暂遮挡，给足点击重试窗口
  if (await confirm.isVisible().catch(() => false)) {
    await confirm.click({ timeout: 15_000 }).catch(() => {})
  }
  await page.waitForTimeout(1000)
}

const browser = await launch()

// A. 解锁与渲染
console.log('== A. 解锁与渲染 ==')
{
  const { ctx, page } = await gotoMap(browser, makeSeed({ withoutHub: true }))
  await v('A1 未完成银盘枢纽：贡道区锁定提示可见', async () => {
    const lock = page.locator('[data-testid="imperial-route-locked"]')
    await lock.waitFor({ state: 'visible', timeout: 8000 })
    if (!(await lock.textContent()).includes('银盘枢纽')) throw new Error('提示未含银盘枢纽')
  })
  await v('A2 锁定态据点卡零渲染', async () => {
    if ((await page.locator('[data-testid="imperial-imp_pass"]').count()) !== 0)
      throw new Error('锁定态竟渲染据点卡')
  })
  await ctx.close()

  const { ctx: c2, page: p2 } = await gotoMap(browser, makeSeed({}))
  await v('A3 解锁后 6 座据点卡渲染', async () => {
    for (const id of ['imp_pass', 'imp_audit', 'imp_guard', 'imp_verdict', 'imp_echo', 'imp_court']) {
      if (!(await p2.locator(`[data-testid="imperial-${id}"]`).isVisible()))
        throw new Error(`${id} 缺位`)
    }
  })
  await v('A4 贡赋池面板渲染', async () => {
    if (!(await p2.locator('[data-testid="imperial-pool"]').isVisible())) throw new Error('池缺位')
  })
  await v('A5 无接管时巡检卡不渲染（无目标可选）', async () => {
    if ((await p2.locator('[data-testid^="imperial-audit-"]').count()) !== 0)
      throw new Error('零接管竟有巡检卡')
  })
  await c2.close()
}

// B. 接管一场
console.log('== B. 接管一场 ==')
{
  const { ctx, page } = await gotoMap(browser, makeSeed({}))
  await v('B1 接管入口进战斗页', async () => {
    await page.locator('[data-testid="imperial-imp_pass-capture"]').click()
    await page.waitForURL('**/battle/imp_pass', { timeout: 5000 })
  })
  await v('B2 出征胜利后接管成功（回图已接管态）', async () => {
    await fightAndBack(page)
    await page.waitForTimeout(1000)
    const card = page.locator('[data-testid="imperial-imp_pass"]')
    await card.waitFor({ state: 'visible', timeout: 8000 })
    const txt = await card.textContent()
    if (!txt.includes('已接管')) throw new Error('卡未显示已接管: ' + txt.slice(0, 80))
    if (!txt.includes('1/3')) throw new Error('整备等级缺位: ' + txt.slice(0, 80))
  })
  await v('B3 已接管无再战入口（接管按钮消失、整备入口在场）', async () => {
    // 地图侧防重：接管按钮消失即无再战入口；战斗页出征禁用由 BattleView
    // 单测覆盖（e2e 整页重载依赖自动存档落盘，时序不可控，v1.81 实踩）
    if ((await page.locator('[data-testid="imperial-imp_pass-capture"]').count()) !== 0)
      throw new Error('已接管仍留接管按钮')
    if (!(await page.locator('[data-testid="imperial-imp_pass-upgrade"]').isVisible()))
      throw new Error('整备入口缺位')
  })
  await ctx.close()
}

// C. 领取贡赋 + D. 整备一次
console.log('== C/D. 领取与整备 ==')
{
  const seed = makeSeed({ imperial: capturedAll({ lastClaimAt: Date.now() - 11 * HOUR }) })
  const { ctx, page } = await gotoMap(browser, seed)
  await v('C1 池积 11 小时可领取（按钮可用且有量）', async () => {
    const claim = page.locator('[data-testid="imperial-pool-claim"]')
    await claim.waitFor({ state: 'visible', timeout: 8000 })
    if (await claim.isDisabled()) throw new Error('有量竟禁用')
    const txt = await page.locator('[data-testid="imperial-pool"]').textContent()
    if (!/\d/.test(txt)) throw new Error('池未显量: ' + txt.slice(0, 80))
  })
  await v('C2 领取后池清零（按钮转禁用）', async () => {
    await page.locator('[data-testid="imperial-pool-claim"]').click()
    await page.waitForTimeout(600)
    const claim = page.locator('[data-testid="imperial-pool-claim"]')
    if (!(await claim.isDisabled())) throw new Error('领取后仍可用')
  })
  await v('D1 整备一次：等级 1→2', async () => {
    const up = page.locator('[data-testid="imperial-imp_pass-upgrade"]')
    await up.waitFor({ state: 'visible', timeout: 8000 })
    await up.click()
    await page.waitForTimeout(600)
    const txt = await page.locator('[data-testid="imperial-imp_pass"]').textContent()
    if (!txt.includes('2/3')) throw new Error('整备未到 2 级: ' + txt.slice(0, 100))
  })
  await ctx.close()
}

// E. 巡检迎战
console.log('== E. 巡检迎战 ==')
{
  const seed = makeSeed({ imperial: capturedAll({}) })
  const { ctx, page } = await gotoMap(browser, seed, { waitMs: 2500 })
  await v('E1 tick 自动生成 pending 巡检卡', async () => {
    await page.locator('[data-testid="imperial-audit-pending"]').waitFor({ state: 'visible', timeout: 8000 })
  })
  await v('E2 迎战胜利转 passed（下周 +10%）', async () => {
    await page.locator('[data-testid="imperial-audit-fight"]').click()
    await page.waitForURL('**/battle/imperial_audit', { timeout: 5000 })
    await fightAndBack(page)
    await page.waitForTimeout(1000)
    const txt = await page.locator('[data-testid="imperial-audit-passed"]').textContent()
    if (!txt.includes('+10%')) throw new Error('passed 卡缺加成文案: ' + txt.slice(0, 80))
  })
  await ctx.close()
}

// F. 巡检打点 + G. 逾期停摆
console.log('== F/G. 打点与停摆 ==')
{
  const seed = makeSeed({
    imperial: capturedAll({ lastClaimAt: Date.now() - 24 * HOUR }),
  })
  seed.imperial.lastClaimAt = Date.now() - 24 * HOUR
  const { ctx, page } = await gotoMap(browser, seed, { waitMs: 2500 })
  await v('F1 打点通过转 paid（无加成文案）', async () => {
    await page.locator('[data-testid="imperial-audit-pending"]').waitFor({ state: 'visible', timeout: 8000 })
    await page.locator('[data-testid="imperial-audit-pay"]').click()
    await page.waitForTimeout(600)
    const txt = await page.locator('[data-testid="imperial-audit-paid"]').textContent()
    if (!txt.includes('打点')) throw new Error('paid 态缺打点文案: ' + txt.slice(0, 80))
  })
  await ctx.close()

  const overdue = capturedAll({})
  overdue.audit = {
    week: '2020-W01',
    targetId: 'imp_pass',
    deadline: Date.now() - 1000,
    status: 'pending',
  }
  const seed2 = makeSeed({ imperial: overdue })
  const { ctx: c2, page: p2 } = await gotoMap(browser, seed2, { waitMs: 2500 })
  await v('G1 逾期转 overdue：巡检卡与目标卡停摆标记', async () => {
    await p2.locator('[data-testid="imperial-audit-overdue"]').waitFor({ state: 'visible', timeout: 8000 })
    const card = await p2.locator('[data-testid="imperial-imp_pass"]').textContent()
    if (!card.includes('停摆')) throw new Error('目标卡缺停摆标记: ' + card.slice(0, 80))
  })
  await v('G2 停摆仅作用目标座：其余座照常计产可领取', async () => {
    const claim = p2.locator('[data-testid="imperial-pool-claim"]')
    if (await claim.isDisabled()) throw new Error('其余 5 座计产竟不可领取')
    if (!(await p2.locator('[data-testid="imperial-imp_pass-upgrade"]').isVisible()))
      throw new Error('停摆座整备入口缺位（整备保留可升）')
  })
  await c2.close()
}

await finish(browser)
if (fail > 0) {
  console.error(`\nFAILED: ${fail}`)
  process.exitCode = 1
} else {
  console.log(`\nALL PASS: ${pass}`)
}
