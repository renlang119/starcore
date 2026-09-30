// 星核纪元 v0.57 专项回归：成就/里程碑系统
// A. 全新档：成就页渲染（49 卡/9 分区/汇总 0/49）、导航双端入口
// B. 注入终身计数档：解锁态/进度条/汇总加成
// C. 实时解锁 + toast：注入接近阈值档 → tick 触发解锁 → toast 弹出
// D. 缺 achievements 字段的旧档兼容不废档
// E. 转生保留成就（注入转生条件档 → doTranscend 后成就仍在）
import { launch, check, finish, savePayload, BASE_URL as URL } from './starcore-pwlib.mjs';

const norm = (s) => (s || '').replace(/\s+/g, '');

function makeSave(over = {}) {
  return {
    version: 1,
    savedAt: Date.now(),
    player: { id: 'test', name: '测试' },
    totalPlayTime: 0,
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
    transcend: { negativeEntropy: '0', totalTranscends: 0, tree: [] },
    ...over,
  };
}

async function newPage(browser, save, path = '/achievements', viewport = { width: 1280, height: 900 }) {
  const payload = save === null ? null : savePayload(save);
  const ctx = await browser.newContext({ viewport });
  await ctx.addInitScript((p) => {
    if (p) localStorage.setItem('starcore_save_v1_backup', p);
    localStorage.removeItem('starcore_save_v1');
    localStorage.setItem('starcore_onboarding', JSON.stringify({}));
  }, payload);
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(URL + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  return { page, errors };
}

const browser = await launch();

// —— A. 全新档：成就页渲染 + 导航入口 ——
console.log('== A. 全新档成就页渲染与导航 ==');
{
  const { page, errors } = await newPage(browser, makeSave());
  const cards = page.locator('.ach-card');
  check(`49 张成就卡（实际 ${await cards.count()}）`, (await cards.count()) === 49);
  const sections = page.locator('.ach-section');
  check(`9 个分类区（实际 ${await sections.count()}）`, (await sections.count()) === 9);
  const countText = norm(await page.locator('.summary-count').textContent());
  check(`汇总 0/49（实际 ${countText}）`, countText === '0/49');
  check('汇总提示尚未获得加成', (await page.locator('.bonus-value').textContent()).includes('尚未获得加成'));
  // 桌面侧栏有成就入口
  check('桌面侧栏含成就导航', (await page.locator('.side-nav .nav-item', { hasText: '成就' }).count()) === 1);
  check('无 console error', errors.filter((e) => !e.includes('favicon')).length === 0);
  await page.context().close();
}
// 移动端「更多」面板含成就
{
  const { page } = await newPage(browser, makeSave(), '/', { width: 375, height: 800 });
  await page.locator('.bottom-nav .tab', { hasText: '更多' }).click();
  await page.waitForTimeout(400);
  check('移动更多面板含成就入口', (await page.locator('.more-item', { hasText: '成就' }).count()) === 1);
  await page.locator('.more-item', { hasText: '成就' }).click();
  await page.waitForTimeout(600);
  check('点击后跳转成就页', page.url().includes('/achievements'));
  await page.context().close();
}

// —— B. 注入终身计数档：解锁态/进度条/汇总 ——
console.log('== B. 终身计数档解锁态与进度条 ==');
{
  const save = makeSave({
    totalPlayTime: 3700, // > 1h → ach_time_1
    transcend: { negativeEntropy: '0', totalTranscends: 3, tree: [] }, // → ach_transcend_1/2
    achievements: {
      lifetime: {
        energy: '12000000', // > 1e7 → ach_energy_1/2；进度条第三档 1.2e7/1e9
        dark: '500', // < 1e3 → 进度条 500/1000
        upgrades: 60, // > 50 → ach_build_1
        maxBuildingLevel: 20,
        researches: 12, // > 10 → ach_tech_1
        explores: 5, // > 4 → ach_explore_1
        battles: 9, // > 8 → ach_battle_1
      },
      unlocked: {},
    },
  });
  const { page } = await newPage(browser, save);
  await page.waitForTimeout(1500); // 等首个 tick 触发 checkAndUnlock（终身计数直接达标即解锁）
  const unlockedCards = page.locator('.ach-card.unlocked');
  // 应解锁：energy_1, energy_2, build_1, tech_1, explore_1, battle_1, transcend_1, transcend_2, time_1 = 9
  check(`解锁 9 个成就（实际 ${await unlockedCards.count()}）`, (await unlockedCards.count()) === 9);
  const countText = norm(await page.locator('.summary-count').textContent());
  check(`汇总 9/49（实际 ${countText}）`, countText === '9/49');
  const bonus = await page.locator('.bonus-value').textContent();
  check(`汇总加成含全产出（实际 ${norm(bonus)}）`, bonus.includes('全产出'));
  // 进度条：暗物质 500/1,000
  const darkCard = page.locator('.ach-card', { hasText: '暗流涌动' }).first();
  const progText = norm(await darkCard.locator('.progress-text').textContent());
  check(`未解锁成就显示进度 500/1K（实际 ${progText}）`, progText === '500/1K');
  // 已解锁卡片显示时间戳
  const e1 = page.locator('.ach-card', { hasText: '星火初燃' }).first();
  check('已解锁卡片显示 ✓ 已解锁', (await e1.locator('.ach-done').textContent()).includes('已解锁'));
  await page.context().close();
}

// —— C. 实时解锁 + toast ——
console.log('== C. 实时解锁与 toast 提示 ==');
{
  // totals 与 lifetime.energy 均 99990（快照对齐后 lifetime 从装档起算，须同步注入），
  // Lv30 光能收集器产出 15/s，首个 tick 差值 +15 跨过 1e5 → toast
  const save = makeSave({
    resources: {
      amounts: { energy: '0', crystal: '0', alloy: '0', data: '0', dark: '0' },
      totals: { energy: '99990', crystal: '0', alloy: '0', data: '0', dark: '0' },
    },
    buildings: { levels: { solar_collector: 30 } }, // 有产出，tick 会推 totals 过阈值
    achievements: {
      lifetime: { energy: '99990', dark: '0', upgrades: 0, maxBuildingLevel: 0, researches: 0, explores: 0, battles: 0 },
      unlocked: {},
    },
  });
  const { page } = await newPage(browser, save, '/');
  const toast = page.locator('.ach-toast');
  await toast.waitFor({ state: 'visible', timeout: 8000 });
  check('toast 弹出', await toast.isVisible());
  const toastText = norm(await toast.textContent());
  check(`toast 显示成就解锁+星火初燃（实际 ${toastText}）`,
    toastText.includes('成就解锁') && toastText.includes('星火初燃'));
  // 等自动消失后队列清空
  await page.waitForTimeout(3000);
  check('toast 2.5s 后自动消失', !(await toast.isVisible().catch(() => false)));
  // 成就页此时应 1/49
  await page.goto(URL + '/achievements', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const countText = norm(await page.locator('.summary-count').textContent());
  check(`成就页汇总 1/49（实际 ${countText}）`, countText === '1/49');
  await page.context().close();
}

// —— D. 缺 achievements 字段的旧档兼容 ——
console.log('== D. 旧档（无 achievements 字段）兼容 ==');
{
  const save = makeSave({
    version: 1,
    totalPlayTime: undefined,
    achievements: undefined,
    transcend: { negativeEntropy: '5', totalTranscends: 2, tree: [{ id: 't_energy_1', level: 1 }] },
  });
  delete save.achievements;
  delete save.totalPlayTime;
  const { page, errors } = await newPage(browser, save);
  await page.waitForTimeout(1500);
  check('成就页正常渲染（缺成就字段旧档不废）', (await page.locator('.ach-card').count()) === 49);
  // 转生次数 2 → 追溯解锁 ach_transcend_1
  const unlocked = await page.locator('.ach-card.unlocked').count();
  check(`追溯解锁转生类成就（实际 ${unlocked} ≥ 1）`, unlocked >= 1);
  check('无 console error', errors.filter((e) => !e.includes('favicon')).length === 0);
  await page.context().close();
}

// —— E. 转生保留成就 ——
console.log('== E. 转生后成就保留 ==');
{
  const save = makeSave({
    resources: {
      amounts: { energy: '1000000', crystal: '0', alloy: '0', data: '0', dark: '0' },
      totals: { energy: '10000000', crystal: '0', alloy: '0', data: '0', dark: '0' },
    },
    achievements: {
      lifetime: { energy: '10000000', dark: '0', upgrades: 0, maxBuildingLevel: 0, researches: 0, explores: 0, battles: 0 },
      unlocked: { ach_energy_1: Date.now(), ach_energy_2: Date.now() },
    },
  });
  const { page } = await newPage(browser, save, '/prestige');
  await page.waitForTimeout(1200);
  // 执行转生（totals 1e7 ≥ 3e5 可转）
  await page.locator('.btn-transcend').click();
  await page.waitForTimeout(300);
  await page.locator('.btn-accent', { hasText: '确认重启' }).click();
  await page.waitForTimeout(800);
  // SPA 内导航到成就页（不能 page.goto——addInitScript 每次整页导航会重写注入档，冲掉转生后的内存态）
  await page.locator('.side-nav .nav-item', { hasText: '成就' }).click();
  await page.waitForTimeout(800);
  const e1 = page.locator('.ach-card', { hasText: '星火初燃' }).first();
  check('转生后 ach_energy_1 仍解锁', await e1.evaluate((el) => el.classList.contains('unlocked')));
  // 转生 1 次成就也解锁（原 0 次 + 本次 1 次）
  const t1 = page.locator('.ach-card', { hasText: '初次奇点' }).first();
  check('转生后 ach_transcend_1 解锁', await t1.evaluate((el) => el.classList.contains('unlocked')));
  await page.context().close();
}

// —— F. 远征深度里程碑（v0.69：expeditionBest 走 provider，注入档读现值解锁）——
console.log('== F. 远征深度里程碑（D10 解锁，跨转生现值判定）==');
{
  // expeditionBest: 10 → ach_battle_4 解锁；combat.completed 保持空（不影响常规据点口径）
  const save = makeSave({ combat: { garrisoned: {}, completed: [], expeditionBest: 10 } });
  const { page, errors } = await newPage(browser, save);
  const b4 = page.locator('.ach-card', { hasText: '深渊开拓者' }).first();
  check('深渊开拓者卡渲染（D10 里程碑）', (await b4.count()) === 1);
  check('D10 达标解锁', await b4.evaluate((el) => el.classList.contains('unlocked')));
  const b5 = page.locator('.ach-card', { hasText: '虚境征服者' }).first();
  check('虚境征服者未解锁（D20 未达）', !(await b5.evaluate((el) => el.classList.contains('unlocked'))));
  // 新档解锁战斗加成后汇总面板应显示攻防加成（不再「尚未获得加成」）
  check('汇总面板显示已获加成', !(await page.locator('.bonus-value').textContent()).includes('尚未获得加成'));
  check('无 console error', errors.filter((e) => !e.includes('favicon')).length === 0);
  await page.context().close();
}

await finish(browser);
