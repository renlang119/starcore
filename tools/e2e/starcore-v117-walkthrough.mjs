// 星核纪元 v1.17 全流程玩家走查
// 富档注档 + SPA 内真实点击：签到→建造→科技→训练→编队→探索→出征→驻扎
// →远征深度推进→遗物强化→设置页双语切换→移动端 375 九路由。
// 全程 console.error + HTTP>=400 双路监听（favicon 类只有 console 能抓到）。
import { launch, check, finish, failCount, newSeededPage, BASE_URL } from './starcore-pwlib.mjs';

const ALL_TECHS = ["fusion_tech", "energy_eff_1", "core_mining", "energy_eff_2", "dyson_theory", "crystal_eff_1", "refine_tech", "alloy_eff_1", "nano_forge_tech", "ion_casting", "alloy_eff_2", "stellar_forge_theory", "quantum_tech", "data_eff_1", "neural_arch", "research_speed", "data_eff_2", "holographic_computing", "military_basic", "weapon_upg", "armor_upg", "adv_units", "parallel_training_1", "parallel_training_2", "crystal_growth", "deep_crystal_mining", "crystal_eff_2", "silicon_ring_theory", "explore_basic", "explore_range_1", "explore_range_2", "dark_detection", "dark_matter_theory", "dark_capture", "dark_eff_1", "dark_singularity_well_theory", "singularity_theory", "prestige_boost", "offline_enhance", "stellar_charting", "wormhole_stabilization", "fleet_logistics", "dark_resonance", "starcluster_charting", "flagship_doctrine", "dark_amplifier", "precursor_memory", "arm_navigation", "armada_tactics", "dark_harvester", "neural_archive", "galaxy_charting", "galaxy_command", "dark_web", "galaxy_archive", "void_charting", "void_command", "dark_veil", "void_archive"];

function richSave() {
  return {
    version: 1,
    savedAt: Date.now(),
    player: { id: 'qa', name: '走查员' },
    totalPlayTime: 0,
    resources: {
      amounts: { energy: '1000000000', crystal: '1000000', alloy: '1000000', data: '1000000', dark: '1000' },
      totals: { energy: '2000000000', crystal: '2000000', alloy: '2000000', data: '2000000', dark: '2000' },
    },
    buildings: { levels: { solar_collector: 20, crystal_mine: 10 } },
    research: { completed: [...ALL_TECHS] },
    military: {
      owned: { assault: 500, guard: 500, heavy: 200, psionic: 100 },
      training: [],
      formations: [{ id: 'f1', name: '主力编队', units: { assault: 500, guard: 500, heavy: 200, psionic: 100 } }],
    },
    combat: { garrisoned: {}, completed: ['raider_1', 'silencer_3'], expeditionBest: 0 },
    exploration: { progress: {} },
    relics: { owned: [], equipped: [null, null, null, null] },
    transcend: { negativeEntropy: '50', totalTranscends: 1, tree: [{ id: 't_slot', level: 1 }] },
    daily: { lastCheckIn: new Date().toLocaleDateString('sv'), streak: 3, weeklyCounters: { battles: 0, explores: 0, researches: 0, upgrades: 0, transcends: 0 }, challengeWeek: '', weekChallenges: [] },
  };
}

const browser = await launch({ headless: true });
const consoleErrors = [];
function wire(page) {
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(`[console] ${m.text()} @ ${page.url()}`);
  });
  page.on('pageerror', (e) => consoleErrors.push(`[pageerror] ${e.message} @ ${page.url()}`));
  page.on('response', (r) => {
    if (r.status() >= 400 && !r.url().includes('favicon')) consoleErrors.push(`[http${r.status()}] ${r.url()}`);
  });
}

async function nav(page, label) {
  await page.locator('.side-nav .nav-item', { hasText: label }).first().click();
  await page.waitForTimeout(800);
}

// ============ A. 新档冒烟：真实起步 ============
console.log('== A. 新档冒烟 ==');
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  wire(page);
  await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' });
  // 自动首签（tick 1s）
  await page.waitForTimeout(2500);
  const badge = await page.locator('[data-testid="checkin-badge"]').textContent().catch(() => '');
  check('新档自动首签（连击 1）', badge.includes('连击 1 天'));
  await page.context().close();
}

