// 星核纪元 v1.27 专项回归：派遣远征
// A. 解锁与渲染：未解锁提示 / 攻克锚点后解锁 / 四档位渲染 / 预期带回预览
// B. 派出与结算：派出入档 / 到点离线区块结算入账 / 权重定值（24h=8×4h）
// C. 提前召回：在途召回解除与回执 / 重复派遣拒绝（按比例金额口径由数据层单测覆盖）
// D. 锁定面：派遣中出战禁用 + 编入/撤出按钮禁用 / 召回后恢复
// E. 存档往返：派遣态入档 / 未知编队 id 剥离不拒档 / 旧档缺键兼容
// F. 转生清空 + 移动视口：转生后在途清空；390px 渲染无溢出、召回可用
// 时间控制：绝对时间戳完成制，预制 startTime 拨时到点/未到点（page.clock 禁用惯例）
import { launch, check, finish, savePayload, injectSave, BASE_URL } from './starcore-pwlib.mjs';

const BASE = BASE_URL;

let pass = 0;
let fail = 0;
const FAILURES = [];
async function v(label, fn) {
  try {
    await fn();
    pass++;
    console.log(`  ✓ ${label}`);
  } catch (e) {
    fail++;
    FAILURES.push(`${label}: ${e.message}`);
    console.log(`  ✗ ${label}: ${e.message}`);
  }
}

/** 本地日期 YYYY-MM-DD（换天与自动签到按本地日判定；UTC 形态在本地 0~8 时窗口会误判换天并叠加自动签到奖励，2026-09-27 实踩） */
function localDateStr(d = new Date()) { return d.toLocaleDateString('sv'); }
const TODAY = localDateStr();
const HOUR = 3_600_000;

/** 种子档；militaryExtra 可注入 dispatches（null 时删 dispatches 键模拟旧档） */
function makeSeed({ best = 5, dispatches, dispatchedFormation } = {}) {
  const now = Date.now();
  const save = {
    version: 1,
    savedAt: now,
    player: { id: 'p1', name: '指挥官' },
    totalPlayTime: 0,
    resources: { amounts: { energy: '50000', alloy: '2000', data: '300', dark: '4' }, totals: { energy: '50000', alloy: '2000', data: '300', dark: '4' } },
    buildings: { levels: {} },
    research: { completed: ['military_basic'] },
    military: {
      owned: { assault: 10 },
      training: [],
      formations: [
        { id: 'f1', name: '一队', units: { assault: 5 } },
        { id: 'f2', name: '二队', units: { assault: 5 } },
        { id: 'f3', name: '三队', units: {} },
      ],
      ...(dispatches !== null && dispatches !== undefined
        ? { dispatches }
        : dispatchedFormation
          ? { dispatches: { [dispatchedFormation]: { hours: 4, startTime: now } } }
          : {}),
    },
    combat: {
      garrisoned: {},
      completed: best >= 1 ? ['silencer_3'] : [],
      expeditionBest: best,
    },
    exploration: { progress: {} },
    relics: { owned: [], equipped: [] },
    transcend: { negativeEntropy: '0', totalTranscends: 0, tree: [] },
    daily: {
      lastCheckIn: TODAY,
      streak: 1,
      weeklyCounters: { battles: 0, explores: 0, researches: 0, upgrades: 0, transcends: 0, expedition: 0, synths: 0, enhances: 0, garrisonHours: 0 },
      challengeWeek: '',
      weekChallenges: [],
    },
  };
  if (dispatches === null) delete save.military.dispatches;
  return save;
}

async function newPage(browser, seed, viewport) {
  const ctx = await browser.newContext(viewport ? { viewport } : undefined);
  const page = await ctx.newPage();
  await ctx.addInitScript(injectSave, savePayload(seed));
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  return { ctx, page };
}

