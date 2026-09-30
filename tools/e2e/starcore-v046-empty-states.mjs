// 星核纪元 v0.46 回归：四页空状态 + EmptyState 组件
// 存档注入方式：context.addInitScript(payload)——在应用 JS 执行前写入 localStorage，
// 规避「旧页面 beforeunload saveSync 覆盖备份」的时序问题。
import { launch, check, finish, savePayload, PREVIEW_URL as URL } from './starcore-pwlib.mjs';

const TECH_IDS = ["fusion_tech", "energy_eff_1", "core_mining", "energy_eff_2", "dyson_theory", "crystal_eff_1", "refine_tech", "alloy_eff_1", "nano_forge_tech", "ion_casting", "alloy_eff_2", "stellar_forge_theory", "quantum_tech", "data_eff_1", "neural_arch", "research_speed", "data_eff_2", "holographic_computing", "military_basic", "weapon_upg", "armor_upg", "adv_units", "parallel_training_1", "parallel_training_2", "crystal_growth", "deep_crystal_mining", "crystal_eff_2", "silicon_ring_theory", "explore_basic", "explore_range_1", "explore_range_2", "dark_detection", "dark_matter_theory", "dark_capture", "dark_eff_1", "dark_singularity_well_theory", "singularity_theory", "prestige_boost", "offline_enhance", "stellar_charting", "wormhole_stabilization", "fleet_logistics", "dark_resonance", "starcluster_charting", "flagship_doctrine", "dark_amplifier", "precursor_memory", "arm_navigation", "armada_tactics", "dark_harvester", "neural_archive", "galaxy_charting", "galaxy_command", "dark_web", "galaxy_archive", "void_charting", "void_command", "dark_veil", "void_archive"];
const NODE_IDS = ["node_orbit", "node_inner", "node_outer", "node_deep", "node_stellar_gate", "node_stellar_mine", "node_stellar_forge", "node_stellar_dead", "node_stellar_core", "node_stellar_edge", "node_cluster_gate", "node_cluster_swarm", "node_cluster_ruin", "node_cluster_heart", "node_cluster_hollow", "node_cluster_silence", "node_arm_gate", "node_arm_cradle", "node_arm_grave", "node_arm_spine", "node_arm_abyss", "node_arm_threshold", "node_galaxy_gate", "node_galaxy_range", "node_galaxy_archive", "node_galaxy_hub", "node_galaxy_halo", "node_galaxy_heart", "node_void_gate", "node_void_beacon", "node_void_watch", "node_void_hub", "node_void_veil", "node_void_origin"];
const BUILDING_IDS = ["solar_collector", "fusion_reactor", "core_extractor", "dyson_swarm", "crystal_mine", "crystal_nursery", "deep_crystal_drill", "silicon_ring", "refinery", "nano_forge", "ion_casting_plant", "stellar_forge", "dark_detector", "dark_matter_lab", "dark_capture_station", "dark_singularity_well", "data_center", "quantum_lab", "neural_hub", "holographic_core"];

function makeSave({ allTechs = false, allBuildingsMaxed = false, allNodesCompleted = false, militaryBasic = false } = {}) {
  const levels = {};
  if (allBuildingsMaxed) for (const id of BUILDING_IDS) levels[id] = 10;
  const progress = {};
  for (const id of NODE_IDS) progress[id] = { nodeId: id, startTime: 0, endTime: 0, completed: allNodesCompleted };
  const research = { completed: allTechs ? TECH_IDS : militaryBasic ? ['military_basic', 'explore_basic', 'fusion_tech'] : [] };
  return {
    version: 1,
    savedAt: Date.now(),
    player: { id: 'test', name: '测试' },
    resources: {
      amounts: { energy: '1000000000', crystal: '1000000', alloy: '100000', data: '100000', dark: '0' },
      totals: { energy: '1000000000', crystal: '1000000', alloy: '100000', data: '100000', dark: '0' },
    },
    buildings: { levels },
    research,
    military: { owned: {}, training: [], formations: [] },
    combat: { garrisoned: {}, completed: [] },
    exploration: { progress },
    relics: { owned: [], equipped: [null, null, null, null] },
    transcend: { negativeEntropy: '0', totalTranscends: 0, tree: [] },
  };
}

// 新开 context（可选注入存档），返回 page
async function newPage(browser, save = null) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  if (save) {
    const payload = savePayload(save);
    await ctx.addInitScript(
      (p) => {
        localStorage.setItem('starcore_save_v1_backup', p);
        localStorage.removeItem('starcore_save_v1');
      },
      payload
    );
  } else {
    await ctx.addInitScript(() => {
      localStorage.clear();
      indexedDB.deleteDatabase('starcore');
    });
  }
  return ctx.newPage();
}

const browser = await launch();
const consoleErrors = [];

