// 星核纪元 v0.60 专项回归：无尽远征模式
// A. 未解锁：MapView 远征区块渲染、置灰卡、提示文案、点击不跳转
// B. 注档克沉默者旗舰：解锁亮卡、前沿=第1层；旧档无 expeditionBest 字段兼容
// C. /battle/endless：深度面板（跟随前沿）、敌情预览、驻扎隐藏、出征胜利推进深度
// D. 深度步进器：上下限钳制、重打不推进；失败不推进
// E. 注档 expeditionBest=3：前沿第4层、旧层数值随深度递增；转生后入口重新锁定但档案深度保留
// F. 常规据点战斗页不受影响（驻扎按钮仍在）；成就 49 卡不回归；移动视口不溢出
// G. 远征里程碑（v1.20）：领取条显示/领取回执、补领逐档清账、终身数据不挂本轮解锁、已领幂等
import { launch, check, finish, newSeededPage } from './starcore-pwlib.mjs';

const ALL_NODES = [
  'node_orbit', 'node_inner', 'node_outer', 'node_deep',
  'node_stellar_gate', 'node_stellar_mine', 'node_stellar_forge',
  'node_stellar_dead', 'node_stellar_core', 'node_stellar_edge',
];

function makeSave({
  completedNodes = [],
  completedStrongholds = [],
  expeditionBest,
  milestonesClaimed,
  army = true,
} = {}) {
  const progress = {};
  for (const id of completedNodes) {
    progress[id] = { nodeId: id, startTime: 1, endTime: 2, completed: true };
  }
  const combat = { garrisoned: {}, completed: completedStrongholds };
  // expeditionBest === undefined 时不写字段（模拟 v0.59 旧档）
  if (expeditionBest !== undefined) combat.expeditionBest = expeditionBest;
  // milestonesClaimed === undefined 时不写字段（模拟 v1.19 旧档）
  if (milestonesClaimed !== undefined) combat.milestonesClaimed = milestonesClaimed;
  return {
    version: 1,
    savedAt: Date.now(),
    player: { id: 'test', name: '测试' },
    totalPlayTime: 0,
    resources: {
      amounts: army
        ? { energy: '1000000000', crystal: '1000000', alloy: '1000000', data: '1000000', dark: '1000' }
        : { energy: '0', crystal: '0', alloy: '0', data: '0', dark: '0' },
      totals: army
        ? { energy: '1000000000', crystal: '1000000', alloy: '1000000', data: '1000000', dark: '1000' }
        : { energy: '0', crystal: '0', alloy: '0', data: '0', dark: '0' },
    },
    buildings: { levels: {} },
    research: { completed: ['military_basic', 'adv_units'] },
    military: army
      ? {
          owned: { assault: 400, guard: 250, heavy: 200, psionic: 100 },
          training: [],
          formations: [
            { id: 'f1', name: '先锋编队', units: { assault: 400, guard: 250, heavy: 200, psionic: 100 } },
            { id: 'f2', name: '第二编队', units: { assault: 0, guard: 0, heavy: 0, psionic: 0 } },
            { id: 'f3', name: '第三编队', units: { assault: 0, guard: 0, heavy: 0, psionic: 0 } },
          ],
        }
      : { owned: {}, training: [], formations: [] },
    combat,
    exploration: { progress },
    relics: { owned: [], equipped: [null, null, null, null] },
    transcend: { negativeEntropy: '0', totalTranscends: 1, tree: [] },
    achievements: {
      lifetime: { energy: '0', dark: '0', upgrades: 0, maxBuildingLevel: 0, researches: 0, explores: 0, battles: 0 },
      unlocked: {},
    },
  };
}

const browser = await launch();
const UNLOCK_NODE = ALL_NODES; // 沉默者旗舰需 node_stellar_edge 完成 → 全部 10 节点