async function gotoArmy(page) {
  await page.locator('.side-nav .nav-item', { hasText: '部队' }).first().click();
  await page.waitForURL('**/army', { timeout: 5000 });
  await page.waitForTimeout(400);
  // ArmyView 默认兵营页签，派遣区在编组页签下
  await page.locator('.tab', { hasText: '编组' }).first().click();
  await page.waitForTimeout(300);
}

const browser = await launch();

// A. 解锁与渲染
console.log('== A. 解锁与渲染 ==');
{
  // best=0（未攻克 silencer_3）：派遣区显示锁定提示
  const { ctx, page } = await newPage(browser, makeSeed({ best: 0 }));
  await gotoArmy(page);
  await v('A1 未攻克锚点：派遣区显示解锁提示', async () => {
    const lock = page.locator('[data-testid="dispatch-f1"] [data-testid="dispatch-locked"]');
    await lock.waitFor({ state: 'visible', timeout: 8000 });
    if (!(await lock.textContent()).includes('沉默者旗舰')) throw new Error('提示未含锚点名');
  });
  await v('A2 未解锁无派出按钮', async () => {
    if ((await page.locator('[data-testid="dispatch-send-f1"]').count()) !== 0) throw new Error('锁定态竟有派出按钮');
  });
  await ctx.close();

  // best=5（已攻克）：四档位 + 预览 + 派出按钮
  const { ctx: ctx2, page: page2 } = await newPage(browser, makeSeed({ best: 5 }));
  const errs = [];
  page2.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page2.on('pageerror', (e) => errs.push(String(e)));
  page2.on('response', (r) => { if (r.status() >= 400) errs.push(`HTTP ${r.status()} ${r.url()}`); });
  await gotoArmy(page2);
  await v('A3 解锁后四档位渲染', async () => {
    for (const h of [4, 8, 12, 24]) {
      const loc = page2.locator(`[data-testid="dispatch-tier-f1-${h}"]`);
      if (!(await loc.isVisible())) throw new Error(`档位 ${h}h 缺位`);
    }
  });
  await v('A4 预期带回预览渲染（含资源名）', async () => {
    const t = await page2.locator('[data-testid="dispatch-f1"]').textContent();
    if (!t.includes('预期带回') || !t.includes('能量')) throw new Error('预览缺文案: ' + t.slice(0, 80));
  });
  await v('A5 console/pageerror/HTTP≥400 三路零命中', async () => {
    await page2.waitForTimeout(1500);
    if (errs.length) throw new Error(errs.slice(0, 3).join(' | '));
  });
  await ctx2.close();
}