// —— 1. 全新存档：基本渲染无空态 ——
console.log('== 全新存档基本渲染 ==');
{
  const page = await newPage(browser);
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  await page.goto(URL + '/build', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  check('Build 页显示建筑卡（无空态）', (await page.locator('.build-card').count()) > 0);
  check('Build 页无空态', (await page.locator('.empty-state').count()) === 0);
  await page.goto(URL + '/tech', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  check('Tech 页显示科技卡（无空态）', (await page.locator('.tech-card').count()) > 0);
  await page.goto(URL + '/map', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  check('Map 页显示节点卡（无空态）', (await page.locator('.node-card').count()) > 0);
  await ctx_close(page);
}
async function ctx_close(page) { await page.context().close(); }

// —— 2. ArmyView 空态：未解锁军事 ——
console.log('== ArmyView 空态（未解锁军事）==');
{
  const page = await newPage(browser); // 全新档：无军事科技
  await page.goto(URL + '/army', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  check('显示空态', (await page.locator('.empty-state').count()) === 1);
  check('文案 = 尚未组建部队', (await page.locator('.empty-state').textContent()).includes('尚未组建部队'));
  check('有「前往科技」按钮', (await page.locator('.empty-state button', { hasText: '前往科技' }).count()) === 1);
  await page.locator('.empty-state button', { hasText: '前往科技' }).click();
  await page.waitForTimeout(500);
  check('点击跳转到 /tech', page.url().endsWith('/tech'));
  await page.context().close();
}

// —— 3. RelicView 空态 ——
console.log('== RelicView 空态 ==');
{
  const page = await newPage(browser);
  await page.goto(URL + '/relic', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  check('文案 = 尚未发现遗物', (await page.locator('.empty-state').textContent()).includes('尚未发现遗物'));
  check('有「前往探索」按钮', (await page.locator('.empty-state button', { hasText: '前往探索' }).count()) === 1);
  await page.locator('.empty-state button', { hasText: '前往探索' }).click();
  await page.waitForTimeout(500);
  check('点击跳转到 /map', page.url().endsWith('/map'));
  await page.context().close();
}

// —— 4. ArmyView 空态 2：已解锁但无部队（v0.48 改版：轻提示 + 卡片同屏，不再有死按钮）——
console.log('== ArmyView 空态（已解锁无部队）==');
{
  const page = await newPage(browser, makeSave({ militaryBasic: true }));
  await page.goto(URL + '/army', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  check('文案 = 部队尚未组建', (await page.locator('.empty-state').textContent()).includes('部队尚未组建'));
  check('无「训练部队」死按钮（v0.48 修复）', (await page.locator('.empty-state button', { hasText: '训练部队' }).count()) === 0);
  check('单位卡片同屏渲染（训练入口可用）', (await page.locator('.unit-card').count()) > 0);
  check('仍在 /army', page.url().endsWith('/army'));
  await page.context().close();
}

// —— 5. TechView 空态：全部科技完成 ——
console.log('== TechView 空态（全部完成）==');
{
  const page = await newPage(browser, makeSave({ allTechs: true }));
  await page.goto(URL + '/tech', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  check('显示全完成空态', (await page.locator('.empty-state').count()) === 1);
  check('文案 = 所有已知科技已研究完成', (await page.locator('.empty-state').textContent()).includes('所有已知科技已研究完成'));
  await page.context().close();
}

// —— 5b. BuildView：锁定扇区不显示空态（锁定卡保留预告价值）——
// 注：建筑定义当前无 maxLevel 字段，「全部满级」触发条件数据上暂不成立，逻辑保留待数据演进
console.log('== BuildView 锁定扇区（无空态，锁定卡预告）==');
{
  const page = await newPage(browser, makeSave({})); // 无科技：深空扇区全锁
  await page.goto(URL + '/build', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  check('能量扇区正常显示建筑卡', (await page.locator('.build-card').count()) > 0);
  // 切到未解锁扇区（若有）——检查锁定卡仍显示且无空态
  const tabs = await page.locator('.sector-tab').count();
  if (tabs > 1) {
    await page.locator('.sector-tab').nth(tabs - 1).click();
    await page.waitForTimeout(500);
    check('锁定扇区显示锁定卡（预告）', (await page.locator('.build-card.locked').count()) > 0);
    check('锁定扇区无空态', (await page.locator('.empty-state').count()) === 0);
  }
  await page.context().close();
}

// —— 5c. MapView 空态：全部节点完成 ——
console.log('== MapView 空态（全部探索完毕）==');
{
  const page = await newPage(browser, makeSave({ allNodesCompleted: true }));
  await page.goto(URL + '/map', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  check('显示探索完毕空态', (await page.locator('.empty-state').count()) === 1);
  check('文案 = 全宇宙已探索完毕', (await page.locator('.empty-state').textContent()).includes('全宇宙已探索完毕'));
  await page.context().close();
}

// —— 6. 全新档十路由 console error ——
console.log('== 十路由 console error ==');
{
  const page = await newPage(browser);
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  for (const r of ['/', '/build', '/tech', '/map', '/army', '/battle/raider_1', '/relic', '/prestige', '/achievements', '/settings']) {
    await page.goto(URL + r, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
  }
  await page.context().close();
}
check(`无 console error（共 ${consoleErrors.length}）`, consoleErrors.length === 0);
if (consoleErrors.length) console.log('   ' + JSON.stringify(consoleErrors, null, 2));

await finish(browser);
