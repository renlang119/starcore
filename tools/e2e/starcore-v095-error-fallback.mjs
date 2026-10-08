// 星核纪元 v0.95 专项：错误屏出口可靠性与运行期兜底
// A. corrupt 错误屏导出：点击「导出原始存档」触发浏览器下载，内容为原始载荷
// B. 运行期兜底：注入未捕获异常 → 兜底屏出现，三出口可用
//    B1 导出存档触发下载；B2 刷新页面恢复；B3 清除存档重开后回到游戏
import { launch, check, finish, savePayload, injectSave, BASE_URL as URL } from './starcore-pwlib.mjs';

function makeSave({ energy = '1e9' } = {}) {
  const base = { energy, crystal: '1e6', alloy: '1e6', data: '1e6', dark: '1000' };
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

const browser = await launch();

// A. corrupt 错误屏导出下载
console.log('== A. corrupt 错误屏导出下载 ==');
{
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    acceptDownloads: true,
  });
  await ctx.addInitScript(() => {
    localStorage.setItem('starcore_save_v1_backup', 'not-a-valid-payload');
    localStorage.removeItem('starcore_save_v1');
  });
  const page = await ctx.newPage();
  await page.goto(URL + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const dlPromise = page.waitForEvent('download', { timeout: 6000 }).catch(() => null);
  await page.locator('button', { hasText: '导出原始存档' }).click();
  await page.waitForTimeout(400);
  const text = await page.evaluate(() => document.body.innerText);
  check('导出点击后出现下载提示', text.includes('已开始下载原始存档文件'));
  const dl = await dlPromise;
  check('触发浏览器下载', !!dl);
  if (dl) {
    const fn = dl.suggestedFilename();
    check(`下载文件名形态（实际 ${fn}）`, /^starcore-corrupt-save-\d+\.json$/.test(fn));
    const p = await dl.path().catch(() => null);
    if (p) {
      const { readFileSync } = await import('node:fs');
      check('下载内容为原始损坏载荷', readFileSync(p, 'utf8') === 'not-a-valid-payload');
    } else {
      check('下载内容可读取', false);
    }
  }
  await ctx.close();
}

// B. 运行期兜底
console.log('== B. 运行期兜底 ==');
{
  const pageErrors = [];
  const save = makeSave();
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    acceptDownloads: true,
  });
  await ctx.addInitScript(injectSave, savePayload(save));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await page.goto(URL + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  // 通过 Vue 应用实例调用已注册的全局错误处理器（等价于组件内抛出未捕获异常）
  const inject = () =>
    page.evaluate(() => {
      const app = document.querySelector('#app').__vue_app__;
      if (!app || typeof app.config.errorHandler !== 'function') return false;
      app.config.errorHandler(new Error('v095 探针'), null, 'probe');
      return true;
    });

  const pre = await page.evaluate(() => document.body.innerText);
  check('前置：正常进游戏', !pre.includes('星核运行异常') && !pre.includes('星核读取失败'));
  check('全局错误处理器已注册且可调用', await inject());
  await page.waitForTimeout(300);
  const t1 = await page.evaluate(() => document.body.innerText);
  check('兜底屏出现（标题「星核运行异常」）', t1.includes('星核运行异常'));
  check('提示含刷新重试去向', t1.includes('建议先刷新页面重试'));
  check(
    '三出口齐备（刷新/导出/清除）',
    ['刷新页面', '导出存档', '清除存档重开'].every((x) => t1.includes(x))
  );

  // B1. 导出存档出口
  const dlPromise = page.waitForEvent('download', { timeout: 6000 }).catch(() => null);
  await page.locator('button', { hasText: '导出存档' }).click();
  await page.waitForTimeout(400);
  const t2 = await page.evaluate(() => document.body.innerText);
  check('导出存档出现下载提示', t2.includes('已开始下载存档文件'));
  const dl = await dlPromise;
  check(
    '导出存档触发浏览器下载',
    !!dl && /^starcore-save-\d+\.txt$/.test(dl.suggestedFilename())
  );
  if (dl) {
    const p = await dl.path().catch(() => null);
    if (p) {
      const { readFileSync } = await import('node:fs');
      check('导出内容为 SCB1- 存档码', readFileSync(p, 'utf8').startsWith('SCB1-'));
    } else {
      check('导出内容可读取', false);
    }
  }

  // B2. 刷新页面出口
  await page.locator('button', { hasText: '刷新页面' }).click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1200);
  const t3 = await page.evaluate(() => document.body.innerText);
  check('刷新后恢复正常（无兜底屏）', !t3.includes('星核运行异常') && t3.length > 80);

  // B3. 清除存档重开出口
  check('再次注入异常', await inject());
  await page.waitForTimeout(300);
  check(
    '兜底屏再次出现',
    (await page.evaluate(() => document.body.innerText)).includes('星核运行异常')
  );
  await page.locator('button', { hasText: '清除存档重开' }).click();
  await page.waitForTimeout(1000);
  const t4 = await page.evaluate(() => document.body.innerText);
  check('清除后回到游戏（无兜底屏）', !t4.includes('星核运行异常') && t4.length > 80);
  const cleared = await page.evaluate(() => localStorage.getItem('starcore_save_v1_backup'));
  check('清除后备份通道载荷已移除', cleared === null);

  check('全程无页面未捕获异常', pageErrors.length === 0);
  await ctx.close();
}

await finish(browser);
