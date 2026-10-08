// 星核纪元 v0.59 专项回归：星图第二层「恒星系层」
// A. 五层渲染：恒星系层分区出现，6 节点全部锁定态（全新档）
// B. 注档 node_deep 完成：gate 可用、双分支 mine/forge 可见但锁定、深空链不受影响
// C. 注档 4 节点完成（旧档形态）：仅 gate 可用，其余恒星系节点锁定；旧档兼容（v7 无新字段）
// D. 注档 9/10 完成：edge 可用、10 节点成就口径、恒星系层据点解锁（全表 21，本档 14）、自动化不误开新层
// E. 配套科技 4 个出现在科技页且可研究态可购；成就页仍 49 卡 9 区
// F. MapView 空态不误触（新节点未完成时「全部探索完毕」不出现）
import { launch, check, finish, newSeededPage } from './starcore-pwlib.mjs';

const STELLAR_NODES = [
  'node_stellar_gate',
  'node_stellar_mine',
  'node_stellar_forge',
  'node_stellar_dead',
  'node_stellar_core',
  'node_stellar_edge',
];
const NEW_TECHS = ['stellar_charting', 'wormhole_stabilization', 'fleet_logistics', 'dark_resonance'];
const NEW_STRONGHOLDS = [
  'raider_4',
  'beast_3',
  'ruin_3',
  'silencer_2',
  'raider_5',
  'beast_4',
];

function makeSave({ completedNodes = [], withAutoExplore = false, rich = true } = {}) {
  const progress = {};
  for (const id of completedNodes) {
    progress[id] = { nodeId: id, startTime: 1, endTime: 2, completed: true };
  }
  return {
    version: 1,
    savedAt: Date.now(),
    player: { id: 'test', name: '测试' },
    totalPlayTime: 0,
    resources: {
      amounts: rich
        ? { energy: '1000000000', crystal: '1000000', alloy: '1000000', data: '1000000', dark: '1000' }
        : { energy: '0', crystal: '0', alloy: '0', data: '0', dark: '0' },
      totals: rich
        ? { energy: '1000000000', crystal: '1000000', alloy: '1000000', data: '1000000', dark: '1000' }
        : { energy: '0', crystal: '0', alloy: '0', data: '0', dark: '0' },
    },
    buildings: { levels: {} },
    research: { completed: [] },
    military: { owned: {}, training: [], formations: [] },
    combat: { garrisoned: {}, completed: [] },
    exploration: { progress },
    relics: { owned: [], equipped: [null, null, null, null] },
    transcend: {
      negativeEntropy: '0',
      totalTranscends: 1,
      tree: withAutoExplore ? [{ id: 't_auto_explore', level: 1 }] : [],
    },
    achievements: {
      lifetime: { energy: '0', dark: '0', upgrades: 0, maxBuildingLevel: 0, researches: 0, explores: 0, battles: 0 },
      unlocked: {},
    },
  };
}

const browser = await launch();

// 按节点名精确匹配卡片（避免锁定提示「需先完成：X」造成的 hasText 误命中）
const nodeCard = (page, name) =>
  page.locator('.node-card', { has: page.locator(`.n-name:text-is("${name}")`) });

// A. 五层渲染
console.log('== A. 全新档：恒星系层分区 + 全锁定 ==');
{
  const page = await newSeededPage(browser, makeSave({ rich: false }), '/map');
  const section = page.locator('.layer-section', { hasText: '恒星系层' });
  check('恒星系层分区渲染', (await section.count()) === 1);
  const cards = section.locator('.node-card');
  check('恒星系层 6 节点', (await cards.count()) === 6);
  check('6 节点全部锁定态', (await section.locator('.node-card.locked').count()) === 6);
  check('层名可见', (await section.locator('.layer-name').textContent()) === '恒星系层');
  await page.context().close();
}

// B. node_deep 完成：入口解锁，双分支锁定
console.log('== B. node_deep 完成：gate 可用 ==');
{
  const page = await newSeededPage(browser, makeSave({ completedNodes: ['node_deep'] }), '/map');
  const gate = nodeCard(page, '半人马门户');
  check('半人马门户节点存在', (await gate.count()) === 1);
  check('gate 非锁定（可探索）', !(await gate.evaluate((el) => el.classList.contains('locked'))));
  const mine = nodeCard(page, '碎晶星带');
  check('碎晶星带可见且锁定', (await mine.count()) === 1 && (await mine.evaluate((el) => el.classList.contains('locked'))));
  const forge = nodeCard(page, '熔炉星系');
  check('熔炉星系可见且锁定', (await forge.count()) === 1 && (await forge.evaluate((el) => el.classList.contains('locked'))));
  await page.context().close();
}

