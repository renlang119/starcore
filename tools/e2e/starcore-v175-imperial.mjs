// 星核纪元 v1.75 专项回归：档案馆帝庭档案分组（贡道核验仪卫裁决炉音观察留档）
// A. 锁定态：缺省档帝庭档案分组标题可见、留白提示、条目零渲染不剧透
// B. 七门解锁后悬念：银河之门完成（未到银盘枢纽）仍锁定，与七门口径错开
// C. 解锁态：银盘枢纽完成档五节 15 条渲染、计数 15/18（v1.81 炉前节锁定不计入）
import { launch, check, finish, newSeededPage } from './starcore-pwlib.mjs';

function makeSave({ progress = {} } = {}) {
  return {
    version: 1,
    savedAt: Date.now(),
    player: { id: 'test', name: '测试' },
    totalPlayTime: 0,
    resources: {
      amounts: { energy: '1000000000', crystal: '1000000', alloy: '1000000', data: '1000000', dark: '1000' },
      totals: { energy: '1000000000', crystal: '1000000', alloy: '1000000', data: '1000000', dark: '1000' },
    },
    buildings: { levels: {} },
    research: { completed: [] },
    military: { owned: {}, training: [], formations: [] },
    combat: { garrisoned: {}, completed: [] },
    exploration: { progress },
    relics: { owned: [], equipped: [null, null, null, null] },
    transcend: { negativeEntropy: '0', totalTranscends: 1, tree: [] },
    achievements: {
      lifetime: { energy: '0', dark: '0', upgrades: 0, maxBuildingLevel: 0, researches: 0, explores: 0, battles: 0 },
      unlocked: {},
    },
  };
}

/** 单节点完成进度（解锁判读只看完成态） */
function doneNode(id) {
  return { nodeId: id, startTime: 1, endTime: 2, completed: true };
}

const browser = await launch();

// A. 锁定态
console.log('== A. 帝庭档案锁定态：留白提示、条目零渲染 ==');
{
  const page = await newSeededPage(browser, makeSave(), '/archive');
  await page.locator('[data-testid="archive-imperial-group"]').waitFor({ state: 'visible', timeout: 9000 });
  const text = await page.locator('[data-testid="archive-imperial-group"]').textContent();
  check('分组标题可见且无计数', text.includes('帝庭档案') && !text.includes('已归档'));
  check('留白提示可见', text.includes('还没走到航道的尽头'));
  check('条目零渲染不剧透', (await page.locator('[data-testid="archive-imperial-card"]').count()) === 0);
  check('炉音节名不泄漏', !text.includes('炉音'));
  await page.context().close();
}

// B. 七门解锁后悬念：银河之门完成（未到银盘枢纽）仍锁定
console.log('== B. 银河之门完成仍锁定（解锁挂银盘枢纽，与七门错开） ==');
{
  const progress = { node_galaxy_gate: doneNode('node_galaxy_gate') };
  const page = await newSeededPage(browser, makeSave({ progress }), '/archive');
  await page.locator('[data-testid="archive-imperial-group"]').waitFor({ state: 'visible', timeout: 9000 });
  const text = await page.locator('[data-testid="archive-imperial-group"]').textContent();
  check('仍处锁定态', text.includes('还没走到航道的尽头'));
  check('条目零渲染', (await page.locator('[data-testid="archive-imperial-card"]').count()) === 0);
  await page.context().close();
}

// C. 解锁态：银盘枢纽完成（单点解锁）
console.log('== C. 帝庭档案解锁态：15 条留档五节、计数 15/18 ==');
{
  const progress = { node_galaxy_hub: doneNode('node_galaxy_hub') };
  const page = await newSeededPage(browser, makeSave({ progress }), '/archive');
  const group = page.locator('[data-testid="archive-imperial-group"]');
  await group.waitFor({ state: 'visible', timeout: 9000 });
  await page
    .locator('[data-testid="archive-imperial-card"]')
    .first()
    .waitFor({ state: 'visible', timeout: 9000 });
  const text = await group.textContent();
  check('计数 15/18', text.includes('已归档 15 / 18 条'));
  check('五节节名段头齐备', ['贡道', '核验', '仪卫', '裁决', '炉音'].every((n) => text.includes(n)));
  check('15 条卡片渲染', (await page.locator('[data-testid="archive-imperial-card"]').count()) === 15);
  check('首节首条与炉音末条可见', text.includes('当柴的航道') && text.includes('不熄的说法'));
  check('帝庭档案批注可见', text.includes('档批'));
  check('留白提示不再出现', !text.includes('还没走到航道的尽头'));
  await page.context().close();
}

await finish(browser);
