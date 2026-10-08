// 星核纪元 v1.22 专项回归：成就扩展
// A. 全新档：49 卡 9 区、汇总 0/49；v1.22 新成就卡渲染（合成/强化/套装/敌情/远征长线）
// B. 注档终身计数：合成 3 次 → 初试熔合解锁；强化 60 级 → 千锤百炼解锁、150 未达
// C. 注档现值指标：敌方图鉴 20 种 → 侦察分析员；56 种 → 敌情全录；套装 1 → 套装初成
// D. 远征长线：expeditionBest 30/40 → 深空远航者/深渊尽头；阈值边界 29/39 不解锁
// E. 旧档兼容：缺 synths/enhanceLevels 键的 v1.21 档不废档，新指标从 0 起算
// F. 真实操作链：合成一次 → 终身计数 +1 → 成就解锁 toast（走 relics.synthesize 注入通道）
// G. 转生保留：注档合成 2 次 + 转生后终身计数仍在；成就页汇总跨转生累计
// H. 移动视口：成就页 49 卡无横向溢出
import { launch, check, finish, newSeededPage } from './starcore-pwlib.mjs';

function makeSave({
  lifetime = {},
  unlockedKeys = [],
  totalTranscends = 0,
  resources,
} = {}) {
  const baseRes = {
    energy: '1000000000', crystal: '1000000', alloy: '1000000', data: '1000000', dark: '1000',
  };
  return {
    version: 1,
    savedAt: Date.now(),
    player: { id: 'test', name: '测试' },
    totalPlayTime: 0,
    resources: { amounts: resources ?? baseRes, totals: resources ?? baseRes },
    buildings: { levels: {} },
    research: { completed: [] },
    military: {
      owned: { assault: 400, guard: 250, heavy: 200, psionic: 100 },
      training: [],
      formations: [
        { id: 'f1', name: '先锋编队', units: { assault: 400, guard: 250, heavy: 200, psionic: 100 } },
        { id: 'f2', name: '第二编队', units: { assault: 0, guard: 0, heavy: 0, psionic: 0 } },
        { id: 'f3', name: '第三编队', units: { assault: 0, guard: 0, heavy: 0, psionic: 0 } },
      ],
    },
    combat: { garrisoned: {}, completed: [] },
    exploration: { progress: {} },
    relics: { owned: [], equipped: [null, null, null, null] },
    transcend: { negativeEntropy: '0', totalTranscends, tree: [] },
    achievements: {
      lifetime: {
        energy: '0', dark: '0', upgrades: 0, maxBuildingLevel: 0,
        researches: 0, explores: 0, battles: 0,
        ...lifetime,
      },
      unlocked: Object.fromEntries(unlockedKeys.map((k) => [k, Date.now()])),
    },
  };
}

const browser = await launch();

// A. 全新档渲染
console.log('== A. 全新档：49 卡 9 区 + 汇总 0/49 ==');
{
  const page = await newSeededPage(browser, makeSave(), '/achievements', { waitMs: 1500 });
  const cards = page.locator('.ach-card');
  check(`49 张成就卡（实际 ${await cards.count()}）`, (await cards.count()) === 49);
  const sections = await page.locator('.ach-section, section').count();
  check('成就分区渲染正常（9 区）', sections >= 9);
  const countText = (await page.locator('.summary-count').textContent()).replace(/\s/g, '');
  check(`汇总 0/49（实际 ${countText}）`, countText === '0/49');
  // 新成就卡可见（按名称定位，:text-is 精确匹配防子串误命中）
  for (const name of ['初试熔合', '千锤百炼', '套装初成', '侦察分析员', '深空远航者', '敌情全录']) {
    check(`新成就卡「${name}」渲染`, (await page.locator('.ach-card', { has: page.locator(`.ach-name:text-is("${name}")`) }).count()) === 1);
  }
  await page.context().close();
}

// B. 终身计数：合成/强化
console.log('== B. 注档终身计数：合成/强化解锁 ==');
{
  const page = await newSeededPage(
    browser,
    makeSave({ lifetime: { synths: 3, enhanceLevels: 60 } }),
    '/achievements',
    { waitMs: 1500 }
  );
  const unlocked = page.locator('.ach-card.unlocked');
  // 应解锁：ach_relic_5（合成 1）、ach_relic_6（合成 5 未达不解）→ 仅 relic_5；
  // 强化 60：ach_relic_8（10）、ach_relic_9（50）→ 两张；计 3 张
  check(`解锁 3 个成就（合成 1 档 + 强化 10/50 档，实际 ${await unlocked.count()}）`,
    (await unlocked.count()) === 3);
  for (const name of ['初试熔合', '淬炼之始', '千锤百炼']) {
    const card = page.locator('.ach-card', { has: page.locator(`.ach-name:text-is("${name}")`) });
    check(`「${name}」已解锁`, await card.evaluate((el) => el.classList.contains('unlocked')));
  }
  const cnt = (await page.locator('.summary-count').textContent()).replace(/\s/g, '');
  check(`汇总 3/49（实际 ${cnt}）`, cnt === '3/49');
  await page.context().close();
}