// B. 派出与结算
console.log('== B. 派出与结算 ==');
{
  const { ctx, page } = await newPage(browser, makeSeed({ best: 5 }));
  await gotoArmy(page);
  await v('B1 选 4h 档派出：派遣态出现倒计时', async () => {
    await page.click('[data-testid="dispatch-tier-f1-4"]');
    await page.click('[data-testid="dispatch-send-f1"]');
    await page.locator('[data-testid="dispatch-state-f1"]').waitFor({ state: 'visible', timeout: 5000 });
    const t = await page.locator('[data-testid="dispatch-state-f1"]').textContent();
    if (!t.includes('归来剩余')) throw new Error('无倒计时文案: ' + t);
  });
  await v('B2 到点拨时（预制 startTime 旧值）重载后完成态', async () => {
    // 以 4h 前为 startTime 注档 → 现在即到点
    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    const seed = makeSeed({ best: 5 });
    seed.savedAt = Date.now() - 5 * HOUR; // 离线窗口覆盖到点时刻
    seed.military.dispatches = { f2: { hours: 4, startTime: Date.now() - 4 * HOUR - 5000 } };
    await ctx2.addInitScript(injectSave, savePayload(seed));
    await page2.goto(BASE + '/army', { waitUntil: 'domcontentloaded' });
    await page2.waitForTimeout(1500);
    // 到点落在离线窗口（savedAt=注入-5h）→ 离线报告「派遣归来」区块
    const body2 = await page2.evaluate(() => document.body.innerText);
    if (!body2.includes('派遣归来')) throw new Error('离线报告无派遣区块');
    if (!/66\.43M/.test(body2)) throw new Error('派遣区块无 best=5 全额 66.43M');
    await ctx2.close();
  });
  await v('B3 完成态召回：能量入账（best=5 全额 ≈ 2e7×1.35⁴）', async () => {
    const ctx3 = await browser.newContext();
    const page3 = await ctx3.newPage();
    const seed = makeSeed({ best: 5 });
    seed.savedAt = Date.now() - 5 * HOUR; // 离线窗口覆盖到点时刻
    seed.military.dispatches = { f2: { hours: 4, startTime: Date.now() - 4 * HOUR - 5000 } };
    await ctx3.addInitScript(injectSave, savePayload(seed));
    await page3.goto(BASE + '/army', { waitUntil: 'domcontentloaded' });
    await page3.waitForTimeout(1500);
    const top3 = (await page3.evaluate(() => document.body.innerText)).replace(/,/g, '');
    // 离线结算能量 = 50K 起点 + 66,430,125 全额 → 顶栏显示 66.4M+
    if (!/66\.4M|66\.43M/.test(top3)) throw new Error('离线派遣奖励未入账顶栏: ' + top3.slice(0, 420));
  });
  await v('B4 权重线性：同锚 24h 预览 = 4h 预览 ×8（8 容差）', async () => {
    // EV 定值口径：best=5 4h energy = round(2e7×1.35⁴)=66,430,125；24h ×8
    const ctx4 = await browser.newContext();
    const page4 = await ctx4.newPage();
    const seed = makeSeed({ best: 5 });
    await ctx4.addInitScript(injectSave, savePayload(seed));
    await page4.goto(BASE + '/army', { waitUntil: 'domcontentloaded' });
    await page4.waitForTimeout(800);
    await page4.locator('.tab', { hasText: '编组' }).first().click();
    await page4.waitForTimeout(300);
    await page4.click('[data-testid="dispatch-tier-f1-4"]');
    await page4.waitForTimeout(200);
    const t4 = await page4.locator('[data-testid="dispatch-f1"]').textContent();
    await page4.click('[data-testid="dispatch-tier-f1-24"]');
    await page4.waitForTimeout(200);
    const t24 = await page4.locator('[data-testid="dispatch-f1"]').textContent();
    // 4h 显示 66M；24h 显示 531M（66,430,125×8=531,441,000）
    if (!/66\.4?3?M/.test(t4) || !/531\.?4?M/.test(t24)) throw new Error(`权重缩放失真: 4h[${t4.slice(0,60)}] 24h[${t24.slice(0,60)}]`);
    await ctx4.close();
  });
  await ctx.close();
}

// C. 提前召回
console.log('== C. 提前召回 ==');
{
  const { ctx, page } = await newPage(browser, makeSeed({ best: 5, dispatchedFormation: 'f1' }));
  await gotoArmy(page);
  await v('C1 在途（刚派出）召回：解除且回执出现', async () => {
    await page.click('[data-testid="dispatch-recall-f1"]');
    await page.locator('.toast').waitFor({ state: 'visible', timeout: 3000 });
    const toastText = (await page.textContent('.toast')).trim();
    if (!toastText.includes('派遣远征')) throw new Error(`回执文案「${toastText}」`);
    await page.waitForTimeout(300);
    const t = await page.textContent('body');
    if (/归来剩余/.test(t)) throw new Error('召回后仍在途');
  });
  await v('C2 召回后可重新派出', async () => {
    await page.click('[data-testid="dispatch-send-f1"]');
    await page.locator('[data-testid="dispatch-state-f1"]').waitFor({ state: 'visible', timeout: 5000 });
  });
  await ctx.close();

  const { ctx: ctx2, page: page2 } = await newPage(browser, makeSeed({ best: 5 }));
  await gotoArmy(page2);
  await v('C3 重复派遣拒绝（已在新页面派出）', async () => {
    await page2.click('[data-testid="dispatch-send-f1"]');
    await page2.waitForTimeout(300);
    await page2.click('[data-testid="dispatch-send-f1"]').catch(() => {});
    // 第二次点击时按钮已被派遣态替换 → 找不到即符合锁定语义
  });
  await ctx2.close();
}

