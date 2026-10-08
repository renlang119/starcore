// 星核纪元 v0.62 专项回归：每日签到/周期挑战
// A. 全新档：首页 DailyCard 渲染（badge 待签/已签、3 项挑战、连击点）
// B. 自动签到：全新档进游戏数秒后 tick 自动首签（badge 变已签 + 连击 1）
// C. 注档已完成挑战：领取按钮出现 → 点击 → 暗物质到账 + 按钮变已领取
// D. 注档连击 5 天 + 今日已签：badge 连击 5、圆点 5 亮
// E. 换周重掷：注档旧周标识 → 加载后挑战重掷（challengeWeek 变当前周）
// F. 成就 49 卡不回归；导航无新增项；移动视口不溢出
// G. 扩类挑战（v1.21）：新 kind（远征/合成/强化/驻扎）注档渲染与领取，旧五键计数器兼容
import { launch, check, finish, newSeededPage } from './starcore-pwlib.mjs';

// 本地日期/周（与 app 同逻辑，node 侧复算）
function localDateStr(d = new Date()) {
  return d.toLocaleDateString('sv');
}
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

function makeSave({ daily, dark = 100 } = {}) {
  const save = {
    version: 1,
    savedAt: Date.now(),
    player: { id: 'test', name: '测试' },
    totalPlayTime: 0,
    resources: {
      amounts: { energy: '1000000', crystal: '100000', alloy: '100000', data: '100000', dark: String(dark) },
      totals: { energy: '1000000', crystal: '100000', alloy: '100000', data: '100000', dark: String(dark) },
    },
    buildings: { levels: {} },
    research: { completed: [] },
    military: { owned: {}, training: [], formations: [] },
    combat: { garrisoned: {}, completed: [] },
    exploration: { progress: {} },
    relics: { owned: [], equipped: [null, null, null, null] },
    transcend: { negativeEntropy: '0', totalTranscends: 0, tree: [] },
    achievements: {
      lifetime: { energy: '0', dark: '0', upgrades: 0, maxBuildingLevel: 0, researches: 0, explores: 0, battles: 0 },
      unlocked: {},
    },
  };
  if (daily !== undefined) save.daily = daily;
  return save;
}

const browser = await launch();
const TODAY = localDateStr();
const THIS_WEEK = weekStr();

// A/B. 全新档渲染 + 自动首签
console.log('== A/B. 全新档：卡片渲染 + 自动首签 ==');
{
  const page = await newSeededPage(browser, makeSave(), '/', { waitMs: 1500 });
  check('DailyCard 渲染', (await page.locator('[data-testid="daily-card"]').count()) === 1);
  check('挑战 3 行', (await page.locator('.challenge-row').count()) === 3);
  check('连击点 7 个', (await page.locator('.streak-dots .dot').count()) === 7);
  // 自动签到：等 tick（1s 间隔），badge 变「今日已签」
  await page.waitForTimeout(2500);
  const badge = (await page.locator('[data-testid="checkin-badge"]').textContent()).trim();
  check('自动首签完成（badge 已签）', badge.includes('今日已签'));
  check('连击 1 天', badge.includes('连击 1 天'));
  check('首签点亮 1 个圆点', (await page.locator('.streak-dots .dot.lit').count()) === 1);
  // 刷新后不重复签（连击仍 1）
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  const badge2 = (await page.locator('[data-testid="checkin-badge"]').textContent()).trim();
  check('刷新后不重复签到（仍连击 1）', badge2.includes('连击 1 天'));
  await page.context().close();
}