// ============ B. 富档建造/科技页真实点击 ============
console.log('== B. 建造/科技/训练 ==');
{
  const page = await newSeededPage(browser, richSave(), '/', { waitMs: 1500 });
  wire(page);
  await nav(page, '建造');
  const card = page.locator('.build-card').filter({ hasText: '光能收集器' });
  const lvBefore = await card.locator('.b-level').textContent();
  await card.locator('button.btn-primary').first().click();
  await page.waitForTimeout(400);
  const lvAfter = await card.locator('.b-level').textContent();
  check(`建造页升级生效（${lvBefore.trim()}→${lvAfter.trim()}）`, lvBefore !== lvAfter);
  // 科技：全科技已完成 → 「全部完成」空态（显式等文本，防空态未挂载）
  await nav(page, '科技树');
  await page.getByText('所有已知科技已研究完成').waitFor({ timeout: 5000 });
  check('科技 59 项全部已完成态（空态文案在位）', true);
  // 训练：突击兵卡内 +1 → 训练（按钮在兵种卡内部）
  await nav(page, '部队');
  const assaultCard = page.locator('.unit-card', { hasText: '突击兵' }).first();
  await assaultCard.locator('.count-btn', { hasText: '+1' }).first().click();
  await assaultCard.locator('button', { hasText: '训练' }).last().click();
  await page.waitForTimeout(6000); // assault 5s 完成
  const countText = await assaultCard.locator('.u-count').textContent();
  // 全军口径：库存 500 + 编队 500 + 新训 1 = 1001
  check(`训练完成入编（${countText.trim()}）`, countText.includes('1001'));
  await page.context().close();
}

// ============ C. 探索 → 出征 → 结果弹窗 → 驻扎/撤回 ============
console.log('== C. 探索/出征/驻扎 ==');
{
  const page = await newSeededPage(browser, richSave(), '/', { waitMs: 1500 });
  wire(page);
  await nav(page, '探索');
  await page.waitForFunction(() => document.querySelectorAll('.layer-section').length === 9, { timeout: 8000 });
  check('九层分区渲染', (await page.locator('.layer-section').count()) === 9);
  // 已有 node_orbit 可用（档内未完成任何节点）：真实点击探索
  const orbitCard = page.locator('.node-card', { hasText: '轨道残骸带' }).first();
  const exploreBtn = orbitCard.locator('button', { hasText: '探索' }).first();
  check('orbit 探索按钮存在', (await exploreBtn.count()) === 1);
  await exploreBtn.click();
  await page.waitForTimeout(500);
  check('orbit 进入探索中', (await orbitCard.getAttribute('class')).includes('exploring'));
  // 据点出征：raider_1 已通关档内应显示已完成标记，重新出征仍可用
  const sCard = page.locator('.stronghold-card').first();
  await sCard.waitFor({ state: 'visible', timeout: 8000 });
  check('据点卡渲染', (await page.locator('.stronghold-card').count()) >= 1);
  await sCard.click();
  await page.waitForURL('**/battle/**', { timeout: 5000 });
  const deploy = page.locator('[data-testid="battle-start"]');
  check('出征按钮可用', !(await deploy.isDisabled()));
  await deploy.click();
  await page.waitForTimeout(800);
  check('战斗结果弹窗出现', (await page.locator('.modal-overlay, [role="dialog"], .result-modal').count()) >= 1
    || (await page.locator('button', { hasText: '留在此据点' }).count()) === 1);
  // 留在此据点 → 驻扎
  const stay = page.locator('button', { hasText: '留在此据点' });
  if ((await stay.count()) === 1) { await stay.click(); await page.waitForTimeout(300); }
  const garrisonBtn = page.locator('[data-testid="battle-garrison"]');
  check('驻扎按钮存在且可用', (await garrisonBtn.count()) === 1 && !(await garrisonBtn.isDisabled()));
  await garrisonBtn.click();
  await page.waitForTimeout(400);
  const confirmBtn = page.locator('button', { hasText: '确认驻扎' });
  check('驻扎确认弹窗出现', (await confirmBtn.count()) === 1);
  await confirmBtn.click();
  await page.waitForTimeout(400);
  check('驻扎后按钮变撤回驻扎', (await garrisonBtn.textContent()).includes('撤回驻扎'));
  await garrisonBtn.click(); // 撤回
  await page.waitForTimeout(300);
  check('撤回后恢复挂机驻扎', (await garrisonBtn.textContent()).includes('挂机驻扎'));
  await page.context().close();
}