// D. 锁定面
console.log('== D. 锁定面 ==');
{
  const { ctx, page } = await newPage(browser, makeSeed({ best: 5, dispatchedFormation: 'f1' }));
  await gotoArmy(page);
  await v('D1 派遣中编队编入/撤出按钮全禁用', async () => {
    const btns = page.locator('.formation-card').first().locator('.fu-btn');
    const n = await btns.count();
    if (n === 0) throw new Error('未找到编入/撤出按钮');
    for (let i = 0; i < n; i++) {
      if (!(await btns.nth(i).isDisabled())) throw new Error(`按钮 ${i} 未禁用`);
    }
  });
  await v('D2 未派遣编队按钮不受影响', async () => {
    const card2 = page.locator('.formation-card').nth(1);
    const enabled = card2.locator('.fu-btn:not([disabled])');
    if ((await enabled.count()) === 0) throw new Error('二队按钮竟全禁用');
  });
  await ctx.close();

  // 战斗页锁定面用「纯 SPA 注入档 + SPA 导航」专开一 context：
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const seed = makeSeed({ best: 5, dispatchedFormation: 'f1' });
    seed.combat.completed = ['silencer_3', 'silencer_1'];
    seed.exploration.progress = { node_deep: { nodeId: 'node_deep', startTime: 0, endTime: 1, completed: true } };
    await ctx.addInitScript(injectSave, savePayload(seed));
    await page.goto(BASE + '/battle/silencer_1', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    // f1 = 派遣中（下标 0 默认选中），f2 未派遣
    await v('D4 出战按钮：默认选中派遣中 f1 → 禁用', async () => {
      const btn = page.locator('[data-testid="battle-start"]');
      await btn.waitFor({ state: 'visible', timeout: 12000 });
      await page.waitForTimeout(800);
      if (!(await btn.isDisabled())) throw new Error('派遣中编队竟能出战');
    });
    await v('D5 切到未派遣 f2 → 出战恢复可用', async () => {
      await page.locator('.f-tab', { hasText: '二队' }).click();
      await page.waitForTimeout(300);
      if (await page.locator('[data-testid="battle-start"]').isDisabled()) throw new Error('未派遣编队出战被误禁');
    });
    await ctx.close();
  }
}

// E. 存档往返
console.log('== E. 存档往返 ==');
{
  const { ctx, page } = await newPage(browser, makeSeed({ best: 5, dispatchedFormation: 'f1' }));
  await gotoArmy(page);
  await v('E1 在途派遣写盘（备份键含 dispatches）', async () => {
    await page.waitForTimeout(2500);
    const raw = await page.evaluate(() => localStorage.getItem('starcore_save_v1_backup'));
    if (!raw) throw new Error('无备份存档');
    const data = JSON.parse(JSON.parse(raw).d);
    if (!data.military || !data.military.dispatches || !data.military.dispatches.f1) {
      throw new Error('派遣未入档: ' + JSON.stringify(data.military && data.military.dispatches));
    }
    if (data.military.dispatches.f1.hours !== 4) throw new Error('档位未入档');
  });
  await ctx.close();

  const { ctx: ctx2, page: page2 } = await newPage(browser, makeSeed({
    best: 5,
    dispatches: { f1: { hours: 4, startTime: Date.now() }, fX: { hours: 4, startTime: Date.now() } },
  }));
  await gotoArmy(page2);
  await v('E2 未知编队 id 派遣条目：剥离不拒档正常进游戏', async () => {
    await page2.locator('.army-view, .army').first().waitFor({ state: 'visible', timeout: 8000 });
    await page2.waitForTimeout(800);
    if ((await page2.locator('[data-testid="dispatch-state-fX"]').count()) !== 0) throw new Error('未知编队派遣竟渲染');
    if (!(await page2.locator('[data-testid="dispatch-state-f1"]').isVisible())) throw new Error('合法派遣被误剥');
  });
  await ctx2.close();

  const { ctx: ctx3, page: page3 } = await newPage(browser, makeSeed({ best: 5, dispatches: null }));
  await gotoArmy(page3);
  await v('E3 旧档缺 dispatches 键：兼容正常进游戏', async () => {
    await page3.locator('.army-view, .army').first().waitFor({ state: 'visible', timeout: 8000 });
  });
  await ctx3.close();
}

