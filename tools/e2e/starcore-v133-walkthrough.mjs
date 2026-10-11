// 星核纪元 v1.33 全玩法走查（模拟玩家真实操作 + 注档拨时加速，覆盖全部玩法面）
//
// 覆盖玩法：新档冒烟 / 建造（批量 ×10）/ 科技 / 训练 / 探索 / 据点出征+驻扎 / 无尽远征
//   / 里程碑领取 / 遗物（强化+套装+合成）/ 编队特性 / 自动化协议（建造+研究+探索）
//   / 成就 / 档案馆 / 每周强敌 / 随机遭遇 / 派遣远征（含离线归来）/ 签到+周期挑战
//   / 转生 / 设置（中英双语 + 存档导出 + 导入替换）/ 移动端全路由
// 每页与关键交互节点截图落盘 OUT 目录（桌面 1280 与移动 375 双档，全页截图）；
// 全程 console.error / pageerror / HTTP>=400 双路监听；每段独立捕获异常，单段失败不中断后续。
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { saveCode, launch, check, finish, newSeededPage, savePayload, injectSave, BASE_URL } from './starcore-pwlib.mjs'

const OUT = process.env.OUT || path.join(os.tmpdir(), 'starcore-walkthrough')
fs.mkdirSync(OUT, { recursive: true })
const HOUR = 3_600_000