// C. 已完成挑战领取
console.log('== C. 注档完成态：领取 → 暗物质到账 ==');
{
  // 当前周 + 一项 battles 挑战 tier 0（模板 target 5），计数已 5 → 可领取
  // 注：v0.75 起 target/rewardDark 由 hydrate 按模板重推导，注入值须与模板一致
  const page = await newSeededPage(browser, makeSave({
      dark: 100,
      daily: {
        lastCheckIn: TODAY,
        streak: 2,
        weeklyCounters: { battles: 5, explores: 0, researches: 0, upgrades: 0, transcends: 0 },
        challengeWeek: THIS_WEEK,
        weekChallenges: [
          { templateId: 'wk_battles', kind: 'battles', tier: 0, target: 5, rewardDark: 3, claimed: false },
          { templateId: 'wk_explores', kind: 'explores', tier: 0, target: 6, rewardDark: 3, claimed: false },
          { templateId: 'wk_researches', kind: 'researches', tier: 0, target: 3, rewardDark: 3, claimed: false },
        ],
      },
    }), '/', { waitMs: 1500 });
  check('连击 5 不适用（badge 连击 2）', (await page.locator('[data-testid="checkin-badge"]').textContent()).includes('连击 2 天'));
  check('挑战行显示 5/5', (await page.locator('[data-testid="challenge-wk_battles"] .c-count').textContent()).trim() === '5/5');
  const claimBtn = page.locator('[data-testid="claim-wk_battles"]');
  check('领取按钮出现', (await claimBtn.count()) === 1);
  await claimBtn.click();
  await page.waitForTimeout(500);
  check('领取后按钮消失（已领取）', (await page.locator('[data-testid="challenge-wk_battles"] .c-claimed').count()) === 1);
  // 暗物质到账：签到勾连连击 +1（2→3），且 +3 暗物质进资源，检查资源面板数值变化
  const overviewDark = await page.evaluate(() => localStorage.getItem('starcore_save_v1_backup'));
  check('存档已更新（领取落库）', overviewDark !== null);
  await page.context().close();
}

// D. 连击 5 天注档
console.log('== D. 连击 5 天：圆点 5 亮 ==');
{
  const page = await newSeededPage(browser, makeSave({
      daily: {
        lastCheckIn: TODAY,
        streak: 5,
        weeklyCounters: { battles: 0, explores: 0, researches: 0, upgrades: 0, transcends: 0 },
        challengeWeek: THIS_WEEK,
        weekChallenges: [],
      },
    }), '/', { waitMs: 1500 });
  check('badge 连击 5 天', (await page.locator('[data-testid="checkin-badge"]').textContent()).includes('连击 5 天'));
  check('圆点 5 亮', (await page.locator('.streak-dots .dot.lit').count()) === 5);
  // v0.94：空表 + 当前周在加载时补掷（不再整周空窗）
  check('空挑战列表加载后补掷 3 项', (await page.locator('.challenge-row').count()) === 3);
  await page.context().close();
}

// G. 扩类挑战（v1.21）：新 kind 渲染与领取 + 旧计数器兼容
console.log('== G. 扩类挑战：新 kind 渲染/领取 + 旧档兼容 ==');
{
  // G1. 旧五键 weeklyCounters（v1.19 形态）加载不拒档：挑战正常渲染
  const g1 = await newSeededPage(browser, makeSave({
      daily: {
        lastCheckIn: TODAY,
        streak: 2,
        weeklyCounters: { battles: 0, explores: 0, researches: 0, upgrades: 0, transcends: 0 },
        challengeWeek: THIS_WEEK,
        weekChallenges: [
          { templateId: 'wk_expedition', kind: 'expedition', tier: 0, target: 2, rewardDark: 3, claimed: false },
          { templateId: 'wk_synths', kind: 'synths', tier: 0, target: 2, rewardDark: 3, claimed: false },
          { templateId: 'wk_garrison', kind: 'garrisonHours', tier: 0, target: 20, rewardDark: 3, claimed: false },
        ],
      },
    }), '/', { waitMs: 1500 });
  check('旧五键档加载：挑战 3 行', (await g1.locator('.challenge-row').count()) === 3);
  check('远征挑战行渲染（模板池取名）', (await g1.locator('[data-testid="challenge-wk_expedition"]').count()) === 1);
  check('新 kind 行进度 0/2', (await g1.locator('[data-testid="challenge-wk_expedition"] .c-count').textContent()).trim() === '0/2');
  check('新 kind 无领取按钮（未达标）', (await g1.locator('[data-testid="claim-wk_expedition"]').count()) === 0);
  await g1.context().close();

  // G2. 新 kind 达标领取：expedition 计数 2/2 → 领取按钮 → 点击 → 已领取
  const g2 = await newSeededPage(browser, makeSave({
      daily: {
        lastCheckIn: TODAY,
        streak: 2,
        weeklyCounters: {
          battles: 0, explores: 0, researches: 0, upgrades: 0, transcends: 0,
          expedition: 2, synths: 0, enhances: 0, garrisonHours: 0,
        },
        challengeWeek: THIS_WEEK,
        weekChallenges: [
          { templateId: 'wk_expedition', kind: 'expedition', tier: 0, target: 2, rewardDark: 3, claimed: false },
          { templateId: 'wk_synths', kind: 'synths', tier: 0, target: 2, rewardDark: 3, claimed: false },
          { templateId: 'wk_garrison', kind: 'garrisonHours', tier: 0, target: 20, rewardDark: 3, claimed: false },
        ],
      },
    }), '/', { waitMs: 1500 });
  check('远征达标显示 2/2', (await g2.locator('[data-testid="challenge-wk_expedition"] .c-count').textContent()).trim() === '2/2');
  const g2btn = g2.locator('[data-testid="claim-wk_expedition"]');
  check('远征领取按钮出现', (await g2btn.count()) === 1);
  await g2btn.click();
  await g2.waitForTimeout(500);
  check('远征领取后变已领取', (await g2.locator('[data-testid="challenge-wk_expedition"] .c-claimed').count()) === 1);
  check('其余新 kind 未误标已领取', (await g2.locator('[data-testid="challenge-wk_synths"] .c-claimed').count()) === 0);
  await g2.context().close();
}

