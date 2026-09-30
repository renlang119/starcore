// 星核纪元 v0.56 专项回归：转生树无限化
// A. level 格式档注入 → 买断节点显示已激活，无限区 4 节点 Lv.0
// B. 新档购买无限节点 → 扣费/升级/成本递增（5 → 8）断言
// C. 买满全部 11 买断节点后无限节点仍可购买（循环不断裂直接验证）
// D. 余额不足 → 升级按钮禁用
// 存档注入方式同 v048：addInitScript 在应用 JS 前写 localStorage 备份键。
import { launch, check, finish, savePayload, injectSave, BASE_URL as URL } from './starcore-pwlib.mjs';

const norm = (s) => (s || '').replace(/\s+/g, '');

// BUYOUT_IDS：14 个买断节点（v0.58 加 3 个自动协议；基础 11 个成本合计 40）
const BUYOUT_IDS = [
  't_energy_1', 't_alloy_1', 't_data_1', 't_crystal_1', 't_starting', 't_slot',
  't_dark_1', 't_energy_2', 't_combat_1', 't_offline', 't_prestige_boost',
  't_auto_build', 't_auto_research', 't_auto_explore',
];

function makeSave({ version = 1, ne = '0', transcends = 0, tree = [] }) {
  return {
    version,
    savedAt: Date.now(),
    player: { id: 'test', name: '测试' },
    resources: {
      amounts: { energy: '1000', crystal: '100', alloy: '100', data: '100', dark: '10' },
      totals: { energy: '1000', crystal: '100', alloy: '100', data: '100', dark: '10' },
    },
    buildings: { levels: {} },
    research: { completed: [] },
    military: { owned: {}, training: [], formations: [] },
    combat: { garrisoned: {}, completed: [] },
    exploration: { progress: {} },
    relics: { owned: [], equipped: [null, null, null, null] },
    transcend: { negativeEntropy: ne, totalTranscends: transcends, tree },
  };
}

async function newPrestigePage(browser, save) {
  const payload = savePayload(save);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(injectSave, payload);
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(URL + '/prestige', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  return { page, errors };
}

// 按名称定位树节点卡片
const cardOf = (page, name) => page.locator('.tree-node', { hasText: name }).first();
const negValue = async (page) => norm(await page.locator('.neg-value').textContent());

const browser = await launch();

// —— A. 买断节点已激活态渲染（level 格式，v0.73 起为唯一格式）——
console.log('== A. 买断节点已激活渲染 ==');
{
  const save = makeSave({
    ne: '7', transcends: 2,
    tree: [
      { id: 't_energy_1', level: 1 },
    ],
  });
  const { page, errors } = await newPrestigePage(browser, save);
  const energyCard = cardOf(page, '能量觉醒');
  check('已购买断节点显示「已激活」', norm(await energyCard.textContent()).includes('已激活'));
  const alloyCard = cardOf(page, '合金觉醒');
  check('未购买断节点仍显示购买按钮', (await alloyCard.locator('button', { hasText: '购买' }).count()) === 1);
  check('负熵余额保留 7', (await negValue(page)) === '7');
  const infCards = page.locator('.infinite-node');
  check(`无限区 4 节点（实际 ${await infCards.count()}）`, (await infCards.count()) === 4);
  const prodCard = cardOf(page, '奇点共振');
  check('无限节点初始 Lv.0', norm(await prodCard.locator('.node-level').textContent()) === 'Lv.0');
  check('无限节点初始成本 5 负熵', norm(await prodCard.locator('.node-cost').textContent()) === '5负熵');
  check('存档加载无 console error', errors.length === 0 || !errors.some((e) => !e.includes('favicon')));
  await page.context().close();
}

// —— B. 购买无限节点：扣费 / 升级 / 成本递增 ——
console.log('== B. 无限节点重复购买 ==');
{
  const save = makeSave({ ne: '20', transcends: 3, tree: [] });
  const { page } = await newPrestigePage(browser, save);
  const prodCard = cardOf(page, '奇点共振');
  check('Lv.0 按钮文案「购买」', (await prodCard.locator('button', { hasText: '购买' }).count()) === 1);
  await prodCard.locator('button').click();
  await page.waitForTimeout(300);
  check('购买后负熵 20→15', (await negValue(page)) === '15');
  check('等级 Lv.0→Lv.1', norm(await prodCard.locator('.node-level').textContent()) === 'Lv.1');
  check('下一级成本 5→8', norm(await prodCard.locator('.node-cost').textContent()) === '8负熵');
  check('按钮文案变「升级」', (await prodCard.locator('button', { hasText: '升级' }).count()) === 1);
  check('累计加成显示 当前 +10%', norm(await prodCard.locator('.node-eff-total').textContent()) === '当前+10%');
  await prodCard.locator('button').click();
  await page.waitForTimeout(300);
  check('二次购买负熵 15→7', (await negValue(page)) === '7');
  check('等级 Lv.2', norm(await prodCard.locator('.node-level').textContent()) === 'Lv.2');
  check('第三级成本 12', norm(await prodCard.locator('.node-cost').textContent()) === '12负熵');
  check('累计加成 当前 +21%（1.1²−1 取整）', norm(await prodCard.locator('.node-eff-total').textContent()) === '当前+21%');
  await page.context().close();
}

// —— C. 买满 14 买断节点后无限节点仍可购买（循环不断裂）——
console.log('== C. 买满买断后无限节点仍可购买 ==');
{
  const save = makeSave({
    ne: '30', transcends: 6,
    tree: BUYOUT_IDS.map((id) => ({ id, level: 1 })),
  });
  const { page } = await newPrestigePage(browser, save);
  const activated = await page.locator('.purchased-tag').count();
  check(`14 买断节点全部已激活（实际 ${activated}）`, activated === 14);
  const prodCard = cardOf(page, '奇点共振');
  const btn = prodCard.locator('button');
  check('无限节点购买按钮可用（余额 30 ≥ 5）', await btn.isEnabled());
  await btn.click();
  await page.waitForTimeout(300);
  check('购买成功负熵 30→25', (await negValue(page)) === '25');
  check('等级 Lv.1', norm(await prodCard.locator('.node-level').textContent()) === 'Lv.1');
  await page.context().close();
}

// —— D. 余额不足禁用 ——
console.log('== D. 余额不足升级按钮禁用 ==');
{
  const save = makeSave({ ne: '3', transcends: 1, tree: [{ id: 't_inf_prod', level: 1 }] });
  const { page } = await newPrestigePage(browser, save);
  const prodCard = cardOf(page, '奇点共振');
  check('Lv.1 恢复（level 格式 hydrate）', norm(await prodCard.locator('.node-level').textContent()) === 'Lv.1');
  check('下一级成本 8 > 余额 3 → 按钮禁用', await prodCard.locator('button').isDisabled());
  const combatCard = cardOf(page, '战争遗产');
  check('其他无限节点 Lv.0 成本 5 > 3 同样禁用', await combatCard.locator('button').isDisabled());
  await page.context().close();
}

await finish(browser);
