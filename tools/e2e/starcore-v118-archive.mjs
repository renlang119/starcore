// 星核纪元 v1.18 专项回归：档案馆（剧情接线 + 敌方图鉴）
// A. 全新档：档案馆页渲染（星图档案 34 节点全锁定 / 敌方档案 56 种全未知）、导航双端入口
// B. 注入探索进度档：已完成节点显示剧情文案与名称、计数已留档 N/34
// C. 注入遭遇记录档：图鉴显示名称与属性、计数已收录 N/56
// D. 战斗接线：真实点击出征 → 图鉴收录（胜负都算遭遇）
// E. 缺 archive 字段旧档兼容不废档 + 移动端路由渲染
import { launch, check, finish, savePayload, BASE_URL as URL } from './starcore-pwlib.mjs';

const norm = (s) => (s || '').replace(/\s+/g, '');

function makeSave(over = {}) {
  return {
    version: 1,
    savedAt: Date.now(),
    player: { id: 'test', name: '测试' },
    totalPlayTime: 0,
    resources: {
      amounts: { energy: '100000', crystal: '10000', alloy: '10000', data: '10000', dark: '1000' },
      totals: { energy: '100000', crystal: '10000', alloy: '10000', data: '10000', dark: '1000' },
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

async function newPage(browser, save, path = '/archive', viewport = { width: 1280, height: 900 }) {
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

// —— A. 全新档：档案馆渲染与导航入口 ——
console.log('== A. 全新档档案馆渲染 ==');
{
  const { page, errors } = await newPage(browser, makeSave());
  check('页面标题渲染', (await page.locator('.page-title').textContent()).includes('星图档案馆'));
  const storyCards = page.locator('[data-testid="archive-story-card"]');
  check(`星图档案 34 节点卡（实际 ${await storyCards.count()}）`, (await storyCards.count()) === 34);
  check('留档计数 0/34', norm(await page.locator('.count-lead').first().textContent()).includes('0/34'));
  check('锁定节点不剧透（无剧情文本泄漏）', !(await page.locator('.st-story').first().textContent()).includes('扫描器'));
  check('锁定占位文案', (await page.locator('.st-story').first().textContent()).includes('尚未踏足'));
  const enemyCards = page.locator('[data-testid="archive-enemy-card"]');
  check(`敌方档案 56 种聚合卡（实际 ${await enemyCards.count()}）`, (await enemyCards.count()) === 56);
  check('收录计数 0/56', norm(await page.locator('.count-lead').nth(1).textContent()).includes('0/56'));
  check('未遭遇显示未知敌影', (await enemyCards.first().textContent()).includes('未知敌影'));
  // 桌面侧栏 + 移动更多面板入口
  check('桌面侧栏含档案馆导航', (await page.locator('.side-nav .nav-item', { hasText: '档案馆' }).count()) === 1);
  check('无 console error', errors.filter((e) => !e.includes('favicon')).length === 0);
  await page.context().close();
}
{
  const { page } = await newPage(browser, makeSave(), '/', { width: 375, height: 800 });
  await page.locator('.bottom-nav .tab', { hasText: '更多' }).click();
  await page.waitForTimeout(400);
  check('移动更多面板含档案馆入口', (await page.locator('.more-item', { hasText: '档案馆' }).count()) === 1);
  await page.locator('.more-item', { hasText: '档案馆' }).click();
  await page.waitForTimeout(600);
  check('点击后跳转档案馆页', page.url().includes('/archive'));
  // 移动端无横向溢出
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(`移动端无横向溢出（差 ${overflow}px）`, overflow <= 1);
  await page.context().close();
}

// —— B. 注入探索进度档：剧情回读 ——
console.log('== B. 探索进度档剧情回读 ==');
{
  const save = makeSave({
    exploration: {
      progress: {
        node_orbit: { nodeId: 'node_orbit', startTime: 0, endTime: 0, completed: true },
        node_inner: { nodeId: 'node_inner', startTime: 0, endTime: 0, completed: true },
      },
    },
  });
  const { page } = await newPage(browser, save);
  const cards = page.locator('[data-testid="archive-story-card"]');
  const unlocked = cards.filter({ hasText: '轨道残骸带' });
  check('已完成节点显示名称', (await unlocked.count()) === 1);
  const storyText = await unlocked.locator('.st-story').textContent();
  check('剧情文案接线（story.ts 回读）', storyText.includes('扫描器在轨道残骸带中发现了掠夺者的踪迹'));
  check('留档计数 2/34', norm(await page.locator('.count-lead').first().textContent()).includes('2/34'));
  const locked = cards.filter({ hasText: '???' });
  check(`未完成节点仍锁定（实际 ${await locked.count()}）`, (await locked.count()) === 32);
  await page.context().close();
}

// —— C. 注入遭遇记录档：图鉴收录态 ——
console.log('== C. 遭遇记录档图鉴收录 ==');
{
  const save = makeSave({ archive: { enemies: ['raider_1#0', 'beast_1#0'] } });
  const { page } = await newPage(browser, save);
  check('收录计数 2/56', norm(await page.locator('.count-lead').nth(1).textContent()).includes('2/56'));
  const seenCards = page.locator('.enemy-card.seen');
  check(`已收录卡 2 张（实际 ${await seenCards.count()}）`, (await seenCards.count()) === 2);
  const firstSeen = seenCards.first();
  check('收录卡显示名称非占位', !(await firstSeen.textContent()).includes('未知敌影'));
  check('收录卡显示属性', (await firstSeen.locator('.e-stats').textContent()).includes('攻'));
  await page.context().close();
}

// —— D. 战斗接线：真实点击出征收录图鉴 ——
console.log('== D. 战斗接线图鉴收录 ==');
{
  // 档：完成 node_orbit（解锁 raider_1）+ 带兵编队，打 raider_1
  const save = makeSave({
    exploration: {
      progress: { node_orbit: { nodeId: 'node_orbit', startTime: 0, endTime: 0, completed: true } },
    },
    military: {
      owned: { assault: 100 },
      training: [],
      formations: [{ id: 'f1', name: '编队1', units: { assault: 100 } }],
    },
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript((p) => {
    localStorage.setItem('starcore_save_v1_backup', p);
    localStorage.removeItem('starcore_save_v1');
    localStorage.setItem('starcore_onboarding', JSON.stringify({}));
  }, savePayload(save));
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(URL + '/battle/raider_1', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const startBtn = page.locator('[data-testid="battle-start"]');
  check('出征按钮可用', !(await startBtn.isDisabled()));
  await startBtn.click();
  await page.waitForTimeout(600);
  // 战斗结果弹窗会遮挡侧栏（web-app-acceptance 已知坑）：先点「留在此据点」关闭弹窗
  const stayBtn = page.locator('.modal-overlay .btn-primary', { hasText: '留在此据点' });
  await stayBtn.waitFor({ state: 'visible', timeout: 10_000 });
  await stayBtn.click();
  await page.waitForTimeout(400);
  // SPA 导航到档案馆（勿 goto：goto 重触发 initScript 覆盖注入档）
  await page.locator('.side-nav .nav-item', { hasText: '档案馆' }).click();
  await page.waitForTimeout(800);
  check('交战后图鉴收录该据点全部敌方', norm(await page.locator('.count-lead').nth(1).textContent()).includes('1/56'));
  check('无 console error', errors.filter((e) => !e.includes('favicon')).length === 0);
  await ctx.close();
}

// —— E. 旧档兼容（无 archive 字段）——
console.log('== E. 旧档兼容 ==');
{
  const save = makeSave(); // 无 archive 字段
  const { page, errors } = await newPage(browser, save);
  check('旧档正常进档案馆页不判废', (await page.locator('.archive-view').count()) === 1);
  check('旧档图鉴 0/56 向前收集', norm(await page.locator('.count-lead').nth(1).textContent()).includes('0/56'));
  check('无 console error', errors.filter((e) => !e.includes('favicon')).length === 0);
  await page.context().close();
}

await finish(browser);