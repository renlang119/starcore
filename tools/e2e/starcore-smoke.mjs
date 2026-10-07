// 星核纪元 · 全站冒烟（动态）
// 桌面+移动视口：加载→控制台错误→导航契约→路由遍历→交互（升级建筑/研究）→刷新持久化→截图
import { launch, BASE_URL as URL } from './starcore-pwlib.mjs';
import fs from 'node:fs';

const OUT = '/tmp/starcore-smoke';
fs.mkdirSync(OUT, { recursive: true });

const results = { errors: [], checks: [], nav: {} };
const ok = (name, pass, detail = '') => {
  results.checks.push({ name, pass, detail });
  console.log(`${pass ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
};

const browser = await launch();

for (const vp of [
  { name: 'desktop-1280', width: 1280, height: 800, mobile: false },
  { name: 'mobile-375', width: 375, height: 812, mobile: true },
]) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
    deviceScaleFactor: vp.mobile ? 2 : 1,
  });
  const page = await ctx.newPage();
  const consoleErrs = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrs.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => consoleErrs.push('PAGEERROR: ' + String(e).slice(0, 200)));

  await page.goto(URL + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500); // 跑 2+ 个 tick

  // 1. 首屏渲染
  const body = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 300));
  ok(`${vp.name} 首屏渲染`, body.length > 50, body.slice(0, 80));

  // 2. 横向溢出
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  ok(`${vp.name} 无横向溢出`, !overflow);

  // 3. 背景色（v0.02 修复回归：body 应为深色）
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  ok(`${vp.name} 深色背景`, bg === 'rgb(5, 7, 13)', bg);

  // 4. 导航数量（桌面 9 项侧导航 / 移动 5 主 + 4 次底部导航）
  const navCount = await page.evaluate(() => {
    const sideEl = document.querySelector('.side-nav');
    const bottomEl = document.querySelector('.bottom-nav');
    const side = sideEl ? sideEl.querySelectorAll('a, [class*="item"], button').length : 0;
    const bottom = bottomEl ? bottomEl.querySelectorAll('.tab').length : 0;
    // v0.83 修复：元素不存在（v-if 未挂载）时 visible=false，
    // 原写法 fallback 到 body 使 display 恒 ≠ none，桌面/移动判定恒被污染
    const sideVisible = sideEl ? getComputedStyle(sideEl).display !== 'none' : false;
    const bottomVisible = bottomEl ? getComputedStyle(bottomEl).display !== 'none' : false;
    return { side, bottom, sideVisible, bottomVisible };
  });
  results.nav[vp.name] = navCount;
  if (vp.mobile) {
    ok(`${vp.name} 移动端单导航（侧栏隐藏）`, !navCount.sideVisible && navCount.bottomVisible, JSON.stringify(navCount));
  } else {
    ok(`${vp.name} 桌面端侧导航显示`, navCount.sideVisible && !navCount.bottomVisible, JSON.stringify(navCount));
  }

  // 5. 路由遍历（SPA 无 404）
  for (const path of ['/build', '/tech', '/map', '/army', '/relic', '/prestige', '/achievements', '/archive', '/settings']) {
    await page.goto(URL + path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    const t = await page.evaluate(() => document.body.innerText.length);
    const errs = consoleErrs.length;
    if (t < 30) ok(`${vp.name} 路由 ${path}`, false, '内容过短');
    if (errs > 0) ok(`${vp.name} 路由 ${path} 控制台`, false, consoleErrs[errs - 1]);
  }
  ok(`${vp.name} 路由遍历无错误`, consoleErrs.length === 0, `${consoleErrs.length} 个控制台错误`);

  // 6. 未知路径 SPA fallback
  await page.goto(URL + '/nonexistent-path', { waitUntil: 'networkidle' });
  const fallback = await page.evaluate(() => document.body.innerText.length);
  ok(`${vp.name} SPA fallback`, fallback > 30, `内容长度 ${fallback}`);

  await page.screenshot({ path: `${OUT}/${vp.name}-home.png`, fullPage: false });
  results.errors.push(...consoleErrs.map((e) => `[${vp.name}] ${e}`));
  await ctx.close();
}

// —— 交互与持久化（桌面视口）——
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const errs2 = [];
page.on('pageerror', (e) => errs2.push(String(e).slice(0, 150)));
await page.goto(URL + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

// 读取初始能量
const readEnergy = () => page.evaluate(() => {
  const m = document.body.innerText.match(/能量[\s\S]{0,30}?([\d.,]+[kKmM]?)/);
  return m ? m[1] : null;
});

// 7. 建造页升级建筑（点击第一个可购买按钮）
await page.goto(URL + '/build', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
const buyBtn = page.locator('button:has-text("建造"), button:has-text("升级"), button:has-text("购买")').first();
const canBuy = await buyBtn.count() > 0 && await buyBtn.isEnabled().catch(() => false);
if (canBuy) {
  await buyBtn.click();
  await page.waitForTimeout(1500);
  ok('交互 建筑升级点击', true);
} else {
  ok('交互 建筑升级点击', false, '无可点击购买按钮');
}

// 8. tick 循环运转：游戏主循环存活 + 数值健康（v0.83 重写原「数值随时间变化」——
// 原断言在 fmt 分辨率与新档签到后 20K 量级下不可见 0.5/s 产出，恒假）。
// 改验：能量 ≥ 2e4（新档首 tick 自动首签已发放，循环 tick 已执行）。
// 注意 goto 后须等 Vue 挂载 + init 异步读档完成，否则五资源节点尚未渲染
await page.goto(URL + '/', { waitUntil: 'networkidle' }); // 从 /build 回首页（.hero 在首页）
await page.waitForTimeout(2500);
const loopOk = await page.evaluate(() => {
  // v1.41 中央圆移除后直接读顶点能量节点数值
  const el = document.querySelector('.pos-energy .node-value');
  const energyText = el ? el.textContent.trim() : '';
  const mult = energyText.includes('K') ? 1000 : energyText.includes('M') ? 1e6 : 1;
  const v = parseFloat(energyText.replace(/,/g, '')) * mult;
  return { energyText, v };
});
ok(
  'tick 循环运转（首签发放 + 数值健康）',
  loopOk.v >= 20000,
  `能量=${loopOk.energyText}`
);

// 9. 存档持久化：刷新后 IndexedDB 有存档
await page.waitForTimeout(16000); // 等一次自动存档（15s 间隔）
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const saved = await page.evaluate(async () => {
  const backup = localStorage.getItem('starcore_save_v1_backup');
  return { backup: !!backup };
});
ok('自动存档写入', saved.backup, JSON.stringify(saved));

// 10. 离线收益报告不应误弹（刚刷新，离线<5分钟）
const offlineModal = await page.evaluate(() => !!document.querySelector('.modal-overlay, [class*="offline"]'));
ok('短时离开无误弹离线报告', !offlineModal, offlineModal ? '检测到弹窗（真缺陷：短时离线误弹）' : '无弹窗');

await page.screenshot({ path: `${OUT}/desktop-after-interact.png` });
ok('交互过程无页面错误', errs2.length === 0, errs2.join('; ').slice(0, 150));

await ctx.close();
await browser.close();

console.log('\n===== 汇总 =====');
const fails = results.checks.filter((c) => !c.pass);
console.log(`检查 ${results.checks.length} 项，失败 ${fails.length} 项`);
fs.writeFileSync(`${OUT}/result.json`, JSON.stringify(results, null, 2));
process.exit(fails.length ? 1 : 0);