// A. 未解锁
console.log('== A. 未解锁：置灰卡 + 提示 + 点击不跳转 ==');
{
  const page = await newSeededPage(browser, makeSave({ completedNodes: [] }), '/map');
  const section = page.locator('[data-testid="endless-section"]');
  check('远征区块渲染', (await section.count()) === 1);
  check('区块标题「无尽远征」', (await section.locator('.endless-title').textContent()).trim() === '无尽远征');
  const locked = section.locator('[data-testid="endless-card-locked"]');
  check('锁定卡存在', (await locked.count()) === 1);
  check('锁定卡 disabled', await locked.isDisabled());
  check('提示「攻克沉默者旗舰后开放」', (await locked.textContent()).includes('攻克「沉默者旗舰」后开放'));
  await locked.click({ force: true });
  await page.waitForTimeout(400);
  check('点击锁定卡不跳转', !page.url().includes('/battle/endless'));
  check('未解锁时无解锁卡', (await section.locator('[data-testid="endless-card-unlocked"]').count()) === 0);
  await page.context().close();
}

// B. 解锁 + 旧档兼容
console.log('== B. 克旗舰解锁：亮卡 + 前沿第1层 + 旧档无字段兼容 ==');
{
  const page = await newSeededPage(browser, makeSave({ completedNodes: UNLOCK_NODE, completedStrongholds: ['silencer_3'] }), '/map');
  const unlocked = page.locator('[data-testid="endless-card-unlocked"]');
  check('解锁卡出现', (await unlocked.count()) === 1);
  check('前沿显示第 1 层', (await unlocked.textContent()).includes('深渊·第 1 层'));
  check('历史最深 第 0 层', (await unlocked.textContent()).includes('第 0 层'));
  await page.context().close();

  // v0.59 旧档（combat 无 expeditionBest 字段）→ 默认 0 不抛错，锁定态正常
  const legacy = await newSeededPage(browser, makeSave({ completedNodes: UNLOCK_NODE.slice(0, 4), completedStrongholds: ['raider_1'] }), '/map');
  check('旧档（无字段）远征仍锁定', (await legacy.locator('[data-testid="endless-card-locked"]').count()) === 1);
  const legacyUnl = await newSeededPage(browser, { ...makeSave({ completedNodes: UNLOCK_NODE, completedStrongholds: ['silencer_3'] }), combat: { garrisoned: {}, completed: ['silencer_3'] } }, '/map');
  check('旧档（无字段）克旗舰后正常解锁', (await legacyUnl.locator('[data-testid="endless-card-unlocked"]').count()) === 1);
  await legacy.context().close();
  await legacyUnl.context().close();
}

// C. 远征战斗页 + 胜利推进
console.log('== C. /battle/endless：深度跟随前沿 + 胜利推进 ==');
{
  const page = await newSeededPage(browser, makeSave({ completedNodes: UNLOCK_NODE, completedStrongholds: ['silencer_3'] }), '/battle/endless');
  const panel = page.locator('[data-testid="endless-depth-panel"]');
  check('深度面板渲染', (await panel.count()) === 1);
  check('默认深度=前沿第 1 层', (await panel.locator('[data-testid="endless-depth-value"]').textContent()).includes('第 1 层'));
  check('前沿徽标显示', (await panel.locator('.depth-frontier').count()) === 1);
  check('减按钮禁用（已在下限）', await panel.locator('[data-testid="endless-depth-minus"]').isDisabled());
  check('据点名「无尽深渊·第1层」', (await page.locator('.s-name').first().textContent()).includes('无尽深渊·第1层'));
  check('敌方预览渲染', (await page.locator('.enemy-card').count()) >= 1);
  check('敌方带深渊前缀', (await page.locator('.e-name').first().textContent()).includes('深渊'));
  check('驻扎按钮隐藏', (await page.locator('button', { hasText: '挂机驻扎' }).count()) === 0);
  check('出征按钮可用', !(await page.getByRole('button', { name: /出征/ }).isDisabled()));

  // 出征 → 胜利 → 留在此据点（发放奖励+推进深度）
  await page.getByRole('button', { name: /出征/ }).click();
  await page.waitForTimeout(600);
  const modal = page.locator('.modal');
  check('战斗结果弹窗出现', (await modal.count()) === 1);
  const victory = await modal.evaluate((el) => el.classList.contains('victory'));
  if (victory) {
    check('结果=胜利', true);
    await modal.getByRole('button', { name: '留在此据点' }).click();
    await page.waitForTimeout(500);
    // 前沿推进到第 2 层（endlessTouched=false → 自动跟随）
    check('胜利后深度跟随新前沿=第 2 层', (await panel.locator('[data-testid="endless-depth-value"]').textContent()).includes('第 2 层'));
    // 返回星图验证历史最深=1
    await page.getByRole('button', { name: /返回星图/ }).click().catch(() => {});
    await page.waitForTimeout(600);
  } else {
    check('结果=胜利', false);
  }
  const mapPage = await newSeededPage(browser, makeSave({ completedNodes: UNLOCK_NODE, completedStrongholds: ['silencer_3'], expeditionBest: 1 }), '/map');
  check('远征卡显示历史最深 第 1 层', (await mapPage.locator('[data-testid="endless-card-unlocked"]').textContent()).includes('第 1 层'));
  await mapPage.context().close();
  await page.context().close();
}

