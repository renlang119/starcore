// 星核纪元 v0.92 专项回归：星图第九层「深空层」（终层）
// A. 九层渲染：深空层分区出现，6 节点全部锁定态（全新档）
// B. 注档旧 28 节点完成（v0.91 旧档形态）：银河彼岸可用、双分支锁定（零迁移）
// C. 解锁链：gate 完成 → beacon/watch 可用；双分支完成 → hub 可用 → veil → origin
// D. 注档 34 节点全完成：36 据点全解锁口径、终章沉默者回响解锁；缺 origin → 35 据点
// E. 自动化不误开新层（穷档 + 探索协议开着 → 无进行中探索，gate 成本 2e12 买不起）
// F. 空态口径：33/34 完成不出空态；34/34 完成出空态（全宇宙已探索完毕）且据点区块保留
// G. 配套科技 4 个渲染 + 科技 59 卡 + 成就 49 卡 9 区 + 深空巡礼成就存在 + 智慧之巅 59
import { launch, check, finish, newSeededPage } from './starcore-pwlib.mjs';

const OLD_28_NODES = [
  'node_orbit',
  'node_inner',
  'node_outer',
  'node_deep',
  'node_stellar_gate',
  'node_stellar_mine',
  'node_stellar_forge',
  'node_stellar_dead',
  'node_stellar_core',
  'node_stellar_edge',
  'node_cluster_gate',
  'node_cluster_swarm',
  'node_cluster_ruin',
  'node_cluster_heart',
  'node_cluster_hollow',
  'node_cluster_silence',
  'node_arm_gate',
  'node_arm_cradle',
  'node_arm_grave',
  'node_arm_spine',
  'node_arm_abyss',
  'node_arm_threshold',
  'node_galaxy_gate',
  'node_galaxy_range',
  'node_galaxy_archive',
  'node_galaxy_hub',
  'node_galaxy_halo',
  'node_galaxy_heart',
];
const VOID_NODES = [
  'node_void_gate',
  'node_void_beacon',
  'node_void_watch',
  'node_void_hub',
  'node_void_veil',
  'node_void_origin',
];
const NEW_TECHS = [
  ['void_charting', '深空测绘'],
  ['void_command', '虚空统帅'],
  ['dark_veil', '暗幕收集网'],
  ['void_archive', '深空记忆库'],
];
const VOID_STRONGHOLDS = {
  raider_12: '虚空掠夺者旗舰',
  beast_8: '虚空白鲸群',
  ruin_8: '先驱者归航港',
  raider_13: '深空裁决军团',
  silencer_7: '沉默者回响',
};

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
        ? {
            energy: '1000000000000',
            crystal: '1000000000',
            alloy: '1000000000',
            data: '1000000000',
            dark: '100000',
          }
        : { energy: '0', crystal: '0', alloy: '0', data: '0', dark: '0' },
      totals: rich
        ? {
            energy: '1000000000000',
            crystal: '1000000000',
            alloy: '1000000000',
            data: '1000000000',
            dark: '100000',
          }
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
      lifetime: {
        energy: '0',
        dark: '0',
        upgrades: 0,
        maxBuildingLevel: 0,
        researches: 0,
        explores: 0,
        battles: 0,
      },
      unlocked: {},
    },
  };
}

const browser = await launch();

// 按节点名精确匹配卡片（避免锁定提示「需先完成：X」造成的 hasText 误命中）
const nodeCard = (page, name) =>
  page.locator('.node-card', { has: page.locator(`.n-name:text-is("${name}")`) });
const isLocked = (card) => card.evaluate((el) => el.classList.contains('locked'));

// A. 九层渲染
console.log('== A. 全新档：深空层分区 + 全锁定 ==');
{
  const page = await newSeededPage(browser, makeSave({ rich: false }), '/map');
  check('九层分区渲染', (await page.locator('.layer-section').count()) === 9);
  const section = page.locator('.layer-section', {
    has: page.locator('.layer-name:text-is("深空层")'),
  });
  check('深空层分区渲染', (await section.count()) === 1);
  const cards = section.locator('.node-card');
  check('深空层 6 节点', (await cards.count()) === 6);
  check('6 节点全部锁定态', (await section.locator('.node-card.locked').count()) === 6);
  check('层名可见', (await section.locator('.layer-name').textContent()) === '深空层');
  await page.context().close();
}

// B. 旧档形态（v0.91 二十八节点全完成）：gate 可用、双分支锁定
console.log('== B. 旧档 28 节点完成：银河彼岸可用（零迁移）==');
{
  const page = await newSeededPage(browser, makeSave({ completedNodes: OLD_28_NODES }), '/map');
  const gate = nodeCard(page, '银河彼岸');
  check('银河彼岸节点存在', (await gate.count()) === 1);
  check('gate 非锁定（旧档无缝续玩）', !(await isLocked(gate)));
  const beacon = nodeCard(page, '虚空航标');
  check('虚空航标可见且锁定', (await beacon.count()) === 1 && (await isLocked(beacon)));
  const watch = nodeCard(page, '虚空望台');
  check('虚空望台可见且锁定', (await watch.count()) === 1 && (await isLocked(watch)));
  const origin = nodeCard(page, '信号源头');
  check('信号源头锁定（深层前置未满足）', (await origin.count()) === 1 && (await isLocked(origin)));
  await page.context().close();
}

