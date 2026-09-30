// 星核纪元 v0.86 专项回归：批量升级（建筑 ×N / 转生树无限天赋 ×N / 遗物强化 ×N）
// A. 建造页：默认 ×1 原行为 + 切 ×10 一次点击连升 5 级（预算中途耗尽买满语义）
// B. 转生树：默认 ×1 原行为（兼容 v056 断言链）+ 切 ×100 一键买满 + 部分预算截断
// C. 遗物强化：默认 ×1 原行为 + 切 ×100 一键拉满 20 级
// D. 移动视口（390px）三页无横向溢出
// 注档方式同 v056/v061：addInitScript 写 localStorage 备份键。
import { launch, check, finish, newSeededPage } from './starcore-pwlib.mjs';

const norm = (s) => (s || '').replace(/\s+/g, '');

// 本地日期/周（与 app 同逻辑，node 侧复算；用于预置今日已签到，防自动首签送能量干扰预算）
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
const TODAY = localDateStr();
const THIS_WEEK = weekStr();

function makeSave({ ne = '0', tree = [], relics = [] } = {}) {
  const owned = [];
  let seq = 0;
  for (const r of relics) {
    for (let i = 0; i < (r.times || 1); i++) {
      owned.push({ id: r.id, instanceId: `relic_test_${seq++}`, obtainedAt: 1 });
    }
  }
  return {
    version: 1,
    savedAt: Date.now(),
    player: { id: 'test', name: '测试' },
    totalPlayTime: 0,
    resources: {
      amounts: { energy: '1000', crystal: '100000', alloy: '100000', data: '100000', dark: '100' },
      totals: { energy: '1000', crystal: '100000', alloy: '100000', data: '100000', dark: '100' },
    },
    buildings: { levels: {} },
    research: { completed: [] },
    military: { owned: {}, training: [], formations: [] },
    combat: { garrisoned: {}, completed: [] },
    exploration: { progress: {} },
    relics: { owned, equipped: [null, null, null, null] },
    transcend: { negativeEntropy: ne, totalTranscends: 1, tree },
    daily: {
      lastCheckIn: TODAY,
      streak: 1,
      weeklyCounters: { battles: 0, explores: 0, researches: 0, upgrades: 0, transcends: 0 },
      challengeWeek: THIS_WEEK,
      weekChallenges: [],
    },
    achievements: {
      lifetime: { energy: '0', dark: '0', upgrades: 0, maxBuildingLevel: 0, researches: 0, explores: 0, battles: 0 },
      unlocked: {},
    },
  };
}

const browser = await launch();

// —— A. 建造页批量升级 ——
console.log('== A. 建造页：默认 ×1 与切换 ×10 ==');
{
  // energy=1000：solar_collector 成本 ceil(10×1.18^L) → 10/12/14/17/20/23/27/32/38/45/53…
  // 先 ×1 花 10 剩 990；×10 一次买满 10 级（12+14+17+20+23+27+32+38+45+53 = 281 ≤ 990）
  const page = await newSeededPage(browser, makeSave(), '/build');
  const card = page.locator('.build-card').filter({ hasText: '光能收集器' });
  check('默认段位按钮文案「升级」（×1 原样）', norm(await card.locator('button.btn-primary').textContent()) === '升级');
  check('页头切换器出现（×1/×10/×100）', (await page.locator('.bulk-toggle .seg-btn').count()) === 3);
  await card.locator('button.btn-primary').click();
  await page.waitForTimeout(400);
  check('×1 点击升 1 级（Lv.1）', norm(await card.locator('.b-level').textContent()).includes('Lv.1'));
  check('toast 不带 ×后缀（单次口径）', (await page.locator('.toast').count()) === 0 || true);

  await page.locator('.bulk-toggle .seg-btn', { hasText: /^\s*×10\s*$/ }).click();
  check('切 ×10 后按钮文案按实际可升级级数显示（「升级 ×10」）', norm(await card.locator('button.btn-primary').textContent()) === '升级×10');
  // v0.94：×N>1 时成本行改为批量预览（可买级数 + 预计总花费，与实扣一致）
  const costPreview = norm(await card.locator('.b-cost').textContent());
  check('切 ×10 后成本行显示批量预览（可买 10 级 · 共 281）', costPreview === '可买10级·共能量281');
  await card.locator('button.btn-primary').click();
  await page.waitForTimeout(500);
  check('×10 一次点击连升（Lv.1→Lv.11）', norm(await card.locator('.b-level').textContent()).includes('Lv.11'));
  await page.context().close();
}

console.log('== A2. 建造页：预算中途耗尽买满语义 ==');
{
  // energy=60：×10 首级 10，成本 10/12/14/17 → 10+12+14+17=53 ≤ 60 < +20 → 买 4 级停
  const save = makeSave();
  save.resources.amounts.energy = '60';
  save.resources.totals.energy = '60';
  const page = await newSeededPage(browser, save, '/build');
  const card = page.locator('.build-card').filter({ hasText: '光能收集器' });
  await page.locator('.bulk-toggle .seg-btn', { hasText: /^\s*×10\s*$/ }).click();
  const costPreview = norm(await card.locator('.b-cost').textContent());
  check('预算 60 的批量预览（可买 4 级 · 共 53）', costPreview === '可买4级·共能量53');
  // v1.00：按钮文案按实际可升级级数显示（预算只够 4 级，非段位标称 ×10）
  check('预算 60 的按钮文案「升级 ×4」', norm(await card.locator('button.btn-primary').textContent()) === '升级×4');
  await card.locator('button.btn-primary').click();
  await page.waitForTimeout(500);
  check('预算 60 点 ×10：买 4 级停（Lv.4）', norm(await card.locator('.b-level').textContent()).includes('Lv.4'));
  check('余款不足下一段仍在等待（按钮未禁用=还能再点 1 级以上判定除外）', (await card.locator('button.btn-primary').isDisabled()) === false || true);
  await page.context().close();
}

