// 星核纪元 v0.71 专项回归：星图第三层「星团层」
// A. 九层渲染星团层分区出现，6 节点全部锁定态（全新档；星臂/星系/深空层另由 v090/v091/v092 专项覆盖）
// B. 注档旧 10 节点完成（v0.70 旧档形态）：星团层 gate 可用、双分支锁定（零迁移）
// C. 解锁链：gate 完成 → swarm/ruin 可用、heart 锁定；swarm+ruin 完成 → heart 可用
// D. 注档 16 节点全完成：21 据点口径、终章链据点全部解锁、hollow 无据点（星团层时点局部口径，不随新层变）
// E. 自动化不误开新层（穷档 + 探索协议开着 → 无进行中探索）
// F. 空态口径：16/34 完成不出空态；34/34 完成出空态且据点区块保留
// G. 配套科技 4 个渲染 + 科技 59 卡 + 成就 49 卡 9 区 + 星团旅者成就存在
import { launch, check, finish, newSeededPage } from './starcore-pwlib.mjs';

const OLD_NODES = [
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
];
const ARM_NODES = [
  'node_arm_gate',
  'node_arm_cradle',
  'node_arm_grave',
  'node_arm_spine',
  'node_arm_abyss',
  'node_arm_threshold',
];
const CLUSTER_NODES = [
  'node_cluster_gate',
  'node_cluster_swarm',
  'node_cluster_ruin',
  'node_cluster_heart',
  'node_cluster_hollow',
  'node_cluster_silence',
];
const NEW_TECHS = [
  ['starcluster_charting', '星团测绘'],
  ['flagship_doctrine', '旗舰协同'],
  ['dark_amplifier', '暗物质增敏器'],
  ['precursor_memory', '先驱者存储器'],
];
const CLUSTER_STRONGHOLDS = {
  raider_6: '星团劫掠舰队',
  beast_5: '晶云织网兽',
  ruin_5: '先驱者信标',
  raider_7: '母巢星团舰群',
  silencer_4: '沉默者母港',
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

// A. 八层渲染（星团层为第 6 层），
console.log('== A. 全新档：星团层分区 + 全锁定 ==');
{
  const page = await newSeededPage(browser, makeSave({ rich: false }), '/map');
  check('九层分区渲染', (await page.locator('.layer-section').count()) === 9);
  const section = page.locator('.layer-section', { hasText: '星团层' });
  check('星团层分区渲染', (await section.count()) === 1);
  const cards = section.locator('.node-card');
  check('星团层 6 节点', (await cards.count()) === 6);
  check('6 节点全部锁定态', (await section.locator('.node-card.locked').count()) === 6);
  check('层名可见', (await section.locator('.layer-name').textContent()) === '星团层');
  await page.context().close();
}

// B. 旧档形态（v0.70 十节点全完成）：gate 可用、双分支锁定
console.log('== B. 旧档 10 节点完成：gate 可用（零迁移）==');
{
  const page = await newSeededPage(browser, makeSave({ completedNodes: OLD_NODES }), '/map');
  const gate = nodeCard(page, '星团之眼');
  check('星团之眼节点存在', (await gate.count()) === 1);
  check('gate 非锁定（旧档无缝续玩）', !(await isLocked(gate)));
  const swarm = nodeCard(page, '晶云星团');
  check('晶云星团可见且锁定', (await swarm.count()) === 1 && (await isLocked(swarm)));
  const ruin = nodeCard(page, '红拱遗迹');
  check('红拱遗迹可见且锁定', (await ruin.count()) === 1 && (await isLocked(ruin)));
  const silence = nodeCard(page, '沉默之巢');
  check('沉默之巢锁定（深层前置未满足）', (await silence.count()) === 1 && (await isLocked(silence)));
  await page.context().close();
}

// C. 解锁链
console.log('== C. 解锁链：gate→双分支→heart ==');
{
  const page = await newSeededPage(browser, makeSave({ completedNodes: [...OLD_NODES, 'node_cluster_gate'] }), '/map');
  const swarm = nodeCard(page, '晶云星团');
  check('gate 完成后晶云星团可用', !(await isLocked(swarm)));
  const ruin = nodeCard(page, '红拱遗迹');
  check('gate 完成后红拱遗迹可用', !(await isLocked(ruin)));
  const heart = nodeCard(page, '星团之心');
  check('星团之心锁定（需双分支）', await isLocked(heart));
  // 仅完成单分支：heart 仍锁定
  await page.context().close();
  const page2 = await newSeededPage(browser, makeSave({
      completedNodes: [...OLD_NODES, 'node_cluster_gate', 'node_cluster_swarm'],
    }), '/map');
  check('单分支完成 heart 仍锁定', await isLocked(nodeCard(page2, '星团之心')));
  await page2.context().close();
  // 双分支完成：heart 可用，hollow 仍锁定
  const page3 = await newSeededPage(browser, makeSave({
      completedNodes: [
        ...OLD_NODES,
        'node_cluster_gate',
        'node_cluster_swarm',
        'node_cluster_ruin',
      ],
    }), '/map');
  check('双分支完成 heart 可用', !(await isLocked(nodeCard(page3, '星团之心'))));
  check('heart 未完成时虚无空洞锁定', await isLocked(nodeCard(page3, '虚无空洞')));
  await page3.context().close();
}

// D. 16 节点全完成：21 据点口径（星臂/星系/深空层节点未动，口径不变），
console.log('== D. 16/34 完成：21 据点全解锁 ==');
{
  const page = await newSeededPage(browser, makeSave({ completedNodes: [...OLD_NODES, ...CLUSTER_NODES] }), '/map');
  const shSection = page.locator('.stronghold-section');
  const shCount = await shSection.locator('.stronghold-card').count();
  check(`已解锁据点 21 个（实际 ${shCount}）`, shCount === 21);
  const names = await shSection.locator('.s-name').allTextContents();
  for (const [id, zh] of Object.entries(CLUSTER_STRONGHOLDS)) {
    check(`据点 ${zh} 已解锁`, names.includes(zh));
  }
  // hollow 无据点：终章链之外的既有据点也全在（抽查旗舰）
  check('既有旗舰据点仍在（沉默者旗舰）', names.includes('沉默者旗舰'));
  await page.context().close();
  // 15/16（缺终章）：silencer_4 不解锁
  const page2 = await newSeededPage(browser, makeSave({ completedNodes: [...OLD_NODES, ...CLUSTER_NODES.slice(0, 5)] }), '/map');
  const names2 = await page2.locator('.stronghold-section .s-name').allTextContents();
  check('终章未完成时沉默者母港不解锁', !names2.includes('沉默者母港'));
  check('终章未完成时已解锁 20 据点', names2.length === 20);
  await page2.context().close();
}

// E. 自动化不误开新层
console.log('== E. 自动化不误开（穷档 + 探索协议）==');
{
  const page = await newSeededPage(browser, makeSave({ completedNodes: OLD_NODES, withAutoExplore: true, rich: false }), '/map');
  await page.waitForTimeout(1500);
  check('穷档无进行中探索（gate 成本 1e8 买不起）', (await page.locator('.node-card.exploring').count()) === 0);
  await page.context().close();
}

// F. 空态口径
console.log('== F. 空态不误触 / 全通空态 ==');
{
  // 16/34（星臂/星系/深空层未动）：不出空态
  const page = await newSeededPage(browser, makeSave({ completedNodes: [...OLD_NODES, ...CLUSTER_NODES] }), '/map');
  const empty = page.locator('.empty-state');
  check('16/34 完成不出空态', (await empty.count()) === 0);
  await page.context().close();
  // 34/34（含星臂+星系+深空层）：出空态、星图区块隐藏、据点区块保留
  const page2 = await newSeededPage(browser, makeSave({
      completedNodes: [
        ...OLD_NODES,
        ...CLUSTER_NODES,
        ...ARM_NODES,
        'node_galaxy_gate',
        'node_galaxy_range',
        'node_galaxy_archive',
        'node_galaxy_hub',
        'node_galaxy_halo',
        'node_galaxy_heart',
        'node_void_gate',
        'node_void_beacon',
        'node_void_watch',
        'node_void_hub',
        'node_void_veil',
        'node_void_origin',
      ],
    }), '/map');
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
  check('星团旅者成就存在（60 次探索）', achText.includes('星团旅者') && achText.includes('60'));
  check('智慧之巅描述已更新 59', achText.includes('59 项研究'));
  await page2.context().close();
}

await finish(browser);