// C. 解锁链
console.log('== C. 解锁链：gate→双分支→hub→veil→origin ==');
{
  const base = await newSeededPage(browser, makeSave({ completedNodes: [...OLD_28_NODES, 'node_void_gate'] }), '/map');
  check('gate 完成后虚空航标可用', !(await isLocked(nodeCard(base, '虚空航标'))));
  check('gate 完成后虚空望台可用', !(await isLocked(nodeCard(base, '虚空望台'))));
  check('星幕枢纽锁定（需双分支）', await isLocked(nodeCard(base, '星幕枢纽')));
  await base.context().close();
  // 仅单分支：hub 仍锁定
  const single = await newSeededPage(browser, makeSave({
      completedNodes: [...OLD_28_NODES, 'node_void_gate', 'node_void_beacon'],
    }), '/map');
  check('单分支完成 hub 仍锁定', await isLocked(nodeCard(single, '星幕枢纽')));
  await single.context().close();
  // 双分支完成：hub 可用、veil 锁定
  const both = await newSeededPage(browser, makeSave({
      completedNodes: [
        ...OLD_28_NODES,
        'node_void_gate',
        'node_void_beacon',
        'node_void_watch',
      ],
    }), '/map');
  check('双分支完成 hub 可用', !(await isLocked(nodeCard(both, '星幕枢纽'))));
  check('hub 未完成时静默星幕锁定', await isLocked(nodeCard(both, '静默星幕')));
  await both.context().close();
  // hub 完成：veil 可用、origin 锁定
  const hub = await newSeededPage(browser, makeSave({
      completedNodes: [
        ...OLD_28_NODES,
        'node_void_gate',
        'node_void_beacon',
        'node_void_watch',
        'node_void_hub',
      ],
    }), '/map');
  check('hub 完成后静默星幕可用', !(await isLocked(nodeCard(hub, '静默星幕'))));
  check('veil 未完成时信号源头锁定', await isLocked(nodeCard(hub, '信号源头')));
  await hub.context().close();
}

// D. 34 节点全完成：36 据点全解锁口径
console.log('== D. 34/34 完成：36 据点全解锁 ==');
{
  const page = await newSeededPage(browser, makeSave({ completedNodes: [...OLD_28_NODES, ...VOID_NODES] }), '/map');
  const shSection = page.locator('.stronghold-section');
  const shCount = await shSection.locator('.stronghold-card').count();
  check(`已解锁据点 36 个（实际 ${shCount}）`, shCount === 36);
  const names = await shSection.locator('.s-name').allTextContents();
  for (const [id, zh] of Object.entries(VOID_STRONGHOLDS)) {
    check(`据点 ${zh} 已解锁`, names.includes(zh));
  }
  check('既有旗舰据点仍在（沉默者主脑）', names.includes('沉默者主脑'));
  await page.context().close();
  // 33/34（缺 origin 终章）：silencer_7 不锁
  const page2 = await newSeededPage(browser, makeSave({
      completedNodes: [...OLD_28_NODES, ...VOID_NODES.slice(0, 5)],
    }), '/map');
  const names2 = await page2.locator('.stronghold-section .s-name').allTextContents();
  check('终章未完成时沉默者回响不解锁', !names2.includes('沉默者回响'));
  check('终章未完成时已解锁 35 据点', names2.length === 35);
  await page2.context().close();
}

// E. 自动化不误开新层
console.log('== E. 自动化不误开（穷档 + 探索协议）==');
{
  const page = await newSeededPage(browser, makeSave({ completedNodes: OLD_28_NODES, withAutoExplore: true, rich: false }), '/map');
  await page.waitForTimeout(1500);
  check('穷档无进行中探索（void gate 成本 2e12 买不起）', (await page.locator('.node-card.exploring').count()) === 0);
  await page.context().close();
}

// F. 空态口径
console.log('== F. 空态不误触 / 全通空态 ==');
{
  // 33/34（缺 origin 终章）：不出空态
  const page = await newSeededPage(browser, makeSave({ completedNodes: [...OLD_28_NODES, ...VOID_NODES.slice(0, 5)] }), '/map');
  check('33/34 完成不出空态', (await page.locator('.empty-state').count()) === 0);
  await page.context().close();
  // 34/34：出空态、星图区块隐藏、据点区块保留
  const page2 = await newSeededPage(browser, makeSave({ completedNodes: [...OLD_28_NODES, ...VOID_NODES] }), '/map');
  check('34/34 完成出空态', (await page2.locator('.empty-state').count()) === 1);
  check('空态文案「全宇宙已探索完毕」', (await page2.textContent('.empty-state')).includes('全宇宙已探索完毕'));
  check('星图区块隐藏', (await page2.locator('.layer-section').count()) === 0);
  check('据点区块保留', (await page2.locator('.stronghold-section').count()) === 1);
  await page2.context().close();
}

// G. 科技/成就面
console.log('== G. 新科技渲染 + 59 卡 + 成就 49 卡 ==');
{
  const page = await newSeededPage(browser, makeSave({}), '/tech');
  for (const [id, zh] of NEW_TECHS) {
    const card = page.locator('.tech-card', { has: page.locator(`.t-name:text-is("${zh}")`) });
    check(`科技「${zh}」渲染`, (await card.count()) === 1);
  }
  check('科技卡总数 59', (await page.locator('.tech-card').count()) === 59);
  await page.context().close();
  const page2 = await newSeededPage(browser, makeSave({}), '/achievements');
  check('成就页 49 卡', (await page2.locator('.ach-card').count()) === 49);
  const sections = await page2.locator('.ach-section, section').count();
  check('成就分区渲染正常', sections >= 9);
  const achText = await page2.textContent('body');
  check('深空巡礼成就存在（120 次探索）', achText.includes('深空巡礼') && achText.includes('120'));
  check('智慧之巅描述 59 项研究', achText.includes('59 项研究'));
  await page2.context().close();
}

await finish(browser);