// 星核纪元 v1.55 专项回归：节点仪式感
// A. 转生仪式：确认重启后全屏演出（标题 / 收益 / 第 N 次），点击关闭后转生生效
// B. 层完成横幅：orbit 层完成跳变沿播顶部横幅（层名文案），点击提前关闭
// C. 终局仪式：34/34（深空层跳变沿）播终局全屏仪式，点击关闭；首页静态贺词仍在
// D. 减动效降级：reduced-motion 下转生仪式静态可读、可点击关闭
import { launch, check, finish, newSeededPage } from './starcore-pwlib.mjs';

// 34 节点全量（终局档用「33 完成 + 末节点进行中」；顺序即数据文件声明序）
const ALL_NODES = [
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
  'node_void_gate',
  'node_void_beacon',
  'node_void_watch',
  'node_void_hub',
  'node_void_veil',
  'node_void_origin',
];

function makeSave({ progress = {}, totalTranscends = 1 } = {}) {
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
    transcend: { negativeEntropy: '0', totalTranscends, tree: [] },
    achievements: {
      lifetime: { energy: '0', dark: '0', upgrades: 0, maxBuildingLevel: 0, researches: 0, explores: 0, battles: 0 },
      unlocked: {},
    },
  };
}

const browser = await launch();

// A. 转生仪式
console.log('== A. 转生仪式：全屏演出 + 点击关闭 ==');
{
  const page = await newSeededPage(browser, makeSave(), '/prestige');
  await page.locator('.btn-transcend').click();
  await page.waitForTimeout(300);
  await page.locator('.btn-accent', { hasText: '确认重启' }).click();
  await page.waitForTimeout(500);
  const overlay = page.locator('.ceremony-overlay');
  check('仪式 overlay 出现', (await overlay.count()) === 1);
  const text = await overlay.textContent();
  check('仪式含标题与收益与次数（第 2 次）', text.includes('奇点重启') && text.includes('负熵') && text.includes('第 2 次奇点重启'));
  check('确认弹窗已关闭', (await page.locator('.modal-overlay').count()) === 0);
  await overlay.click();
  await page.waitForTimeout(300);
  check('点击后仪式关闭', (await page.locator('.ceremony-overlay').count()) === 0);
  // 转生已生效：资源重置后转生按钮回禁用态
  check('转生生效（按钮回禁用态）', await page.locator('.btn-transcend').isDisabled());
  await page.context().close();
}

// B. 层完成横幅
console.log('== B. 层完成横幅：跳变沿播出 + 点击关闭 ==');
{
  const soon = Date.now() + 2000;
  const save = makeSave({
    progress: {
      node_orbit: { nodeId: 'node_orbit', startTime: Date.now() - 1000, endTime: soon, completed: false },
    },
  });
  const page = await newSeededPage(browser, save, '/map');
  const banner = page.locator('.layer-banner');
  await banner.waitFor({ state: 'visible', timeout: 9000 });
  const text = await banner.textContent();
  check('横幅含层名与完毕文案', text.includes('轨道带') && text.includes('探索完毕'));
  await banner.click();
  await page.waitForTimeout(400);
  check('点击后横幅关闭', (await page.locator('.layer-banner').count()) === 0);
  // 同层不重复播：等候一个自动消失周期后不再出现
  await page.waitForTimeout(4000);
  check('同层不重复播', (await page.locator('.layer-banner').count()) === 0);
  await page.context().close();
}

// C. 终局仪式
console.log('== C. 终局仪式：34/34 全屏演出 + 首页贺词 ==');
{
  const progress = {};
  for (const id of ALL_NODES.slice(0, -1)) {
    progress[id] = { nodeId: id, startTime: 1, endTime: 2, completed: true };
  }
  progress['node_void_origin'] = {
    nodeId: 'node_void_origin',
    startTime: Date.now() - 1000,
    endTime: Date.now() + 2000,
    completed: false,
  };
  const page = await newSeededPage(browser, makeSave({ progress }), '/');
  const overlay = page.locator('.ceremony-overlay');
  await overlay.waitFor({ state: 'visible', timeout: 9000 });
  const text = await overlay.textContent();
  check('终局仪式含标题与贺词', text.includes('全宇宙已探索完毕') && text.includes('守门者'));
  check('普通层横幅不出现（终局改播全屏）', (await page.locator('.layer-banner').count()) === 0);
  await overlay.click();
  await page.waitForTimeout(400);
  check('点击后终局仪式关闭', (await page.locator('.ceremony-overlay').count()) === 0);
  check('首页静态贺词仍在', (await page.locator('.final-salute').count()) === 1);
  await page.context().close();
}

// D. 减动效降级
console.log('== D. 减动效：reduced-motion 下仪式静态可读 ==');
{
  const page = await newSeededPage(browser, makeSave(), '/prestige', {
    extraCtx: { reducedMotion: 'reduce' },
  });
  await page.locator('.btn-transcend').click();
  await page.waitForTimeout(300);
  await page.locator('.btn-accent', { hasText: '确认重启' }).click();
  await page.waitForTimeout(400);
  const overlay = page.locator('.ceremony-overlay');
  check('减动效下仪式仍出现可读', (await overlay.count()) === 1 && (await overlay.textContent()).includes('奇点重启'));
  await overlay.click();
  await page.waitForTimeout(300);
  check('减动效下点击关闭', (await page.locator('.ceremony-overlay').count()) === 0);
  await page.context().close();
}

await finish(browser);
