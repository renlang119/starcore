// 星核纪元 v0.49 专项回归：首页行动队列口径
// 训练中无汇总卡；进行中全保留 + 可执行补足 ≤6；无训练时显示训练引导。
import { launch, check, finish, savePayload, PREVIEW_URL as URL } from './starcore-pwlib.mjs';

function makeSave({ training = [], exploring = [], completed = [] }) {
  const now = Date.now();
  const progress = {};
  for (const n of exploring) {
    progress[n] = { nodeId: n, startTime: now - 1000, endTime: now + 3600e3, completed: false };
  }
  return {
    version: 1,
    savedAt: now,
    player: { id: 'test', name: '测试' },
    resources: {
      amounts: { energy: '1000000000', crystal: '1000000', alloy: '1000000', data: '1000000', dark: '1000' },
      totals: { energy: '1000000000', crystal: '1000000', alloy: '1000000', data: '1000000', dark: '1000' },
    },
    buildings: { levels: {} },
    research: { completed },
    military: {
      owned: { assault: 0, guard: 0, heavy: 0, psionic: 0 },
      training,
      formations: [],
    },
    combat: { garrisoned: {}, completed: [] },
    exploration: { progress },
    relics: { owned: [], equipped: [null, null, null, null] },
    transcend: { negativeEntropy: '0', totalTranscends: 0, tree: [] },
  };
}

async function newHomePage(browser, opts) {
  const save = makeSave(opts);
  const payload = savePayload(save);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript((p) => {
    localStorage.setItem('starcore_save_v1_backup', p);
    localStorage.removeItem('starcore_save_v1');
    localStorage.setItem('starcore_onboarding', JSON.stringify({ 'home-core': true, 'home-quick': true, 'home-actions': true }));
  }, payload);
  const page = await ctx.newPage();
  await page.goto(URL + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  return page;
}

const browser = await launch();

// A. 3 训练 + 2 探索进行中：5 进行中 + 1 可执行 = 6，无汇总卡
console.log('== A. 进行中全保留 + 补足 ≤6 ==');
{
  const page = await newHomePage(browser, {
    completed: ['military_basic', 'explore_basic'],
    training: [
      { id: 't1', unitId: 'assault', count: 10, remaining: 40, totalTime: 50 },
      { id: 't2', unitId: 'guard', count: 5, remaining: 30, totalTime: 40 },
      { id: 't3', unitId: 'heavy', count: 2, remaining: 20, totalTime: 30 },
    ],
    exploring: ['node_orbit', 'node_inner'],
  });
  const items = await page.locator('.action-item').count();
  check(`队列总数 = 6（实际 ${items}）`, items === 6);
  const inProg = await page.locator('.action-item.in-progress').count();
  check(`进行中 = 5（实际 ${inProg}）`, inProg === 5);
  const text = await page.locator('.action-list').textContent();
  check('无「支部队训练中」汇总卡', !text.includes('支部队训练中'));
  check('训练进度逐条展示', text.includes('训练 突击兵') && text.includes('训练 重装兵'));
  check('无「训练部队」引导（训练中）', !text.includes('增强军事实力'));
  await page.context().close();
}

// B. 无训练 + 已解锁军事：显示训练引导
console.log('== B. 无训练时显示训练引导 ==');
{
  const page = await newHomePage(browser, { completed: ['military_basic'] });
  const text = await page.locator('.action-list').textContent();
  check('显示「训练部队」引导', text.includes('训练部队'));
  await page.context().close();
}

// C. 7 条进行中（4 探索 + 3 训练）：可执行归零，总数 7
console.log('== C. 进行中 ≥6 时可执行归零 ==');
{
  const page = await newHomePage(browser, {
    completed: ['military_basic', 'explore_basic'],
    training: [
      { id: 't1', unitId: 'assault', count: 10, remaining: 40, totalTime: 50 },
      { id: 't2', unitId: 'guard', count: 5, remaining: 30, totalTime: 40 },
      { id: 't3', unitId: 'heavy', count: 2, remaining: 20, totalTime: 30 },
    ],
    exploring: ['node_orbit', 'node_inner', 'node_outer', 'node_deep'],
  });
  const items = await page.locator('.action-item').count();
  check(`队列总数 = 7（实际 ${items}）`, items === 7);
  const act = await page.locator('.action-item.actionable').count();
  check(`可执行 = 0（实际 ${act}）`, act === 0);
  await page.context().close();
}

await finish(browser);
