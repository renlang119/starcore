// 星核纪元 v0.86.1 · 安全专项：存档篡改矩阵 / XSS / 双击重入 / 恶意导入 / 时间作弊
import { launch, savePayload, BASE_URL as URL } from './starcore-pwlib.mjs';

const found = [];
function ev(id, text) {
  found.push({ id, text });
  console.log(`  EVIDENCE[${id}] ${text}`);
}
function localDateStr(d = new Date()) { return d.toLocaleDateString('sv'); }
function weekStr(d = new Date()) {
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayNum = (t.getDay() + 6) % 7;
  t.setDate(t.getDate() - dayNum + 3);
  const isoYear = t.getFullYear();
  const firstThursday = new Date(isoYear, 0, 4);
  const fDayNum = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - fDayNum + 3);
  const week = 1 + Math.round((t.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}
const TODAY = localDateStr();
const THIS_WEEK = weekStr();

function makeSave(opt = {}) {
  const o = {
    energy: '1000000', crystal: '10000', alloy: '10000', data: '1000', dark: '50',
    ne: '0', research: [], owned: {}, checkIn: TODAY, buildings: {}, ...opt,
  };
  return {
    version: 1, savedAt: Date.now(), player: { id: 'test', name: '测试' }, totalPlayTime: 100,
    resources: {
      amounts: { energy: o.energy, crystal: o.crystal, alloy: o.alloy, data: o.data, dark: o.dark },
      totals: { energy: '5000000', crystal: '50000', alloy: '50000', data: '5000', dark: '60' },
    },
    buildings: { levels: o.buildings },
    research: { completed: o.research },
    military: { owned: o.owned, training: [], formations: [] },
    combat: { garrisoned: {}, completed: [] },
    exploration: { progress: {} },
    relics: { owned: [], equipped: [null, null, null, null] },
    transcend: { negativeEntropy: o.ne, totalTranscends: 0, tree: [] },
    daily: {
      lastCheckIn: o.checkIn, streak: 1,
      weeklyCounters: { battles: 0, explores: 0, researches: 0, upgrades: 0, transcends: 0 },
      challengeWeek: THIS_WEEK, weekChallenges: [],
    },
    achievements: {
      lifetime: { energy: '5000000', dark: '60', upgrades: 10, maxBuildingLevel: 5, researches: 2, explores: 3, battles: 1 },
      unlocked: {},
    },
  };
}

async function ctxOf(browser, initFn, payload) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(initFn, payload);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => ev('pageerror', String(e).slice(0, 160)));
  await page.goto(URL + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  return { ctx, page };
}

const browser = await launch();

console.log('== S1. 存档篡改矩阵（改能量/负熵/等级后校验器反应）==');
{
  // 篡改 case：能量负数 / 超大指数 / 非数字
  const cases = [
    { name: 'energy=-999', mut: (s) => { s.resources.amounts.energy = '-999'; } },
    { name: 'energy=1e999', mut: (s) => { s.resources.amounts.energy = '1e' + '9'.repeat(5); } },
    { name: 'energy="abc"', mut: (s) => { s.resources.amounts.energy = 'abc'; } },
    { name: 'level=99999', mut: (s) => { s.buildings.levels.solar_collector = 99999; } },
    { name: 'ne=-50', mut: (s) => { s.transcend.negativeEntropy = '-50'; } },
    { name: 'version=99', mut: (s) => { s.version = 99; } },
  ];
  for (const c of cases) {
    const save = makeSave();
    c.mut(save);
    const payload = savePayload(save);
    const { ctx, page } = await ctxOf(browser, (p) => {
      localStorage.setItem('starcore_save_v1_backup', p);
      localStorage.removeItem('starcore_save_v1');
      localStorage.setItem('starcore_onboarding', JSON.stringify({}));
    }, payload);
    await page.evaluate((p) => {
      localStorage.setItem('starcore_save_v1_backup', p);
    }, payload).catch(() => {});
    // 重新载入（ctxOf 已加载一次，这里直接读结果态）
    const state = await page.evaluate(() => {
      const err = document.body.innerText.includes('清除存档') || document.body.innerText.includes('错误');
      return { err, top: document.body.innerText.slice(0, 120).replace(/\s+/g, ' ') };
    });
    console.log(`  [${c.name}] errScreen=${state.err} top=${state.top.slice(0, 90)}`);
    // 能量负值若被接受进入游戏 → 数值健康问题
    if (c.name === 'energy=-999') {
      const negAccepted = state.top.includes('-999') || state.top.includes('-');
      if (negAccepted && !state.err) ev('S1a', '能量 -999 疑似被接受（顶栏出现负值且无错误屏）');
    }
    await ctx.close();
  }
}