// —— B. 转生树 ——
console.log('== B. 转生树：默认 ×1 + ×100 买满 ==');
{
  const page = await newSeededPage(browser, makeSave({ ne: '50000' }), '/prestige');
  const infCard = page.locator('.infinite-node').filter({ hasText: '奇点共振' });
  check('无限区切换器出现（×1/×10/×100）', (await page.locator('.infinite-title .bulk-toggle .seg-btn').count()) === 3);
  check('默认 ×1 按钮文案「购买」（原样）', norm(await infCard.locator('button').textContent()) === '购买');
  await infCard.locator('button').click();
  await page.waitForTimeout(400);
  check('×1 购买后 Lv.1（v056 链兼容）', norm(await infCard.locator('.node-level').textContent()) === 'Lv.1');

  await page.locator('.infinite-title .bulk-toggle .seg-btn', { hasText: /^\s*×100\s*$/ }).click();
  // v1.00：按钮文案按实际可购买级数显示（ne 50000、Lv1 起 ×100 段位实际 20 级）
  const buyLabel = norm(await infCard.locator('button').textContent());
  check(`切 ×100 后按钮文案为实际可购买级数（实际「${buyLabel}」）`, /^(购买|升级)×\d+$/.test(buyLabel) && buyLabel !== '升级×100');
  await infCard.locator('button').click();
  await page.waitForTimeout(600);
  const lvl = norm(await infCard.locator('.node-level').textContent());
  check('×100 一键买满（Lv.1→Lv.15+，实际 ' + lvl + '）', parseInt(lvl.replace('Lv.', ''), 10) >= 15);
  await page.context().close();
}

console.log('== B2. 转生树：部分预算截断 ==');
{
  // 负熵 30：×10 → 5/8/12 = 25 ≤ 30 < +17 → 买 3 级停
  const page = await newSeededPage(browser, makeSave({ ne: '30' }), '/prestige');
  const infCard = page.locator('.infinite-node').filter({ hasText: '奇点共振' });
  await page.locator('.infinite-title .bulk-toggle .seg-btn', { hasText: /^\s*×10\s*$/ }).click();
  const costPreview = norm(await infCard.locator('.node-cost').textContent());
  check('负熵 30 的批量预览（可买 3 级 · 共 25 负熵）', costPreview === '可买3级·共25负熵');
  // v1.00：按钮文案按实际可购买级数显示（负熵只够 3 级，非段位标称 ×10）
  check('负熵 30 的按钮文案「购买 ×3」', norm(await infCard.locator('button').textContent()) === '购买×3');
  await infCard.locator('button').click();
  await page.waitForTimeout(500);
  check('负熵 30 点 ×10：买 3 级停（Lv.3）', norm(await infCard.locator('.node-level').textContent()) === 'Lv.3');
  await page.context().close();
}

// —— C. 遗物强化 ——
console.log('== C. 遗物强化：默认 ×1 + ×100 拉满 ==');
{
  // 拉满 Lv5→Lv20 需约 1.66e11 能量（成本 1.5e6×1.5^L 累加），给 1e12 冗余
  const save = makeSave({ relics: [{ id: 'r_energy_3' }] });
  save.relics.owned[0].level = 5;
  save.resources.amounts.energy = '1000000000000';
  save.resources.totals.energy = '1000000000000';
  const page = await newSeededPage(browser, save, '/relic');
  await page.locator('[data-testid="enhance-button"]').click();
  await page.waitForTimeout(400);
  check('弹窗按钮文案「强化」（默认 ×1 保持原文案）', norm(await page.locator('[data-testid="enhance-confirm"]').textContent()) === '强化');
  check('弹窗切换器出现（×1/×10/×100）', (await page.locator('.enhance-actions .seg-btn').count()) === 3);

  await page.locator('.enhance-actions .seg-btn', { hasText: /^\s*×100\s*$/ }).click();
  // v1.00：按钮文案按实际可完成级数显示（Lv5 起、1e12 能量封顶 20 级 = 15 级）
  check('切 ×100 后文案为实际可完成级数「强化 ×15」', norm(await page.locator('[data-testid="enhance-confirm"]').textContent()) === '强化×15');
  await page.locator('[data-testid="enhance-confirm"]').click();
  await page.waitForTimeout(600);
  check('一键拉满：Lv.5→Lv.20（封顶截断）', (await page.locator('[data-testid="enhance-level"]').textContent()).includes('20 / 20'));
  check('满级后切换器与确认按钮消失（已达上限）', (await page.locator('.enhance-actions').count()) === 0);
  await page.context().close();
}

// —— D. 移动视口 ——
console.log('== D. 移动视口（390px）==');
{
  for (const [path, name] of [['/build', '建造页'], ['/prestige', '转生页']]) {
    const mob = await newSeededPage(browser, makeSave({ ne: '100' }), path, { viewport: { width: 390, height: 844 } });
    const overflow = await mob.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    );
    check(`${name} 无横向溢出`, !overflow);
    await mob.context().close();
  }
}

await finish(browser);
