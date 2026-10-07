// 基线回归：三档视口溢出检查 + Hero 五资源节点 + 首屏正常
import { launch, PREVIEW_URL as URL } from './starcore-pwlib.mjs';

const browser = await launch();
let fails = 0;
const ok = (name, pass, detail = '') => {
  if (!pass) fails++;
  console.log(`${pass ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
};

for (const vp of [
  { name: 'desktop-1280', width: 1280, height: 800, mobile: false },
  { name: 'mobile-375', width: 375, height: 812, mobile: true },
  { name: 'mobile-360', width: 360, height: 800, mobile: true },
  { name: 'mobile-320', width: 320, height: 700, mobile: true },
]) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.mobile, hasTouch: vp.mobile,
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 100)));
  await page.goto(URL + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // A1 验证：无横向溢出
  const w = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, win: window.innerWidth }));
  ok(`${vp.name} 无横向溢出`, w.doc <= w.win, `doc=${w.doc} win=${w.win}`);

  // A2 验证（桌面+移动各一次）：hero 五资源节点齐备 + 能量节点显名（v1.41 中央圆移除后改验节点）；
  // A3 验证（v1.43）：首页顶栏资源条隐藏、他页保留
  if (vp.name === 'desktop-1280' || vp.name === 'mobile-375') {
    const hero = await page.evaluate(() => ({
      nodes: document.querySelectorAll('.hero .res-node').length,
      energyName: document.querySelector('.hero .pos-energy .node-name')?.textContent?.trim() || '',
    }));
    ok(`${vp.name} Hero 五资源节点`, hero.nodes === 5 && hero.energyName === '能量', JSON.stringify(hero));
    const pillsHome = await page.evaluate(() => document.querySelectorAll('.top-bar .res-pill').length);
    ok(`${vp.name} 首页顶栏资源隐藏`, pillsHome === 0, `pills=${pillsHome}`);
    await page.goto(URL + '/build', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    const pillsBuild = await page.evaluate(() => document.querySelectorAll('.top-bar .res-pill').length);
    ok(`${vp.name} 他页顶栏资源保留`, pillsBuild === 5, `pills=${pillsBuild}`);
    await page.goto(URL + '/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
  }

  // 首屏正常渲染
  const bodyLen = await page.evaluate(() => document.body.innerText.length);
  ok(`${vp.name} 首屏渲染`, bodyLen > 50 && errs.length === 0, errs.join(';').slice(0, 80));

  if (vp.name === 'mobile-375') await page.screenshot({ path: '/tmp/starcore-smoke/batchA-mobile375.png' });
  await ctx.close();
}

// 资源加载完整性：favicon（删 icons.svg 后确认无引用残留导致 404）
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const notFound = [];
  page.on('response', (r) => { if (r.status() === 404) notFound.push(r.url()); });
  await page.goto(URL + '/', { waitUntil: 'networkidle' });
  for (const p of ['/build', '/tech', '/map', '/army', '/relic', '/prestige']) {
    await page.goto(URL + p, { waitUntil: 'networkidle' });
  }
  await page.waitForTimeout(1000);
  ok('删冗余文件后无 404', notFound.length === 0, JSON.stringify(notFound));
  await ctx.close();
}

await browser.close();
console.log(fails ? `\n✗ ${fails} 项失败` : '\n全部通过');
process.exit(fails ? 1 : 0);
