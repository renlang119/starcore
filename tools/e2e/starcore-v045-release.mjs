// 星核纪元 发布校验：本地预览与远程目标冒烟
// 验证点：首屏渲染 / 版本号断言 / 十路由无错误 / 移动端无横向溢出 / 控制台无 error
// 期望版本读自仓库 package.json，避免每次发版改脚本
import { readFileSync } from 'node:fs';
import { launch, PREVIEW_URL } from './starcore-pwlib.mjs';

const EXPECTED_VERSION = `v${JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
).version}`.replace(/\.0$/, '');
// 目标：默认本地预览；SC_URL 指定远程目标；E2E_LOCAL=1 时两者同测
const TARGETS = [];
if (!process.env.SC_URL || process.env.E2E_LOCAL) TARGETS.push(['本地预览', PREVIEW_URL]);
if (process.env.SC_URL) TARGETS.push(['远程目标', process.env.SC_URL]);
const ROUTES = ['/', '/build', '/tech', '/map', '/army', '/battle', '/relic', '/prestige', '/achievements', '/archive', '/settings'];

const browser = await launch();
let fail = 0;

for (const [name, base] of TARGETS) {
  console.log(`\n===== ${name}: ${base} =====`);

  // 桌面 1280：首屏 + 版本号断言 + 十路由遍历
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const errors = [], consoleErrors = [];
    page.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`${m.text()} [loc=${m.location().url}]`); });
    await page.goto(base + '/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const version = await page.evaluate(() => document.body.innerText.match(/v\d+\.\d+(?:\.\d+)?/)?.[0] || '(无版本串)');
    console.log(`  版本号: ${version}（期望 ${EXPECTED_VERSION}）`);
    if (version !== EXPECTED_VERSION) {
      console.log(`  [FAIL] 版本号不符: 实际 ${version}, 期望 ${EXPECTED_VERSION}`);
      fail++;
    }
    console.log(`  首屏: ${await page.title()}`);
    for (const r of ROUTES) {
      const prev = page.url();
      await page.goto(base + r, { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);
    }
    console.log(`  十路由遍历: 完成（HTTP≥400: ${errors.length ? JSON.stringify(errors) : '无'}；console error: ${consoleErrors.length ? JSON.stringify(consoleErrors) : '无'}）`);
    if (errors.length || consoleErrors.length) fail++;
    await ctx.close();
  }

  // 移动 375：横向溢出检查
  {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto(base + '/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const ov = await page.evaluate(() => ({
      scrollX: window.scrollX,
      docW: document.documentElement.scrollWidth,
      winW: window.innerWidth,
    }));
    const ok = ov.scrollX === 0 && ov.docW <= ov.winW;
    console.log(`  移动375 溢出: scrollX=${ov.scrollX} doc=${ov.docW} win=${ov.winW} → ${ok ? 'OK' : 'FAIL'}`);
    if (!ok) fail++;
    await ctx.close();
  }
}

await browser.close();
console.log(`\n===== 结果: ${fail === 0 ? '全部通过' : fail + ' 项失败'} =====`);
process.exit(fail === 0 ? 0 : 1);