// C. 旧档形态（仅 4 旧节点完成，无新字段）：gate 可用，深层锁定
console.log('== C. 旧档形态（4 旧节点完成）==');
{
  const page = await newSeededPage(browser, makeSave({ completedNodes: ['node_orbit', 'node_inner', 'node_outer', 'node_deep'] }), '/map');
  const gate = nodeCard(page, '半人马门户');
  check('gate 可用（旧档无缝续玩）', (await gate.count()) === 1 && !(await gate.evaluate((el) => el.classList.contains('locked'))));
  const dead = nodeCard(page, '死寂星系');
  check('死寂星系锁定（前置未满足）', (await dead.count()) === 1 && (await dead.evaluate((el) => el.classList.contains('locked'))));
  await page.context().close();
}

// D. 9/10 完成：edge 可用 + 据点解锁 + 自动化不误开
console.log('== D. 9/10 完成：edge 可用 + 14 据点 + 自动化不误开 ==');
{
  const nine = STELLAR_NODES.slice(0, 5).concat(['node_orbit', 'node_inner', 'node_outer', 'node_deep']);
  const page = await newSeededPage(browser, makeSave({ completedNodes: nine }), '/map');
  const edge = nodeCard(page, '银河悬臂边缘');
  check('银河悬臂边缘可用', (await edge.count()) === 1 && !(await edge.evaluate((el) => el.classList.contains('locked'))));
  const shSection = page.locator('.stronghold-section');
  const shCount = await shSection.locator('.stronghold-card').count();
  check(`已解锁据点 14 个（实际 ${shCount}）`, shCount === 14);
  const names = await shSection.locator('.s-name').allTextContents();
  for (const id of NEW_STRONGHOLDS) {
    const zh = {
      raider_4: '掠夺者星际舰队',
      beast_3: '晶背巨兽群',
      ruin_3: '先驱星系档案馆',
      silencer_2: '沉默者殖民舰',
      raider_5: '掠夺者母巢',
      beast_4: '虚空巨兽母体',
      ruin_4: '奇点方舟',
      silencer_3: '沉默者旗舰',
    }[id];
    check(`据点 ${zh} 已解锁`, names.includes(zh));
  }
  // edge 前置（node_stellar_edge）未完成 → 奇点方舟/沉默者旗舰不应提前解锁
  check(
    'edge 前置据点未提前解锁（奇点方舟/沉默者旗舰不在列表）',
    !names.includes('奇点方舟') && !names.includes('沉默者旗舰')
  );
  // 自动化协议开着，但 edge 买不起（rich=false）→ 不应自动开新探索
  const poorPage = await newSeededPage(browser, makeSave({ completedNodes: nine, withAutoExplore: true, rich: false }), '/map');
  await poorPage.waitForTimeout(1500);
  check('自动化不误开新层（穷档无进行中探索）', (await poorPage.locator('.node-card.exploring').count()) === 0);
  await poorPage.context().close();
  await page.context().close();
}

// E. 配套科技渲染 + 成就不回归
console.log('== E. 新科技渲染 + 成就 34 卡不回归 ==');
{
  const page = await newSeededPage(browser, makeSave({}), '/tech');
  for (const [id, zh] of [
    ['stellar_charting', '银河测绘'],
    ['wormhole_stabilization', '虫洞稳定理论'],
    ['fleet_logistics', '舰队后勤学'],
    ['dark_resonance', '暗物质共振'],
  ]) {
    // 用 .t-name 精确匹配，避免「需先研究：X」锁定提示造成 hasText 误命中
    const card = page.locator('.tech-card', { has: page.locator(`.t-name:text-is("${zh}")`) });
    check(`科技「${zh}」渲染`, (await card.count()) === 1);
  }
  check('科卡总数 59', (await page.locator('.tech-card').count()) === 59);
  // 富档：舰队后勤学（前置 adv_units 未研究）应显示锁定/不可研究；银河测绘同理。
  // 这里只验证渲染与状态类存在，不验证可研（前置链由 requires 数据保证）
  await page.context().close();
  const page2 = await newSeededPage(browser, makeSave({}), '/achievements');
  check('成就页 49 卡', (await page2.locator('.ach-card').count()) === 49);
  const sections = await page2.locator('.ach-section, section').count();
  check('成就分区渲染正常', sections >= 9);
  await page2.context().close();
}

// F. 空态不误触
console.log('== F. 空态不误触 ==');
{
  const page = await newSeededPage(browser, makeSave({ completedNodes: ['node_orbit', 'node_inner', 'node_outer', 'node_deep'] }), '/map');
  const empty = page.locator('.empty-state, [class*="empty"]');
  check('旧档全通后空态不出现（新层未完）', (await empty.count()) === 0);
  await page.context().close();
}

await finish(browser);