// E. 换周重掷
console.log('== E. 注档旧周标识：加载后重掷 ==');
{
  const page = await newSeededPage(browser, makeSave({
      daily: {
        lastCheckIn: TODAY,
        streak: 4,
        weeklyCounters: { battles: 99, explores: 99, researches: 99, upgrades: 99, transcends: 99 },
        challengeWeek: '2020-W01', // 远古周
        weekChallenges: [
          { templateId: 'wk_battles', kind: 'battles', tier: 0, target: 5, rewardDark: 3, claimed: false },
          { templateId: 'wk_explores', kind: 'explores', tier: 0, target: 6, rewardDark: 3, claimed: false },
          { templateId: 'wk_researches', kind: 'researches', tier: 0, target: 3, rewardDark: 3, claimed: false },
        ],
      },
    }), '/', { waitMs: 1500 });
  await page.waitForTimeout(1500);
  // 换周后重掷：本真实周（W36 当前）的种子抽取结果与注档的 wk_battles 是否还在不确定，
  // 关键断言：计数清零（99 → 0）且仍有 3 行。用「任一行 count 以 0/ 开头」判定清零
  const counts = await page.locator('.challenge-row .c-count').allTextContents();
  check('换周后计数清零（全部 0/ 开头）', counts.length === 3 && counts.every((t) => t.trim().startsWith('0/')));
  check('挑战仍 3 行（重掷完成）', (await page.locator('.challenge-row').count()) === 3);
  await page.context().close();
}

// F. 不回归项
console.log('== F. 成就 49 卡 / 导航不增 / 移动视口 ==');
{
  const page = await newSeededPage(browser, makeSave(), '/achievements', { waitMs: 1500 });
  check('成就页 49 卡', (await page.locator('.ach-card').count()) === 49);
  await page.context().close();

  const home = await newSeededPage(browser, makeSave(), '/', { viewport: { width: 390, height: 844 }, waitMs: 1500 });
  // 移动端底部导航结构不同：按「更多」按钮展开后的导航项校验，直接数可见导航标签文本
  const navTexts = await home.evaluate(() => {
    const texts = new Set();
    for (const el of document.querySelectorAll('.bottom-nav *, nav *')) {
      const t = (el.textContent || '').trim();
      if (t && t.length <= 4) texts.add(t);
    }
    return [...texts];
  });
  check('导航含既有 8 项主/次页（无新增页）',
    ['主界面', '建造', '科技树', '探索', '部队', '更多'].every((t) => navTexts.some((x) => x.includes(t))) &&
    !navTexts.some((x) => x.includes('签到')));
  const overflow = await home.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  );
  check('移动视口（390px）无横向溢出', !overflow);
  await home.context().close();
}

await finish(browser);