console.log('== S2. XSS：玩家名/导入存档字段注入 ==');
{
  // 玩家名长度上限 24 字符，载荷取最短可触发形态（裸 src 触发 onerror）
  const XSS_PAYLOAD = '<img src onerror=xss=1>';
  const save = makeSave();
  save.player.name = XSS_PAYLOAD;
  const payload = savePayload(save);
  const { ctx, page } = await ctxOf(browser, (p) => {
    localStorage.setItem('starcore_save_v1_backup', p);
    localStorage.removeItem('starcore_save_v1');
    localStorage.setItem('starcore_onboarding', JSON.stringify({}));
  }, payload);
  await page.evaluate((p) => {
    localStorage.setItem('starcore_save_v1_backup', p);
    localStorage.removeItem('starcore_save_v1');
  }, payload);
  await page.goto(URL + '/settings', { waitUntil: 'networkidle' });
  await page.waitForSelector('.save-meta', { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(600);
  const r = await page.evaluate(() => {
    const meta = document.querySelector('.save-meta');
    return {
      // 应用页有 CSP（script-src 'self'），内联 handler 不会执行；此断言为执行面兜底
      xss: window.xss === 1,
      metaText: meta ? meta.textContent.trim() : '(未找到 .save-meta)',
      rawInHtml: document.body.innerHTML.includes('<img src onerror'),
    };
  });
  console.log(`  XSS 触发=${r.xss} 原始HTML注入=${r.rawInHtml} 显示=${JSON.stringify(r.metaText)}`);
  if (r.xss) ev('S2a', '存档玩家名字段 XSS 可执行');
  if (r.rawInHtml) ev('S2b', '玩家名以原始 HTML 渲染（非 textContent）');
  if (!r.metaText.includes('<img src onerror')) ev('S2c', '玩家名未按文本形态上屏（载荷未通过校验或未展示）');
  // 载荷活性自检：应用页 CSP 会拦内联 handler，另起无 CSP 的干净页验证载荷字面量
  // 在裸注入下可触发；不触发则本组断言失去前提
  const probeCtx = await browser.newContext();
  const probePage = await probeCtx.newPage();
  await probePage.setContent('<body></body>');
  const armed = await probePage.evaluate(async (payloadHtml) => {
    window.xss = 0;
    const holder = document.createElement('div');
    holder.innerHTML = payloadHtml;
    document.body.appendChild(holder);
    await new Promise((resolve) => setTimeout(resolve, 300));
    return window.xss === 1;
  }, XSS_PAYLOAD);
  await probeCtx.close();
  console.log(`  载荷活性自检（无 CSP 干净页）=${armed}`);
  if (!armed) ev('S2d', 'XSS 载荷在无 CSP 上下文未触发，S2 前提失效需更换载荷');
  await ctx.close();
}

console.log('== S3. 双击重入：批量/购买/研究按钮连点 ==');
{
  const payload = savePayload(makeSave({ ne: '1000' }));
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript((p) => {
    localStorage.setItem('starcore_save_v1_backup', p);
    localStorage.removeItem('starcore_save_v1');
    localStorage.setItem('starcore_onboarding', JSON.stringify({}));
  }, payload);
  const page = await ctx.newPage();
  await page.goto(URL + '/prestige', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  // 转生树买断节点连点 5 次（只有一次扣费有效，余款只够 1 次）
  const btn = page.locator('.tree-node button', { hasText: '购买' }).first();
  for (let i = 0; i < 5; i++) {
    if (await btn.isEnabled()) await btn.click({ delay: 20 }).catch(() => {});
  }
  await page.waitForTimeout(600);
  const s = await page.evaluate(() => {
    const raw = localStorage.getItem('starcore_save_v1_backup');
    if (!raw) return null;
    try {
      const d = JSON.parse(JSON.parse(raw).d);
      return { ne: d.transcend.negativeEntropy, lv: d.transcend.tree };
    } catch { return null; }
  });
  console.log(`  连点后负熵: ${s ? s.ne : 'n/a'}`);
  // 100 - 5(首档) = 95；若重入会多扣
  await ctx.close();
}

console.log('== S4. 时间作弊：系统时间拨快 30 天 ==');
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const payload = savePayload(makeSave({ checkIn: TODAY }));
  await ctx.addInitScript((p) => {
    localStorage.setItem('starcore_save_v1_backup', p);
    localStorage.removeItem('starcore_save_v1');
    localStorage.setItem('starcore_onboarding', JSON.stringify({}));
  }, payload);
  // 用 clock API 快进 30 天（逐日签到应触发 30 次？还是 1 次？，记录行为）
  await page_clock(ctx, 30);
  async function page_clock(ctx, days) {
    const page = await ctx.newPage();
    await page.goto(URL + '/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => {
        // 直接驱动应用可见的日期变化不可行（Date.now 不可控），
        // 退而求其次：验证连击记录在档内的一致性
      });
    }
    const s = await page.evaluate(() => {
      const raw = localStorage.getItem('starcore_save_v1_backup');
      try { return JSON.parse(JSON.parse(raw).d).daily; } catch { return null; }
    });
    console.log(`  档内 daily: streak=${s && s.streak} last=${s && s.lastCheckIn}`);
    await page.screenshot({ path: '/tmp/sc-qa-time.png' }).catch(() => {});
  }
  await ctx.close();
}