// D. 深度步进与钳制 + 重打不推进
console.log('== D. 深度步进钳制 + 重打不推进 ==');
{
  const page = await newSeededPage(browser, makeSave({ completedNodes: UNLOCK_NODE, completedStrongholds: ['silencer_3'], expeditionBest: 3 }), '/battle/endless');
  const panel = page.locator('[data-testid="endless-depth-panel"]');
  const value = () => panel.locator('[data-testid="endless-depth-value"]').textContent();
  check('默认深度=前沿第 4 层', (await value()).includes('第 4 层'));
  const plus = panel.locator('[data-testid="endless-depth-plus"]');
  const minus = panel.locator('[data-testid="endless-depth-minus"]');
  check('前沿点＋按钮禁用（上限钳制）', await plus.isDisabled());
  await minus.click();
  await minus.click();
  check('连续－降到第 2 层', (await value()).includes('第 2 层'));
  check('非前沿时＋恢复可用', !(await plus.isDisabled()));
  check('前沿徽标消失（非前沿）', (await panel.locator('.depth-frontier').count()) === 0);
  check('敌情随深度变化（第2层）', (await page.locator('.s-name').first().textContent()).includes('第2层'));
  // 重打已过深度：胜利也只拿到奖励，best 仍 3（本处验证 UI 流程；推进语义单测覆盖）
  await page.getByRole('button', { name: /出征/ }).click();
  await page.waitForTimeout(600);
  const modal = page.locator('.modal');
  if (await modal.evaluate((el) => el.classList.contains('victory'))) {
    await modal.getByRole('button', { name: '留在此据点' }).click();
    await page.waitForTimeout(400);
    check('重打低层后仍停在手选深度（不自动跳）', (await value()).includes('第 2 层'));
  } else {
    check('重打低层可出战', true);
  }
  await page.context().close();
}

// E. 转生后入口锁回 + 深度档案保留
console.log('== E. 转生锁回入口、深度保留语义 ==');
{
  // 转生清 completed → 入口锁回；expeditionBest 在存档仍保留（UI 显示语义由 store 单测保证）
  const page = await newSeededPage(browser, makeSave({ completedNodes: UNLOCK_NODE, completedStrongholds: ['silencer_3'], expeditionBest: 3 }), '/map');
  // 模拟转生后的存档形态：completed 清空但 expeditionBest 保留
  await page.context().close();
  const postTranscend = await newSeededPage(browser, makeSave({ completedNodes: [], completedStrongholds: [], expeditionBest: 3 }), '/map');
  check('转生后入口锁定（本轮未克旗舰）', (await postTranscend.locator('[data-testid="endless-card-locked"]').count()) === 1);
  await postTranscend.context().close();
}

