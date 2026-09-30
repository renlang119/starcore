// 基线回归：三档视口溢出检查 + Hero 产出率显示 + 首屏正常
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

  // A2 验证（桌面+移动各一次）：hero 产出率无重复 /s
  if (vp.name === 'desktop-1280' || vp.name === 'mobile-375') {
    const heroRate = await page.evaluate(() => document.querySelector('.hero .rate-display')?.innerText || 'NOT FOUND');
    ok(`${vp.name} Hero 产出率格式`, heroRate !== 'NOT FOUND' && !heroRate.includes('/s /s'), JSON.stringify(heroRate));
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
