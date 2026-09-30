// 星核纪元 v0.58 专项回归：自动化 QoL（转生树 3 个自动协议节点）
// A. 未购协议：tick 后不自动建造/研究/探索，三页无徽标
// B. 购 3 协议：tick 后建筑升级/科技完成/探索启动，三页徽标可见
// C. 转生树 UI：3 个新节点显示在买断区（购买前按钮/已购「已激活」）
import { launch, check, finish, newSeededPage, BASE_URL as URL } from './starcore-pwlib.mjs';

const AUTO_NODES = [
  { id: 't_auto_build', level: 1 },
  { id: 't_auto_research', level: 1 },
  { id: 't_auto_explore', level: 1 },
];

function makeSave(tree = [], ne = '0') {
  return {
    version: 1,
    savedAt: Date.now(),
    player: { id: 'test', name: '测试' },
    totalPlayTime: 0,
    resources: {
      amounts: { energy: '100000000', crystal: '100000', alloy: '100000', data: '100000', dark: '100' },
      totals: { energy: '100000000', crystal: '100000', alloy: '100000', data: '100000', dark: '100' },
    },
    buildings: { levels: {} },
    research: { completed: [] },
    military: { owned: {}, training: [], formations: [] },
    combat: { garrisoned: {}, completed: [] },
    exploration: { progress: {} },
    relics: { owned: [], equipped: [null, null, null, null] },
    transcend: { negativeEntropy: ne, totalTranscends: 1, tree },
    achievements: {
      lifetime: { energy: '0', dark: '0', upgrades: 0, maxBuildingLevel: 0, researches: 0, explores: 0, battles: 0 },
      unlocked: {},
    },
  };
}

const browser = await launch();

// —— A. 未购协议：不自动化 + 无徽标 ——
console.log('== A. 未购协议（对照组）==');
{
  const page = await newSeededPage(browser, makeSave(), '/build', { waitMs: 1600 });
  // tick 已跑，若有自动化建筑早就升了；读当前等级，再等 1.2s 确认不涨
  const lv1 = await page.locator('.build-card').first().textContent();
  await page.waitForTimeout(1200);
  const lv2 = await page.locator('.build-card').first().textContent();
  check('未购建造协议建筑等级不变', lv1 === lv2);
  check('建造页无自动徽标', (await page.locator('.auto-badge').count()) === 0);
  await page.goto(URL + '/tech', { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  check('科技页无自动徽标', (await page.locator('.auto-badge').count()) === 0);
  await page.goto(URL + '/map', { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  check('星图页无自动徽标', (await page.locator('.auto-badge').count()) === 0);
  await page.context().close();
}

// —— B. 购 3 协议：自动化生效 + 徽标可见 ——
console.log('== B. 购买 3 协议后自动化生效 ==');
{
  // 探索需要时间完成，出生点 orbit 探索进行中 → 星图页有节点在探索
  const page = await newSeededPage(browser, makeSave(AUTO_NODES), '/build', { waitMs: 1600 });
  check('建造页显示建造协议徽标', (await page.locator('.auto-badge', { hasText: '建造协议' }).count()) === 1);
  // 自动建造已把可升建筑升级（读取任意建筑 Lv.N > 0）
  const anyUpgraded = await page.evaluate(() => {
    const cards = document.querySelectorAll('.build-card');
    for (const c of cards) {
      const m = c.textContent.match(/Lv\.(\d+)/);
      if (m && parseInt(m[1], 10) > 0) return true;
    }
    return false;
  });
  check('自动建造已升级至少一座建筑', anyUpgraded);
  await page.goto(URL + '/tech', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  check('科技页显示研究协议徽标', (await page.locator('.auto-badge', { hasText: '研究协议' }).count()) === 1);
  // 已完成科技显示 .status-done ✓ 图标（fusion_tech 无前置、资源充足应被自动研究）
  const doneCount = await page.locator('.status-done').count();
  check(`自动研究已完成至少一项科技（status-done ${doneCount} ≥ 1）`, doneCount >= 1);
  await page.goto(URL + '/map', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  check('星图页显示探索协议徽标', (await page.locator('.auto-badge', { hasText: '探索协议' }).count()) === 1);
  const exploring = await page.locator('.node-card.exploring, .node-card .progress-fill, .node-card .bar-fill').count();
  check(`自动探索已开始节点（探索中元素 ${exploring} ≥ 1）`, exploring >= 1);
  await page.context().close();
}

// —— C. 转生树 UI：新节点展示 ——
console.log('== C. 转生树新节点展示 ==');
{
  // 未购：负熵 30 够买建造协议（10）
  const page = await newSeededPage(browser, makeSave([], '30'), '/prestige', { waitMs: 1600 });
  const buildCard = page.locator('.tree-node', { hasText: '建造协议' }).first();
  check('建造协议在买断区显示', (await buildCard.count()) === 1);
  check('未购时显示购买按钮', (await buildCard.locator('button', { hasText: '购买' }).count()) === 1);
  await buildCard.locator('button').click();
  await page.waitForTimeout(400);
  check('购买后显示已激活', (await buildCard.locator('.purchased-tag').count()) === 1);
  // 已购全部 3 个：全部显示已激活
  const page2 = await newSeededPage(browser, makeSave(AUTO_NODES), '/prestige', { waitMs: 1600 });
  const auto = page2.locator('.tree-node', { hasText: '协议' });
  check(`3 个协议节点全部已激活（实际 ${await page2.locator('.tree-node', { hasText: '协议' }).locator('.purchased-tag').count()}）`,
    (await page2.locator('.tree-node', { hasText: '协议' }).locator('.purchased-tag').count()) === 3);
  await page.context().close();
  await page2.context().close();
}

await finish(browser);