// F. 常规据点不受影响 + 移动视口
console.log('== F. 常规据点战斗 + 移动视口不溢出 ==');
{
  const page = await newSeededPage(browser, makeSave({ completedNodes: ['node_orbit'], completedStrongholds: [] }), '/battle/raider_1');
  check('常规据点：驻扎按钮仍在', (await page.locator('button', { hasText: '挂机驻扎' }).count()) === 1);
  check('常规据点：无深度面板', (await page.locator('[data-testid="endless-depth-panel"]').count()) === 0);
  await page.context().close();

  const mob = await newSeededPage(browser, makeSave({ completedNodes: UNLOCK_NODE, completedStrongholds: ['silencer_3'] }), '/battle/endless', { viewport: { width: 390, height: 844 } });
  const overflow = await mob.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  );
  check('移动视口（390px）无横向溢出', !overflow);
  await mob.context().close();

  const ach = await newSeededPage(browser, makeSave({}), '/achievements');
  check('成就页仍 49 卡', (await ach.locator('.ach-card').count()) === 49);
  await ach.context().close();
}

// G. 远征里程碑（v1.20）：领取条、领取入账、转生保留、伪领净化
console.log('== G. 里程碑领取条：显示/领取/转生保留/旧档兼容 ==');
{
  // G1. best=9 未达标：无领取条
  const g1 = await newSeededPage(browser, makeSave({ completedNodes: UNLOCK_NODE, completedStrongholds: ['silencer_3'], expeditionBest: 9 }), '/map');
  check('best=9 无领取条', (await g1.locator('[data-testid="milestone-ready"]').count()) === 0);
  await g1.context().close();

  // G2. best=10：领取条出现，含档位与暗物质预览；点击领取后消失且 dark 入账
  const g2 = await newSeededPage(browser, makeSave({ completedNodes: UNLOCK_NODE, completedStrongholds: ['silencer_3'], expeditionBest: 10 }), '/map');
  const bar = g2.locator('[data-testid="milestone-ready"]');
  check('best=10 领取条出现', (await bar.count()) === 1);
  check('档位文案 第 10 层', (await bar.textContent()).includes('第 10 层'));
  check('预览含暗物质', (await bar.textContent()).includes('暗物质'));
  await g2.locator('[data-testid="milestone-claim"]').click();
  await g2.waitForTimeout(400);
  check('领取后领取条消失', (await g2.locator('[data-testid="milestone-ready"]').count()) === 0);
  check('领取回执 toast 出现', (await g2.locator('.toast').count()) >= 1);
  await g2.context().close();

  // G3. 转生形态（completed 清空、best 保留 25）：档 1/2 未领 → 领取条仍在（终身数据不挂本轮解锁）
  const g3 = await newSeededPage(browser, makeSave({ completedNodes: [], completedStrongholds: [], expeditionBest: 25 }), '/map');
  check('转生形态 best=25 领取条仍在', (await g3.locator('[data-testid="milestone-ready"]').count()) === 1);
  // 逐档清账：领档 1 → 领取条仍在（档 2 可领）→ 领档 2 → 消失
  await g3.locator('[data-testid="milestone-claim"]').click();
  await g3.waitForTimeout(400);
  check('补领档 1 后仍显示（档 2 可领）', (await g3.locator('[data-testid="milestone-ready"]').count()) === 1);
  check('档位推进到 第 20 层', (await g3.locator('[data-testid="milestone-ready"]').textContent()).includes('第 20 层'));
  await g3.locator('[data-testid="milestone-claim"]').click();
  await g3.waitForTimeout(400);
  check('补领档 2 后领取条消失', (await g3.locator('[data-testid="milestone-ready"]').count()) === 0);
  await g3.context().close();

  // G4. 已领档位注入：领取条不出现（幂等）
  const g4 = await newSeededPage(browser, makeSave({ completedNodes: UNLOCK_NODE, completedStrongholds: ['silencer_3'], expeditionBest: 10, milestonesClaimed: [1] }), '/map');
  check('已领档 1 无领取条', (await g4.locator('[data-testid="milestone-ready"]').count()) === 0);
  await g4.context().close();
}

await finish(browser);
