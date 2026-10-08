// 星核纪元 v0.84 回归：工程卫生核验（SC_URL 可指定远程）
// A. 新档首帧「本周挑战」即生成：clock 冻结（无任何 tick 触发）下 3 行挑战仍就位
// B. SideNav 存储键迁移：旧键（冒号风格）读取一次后迁移，切换写新键
// C. 全局 Toast 无障碍：role=status + aria-live=polite（经 /build 首卡建造触发）
// D. 星核核心键盘可达：Space 触发跳转 /build
// E. og 分享卡元数据：og:image 指 /og.webp + twitter:card=summary_large_image + WebP 可访问
// F. 移动端 toast 抬高避开 extra-nav：bottom 128px + 战斗页 extra-nav 不重叠
// G. 引导气泡层级定标：.ob-core 变体类承载 position/z-index（60），不随打包顺序漂移
import { launch, check, finish, savePayload, injectSave, newSeededPage, BASE_URL as URL } from './starcore-pwlib.mjs';

function makeSave() {
  const base = { energy: '1e9', crystal: '1e6', alloy: '1e6', data: '1e6', dark: '1000' };
  return {
    version: 1,
    savedAt: Date.now(),
    player: { id: 'test', name: '测试' },
    totalPlayTime: 0,
    resources: { amounts: { ...base }, totals: { ...base } },
    buildings: { levels: {} },
    research: { completed: [] },
    military: {
      owned: { assault: 500, guard: 500, heavy: 500, psionic: 500 },
      training: [],
      formations: [
        { id: 'f1', name: '先锋编队', units: { assault: 10, guard: 10, heavy: 10, psionic: 10 } },
        { id: 'f2', name: '第二编队', units: { assault: 0, guard: 0, heavy: 0, psionic: 0 } },
        { id: 'f3', name: '第三编队', units: { assault: 0, guard: 0, heavy: 0, psionic: 0 } },
      ],
    },
    combat: { garrisoned: {}, completed: [] },
    exploration: { progress: {} },
    relics: { owned: [], equipped: [null, null, null, null] },
    transcend: { negativeEntropy: '0', totalTranscends: 0, tree: [] },
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

/** 新建上下文（预置引导已读，避免气泡干扰；init 可附加 localStorage 键值） */
async function newCtx(browser, init) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript((extra) => {
    localStorage.setItem('starcore_onboarding', JSON.stringify({}));
    if (extra) {
      for (const [k, v] of Object.entries(extra)) localStorage.setItem(k, v);
    }
  }, init || null);
  return ctx;
}

const browser = await launch();

// A. 新档首帧周挑战，
console.log('== A. 新档首帧周挑战（clock 冻结，无 tick 也生成）==');
{
  const ctx = await newCtx(browser);
  const page = await ctx.newPage();
  await page.clock.install({ time: new Date('2026-09-10T12:00:00') });
  await page.goto(URL + '/', { waitUntil: 'networkidle' });
  let count = 0;
  try {
    await page.waitForSelector('.challenge-row', { timeout: 2500 });
    count = await page.locator('.challenge-row').count();
  } catch {
    count = 0;
  }
  check(`时钟冻结下「本周挑战」仍生成 3 行（实际 ${count}）`, count === 3);
  const nameOk = await page.evaluate(() => {
    const el = document.querySelector('.challenge-row .c-name');
    return !!el && el.textContent.trim().length > 0;
  });
  check('挑战行名称渲染非空', nameOk);
  await ctx.close();
}

// B. SideNav 存储键迁移，
console.log('== B. SideNav 存储键迁移 ==');
{
  const ctx = await newCtx(browser, { 'starcore:sidenav-collapsed': 'true' });
  const page = await ctx.newPage();
  await page.goto(URL + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const collapsed = await page.locator('.side-nav.collapsed').count();
  check('旧键=true 时侧栏初始为折叠态', collapsed === 1);
  const ls1 = await page.evaluate(() => ({
    n: localStorage.getItem('starcore_sidenav_collapsed'),
    o: localStorage.getItem('starcore:sidenav-collapsed'),
  }));
  check(`旧键读取一次后迁移到新键（新键=${ls1.n}）`, ls1.n === 'true');
  check('旧键已清除', ls1.o === null);
  await page.locator('.collapse-toggle').click();
  await page.waitForTimeout(250);
  const ls2 = await page.evaluate(() => localStorage.getItem('starcore_sidenav_collapsed'));
  check(`切换后写新键 false（实际 ${ls2}）`, ls2 === 'false');
  await ctx.close();
}

// C. 全局 Toast 无障碍，
console.log('== C. 全局 Toast 无障碍 ==');
{
  const page = await newSeededPage(browser, makeSave(), '/build', { waitMs: 1000 });
  const ctx = page.context();
  await page.locator('.build-card').first().locator('button.btn-primary').click();
  await page.locator('.toast').waitFor({ timeout: 3000 });
  const t = await page.evaluate(() => {
    const el = document.querySelector('.toast');
    return {
      role: el.getAttribute('role'),
      live: el.getAttribute('aria-live'),
      text: el.textContent.trim(),
    };
  });
  check(`Toast 出现（「${t.text}」）`, t.text.startsWith('开始建造：'));
  check(`role=status（实际 ${t.role}）`, t.role === 'status');
  check(`aria-live=polite（实际 ${t.live}）`, t.live === 'polite');
  await ctx.close();
}

// D. 首页核心视觉区空格键，
console.log('== D. 首页核心视觉区空格键 ==');
{
  const ctx = await newCtx(browser);
  const page = await ctx.newPage();
  await page.goto(URL + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.locator('.hero-stage').focus();
  await page.keyboard.press('Space');
  await page.waitForTimeout(500);
  const path = await page.evaluate(() => location.pathname);
  check(`Space 触发跳转 /build（实际 ${path}）`, path === '/build');
  await ctx.close();
}

// E. og 分享卡元数据，
console.log('== E. og 分享卡元数据 ==');
{
  const ctx = await newCtx(browser);
  const page = await ctx.newPage();
  await page.goto(URL + '/', { waitUntil: 'networkidle' });
  const og = await page.locator('meta[property="og:image"]').getAttribute('content');
  const tw = await page.locator('meta[name="twitter:card"]').getAttribute('content');
  // 部署侧注入后远程为绝对地址（仓库与本地预览保持相对形态）
  const expectOg = process.env.SC_URL ? `${URL}/og.webp` : '/og.webp';
  check(`og:image = ${expectOg}（实际 ${og}）`, og === expectOg);
  check(`twitter:card = summary_large_image（实际 ${tw}）`, tw === 'summary_large_image');
  const ogUrl = await page.locator('meta[property="og:url"]').getAttribute('content');
  const expectHome = process.env.SC_URL ? `${URL}/` : '/';
  check(`og:url = ${expectHome}（实际 ${ogUrl}）`, ogUrl === expectHome);
  // canonical 为部署侧随注入添加（仓库 link href 目录形态会致构建失败，仓库与 preview 无此标签）
  const canonicalCount = await page.locator('link[rel="canonical"]').count();
  if (process.env.SC_URL) {
    const canonical = canonicalCount ? await page.locator('link[rel="canonical"]').getAttribute('href') : null;
    check(`canonical = ${URL}/（实际 ${canonical}）`, canonical === `${URL}/`);
  } else {
    check('preview 无 canonical（部署侧注入）', canonicalCount === 0);
  }
  check('noscript 提示存在', (await page.locator('noscript').count()) === 1);
  const resp = await page.request.get(URL + '/og.webp');
  const ct = resp.headers()['content-type'] || '';
  check(`og.webp 可访问（HTTP ${resp.status()}，${ct}）`, resp.status() === 200 && ct.includes('image/webp'));
  await ctx.close();
}

// F. 移动端 toast 抬高避开 extra-nav，
console.log('== F. 移动端 toast 抬高避开 extra-nav ==');
{
  // 窄视口（不设 isMobile，沿用项目惯例）
  const vw = { width: 390, height: 844 };
  const ctx = await browser.newContext({ viewport: vw });
  await ctx.addInitScript(injectSave, savePayload(makeSave()));

  // toast：/build 首卡建造触发
  const page = await ctx.newPage();
  await page.goto(URL + '/build', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.locator('.build-card').first().locator('button.btn-primary').click();
  await page.locator('.toast').waitFor({ timeout: 3000 });
  const toastBottom = await page.evaluate(() => {
    const el = document.querySelector('.toast');
    return parseFloat(getComputedStyle(el).bottom);
  });
  check(`移动端 toast bottom = 128px（实际 ${toastBottom}）`, toastBottom === 128);

  // extra-nav：任意 /battle 路径移动端渲染（AppShell 按路由显隐）
  const page2 = await ctx.newPage();
  await page2.goto(URL + '/battle/silencer_1', { waitUntil: 'networkidle' });
  await page2.waitForTimeout(1000);
  const nav = await page2.evaluate(() => {
    const el = document.querySelector('.extra-nav');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: r.top };
  });
  check('战斗页 extra-nav 渲染', nav !== null);
  if (nav) {
    // toast 下沿（视口高 - 128）须高于 extra-nav 上沿才不重叠
    check(
      `toast 下沿 ${vw.height - 128}px 高于 extra-nav 上沿 ${Math.round(nav.top)}px`,
      vw.height - 128 < nav.top
    );
  }
  await ctx.close();
}

// G. 引导气泡层级定标，
console.log('== G. 引导气泡层级定标 ==');
{
  // 空引导标记 → 首页 home-core 气泡出现；定位与层级由父级 .ob-core 承载
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(injectSave, savePayload(makeSave()));
  const page = await ctx.newPage();
  await page.goto(URL + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const bubble = page.locator('.ob-core');
  check('首页 home-core 引导气泡渲染', (await bubble.count()) === 1);
  if ((await bubble.count()) === 1) {
    const style = await bubble.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { position: cs.position, zIndex: cs.zIndex };
    });
    check(`气泡定位 absolute（实际 ${style.position}）`, style.position === 'absolute');
    check(`气泡层级 z-index 60（实际 ${style.zIndex}）`, style.zIndex === '60');
  }
  await ctx.close();
}

await finish(browser);