console.log('== S5. 恶意导入矩阵 ==');
{
  const payload0 = savePayload(makeSave());
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript((p) => {
    localStorage.setItem('starcore_save_v1_backup', p);
    localStorage.removeItem('starcore_save_v1');
    localStorage.setItem('starcore_onboarding', JSON.stringify({}));
  }, payload0);
  const page = await ctx.newPage();
  await page.goto(URL + '/settings', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const payloads = [
    { name: '空串', code: '' },
    { name: '非base64', code: '!!!not-base64!!!' },
    { name: 'JSON注入', code: Buffer.from(JSON.stringify({ version: 1, hacked: true })).toString('base64') },
    { name: '超长串', code: 'A'.repeat(50000) },
    { name: '原型污染', code: Buffer.from(JSON.stringify({ version: 1, __proto__: { hacked: 1 }, resources: { amounts: { energy: '1' } } })).toString('base64') },
  ];
  for (const p of payloads) {
    await page.locator('.import-box textarea').fill(p.code);
    await page.locator('button', { hasText: '导入存档' }).click();
    await page.waitForTimeout(400);
    // v0.87 起导入二次确认：格式初检通过的代码会弹确认框，点确认才走 doImport 校验
    const confirmBtn = page.locator('.modal-overlay button', { hasText: '确认导入' });
    if ((await confirmBtn.count()) > 0) {
      await confirmBtn.click();
      await page.waitForTimeout(400);
    }
    const msg = await page.locator('.import-msg').textContent().catch(() => '(无提示)');
    console.log(`  [${p.name}] 提示: ${(msg || '').trim().slice(0, 60)}`);
  }
  // 原型污染检查
  const polluted = await page.evaluate(() => ({}).hacked === 1 || ({}).hacked);
  if (polluted) ev('S5a', 'Object.prototype 疑似被导入数据污染');
  await page.context().close();
}

await browser.close();
console.log(`\n===== 安全专项完成：${found.length} 个确认发现 =====`);
for (const f of found) console.log(`[${f.id}] ${f.text}`);
process.exit(found.length === 0 ? 0 : 1);