// C. 现值指标：敌方图鉴/套装
console.log('== C. 注档现值指标：敌情/套装解锁 ==');
{
  // 敌方图鉴键静态推导（据点表 + 中文语言包聚合，与 ENEMY_KIND_BUCKETS 同源；
  // 注 20 键 → ach_battle_8；全 56 键 → ach_battle_8/9）
  const KEYS20 = ["raider_1#0", "raider_2#1", "raider_3#1", "beast_1#0", "beast_2#0", "ruin_1#0", "ruin_2#0", "silencer_1#0", "silencer_1#1", "beast_3#0", "beast_4#0", "beast_4#1", "silencer_3#0", "raider_6#0", "raider_6#1", "raider_6#2", "beast_5#0", "beast_5#1", "beast_5#2", "beast_5#3"];
  const KEYS56 = ["raider_1#0", "raider_2#1", "raider_3#1", "beast_1#0", "beast_2#0", "ruin_1#0", "ruin_2#0", "silencer_1#0", "silencer_1#1", "beast_3#0", "beast_4#0", "beast_4#1", "silencer_3#0", "raider_6#0", "raider_6#1", "raider_6#2", "beast_5#0", "beast_5#1", "beast_5#2", "beast_5#3", "ruin_5#0", "ruin_5#1", "ruin_5#2", "ruin_5#3", "raider_7#0", "raider_7#1", "raider_7#2", "raider_7#3", "silencer_4#0", "silencer_4#1", "silencer_4#2", "raider_8#3", "beast_6#3", "ruin_6#0", "ruin_6#1", "silencer_5#0", "beast_7#4", "ruin_7#0", "ruin_7#1", "ruin_7#2", "raider_11#0", "silencer_6#0", "raider_12#0", "raider_12#1", "raider_12#2", "beast_8#0", "beast_8#1", "beast_8#2", "beast_8#4", "ruin_8#1", "ruin_8#2", "ruin_8#5", "raider_13#0", "silencer_7#0", "silencer_7#1", "silencer_7#2"];
  const mkArchive = (ks) => ({
    ...makeSave(),
    archive: { enemies: ks },
  });
  const p20 = await newSeededPage(browser, mkArchive(KEYS20), '/achievements', { waitMs: 1500 });
  const b8 = p20.locator('.ach-card', { has: p20.locator('.ach-name:text-is("侦察分析员")') });
  check('20 种敌种 →「侦察分析员」解锁', await b8.evaluate((el) => el.classList.contains('unlocked')));
  const b9a = p20.locator('.ach-card', { has: p20.locator('.ach-name:text-is("敌情全录")') });
  check('20 种未达「敌情全录」', !(await b9a.evaluate((el) => el.classList.contains('unlocked'))));
  await p20.context().close();
  const p56 = await newSeededPage(browser, mkArchive(KEYS56), '/achievements', { waitMs: 1500 });
  const b9b = p56.locator('.ach-card', { has: p56.locator('.ach-name:text-is("敌情全录")') });
  check('56 种全录 →「敌情全录」解锁', await b9b.evaluate((el) => el.classList.contains('unlocked')));
  await p56.context().close();
  // 套装现值走 relics 装备态：注档 3 件 r_dark_1/2/3 全装备 → activeFullSets=1
  const page = await newSeededPage(
    browser,
    {
      ...makeSave(),
      relics: {
        owned: [
          { id: 'r_dark_1', instanceId: 'i1', obtainedAt: Date.now(), level: 0 },
          { id: 'r_dark_2', instanceId: 'i2', obtainedAt: Date.now(), level: 0 },
          { id: 'r_dark_3', instanceId: 'i3', obtainedAt: Date.now(), level: 0 },
        ],
        equipped: ['i1', 'i2', 'i3', null],
      },
    },
    '/achievements',
    { waitMs: 1500 }
  );
  const card = page.locator('.ach-card', { has: page.locator('.ach-name:text-is("套装初成")') });
  check('「套装初成」解锁（1 个完整套装）', await card.evaluate((el) => el.classList.contains('unlocked')));
  await page.context().close();
}

