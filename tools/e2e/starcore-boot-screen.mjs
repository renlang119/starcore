// 星核纪元 · 启动画面专项（v1.45）
// 首屏装载段守护：延迟应用主体分块，观测启动画面（品牌标识 + 深底 + 星核
// 装载动画）；放行后断言挂载时启动画面被 Vue 整体替换；另验装载失败的
// 静态双语错误出口。本地预览与远程目标（SC_URL）同构可跑。
import { launch, BASE_URL as URL } from './starcore-pwlib.mjs';
import fs from 'node:fs';

const OUT = '/tmp/starcore-boot-screen';
fs.mkdirSync(OUT, { recursive: true });

let pass = 0;
let fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) pass++;
  else fail++;
  console.log(`${cond ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
};

const browser = await launch();

// 延迟非入口资产（语言包与应用主体分块），让启动画面停留可观测；
// 入口分块（index-*.js）须正常执行引导链，不延迟
const delayAssets = (page, ms) =>
  page.route('**/assets/*', (route) => {
    const u = route.request().url();
    if (u.includes('/index-')) return route.continue();
    return new Promise((resolve) =>
      setTimeout(() => {
        route.continue();
        resolve();
      }, ms)
    );
  });

for (const vp of [
  { name: 'desktop-1280', width: 1280, height: 800 },
  { name: 'mobile-390', width: 390, height: 844 },
]) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
  });
  const page = await ctx.newPage();
  await delayAssets(page, 2500);
  await page.goto(URL + '/', { waitUntil: 'domcontentloaded' });

  // 1. 延迟窗口内启动画面在场且形态正确
  await page.waitForTimeout(300);
  const boot = await page.evaluate(() => {
    const el = document.querySelector('.boot-screen');
    if (!el) return { present: false };
    const cs = getComputedStyle(el);
    const star = el.querySelector('.boot-star');
    return {
      present: true,
      bg: cs.backgroundColor,
      position: cs.position,
      title: el.querySelector('.boot-title')?.textContent.trim() || '',
      sub: el.querySelector('.boot-sub')?.textContent.trim() || '',
      hasStar: !!star,
      starColor: star ? getComputedStyle(star).backgroundColor : '',
      starAnimating: star
        ? getComputedStyle(star).animationName !== 'none'
        : false,
    };
  });
  ok(`${vp.name} 启动画面在场`, boot.present);
  ok(
    `${vp.name} 深底全屏固定`,
    boot.present && boot.bg === 'rgb(5, 7, 13)' && boot.position === 'fixed',
    `${boot.bg} / ${boot.position}`
  );
  ok(
    `${vp.name} 品牌名双语`,
    boot.present && boot.title === '星核纪元' && boot.sub === 'STARCORE ERA',
    `${boot.title} / ${boot.sub}`
  );
  ok(
    `${vp.name} 星核装载动画`,
    boot.present &&
      boot.hasStar &&
      boot.starColor === 'rgb(0, 229, 255)' &&
      boot.starAnimating,
    boot.starColor
  );
  await page.screenshot({ path: `${OUT}/${vp.name}-boot.png` });

  // 2. 主体分块放行后：挂载替换启动画面、应用内容在场
  // 注：延迟路由同样拦视图懒加载分块，router-view 渲染会再晚一拍，
  // 截图前等首页核心视觉区出现，避免主区域空白截图
  await page.waitForFunction(() => !document.querySelector('.boot-screen'), {
    timeout: 20000,
  });
  await page.waitForSelector('.hero-stage', { timeout: 20000 });
  const after = await page.evaluate(() => ({
    bootGone: !document.querySelector('.boot-screen'),
    appChildren: document.getElementById('app')?.children.length || 0,
    bodyText: document.body.innerText.length,
  }));
  ok(
    `${vp.name} 挂载后启动画面移除`,
    after.bootGone && after.appChildren > 0 && after.bodyText > 50,
    `app 子节点 ${after.appChildren} / 文本 ${after.bodyText}`
  );
  await page.screenshot({ path: `${OUT}/${vp.name}-mounted.png` });
  await ctx.close();
}

// 3. 装载失败出口：应用主体分块 500，引导链中断须呈现静态双语错误画面
{
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await ctx.newPage();
  await page.route('**/assets/app-*', (route) =>
    route.fulfill({ status: 500, body: 'boom' })
  );
  const errs = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errs.push(m.text().slice(0, 120));
  });
  await page.goto(URL + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  const errView = await page.evaluate(() => {
    const el = document.querySelector('.boot-error');
    if (!el) return { present: false };
    return {
      present: true,
      text: el.textContent || '',
      hasStar: !!el.querySelector('.boot-star'),
      alert: el.getAttribute('role') === 'alert',
    };
  });
  ok('装载失败错误画面在场', errView.present);
  ok(
    '装载失败双语提示',
    errView.present &&
      errView.text.includes('加载失败，请刷新重试') &&
      errView.text.includes('Failed to load'),
    ''
  );
  ok('装载失败无装载动画且语义为警示', !errView.hasStar && errView.alert);
  ok('装载失败有控制台错误记录', errs.length > 0, errs[0] || '');
  await page.screenshot({ path: `${OUT}/boot-error.png` });
  await ctx.close();
}

await browser.close();
console.log('\n===== 汇总 =====');
console.log(`检查 ${pass + fail} 项，失败 ${fail} 项`);
// 总校：失败必须翻转退出码（finish 前断言）
if (fail > 0) process.exit(1);
process.exit(0);