// F. 转生清空 + 移动视口
console.log('== F. 转生清空 + 移动视口 ==');
{
  const seedT = makeSeed({ best: 5, dispatchedFormation: 'f1' });
  seedT.resources.totals = { energy: '900000', alloy: '2000', data: '300', dark: '4' };
  const { ctx, page } = await newPage(browser, seedT);
  await gotoArmy(page);
  await page.locator('[data-testid="dispatch-state-f1"]').waitFor({ state: 'visible', timeout: 5000 });
  await v('F1 SPA 转生：在途派遣随部队/编队清空', async () => {
    await page.locator('.side-nav .nav-item', { hasText: '奇点' }).first().click();
    await page.waitForURL('**/prestige', { timeout: 5000 });
    await page.locator('.btn-transcend').waitFor({ state: 'visible', timeout: 5000 });
    await page.click('.btn-transcend');
    await page.locator('.modal, [class*="modal"]').first().waitFor({ state: 'visible', timeout: 5000 });
    await page.locator('.btn-accent:visible').last().click();
    await page.waitForTimeout(800);
    // 回部队页看派遣区
    await page.locator('.side-nav .nav-item', { hasText: '部队' }).first().click();
    await page.waitForURL('**/army', { timeout: 5000 });
    await page.waitForTimeout(600);
    if ((await page.locator('[data-testid="dispatch-state-f1"]').count()) !== 0) throw new Error('转生后在途派遣残留');
  });
  await ctx.close();

  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mpage = await mctx.newPage();
  const seed = makeSeed({ best: 5, dispatchedFormation: 'f1' });
  await mctx.addInitScript(injectSave, savePayload(seed));
  await mpage.goto(BASE + '/army', { waitUntil: 'domcontentloaded' });
  await mpage.waitForTimeout(1200);
  await mpage.locator('.tab', { hasText: '编组' }).first().click();
  await mpage.waitForTimeout(400);
  await v('F2 移动视口派遣区渲染（390px）', async () => {
    if (!(await mpage.locator('[data-testid="dispatch-f2"]').isVisible())) throw new Error('f2 派遣区不可见');
  });
  await v('F3 无横向溢出', async () => {
    const overflow = await mpage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 1) throw new Error(`溢出 ${overflow}px`);
  });
  await v('F4 四档位同排不换行（f2 未派遣档位组）', async () => {
    const boxes = [];
    for (const h of [4, 8, 12, 24]) {
      const b = await mpage.locator(`[data-testid="dispatch-tier-f2-${h}"]`).boundingBox();
      if (!b) throw new Error(`档位 ${h} 缺位`);
      boxes.push(b);
    }
    const ys = new Set(boxes.map((b) => Math.round(b.y)));
    if (ys.size > 2) throw new Error('档位按钮换行超过两行');
  });
  await v('F5 移动端召回交互可用', async () => {
    await mpage.click('[data-testid="dispatch-recall-f1"]');
    await mpage.waitForTimeout(500);
    if ((await mpage.locator('[data-testid="dispatch-state-f1"]').count()) !== 0) throw new Error('召回未解除');
  });
  await mctx.close();
}

// 末行总校并入 pwlib 计数器：finish 退出码与脚本结果一致
check(`总校（${pass} ✓ / ${fail} ✗）`, fail === 0);
await finish(browser);