// 异常采集（全上下文共用）
const errors = []
function wire(page) {
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`[console] ${m.text()} @ ${page.url()}`)
  })
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message} @ ${page.url()}`))
  page.on('response', (r) => {
    if (r.status() >= 400 && !r.url().includes('favicon')) errors.push(`[http${r.status()}] ${r.url()}`)
  })
}
async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true })
}
/** 段包装：段内异常计一次失败并继续后续段 */
async function sec(label, fn) {
  console.log(`== ${label} ==`)
  try {
    await fn()
  } catch (e) {
    check(`段内未捕获异常（${label}）：${String(e.message || e).slice(0, 160)}`, false)
  }
}
async function seeded(browser, save, route, opts = {}) {
  const page = await newSeededPage(browser, save, route, opts)
  wire(page)
  return page
}
async function navTo(page, label, wait = 700) {
  await page.locator('.side-nav .nav-item', { hasText: label }).first().click()
  await page.waitForTimeout(wait)
}
/** 找第一张可探索节点卡（未锁定/未完成/非进行中且按钮可用） */
async function findExplorable(page) {
  const cards = page.locator('.node-card')
  const n = await cards.count()
  for (let i = 0; i < n; i++) {
    const c = cards.nth(i)
    const cls = (await c.getAttribute('class')) || ''
    if (cls.includes('locked') || cls.includes('completed') || cls.includes('exploring')) continue
    const btn = c.locator('button.btn-accent')
    if ((await btn.count()) === 1 && !(await btn.isDisabled())) return c
  }
  return null
}

// 日期/周工具（与 app 同逻辑）
function weekStr(d = new Date()) {
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dayNum = (t.getDay() + 6) % 7
  t.setDate(t.getDate() - dayNum + 3)
  const isoYear = t.getFullYear()
  const firstThursday = new Date(isoYear, 0, 4)
  const fDayNum = (firstThursday.getDay() + 6) % 7
  firstThursday.setDate(firstThursday.getDate() - fDayNum + 3)
  const week = 1 + Math.round((t.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000))
  return `${isoYear}-W${String(week).padStart(2, '0')}`
}
const TODAY = new Date().toLocaleDateString('sv')
const THIS_WEEK = weekStr()

// 数据基线
const ALL_TECHS = ["fusion_tech", "energy_eff_1", "core_mining", "energy_eff_2", "dyson_theory", "crystal_eff_1", "refine_tech", "alloy_eff_1", "nano_forge_tech", "ion_casting", "alloy_eff_2", "stellar_forge_theory", "quantum_tech", "data_eff_1", "neural_arch", "research_speed", "data_eff_2", "holographic_computing", "military_basic", "weapon_upg", "armor_upg", "adv_units", "parallel_training_1", "parallel_training_2", "crystal_growth", "deep_crystal_mining", "crystal_eff_2", "silicon_ring_theory", "explore_basic", "explore_range_1", "explore_range_2", "dark_detection", "dark_matter_theory", "dark_capture", "dark_eff_1", "dark_singularity_well_theory", "singularity_theory", "prestige_boost", "offline_enhance", "stellar_charting", "wormhole_stabilization", "fleet_logistics", "dark_resonance", "starcluster_charting", "flagship_doctrine", "dark_amplifier", "precursor_memory", "arm_navigation", "armada_tactics", "dark_harvester", "neural_archive", "galaxy_charting", "galaxy_command", "dark_web", "galaxy_archive", "void_charting", "void_command", "dark_veil", "void_archive"]
const TECH_GAP = ['galaxy_command', 'void_command']
const DEEP_NODES = ['node_orbit', 'node_inner', 'node_outer', 'node_deep', 'node_stellar_gate', 'node_stellar_mine', 'node_stellar_forge', 'node_stellar_dead', 'node_stellar_core', 'node_stellar_edge']

function progressOf(ids) {
  const p = {}
  for (const id of ids) p[id] = { nodeId: id, startTime: 1, endTime: 2, completed: true }
  return p
}

function richSave(over = {}) {
  const units = { assault: 3000, guard: 2000, heavy: 2000, psionic: 1000 }
  const zero = { assault: 0, guard: 0, heavy: 0, psionic: 0 }
  const base = {
    version: 1,
    savedAt: Date.now(),
    player: { id: 'qa', name: '走查员' },
    totalPlayTime: 3_600_000,
    resources: {
      amounts: { energy: '10000000000', crystal: '100000000', alloy: '100000000', data: '100000000', dark: '100000' },
      totals: { energy: '20000000000', crystal: '200000000', alloy: '200000000', data: '200000000', dark: '200000' },
    },
    buildings: { levels: { solar_collector: 20, crystal_mine: 10 } },
    research: { completed: ALL_TECHS.filter((t) => !TECH_GAP.includes(t)) },
    military: {
      owned: { ...units },
      training: [],
      formations: [
        { id: 'f1', name: '主力编队', units: { ...units } },
        { id: 'f2', name: '第二编队', units: { ...zero } },
        { id: 'f3', name: '第三编队', units: { ...zero } },
      ],
    },
    combat: { garrisoned: {}, completed: ['raider_1', 'raider_2', 'silencer_3'], expeditionBest: 25, milestonesClaimed: [] },
    exploration: { progress: progressOf(DEEP_NODES) },
    relics: { owned: [], equipped: [null, null, null, null] },
    transcend: { negativeEntropy: '500', totalTranscends: 3, tree: [{ id: 't_slot', level: 1 }] },
    achievements: {
      lifetime: { energy: '0', dark: '0', upgrades: 0, maxBuildingLevel: 0, researches: 0, explores: 0, battles: 0 },
      unlocked: {},
    },
    daily: {
      lastCheckIn: TODAY,
      streak: 3,
      weeklyCounters: { battles: 0, explores: 0, researches: 0, upgrades: 0, transcends: 0, expedition: 0, synths: 0, enhances: 0, garrisonHours: 0 },
      challengeWeek: THIS_WEEK,
      weekChallenges: [],
    },
    encounters: { nextTriggerAt: Date.now() + 600_000 },
    archive: { enemies: ['raider_1#0', 'beast_1#0'] },
  }
  return { ...base, ...over }
}

const browser = await launch()

// ============ A. 新档冒烟：真实起步 ============
await sec('A. 新档冒烟', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  wire(page)
  await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)
  const badge = await page.locator('[data-testid="checkin-badge"]').textContent().catch(() => '')
  check('新档自动首签（连击 1 天）', badge.includes('连击 1 天'))
  await shot(page, 'a-new-home')
  await ctx.close()
})

// ============ B. 建造（批量 ×10）/ 科技 / 训练 ============
await sec('B. 建造 / 科技 / 训练', async () => {
  const page = await seeded(browser, richSave(), '/build')
  await page.locator('.bulk-toggle .seg-btn:text-is("×10")').click()
  await page.waitForTimeout(400)
  const card = page.locator('.build-card').filter({ hasText: '光能收集器' }).first()
  await card.locator('.bulk-preview').first().waitFor({ timeout: 3000 }).catch(() => {})
  const previewN = await card.locator('.bulk-preview').count()
  check(`×10 档可买预览出现（实际 ${previewN} 处）`, previewN >= 1)
  const before = (await card.locator('.b-level').textContent()).trim()
  await shot(page, 'b-build-bulk')
  await card.locator('button.btn-primary').first().click()
  await page.waitForTimeout(500)
  const after = (await card.locator('.b-level').textContent()).trim()
  check(`建造批量升级生效（${before} → ${after}）`, before !== after)
  check('升级轻提示出现', (await page.locator('.toast').count()) >= 1)

  await navTo(page, '科技树', 800)
  const avail = page.locator('.tech-card.available').first()
  check('留白科技可研究卡存在', (await avail.count()) === 1)
  const tname = (await avail.locator('.t-name').textContent()).trim()
  const tbtn = avail.locator('button')
  check(`研究按钮可点（资源充足，${tname}）`, !(await tbtn.isDisabled()))
  await tbtn.click()
  await page.waitForTimeout(600)
  const doneCard = page.locator('.tech-card', { has: page.locator(`.t-name:text-is("${tname}")`) })
  check(`研究完成态（${tname}）`, await doneCard.evaluate((el) => el.classList.contains('completed')))
  await shot(page, 'b-tech')

  await navTo(page, '部队', 800)
  const assaultCard = page.locator('.unit-card', { hasText: '突击兵' }).first()
  await assaultCard.locator('.count-btn', { hasText: '+1' }).first().click()
  await assaultCard.locator('button', { hasText: '训练' }).last().click()
  await page.waitForTimeout(6500)
  const countText = (await assaultCard.locator('.u-count').textContent()).trim()
  check(`训练完成全量入账（${countText}）`, countText.includes('6001'))
  await shot(page, 'b-army-train')
  await page.context().close()
})

// ============ C. 探索 / 据点出征 / 驻扎 ============
await sec('C. 探索 / 出征 / 驻扎', async () => {
  const save = richSave({
    exploration: { progress: progressOf(['node_orbit', 'node_inner', 'node_outer', 'node_deep']) },
    combat: { garrisoned: {}, completed: ['raider_1', 'silencer_3'], expeditionBest: 25, milestonesClaimed: [] },
  })
  const page = await seeded(browser, save, '/map')
  await page.waitForTimeout(800)
  const sections = await page.locator('.layer-section').count()
  check(`星图分层渲染（${sections} 层）`, sections === 9)

  const card = await findExplorable(page)
  check('存在可探索节点（五层开放后）', card !== null)
  if (card) {
    const nname = (await card.locator('.n-name').textContent()).trim()
    await card.locator('button.btn-accent').click()
    await page.waitForTimeout(600)
    const cls = (await card.getAttribute('class')) || ''
    check(`探索启动（${nname}）`, cls.includes('exploring'))
    await shot(page, 'c-map-exploring')
  }

  await page.waitForTimeout(500)
  const sCard = page.locator('.stronghold-card').first()
  await sCard.waitFor({ state: 'visible', timeout: 8000 })
  await sCard.click()
  await page.waitForURL('**/battle/**', { timeout: 5000 })
  await page.waitForTimeout(800)
  await shot(page, 'c-battle')
  const deploy = page.locator('[data-testid="battle-start"]')
  check('出征按钮可用', !(await deploy.isDisabled()))
  await deploy.click()
  await page.waitForTimeout(800)
  const modal = page.locator('.modal')
  const victory = (await modal.count()) === 1 && (await modal.evaluate((el) => el.classList.contains('victory')))
  check('战斗胜利（富档对常规据点）', victory)
  if (victory) {
    await shot(page, 'c-victory')
    await modal.getByRole('button', { name: '留在此据点' }).click()
    await page.waitForTimeout(400)
    const garrisonBtn = page.locator('[data-testid="battle-garrison"]')
    check('驻扎按钮存在且可用', (await garrisonBtn.count()) === 1 && !(await garrisonBtn.isDisabled()))
    await garrisonBtn.click()
    await page.waitForTimeout(400)
    const confirmBtn = page.locator('button', { hasText: '确认驻扎' })
    check('驻扎确认弹窗出现', (await confirmBtn.count()) === 1)
    await shot(page, 'c-garrison')
    await confirmBtn.click()
    await page.waitForTimeout(400)
    check('驻扎后按钮变撤回驻扎', (await garrisonBtn.textContent()).includes('撤回驻扎'))
    await garrisonBtn.click()
    await page.waitForTimeout(300)
    check('撤回后恢复挂机驻扎', (await garrisonBtn.textContent()).includes('挂机驻扎'))
  }
  await page.context().close()
})

// ============ D1. 远征里程碑领取 ============
await sec('D1. 远征里程碑', async () => {
  const page = await seeded(browser, richSave(), '/map')
  const bar = page.locator('[data-testid="milestone-ready"]')
  check('领取条出现（第 10 层档）', (await bar.count()) === 1 && (await bar.textContent()).includes('第 10 层'))
  await shot(page, 'd-milestone')
  await page.locator('[data-testid="milestone-claim"]').click()
  await page.waitForTimeout(400)
  check('补领推进到第 20 层档', (await bar.textContent()).includes('第 20 层'))
  await page.locator('[data-testid="milestone-claim"]').click()
  await page.waitForTimeout(400)
  check('两档领完领取条消失', (await page.locator('[data-testid="milestone-ready"]').count()) === 0)
  await page.context().close()
})

// ============ D2. 无尽远征 ============
await sec('D2. 无尽远征', async () => {
  const save = richSave({ combat: { garrisoned: {}, completed: ['silencer_3'], expeditionBest: 5, milestonesClaimed: [] } })
  const page = await seeded(browser, save, '/map')
  const endless = page.locator('[data-testid="endless-card-unlocked"]')
  check('远征卡已解锁（前沿第 6 层）', (await endless.textContent()).includes('第 6 层'))
  await endless.click()
  await page.waitForURL('**/battle/endless', { timeout: 5000 })
  await page.waitForTimeout(600)
  const panel = page.locator('[data-testid="endless-depth-panel"]')
  const val = () => panel.locator('[data-testid="endless-depth-value"]').textContent()
  check('深度面板渲染（默认前沿）', (await val()).includes('第 6 层'))
  check('前沿处 ＋ 按钮禁用', await panel.locator('[data-testid="endless-depth-plus"]').isDisabled())
  await shot(page, 'd-endless')
  const deploy = page.locator('[data-testid="battle-start"]')
  check('出征按钮可用', !(await deploy.isDisabled()))
  await deploy.click()
  await page.waitForTimeout(800)
  const modal = page.locator('.modal')
  const victory = (await modal.count()) === 1 && (await modal.evaluate((el) => el.classList.contains('victory')))
  check('远征战斗胜利（前沿推进）', victory)
  if (victory) {
    await shot(page, 'd-endless-victory')
    await modal.getByRole('button', { name: '留在此据点' }).click()
    await page.waitForTimeout(500)
    check('胜利后深度自动跟随新前沿（第 7 层）', (await val()).includes('第 7 层'))
    await panel.locator('[data-testid="endless-depth-minus"]').click()
    await page.waitForTimeout(200)
    check('可下调深度（第 6 层）', (await val()).includes('第 6 层'))
    check('非前沿时 ＋ 恢复可用', !(await panel.locator('[data-testid="endless-depth-plus"]').isDisabled()))
    await panel.locator('[data-testid="endless-depth-plus"]').click()
    await page.waitForTimeout(200)
    check('＋ 升回新前沿（第 7 层）', (await val()).includes('第 7 层'))
  }
  await page.context().close()
})

// ============ E. 遗物：强化 / 套装 / 合成 ============
await sec('E. 遗物：强化 / 套装 / 合成', async () => {
  const save = richSave()
  save.relics.owned = [
    { id: 'r_energy_3', instanceId: 'qa_e3', obtainedAt: 1, level: 5 },
    { id: 'r_dark_1', instanceId: 'qa_d1', obtainedAt: 1 },
    { id: 'r_dark_2', instanceId: 'qa_d2', obtainedAt: 1 },
    { id: 'r_energy_1', instanceId: 'qa_c1', obtainedAt: 1 },
    { id: 'r_energy_1', instanceId: 'qa_c2', obtainedAt: 1 },
    { id: 'r_alloy_1', instanceId: 'qa_c3', obtainedAt: 1 },
    { id: 'r_data_1', instanceId: 'qa_c4', obtainedAt: 1 },
  ]
  const page = await seeded(browser, save, '/relic')
  check('遗物页渲染（7 卡）', (await page.locator('.relic-card').count()) === 7)
  await shot(page, 'e-relic')

  const e3card = page.locator('.relic-card', { has: page.locator('[data-testid="relic-level-badge"]') }).first()
  check('epic 遗物带 Lv5 徽章', (await e3card.locator('[data-testid="relic-level-badge"]').textContent()).trim() === 'Lv5')
  await e3card.locator('[data-testid="enhance-button"]').click()
  await page.waitForTimeout(400)
  check('强化面板 5 / 20', (await page.locator('[data-testid="enhance-level"]').textContent()).includes('5 / 20'))
  await shot(page, 'e-enhance')
  await page.locator('[data-testid="enhance-confirm"]').click()
  await page.waitForTimeout(500)
  check('强化后 6 / 20', (await page.locator('[data-testid="enhance-level"]').textContent()).includes('6 / 20'))
  await page.locator('.modal').getByRole('button', { name: '关闭' }).click()
  await page.waitForTimeout(300)
  check('卡面徽章更新 Lv6', (await e3card.locator('[data-testid="relic-level-badge"]').textContent()).trim() === 'Lv6')

  await page.locator('.relic-card', { has: page.locator('.r-name:text-is("暗物质微粒")') }).locator('[data-testid="equip-button"]').click()
  await page.waitForTimeout(200)
  await page.locator('.relic-card', { has: page.locator('.r-name:text-is("暗物质凝聚体")') }).locator('[data-testid="equip-button"]').click()
  await page.waitForTimeout(300)
  const row = page.locator('[data-testid="set-row-silencer"]')
  check('套装行 2/3 激活', (await row.locator('.set-count').textContent()).trim() === '2/3' && (await row.evaluate((el) => el.classList.contains('active'))))
  await shot(page, 'e-sets')

  await page.locator('[data-testid="select-mode-button"]').click()
  await page.waitForTimeout(200)
  const pick = async (name, nth = 0) => {
    const c = page.locator('.relic-card', { has: page.locator(`.r-name:text-is("${name}")`) }).nth(nth)
    await c.locator('[data-testid="select-material-button"]').click()
    await page.waitForTimeout(150)
  }
  await pick('能量碎片', 0)
  await pick('合金碎屑')
  await pick('数据碎片')
  check('材料槽 3 格全填', (await page.locator('.fusion-slot.filled').count()) === 3)
  await shot(page, 'e-fusion')
  await page.locator('[data-testid="fusion-button"]').click()
  await page.waitForTimeout(500)
  check('合成产物弹窗（稀有档）', (await page.locator('.modal [data-testid="synth-product-rare"]').count()) === 1)
  await shot(page, 'e-fusion-result')
  await page.locator('.modal').getByRole('button', { name: '确认' }).click()
  await page.waitForTimeout(400)
  check('合成后 7 → 5 卡', (await page.locator('.relic-card').count()) === 5)
  await page.context().close()
})

// ============ F. 编队特性 ============
await sec('F. 编队特性', async () => {
  const page = await seeded(browser, richSave(), '/army')
  await page.locator('.tabs .tab', { hasText: '编组' }).click()
  await page.waitForTimeout(400)
  await page.locator('[data-testid="trait-f1-logistics_doctrine"]').click()
  await page.waitForTimeout(300)
  check('后勤高亮', await page.locator('[data-testid="trait-f1-logistics_doctrine"]').evaluate((el) => el.classList.contains('active')))
  check('效果描述展开（+20%）', (await page.locator('[data-testid="trait-desc"]').textContent()).includes('+20%'))
  await shot(page, 'f-traits')
  await page.context().close()
})

// ============ G. 成就 ============
await sec('G. 成就', async () => {
  const page = await seeded(browser, richSave(), '/achievements')
  check('成就页 49 卡', (await page.locator('.ach-card').count()) === 49)
  await shot(page, 'g-achievements')
  await page.context().close()
})

// ============ H. 档案馆 ============
await sec('H. 档案馆', async () => {
  const page = await seeded(browser, richSave(), '/archive')
  check('星图档案 34 卡', (await page.locator('[data-testid="archive-story-card"]').count()) === 34)
  check('留档计数 10/34', (await page.locator('.count-lead').first().textContent()).replace(/\s/g, '').includes('10/34'))
  check('敌方档案 56 卡', (await page.locator('[data-testid="archive-enemy-card"]').count()) === 56)
  check('收录计数 2/56', (await page.locator('.count-lead').nth(1).textContent()).replace(/\s/g, '').includes('2/56'))
  await shot(page, 'h-archive')
  await page.context().close()
})

// ============ I. 每周强敌 ============
await sec('I. 每周强敌', async () => {
  const save = richSave({ combat: { garrisoned: {}, completed: ['silencer_3'], expeditionBest: 5, milestonesClaimed: [] } })
  const page = await seeded(browser, save, '/map')
  const open = page.locator('[data-testid="weekly-boss-open"]')
  check('周 Boss 卡开放态', await open.isVisible())
  await shot(page, 'i-boss-open')
  await open.click()
  await page.waitForURL('**/battle/weekly_boss', { timeout: 5000 })
  await page.waitForTimeout(600)
  check('战斗页 Boss 渲染（周强敌）', (await page.locator('.s-name').first().textContent()).includes('周强敌'))
  const deploy = page.locator('[data-testid="battle-start"]')
  check('出战按钮可用', !(await deploy.isDisabled()))
  await deploy.click()
  await page.waitForTimeout(800)
  const modal = page.locator('.modal')
  const victory = (await modal.count()) === 1 && (await modal.evaluate((el) => el.classList.contains('victory')))
  check('周 Boss 胜利（注档军对深度 6/7 必胜）', victory)
  if (victory) {
    await shot(page, 'i-boss-victory')
    await modal.getByRole('button', { name: '留在此据点' }).click()
    await page.waitForTimeout(500)
    await page.getByRole('button', { name: /返回星图/ }).click().catch(() => {})
    await page.waitForTimeout(700)
    check('星图卡已击败态', (await page.locator('[data-testid="weekly-boss-done"]').count()) === 1)
    await shot(page, 'i-boss-done')
  }
  await page.context().close()
})

// ============ J. 随机遭遇 ============
await sec('J. 随机遭遇', async () => {
  const seed = {
    version: 1,
    savedAt: Date.now(),
    player: { id: 'qa', name: '走查员' },
    totalPlayTime: 0,
    resources: { amounts: { energy: '50000', alloy: '2000', data: '300', dark: '4' }, totals: { energy: '50000', alloy: '2000', data: '300', dark: '4' } },
    buildings: { levels: {} },
    research: { completed: [] },
    military: { owned: { assault: 10 }, training: [], formations: [{ id: 'f1', name: '一队', units: { assault: 10 } }] },
    combat: { garrisoned: {}, completed: [] },
    exploration: { progress: {} },
    relics: { owned: [], equipped: [] },
    transcend: { negativeEntropy: '0', totalTranscends: 0, tree: [] },
    daily: { lastCheckIn: TODAY, streak: 1, weeklyCounters: { battles: 0, explores: 0, researches: 0, upgrades: 0, transcends: 0, expedition: 0, synths: 0, enhances: 0, garrisonHours: 0 }, challengeWeek: '', weekChallenges: [] },
    encounters: { nextTriggerAt: Date.now() - 1000 },
  }
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await ctx.addInitScript(() => {
    Math.random = () => 0
  })
  await ctx.addInitScript(injectSave, savePayload(seed))
  const page = await ctx.newPage()
  wire(page)
  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded' })
  const card = page.locator('[data-testid="encounter-card"]')
  await card.waitFor({ state: 'visible', timeout: 8000 })
  check('遭遇事件卡触发', (await card.textContent()).includes('遭遇事件'))
  await page.waitForSelector('.toast', { timeout: 5000 })
  check('触发提醒 toast', (await page.textContent('.toast')).trim() === '遭遇事件')
  await page.waitForTimeout(300)
  await shot(page, 'j-encounter')
  await page.click('[data-testid="encounter-opt-A"]')
  await card.waitFor({ state: 'detached', timeout: 5000 })
  await page.waitForTimeout(900)
  check('结算回执 toast（能量涌流）', (await page.textContent('.toast')).includes('能量涌流'))
  await shot(page, 'j-encounter-receipt')
  await ctx.close()
})

// ============ K. 派遣远征（含离线归来） ============
await sec('K. 派遣远征', async () => {
  const save = richSave({ combat: { garrisoned: {}, completed: ['silencer_3'], expeditionBest: 5, milestonesClaimed: [] } })
  const page = await seeded(browser, save, '/army')
  await page.locator('.tab', { hasText: '编组' }).first().click()
  await page.waitForTimeout(400)
  check('派遣区解锁渲染', (await page.locator('[data-testid="dispatch-f1"]').count()) === 1)
  await page.click('[data-testid="dispatch-tier-f1-4"]')
  await page.waitForTimeout(200)
  await shot(page, 'k-dispatch')
  await page.click('[data-testid="dispatch-send-f1"]')
  await page.waitForTimeout(400)
  const st = page.locator('[data-testid="dispatch-state-f1"]')
  check('派出后倒计时（归来剩余）', (await st.textContent()).includes('归来剩余'))
  await shot(page, 'k-dispatch-active')
  await page.click('[data-testid="dispatch-recall-f1"]')
  await page.waitForTimeout(500)
  check('召回后解除派遣态', (await page.locator('[data-testid="dispatch-state-f1"]').count()) === 0)
  await page.context().close()

  const seed2 = richSave({ combat: { garrisoned: {}, completed: ['silencer_3'], expeditionBest: 5, milestonesClaimed: [] } })
  seed2.savedAt = Date.now() - 5 * HOUR
  seed2.buildings = { levels: {} }
  seed2.resources.amounts.energy = '50000'
  seed2.resources.totals.energy = '50000'
  seed2.military.dispatches = { f2: { hours: 4, startTime: Date.now() - 4 * HOUR - 5000 } }
  const page2 = await seeded(browser, seed2, '/', { waitMs: 1500 })
  const body2 = await page2.evaluate(() => document.body.innerText)
  check('离线报告含派遣归来区块', body2.includes('派遣归来'))
  check('离线结算金额入账（66.4M 口径）', /66\.4/.test(body2))
  await shot(page2, 'k-offline')
  await page2.locator('button', { hasText: '继续' }).first().click().catch(() => {})
  await page2.waitForTimeout(500)
  await page2.context().close()
})

// ============ L. 签到 / 周期挑战 ============
await sec('L. 签到 / 周期挑战', async () => {
  const save = richSave()
  save.daily = {
    lastCheckIn: TODAY,
    streak: 3,
    weeklyCounters: { battles: 5, explores: 0, researches: 0, upgrades: 0, transcends: 0, expedition: 0, synths: 0, enhances: 0, garrisonHours: 0 },
    challengeWeek: THIS_WEEK,
    weekChallenges: [
      { templateId: 'wk_battles', kind: 'battles', tier: 0, target: 5, rewardDark: 3, claimed: false },
      { templateId: 'wk_expedition', kind: 'expedition', tier: 0, target: 2, rewardDark: 3, claimed: false },
      { templateId: 'wk_garrison', kind: 'garrisonHours', tier: 0, target: 20, rewardDark: 3, claimed: false },
    ],
  }
  const page = await seeded(browser, save, '/')
  check('每日卡渲染（连击 3 天）', (await page.locator('[data-testid="checkin-badge"]').textContent()).includes('连击 3 天'))
  check('挑战行 3 条', (await page.locator('.challenge-row').count()) === 3)
  check('达标挑战进度 5/5', (await page.locator('[data-testid="challenge-wk_battles"] .c-count').textContent()).trim() === '5/5')
  await shot(page, 'l-daily')
  await page.locator('[data-testid="claim-wk_battles"]').click()
  await page.waitForTimeout(500)
  check('领取后已领取态', (await page.locator('[data-testid="challenge-wk_battles"] .c-claimed').count()) === 1)
  await shot(page, 'l-daily-claimed')
  await page.context().close()
})

// ============ M. 转生 ============
await sec('M. 转生', async () => {
  const page = await seeded(browser, richSave(), '/prestige')
  await shot(page, 'm-prestige')
  const btn = page.locator('.btn-transcend')
  check('转生按钮可用', !(await btn.isDisabled()))
  await btn.click()
  await page.waitForTimeout(500)
  await page.locator('.btn-accent:visible').last().click()
  await page.waitForTimeout(1500)
  // 转生仪式（v1.55）：确认后全屏演出，点击关闭再截转生后状态（overlay 会盖画面）
  check('转生仪式出现', (await page.locator('.ceremony-overlay').count()) === 1)
  await page.locator('.ceremony-overlay').click()
  await page.waitForTimeout(300)
  await shot(page, 'm-prestige-after')
  await page.waitForTimeout(14000)
  const st = await page.evaluate(() => {
    try {
      const d = JSON.parse(JSON.parse(localStorage.getItem('starcore_save_v1_backup')).d)
      return { t: d.transcend.totalTranscends, tree: d.transcend.tree.length, energy: d.resources.amounts.energy, best: d.combat.expeditionBest }
    } catch {
      return null
    }
  })
  check(`转生落库（次数 3→4，实际 ${st && st.t}）`, st !== null && st.t === 4)
  check(`转生保留树与远征档案（tree ${st && st.tree} / best ${st && st.best}）`, st !== null && st.tree >= 1 && st.best === 25)
  check(`转生后资源重置（energy ${st && st.energy}）`, st !== null && Number(st.energy) < 1e6)
  await page.context().close()
})

// ============ N. 设置：双语 / 导出 / 导入 ============
await sec('N. 设置：双语 / 导出 / 导入', async () => {
  const page = await seeded(browser, richSave(), '/settings', { waitMs: 1200 })
  check('设置页渲染（存档面板 + 语言区块）', (await page.locator('.save-section').count()) === 1 && (await page.locator('.lang-list').count()) === 1)
  await shot(page, 'n-settings')

  await page.locator('.lang-list .lang-item', { hasText: 'English' }).click()
  await page.waitForTimeout(1400)
  check('切换英文 html lang=en', (await page.evaluate(() => document.documentElement.lang)) === 'en')
  check('英文界面（侧栏 Build）', (await page.locator('.side-nav').innerText()).includes('Build'))
  await shot(page, 'n-settings-en')
  await page.locator('.lang-list .lang-item', { hasText: '简体中文' }).click()
  await page.waitForTimeout(1400)
  check('切回中文 html lang=zh-CN', (await page.evaluate(() => document.documentElement.lang)) === 'zh-CN')

  await page.locator('button', { hasText: '导出存档' }).first().click()
  await page.waitForTimeout(600)
  const codeVal = await page.locator('.export-fallback textarea').inputValue().catch(() => '')
  check('导出码展示（SCB1- 前缀）', codeVal.startsWith('SCB1-'))
  await shot(page, 'n-export')

  // 先在浏览器侧取档并改写字段，回 Node 侧构造导入码（签名函数只存在于 Node 侧）
  const patchedJson = await page.evaluate(() => {
    const raw = localStorage.getItem('starcore_save_v1_backup')
    const d = JSON.parse(JSON.parse(raw).d)
    d.transcend.totalTranscends = 0
    d.player.name = '走查员·导入'
    return JSON.stringify(d)
  })
  const code0 = saveCode(patchedJson)
  await page.locator('.import-box textarea').fill(code0)
  await page.locator('button', { hasText: '导入存档' }).first().click()
  await page.waitForTimeout(400)
  check('导入二次确认弹窗', (await page.locator('[role="dialog"]').count()) > 0)
  await shot(page, 'n-import-confirm')
  await page.locator('button', { hasText: '确认导入' }).first().click()
  await page.waitForTimeout(1500)
  const after = await page.evaluate(() => {
    try {
      return JSON.parse(JSON.parse(localStorage.getItem('starcore_save_v1_backup')).d).transcend.totalTranscends
    } catch {
      return null
    }
  })
  check(`导入替换生效（totalTranscends 3→0，实际 ${after}）`, after === 0)
  await page.context().close()
})

// ============ AUTO. 自动化协议（建造+研究+探索） ============
await sec('AUTO. 自动化协议', async () => {
  const save = richSave()
  save.resources.amounts = { energy: '1000000000000', crystal: '1000000000', alloy: '1000000000', data: '1000000000', dark: '1000000' }
  save.resources.totals = { energy: '2000000000000', crystal: '2000000000', alloy: '2000000000', data: '2000000000', dark: '2000000' }
  save.buildings = { levels: { solar_collector: 10 } }
  save.transcend.tree = [
    { id: 't_auto_build', level: 1 },
    { id: 't_auto_research', level: 1 },
    { id: 't_auto_explore', level: 1 },
  ]
  const page = await seeded(browser, save, '/map', { waitMs: 1500 })
  check('探索协议徽标（星图）', (await page.locator('.auto-badge').count()) === 1)
  await page.waitForTimeout(3500)
  const exploringN = await page.locator('.node-card.exploring').count()
  check(`探索协议自动开工（进行中 ${exploringN} 个节点）`, exploringN >= 1)
  await shot(page, 'auto-map')

  await navTo(page, '建造', 800)
  check('建造协议徽标（建造页）', (await page.locator('.auto-badge').count()) === 1)
  const bcard = page.locator('.build-card').filter({ hasText: '光能收集器' }).first()
  const lvOf = async () => Number(((await bcard.locator('.b-level').textContent()).match(/Lv\.(\d+)/) || [])[1] || 0)
  const lv1 = await lvOf()
  await page.waitForTimeout(3000)
  const lv2 = await lvOf()
  check(`建造协议自动升级（Lv.${lv1} → Lv.${lv2}）`, lv2 > lv1)
  await shot(page, 'auto-build')

  await navTo(page, '科技树', 800)
  await page.getByText('所有已知科技已研究完成').waitFor({ timeout: 12000 }).catch(() => {})
  check('研究协议自动补完留白科技（空态）', (await page.getByText('所有已知科技已研究完成').count()) > 0)
  await shot(page, 'auto-tech')
  await page.context().close()
})

// ============ O. 移动端全路由（375px） ============
await sec('O. 移动端全路由', async () => {
  const page = await seeded(browser, richSave(), '/', { viewport: { width: 375, height: 812 }, waitMs: 800 })
  const routes = [['/', 'home'], ['/build', 'build'], ['/tech', 'tech'], ['/map', 'map'], ['/army', 'army'], ['/battle/raider_1', 'battle'], ['/relic', 'relic'], ['/prestige', 'prestige'], ['/achievements', 'achievements'], ['/archive', 'archive'], ['/settings', 'settings']]
  for (const [r, name] of routes) {
    await page.goto(BASE_URL + r, { waitUntil: 'networkidle' })
    await page.waitForTimeout(450)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    check(`移动端 ${name} 无横向溢出（${overflow}px）`, overflow <= 1)
    await shot(page, `mobile-${name}`)
  }
  await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.locator('.bottom-nav .tab', { hasText: '更多' }).first().click()
  await page.waitForTimeout(300)
  const moreText = await page.locator('.more-panel').innerText()
  check('更多面板含遗物/奇点重启/成就/档案馆/设置', ['遗物', '奇点重启', '成就', '档案馆', '设置'].every((x) => moreText.includes(x)))
  await shot(page, 'mobile-more')
  await page.locator('.more-item', { hasText: '档案馆' }).click()
  await page.waitForTimeout(600)
  check('更多面板跳转档案馆', page.url().includes('/archive'))
  await page.context().close()
})

// ============ P. 桌面全路由截图巡检（1280px） ============
await sec('P. 桌面全路由巡检', async () => {
  const page = await seeded(browser, richSave(), '/', { waitMs: 800 })
  const routes = [['/', 'home'], ['/build', 'build'], ['/tech', 'tech'], ['/map', 'map'], ['/army', 'army'], ['/battle/raider_1', 'battle'], ['/relic', 'relic'], ['/prestige', 'prestige'], ['/achievements', 'achievements'], ['/archive', 'archive'], ['/settings', 'settings']]
  for (const [r, name] of routes) {
    await page.goto(BASE_URL + r, { waitUntil: 'networkidle' })
    await page.waitForTimeout(450)
    await shot(page, `desktop-${name}`)
  }
  check('桌面巡检 11 路由截图完成', true)
  await page.context().close()
})

// ============ Q. 收尾：异常汇总 ============
console.log('== Q. 收尾 ==')
const uniq = [...new Set(errors)]
for (const e of uniq.slice(0, 30)) console.log('异常：' + e)
check(`全程 console/pageerror/HTTP≥400 零命中（实计 ${uniq.length}）`, uniq.length === 0)
console.log(`截图目录：${OUT}`)
await finish(browser)