// D. 远征长线：阈值边界
console.log('== D. 远征 D30/D40 边界 ==');
{
  // D29：不到 ach_battle_6；D30：解锁
  const mk = (best) => {
    const s = makeSave();
    s.combat.expeditionBest = best;
    return s;
  };
  const p29 = await newSeededPage(browser, mk(29), '/achievements', { waitMs: 1500 });
  const b6 = p29.locator('.ach-card', { has: p29.locator('.ach-name:text-is("深空远航者")') });
  check('D29 未解锁「深空远航者」', !(await b6.evaluate((el) => el.classList.contains('unlocked'))));
  await p29.context().close();
  const p30 = await newSeededPage(browser, mk(30), '/achievements', { waitMs: 1500 });
  const b6b = p30.locator('.ach-card', { has: p30.locator('.ach-name:text-is("深空远航者")') });
  check('D30 解锁「深空远航者」', await b6b.evaluate((el) => el.classList.contains('unlocked')));
  await p30.context().close();
  const p39 = await newSeededPage(browser, mk(39), '/achievements', { waitMs: 1500 });
  const b7 = p39.locator('.ach-card', { has: p39.locator('.ach-name:text-is("深渊尽头")') });
  check('D39 未解锁「深渊尽头」', !(await b7.evaluate((el) => el.classList.contains('unlocked'))));
  await p39.context().close();
  const p40 = await newSeededPage(browser, mk(40), '/achievements', { waitMs: 1500 });
  const b7b = p40.locator('.ach-card', { has: p40.locator('.ach-name:text-is("深渊尽头")') });
  check('D40 解锁「深渊尽头」', await b7b.evaluate((el) => el.classList.contains('unlocked')));
  await p40.context().close();
}

// E. 旧档兼容：缺新两键
console.log('== E. v1.21 旧档（缺 synths/enhanceLevels）不废档 ==');
{
  const save = makeSave();
  delete save.achievements.lifetime.synths;
  delete save.achievements.lifetime.enhanceLevels;
  const page = await newSeededPage(browser, save, '/achievements', { waitMs: 1500 });
  check('旧档成就页正常渲染（49 卡）', (await page.locator('.ach-card').count()) === 49);
  const cnt = (await page.locator('.summary-count').textContent()).replace(/\s/g, '');
  check(`汇总 0/49（实际 ${cnt}）`, cnt === '0/49');
  await page.context().close();
}

// F. 真实操作链：合成一次 → 计数与解锁
console.log('== F. 真实合成操作 → 终身计数 + 成就 ==');
{
  // 注档 3 件普通遗物 → 选材模式点 3 张 → 合成 → 跳成就页核对
  const page = await newSeededPage(
    browser,
    {
      ...makeSave(),
      relics: {
        owned: [
          { id: 'r_energy_1', instanceId: 'm0', obtainedAt: Date.now(), level: 0 },
          { id: 'r_alloy_1', instanceId: 'm1', obtainedAt: Date.now(), level: 0 },
          { id: 'r_data_1', instanceId: 'm2', obtainedAt: Date.now(), level: 0 },
        ],
        equipped: [null, null, null, null],
      },
    },
    '/relic',
    { waitMs: 1500 }
  );
  await page.locator('[data-testid="select-mode-button"]').click();
  await page.waitForTimeout(150);
  const pickByName = async (name, nth = 0) => {
    const card = page.locator('.relic-card', { has: page.locator(`.r-name:text-is("${name}")`) }).nth(nth);
    await card.locator('[data-testid="select-material-button"]').click();
    await page.waitForTimeout(150);
  };
  await pickByName('能量碎片');
  await pickByName('合金碎屑');
  await pickByName('数据碎片');
  check('材料槽 3 格全填', (await page.locator('.fusion-slot.filled').count()) === 3);
  await page.locator('[data-testid="fusion-button"]').click();
  await page.waitForTimeout(500);
  const modal = page.locator('.modal');
  check('产物弹窗出现', (await modal.count()) === 1);
  await modal.getByRole('button', { name: '确认' }).click();
  await page.waitForTimeout(400);
  // SPA 内导航到成就页（勿 goto 重注入冲档）
  await page.locator('.side-nav .nav-item', { hasText: '成就' }).click();
  await page.waitForTimeout(1200);
  const cnt = (await page.locator('.summary-count').textContent()).replace(/\s/g, '');
  check(`合成后汇总 ≥1/49（实际 ${cnt}）`, /^([1-9]\d*)\/49$/.test(cnt));
  const card = page.locator('.ach-card', { has: page.locator('.ach-name:text-is("初试熔合")') });
  check('「初试熔合」随真实合成解锁', await card.evaluate((el) => el.classList.contains('unlocked')));
  await page.context().close();
}

// G. 转生保留
console.log('== G. 转生后终身计数保留 ==');
{
  const page = await newSeededPage(
    browser,
    makeSave({ lifetime: { synths: 2 }, totalTranscends: 1 }),
    '/achievements',
    { waitMs: 1500 }
  );
  // 转生不清终身计数：synths=2 未达 1? 已达 → relic_5 解锁应保留（unlocked 空 → 由现值补解锁）
  const card = page.locator('.ach-card', { has: page.locator('.ach-name:text-is("初试熔合")') });
  check('转生档「初试熔合」按终身计数补解锁', await card.evaluate((el) => el.classList.contains('unlocked')));
  await page.context().close();
}

// H. 移动视口
console.log('== H. 移动视口 375 无横向溢出 ==');
{
  const page = await newSeededPage(browser, makeSave(), '/achievements', {
    viewport: { width: 375, height: 800 },
    waitMs: 1500,
  });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  );
  check('成就页无横向溢出', !overflow);
  await page.context().close();
}

await finish(browser);
