// 星核纪元 v1.24 专项回归：每周强敌（周 Boss）
// A. 全新档：/map 周 Boss 卡锁定态 + 直访 /battle/weekly_boss 不崩（console 双路监听）
// B. 解锁档（未击败）：/map 卡可点击态 + 考题与奖励预览；战斗页渲染 Boss 编成、隐藏驻扎与深度面板
// C. 击败流：出战胜利 → 记账 → /map 卡已击败态；再入战斗页出战禁用换文案
// D. 已击败注档三态：本周标记禁战；旧档缺键可战；跨周旧标记失效可战
// E. 战损与常规面：缩编出战损失区渲染；常规据点驻扎按钮不回归
// F. 移动视口（390px）：星图与战斗页无横向溢出
import { launch, check, finish, newSeededPage, BASE_URL } from './starcore-pwlib.mjs';
import fs from 'node:fs';

const BASE = BASE_URL;
fs.mkdirSync('/tmp/v124-suite', { recursive: true });

function weekStr(d = new Date()) {
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayNum = (t.getDay() + 6) % 7;
  t.setDate(t.getDate() - dayNum + 3);
  const isoYear = t.getFullYear();
  const firstThursday = new Date(isoYear, 0, 4);
  const fDayNum = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - fDayNum + 3);
  const week = 1 + Math.round((t.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

function localDateStr(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const THIS_WEEK = weekStr();
const TODAY = localDateStr();
const ALL_NODES = [
  'node_orbit', 'node_inner', 'node_outer', 'node_deep',
  'node_stellar_gate', 'node_stellar_mine', 'node_stellar_forge',
  'node_stellar_dead', 'node_stellar_core', 'node_stellar_edge',
];
const UNLOCK_NODES = ALL_NODES; // 沉默者旗舰需 node_stellar_edge 完成
const ARMY_FULL = { assault: 3000, guard: 2000, heavy: 2000, psionic: 1000 };
const ARMY_TRIM = { assault: 1000, guard: 600, heavy: 600, psionic: 300 };

function makeSave({
  completedNodes = [],
  completedStrongholds = [],
  expeditionBest,
  weeklyBoss,
  withDaily = false,
  army = 'full',
  research = ['military_basic', 'adv_units'],
} = {}) {
  const progress = {};
  for (const id of completedNodes) {
    progress[id] = { nodeId: id, startTime: 1, endTime: 2, completed: true };
  }
  const units = army === 'full' ? ARMY_FULL : ARMY_TRIM;
  const zero = { assault: 0, guard: 0, heavy: 0, psionic: 0 };
  const combat = { garrisoned: {}, completed: completedStrongholds };
  // expeditionBest === undefined 时不写字段（模拟 v0.59 旧档）
  if (expeditionBest !== undefined) combat.expeditionBest = expeditionBest;
  const save = {
    version: 1,
    savedAt: Date.now(),
    player: { id: 'test', name: '测试' },
    totalPlayTime: 0,
    resources: {
      amounts: { energy: '1000000000', crystal: '1000000', alloy: '1000000', data: '1000000', dark: '500' },
      totals: { energy: '1000000000', crystal: '1000000', alloy: '1000000', data: '1000000', dark: '500' },
    },
    buildings: { levels: {} },
    research: { completed: research },
    military: {
      owned: { ...units },
      training: [],
      formations: [
        { id: 'f1', name: '先锋编队', units: { ...units } },
        { id: 'f2', name: '第二编队', units: { ...zero } },
        { id: 'f3', name: '第三编队', units: { ...zero } },
      ],
    },
    combat,
    exploration: { progress },
    relics: { owned: [], equipped: [null, null, null, null] },
    transcend: { negativeEntropy: '0', totalTranscends: 1, tree: [] },
    achievements: {
      lifetime: { energy: '0', dark: '0', upgrades: 0, maxBuildingLevel: 0, researches: 0, explores: 0, battles: 0 },
      unlocked: {},
    },
  };
  if (withDaily || weeklyBoss !== undefined) {
    // v0.62 合法形态；weeklyBoss === undefined 时不写字段（模拟 v1.23 旧档）
    const daily = {
      lastCheckIn: TODAY,
      streak: 1,
      weeklyCounters: {
        battles: 0, explores: 0, researches: 0, upgrades: 0, transcends: 0,
        expedition: 0, synths: 0, enhances: 0, garrisonHours: 0,
      },
      challengeWeek: THIS_WEEK,
      weekChallenges: [],
    };
    if (weeklyBoss !== undefined) daily.weeklyBoss = weeklyBoss;
    save.daily = daily;
  }
  return save;
}

const browser = await launch();

// —— A. 全新档：锁定态 + 直访不崩 ——
console.log('== A. 全新档：周 Boss 卡锁定 + 直访战斗页不崩 ==');
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript((s) => localStorage.setItem('starcore_onboarding', JSON.stringify(s)), {});
  const page = await ctx.newPage();
  const consoleErrs = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrs.push(m.text()); });
  page.on('pageerror', (e) => consoleErrs.push(String(e)));
  await page.goto(BASE + '/map', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const locked = page.locator('[data-testid="weekly-boss-locked"]');
  check('A1 新档周 Boss 卡锁定态可见', await locked.isVisible());
  check('A2 锁定态禁用', await locked.isDisabled());
  check('A3 锁定文案', (await locked.textContent()).includes('攻克沉默者旗舰后开放'));
  await page.goto(BASE + '/battle/weekly_boss', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  check('A4 未解锁直访战斗页不崩（console 双路零异常）', consoleErrs.length === 0);
  await ctx.close();
}

// —— B + C. 解锁档渲染 + 击败流 ——
console.log('== B. 解锁档：卡可点 + 考题预览 + 战斗页渲染 ==');
console.log('== C. 击败流：出战胜利 → 记账 → 已击败禁战 ==');
{
  const page = await newSeededPage(
    browser,
    makeSave({ completedNodes: UNLOCK_NODES, completedStrongholds: ['silencer_3'], expeditionBest: 5 }),
    '/map'
  );
  const open = page.locator('[data-testid="weekly-boss-open"]');
  check('B1 解锁档周 Boss 卡可点击态', await open.isVisible());
  check('B2 卡面显示本周考题', (await open.textContent()).includes('本周考题：'));
  check('B3 卡面奖励预览含暗物质', (await open.textContent()).includes('暗物质'));

  await page.goto(BASE + '/battle/weekly_boss', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  check('B4 战斗页渲染 Boss 名（周强敌）', (await page.locator('.s-name').first().textContent()).includes('周强敌'));
  check('B5 敌方编成渲染', (await page.locator('.enemy-card').count()) > 0);
  check('B6 驻扎按钮隐藏', (await page.locator('[data-testid="battle-garrison"]').count()) === 0);
  check('B7 深度面板隐藏', (await page.locator('[data-testid="endless-depth-panel"]').count()) === 0);
  const deploy = page.locator('[data-testid="battle-start"]');
  check('B8 出战按钮可用', !(await deploy.isDisabled()));

  // 击败流：出战 → 胜利弹窗 → 留在此据点 → SPA 回星图验证记账
  await deploy.click();
  await page.waitForTimeout(700);
  const modal = page.locator('.modal');
  check('C1 战斗结果弹窗出现', (await modal.count()) === 1);
  const victory = await modal.evaluate((el) => el.classList.contains('victory'));
  check('C2 结果=胜利（注档军对第 6/7 层 Boss 必胜）', victory);
  if (victory) {
    await page.screenshot({ path: '/tmp/v124-suite/boss-victory.png', fullPage: true });
    await modal.getByRole('button', { name: '留在此据点' }).click();
    await page.waitForTimeout(500);
    check('C3 弹窗关闭（留在此据点）', (await modal.count()) === 0);
    await page.getByRole('button', { name: /返回星图/ }).click().catch(() => {});
    await page.waitForTimeout(700);
    check('C4 星图卡已击败态（weekly-boss-done）', (await page.locator('[data-testid="weekly-boss-done"]').count()) === 1);
    check('C5 已击败卡可点击（回战斗页查看属设计内，门禁在出战按钮）', !(await page.locator('[data-testid="weekly-boss-done"]').isDisabled()));
    // SPA 内点 done 卡回战斗页（整页 goto 会重注入冲档，v0.57 坑）
    await page.locator('[data-testid="weekly-boss-done"]').click();
    await page.waitForTimeout(700);
    const deploy2 = page.locator('[data-testid="battle-start"]');
    check('C6 再入战斗页出战禁用（防重复领取）', await deploy2.isDisabled());
    check('C7 按钮文案切换（本周已击败）', (await deploy2.textContent()).includes('本周已击败'));
  }
  await page.context().close();
}

// —— D. 已击败注档三态 ——
console.log('== D. 注档三态：本周标记禁战 / 旧档缺键可战 / 跨周标记失效 ==');
{
  const doneMap = await newSeededPage(
    browser,
    makeSave({ completedNodes: UNLOCK_NODES, completedStrongholds: ['silencer_3'], expeditionBest: 5, weeklyBoss: { claimedWeek: THIS_WEEK }, withDaily: true }),
    '/map'
  );
  check('D1 本周已击败注档：星图卡 done 态', (await doneMap.locator('[data-testid="weekly-boss-done"]').count()) === 1);
  await doneMap.context().close();

  const doneBattle = await newSeededPage(
    browser,
    makeSave({ completedNodes: UNLOCK_NODES, completedStrongholds: ['silencer_3'], expeditionBest: 5, weeklyBoss: { claimedWeek: THIS_WEEK }, withDaily: true }),
    '/battle/weekly_boss'
  );
  check('D2 本周已击败注档：出战禁用', await doneBattle.locator('[data-testid="battle-start"]').isDisabled());
  check('D3 出战文案切换', (await doneBattle.locator('[data-testid="battle-start"]').textContent()).includes('本周已击败'));
  await doneBattle.context().close();

  const legacy = await newSeededPage(
    browser,
    makeSave({ completedNodes: UNLOCK_NODES, completedStrongholds: ['silencer_3'], expeditionBest: 5 }),
    '/map'
  );
  check('D4 旧档（无 daily 键）：卡 open 态', (await legacy.locator('[data-testid="weekly-boss-open"]').count()) === 1);
  await legacy.context().close();

  const staleWeek = await newSeededPage(
    browser,
    makeSave({ completedNodes: UNLOCK_NODES, completedStrongholds: ['silencer_3'], expeditionBest: 5, weeklyBoss: { claimedWeek: '2000-W01' }, withDaily: true }),
    '/battle/weekly_boss'
  );
  check('D5 跨周旧标记：出战可用（标记失效）', !(await staleWeek.locator('[data-testid="battle-start"]').isDisabled()));
  await staleWeek.context().close();
}

// —— E. 战损与常规面 ——
console.log('== E. 缩编出战损失区渲染 + 常规据点不回归 ==');
{
  const page = await newSeededPage(
    browser,
    makeSave({ completedNodes: UNLOCK_NODES, completedStrongholds: ['silencer_3'], expeditionBest: 5, army: 'trim', research: [] }),
    '/battle/weekly_boss'
  );
  await page.locator('[data-testid="battle-start"]').click();
  await page.waitForTimeout(700);
  const modal = page.locator('.modal');
  check('E1 缩编出战弹窗出现', (await modal.count()) === 1);
  const lossArea = modal.locator('.result-losses');
  check('E2 损失区渲染', (await lossArea.count()) === 1);
  const rows = await modal.locator('.loss-row').count();
  const noLoss = await modal.locator('.no-loss').count();
  check('E3 损失明细或无损失提示至少其一', rows > 0 || noLoss === 1);
  const trimVictory = await modal.evaluate((el) => el.classList.contains('victory'));
  check('E4 缩编同样胜利（战损可控可胜）', trimVictory);
  await page.context().close();

  const normal = await newSeededPage(browser, makeSave({ completedNodes: ['node_orbit'] }), '/battle/raider_1');
  check('E5 常规据点驻扎按钮仍在', (await normal.locator('[data-testid="battle-garrison"]').count()) === 1);
  check('E6 常规据点无深度面板', (await normal.locator('[data-testid="endless-depth-panel"]').count()) === 0);
  await normal.context().close();
}

// —— F. 移动视口 ——
console.log('== F. 移动视口（390px）无横向溢出 ==');
{
  const mobMap = await newSeededPage(
    browser,
    makeSave({ completedNodes: UNLOCK_NODES, completedStrongholds: ['silencer_3'], expeditionBest: 5 }),
    '/map',
    { viewport: { width: 390, height: 844 } }
  );
  const overflow1 = await mobMap.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  );
  check('F1 星图页无横向溢出', !overflow1);
  await mobMap.context().close();

  const mobBattle = await newSeededPage(
    browser,
    makeSave({ completedNodes: UNLOCK_NODES, completedStrongholds: ['silencer_3'], expeditionBest: 5 }),
    '/battle/weekly_boss',
    { viewport: { width: 390, height: 844 } }
  );
  const overflow2 = await mobBattle.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  );
  check('F2 战斗页无横向溢出', !overflow2);
  await mobBattle.context().close();
}

console.log(`（本周=${THIS_WEEK}，模板随周种子；C 段胜利依赖注档军对 depth 6/7 Boss 必胜）`);
await finish(browser);