// ============ D. 无尽远征深度推进（UI 步进 + 出征） ============
console.log('== D. 无尽远征 ==');
{
  const save = richSave();
  save.combat.expeditionBest = 3; // 前沿 = best+1 = 第4层
  const page = await newSeededPage(browser, save, '/', { waitMs: 1500 });
  wire(page);
  await nav(page, '探索');
  const endless = page.locator('[data-testid="endless-card-unlocked"]');
  check('远征卡已解锁形态', (await endless.count()) === 1);
  await endless.click();
  await page.waitForURL('**/battle/endless', { timeout: 5000 });
  const panel = page.locator('[data-testid="endless-depth-panel"]');
  await panel.waitFor({ state: 'visible', timeout: 8000 });
  const up = page.locator('[data-testid="endless-depth-plus"]');
  const down = page.locator('[data-testid="endless-depth-minus"]');
  const val = page.locator('[data-testid="endless-depth-value"]');
  // 前沿语义：depth=best+1 处 ＋ 禁用（钳制行为用 isDisabled 断言，勿点）
  check('前沿第4层 ＋ 按钮禁用', await up.isDisabled());
  check('初始深度显示前沿', (await val.textContent()).includes('前沿'));
  await down.click();
  await page.waitForTimeout(200);
  check(`降到第3层（${(await val.textContent()).trim()}）`, (await val.textContent()).replace(/\s/g, '').includes('第3层'));
  check('非前沿处 ＋ 恢复可用', !(await up.isDisabled()));
  await up.click();
  await page.waitForTimeout(200);
  check(`升回前沿第4层（${(await val.textContent()).trim()}）`, (await val.textContent()).replace(/\s/g, '').includes('第4层'));
  await page.locator('[data-testid="battle-start"]').click();
  await page.waitForTimeout(800);
  const back = page.locator('button', { hasText: '返回星图' }).last();
  if ((await back.count()) >= 1) { await back.click(); await page.waitForTimeout(400); }
  await nav(page, '探索');
  check('远征卡仍为已解锁（深度保留）', (await page.locator('[data-testid="endless-card-unlocked"]').count()) === 1);
  await page.context().close();
}

// ============ E. 遗物强化（注档 epic 能量遗物 Lv5 → 强化 Lv6） ============
console.log('== E. 遗物强化 ==');
{
  const save = richSave();
  save.relics.owned = [{ id: 'r_energy_3', instanceId: 'qa_relic_1', obtainedAt: Date.now(), level: 5 }];
  save.relics.equipped = ['qa_relic_1', null, null, null];
  const page = await newSeededPage(browser, save, '/relic', { waitMs: 1500 });
  wire(page);
  check('遗物卡渲染（Lv5）', (await page.locator('.relic-card').count()) === 1);
  await page.locator('[data-testid="enhance-button"]').click();
  await page.waitForTimeout(400);
  check('强化面板出现', (await page.locator('[data-testid="enhance-modal"]').count()) === 1);
  check('面板等级 5 / 20', (await page.locator('[data-testid="enhance-level"]').textContent()).includes('5 / 20'));
  await page.locator('[data-testid="enhance-confirm"]').click();
  await page.waitForTimeout(500);
  check('强化后面板 6 / 20', (await page.locator('[data-testid="enhance-level"]').textContent()).includes('6 / 20'));
  await page.context().close();
}

// ============ F. 设置页双语切换（SPA 内） ============
console.log('== F. 语言切换 ==');
{
  const page = await newSeededPage(browser, richSave(), '/settings', { waitMs: 1500 });
  wire(page);
  check('设置页语言区块在位', (await page.locator('.lang-list').innerText()).includes('自动（跟随浏览器）'));
  await page.locator('.lang-list .lang-item', { hasText: 'English' }).click();
  await page.waitForTimeout(1200); // 整页刷新生效
  check('切换后 html lang=en', (await page.evaluate(() => document.documentElement.lang)) === 'en');
  check('英文界面生效（侧栏 Build）', (await page.locator('.side-nav').innerText()).includes('Build'));
  // 切回简体
  await page.locator('.lang-list .lang-item', { hasText: '简体中文' }).click();
  await page.waitForTimeout(1200);
  check('切回后 html lang=zh-CN', (await page.evaluate(() => document.documentElement.lang)) === 'zh-CN');
  await page.context().close();
}

// ============ G. 移动端 375 九路由 ============
console.log('== G. 移动端 ==');
{
  const page = await newSeededPage(browser, richSave(), '/', { viewport: { width: 375, height: 812 }, waitMs: 1500 });
  wire(page);
  const routes = ['/', '/build', '/tech', '/map', '/army', '/battle/raider_1', '/relic', '/prestige', '/achievements', '/settings'];
  for (const r of routes) {
    await page.goto(BASE_URL + r, { waitUntil: 'networkidle' });
    await page.waitForTimeout(350);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(`移动端 ${r} 无横向溢出（${overflow}px）`, overflow <= 0);
  }
  // 更多面板含次级项
  await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' });
  await page.locator('.bottom-nav .tab', { hasText: '更多' }).first().click();
  await page.waitForTimeout(300);
  const moreText = await page.locator('.more-panel').innerText();
  check('更多面板含遗物/奇点重启/成就/设置', ['遗物', '奇点重启', '成就', '设置'].every((x) => moreText.includes(x)));
  await page.context().close();
}

// ============ 汇总 ============
const unique = [...new Set(consoleErrors)];
for (const e of unique) console.log('console/网络异常：' + e);
check('全程 console.error / pageerror / HTTP>=400 零命中', unique.length === 0);
await finish(browser);
