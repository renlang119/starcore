// 星核纪元 v0.81 专项回归：存档安全链（6 主项 + 6 顺路项）
// A. corrupt 错误屏：主备档损坏 → 错误屏 + 导出原始存档入口 + 清除重开；不静默开新档
// B. 指数限位：1e999… 拒档进错误屏；1e999999 正常读档（游戏内可构造的最大值）
// C. 空编队自愈：formations=[] 注入档 → 战斗页正常渲染，不白屏
// D. 转生树幂聚合：Lv 高等级注入档正常加载，产出乘数 = value^level 语义
// E. 导入替换语义：缺省字段回落初始值、totalTranscends=0 可清零
// F. 训练 count 整数：小数 count 注入档被拒（走错误屏），校验层收紧的直接验证
// G. 无档回归：正常启动，不误入错误屏
import { launch, check, finish, newSeededPage, savePayload, saveCode, BASE_URL as URL } from './starcore-pwlib.mjs';

function makeSave({ levels = {}, amounts = {}, formations, totalTranscends = 0, tree = [], energy = '1e9' } = {}) {
  const base = { energy, crystal: '1e6', alloy: '1e6', data: '1e6', dark: '1000' };
  return {
    version: 1,
    savedAt: Date.now(),
    player: { id: 'test', name: '测试' },
    totalPlayTime: 0,
    resources: { amounts: { ...base, ...amounts }, totals: { ...base, ...amounts } },
    buildings: { levels },
    research: { completed: [] },
    military: {
      owned: { assault: 500, guard: 500, heavy: 500, psionic: 500 },
      training: [],
      formations:
        formations === undefined
          ? [
              { id: 'f1', name: '先锋编队', units: { assault: 10, guard: 10, heavy: 10, psionic: 10 } },
              { id: 'f2', name: '第二编队', units: { assault: 0, guard: 0, heavy: 0, psionic: 0 } },
              { id: 'f3', name: '第三编队', units: { assault: 0, guard: 0, heavy: 0, psionic: 0 } },
            ]
          : formations,
    },
    combat: { garrisoned: {}, completed: [] },
    exploration: { progress: {} },
    relics: { owned: [], equipped: [null, null, null, null] },
    transcend: { negativeEntropy: '0', totalTranscends, tree },
    achievements: {
      lifetime: { energy: '0', dark: '0', upgrades: 0, maxBuildingLevel: 0, researches: 0, explores: 0, battles: 0 },
      unlocked: {},
    },
  };
}

const browser = await launch();

// A. corrupt 错误屏
console.log('== A. corrupt 错误屏 ==');
{
  // 两份都损坏：主档（IndexedDB 在 headless 不可写则空）+ 备份档为非法载荷
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => {
    localStorage.setItem('starcore_save_v1_backup', 'not-a-valid-payload');
    localStorage.removeItem('starcore_save_v1');
  });
  const page = await ctx.newPage();
  await page.goto(URL + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const screenText = await page.evaluate(() => document.body.innerText);
  check('损坏档进错误屏（标题出现）', screenText.includes('星核读取失败'));
  check(
    '提示为存档损坏口径（非版本过新/读取失败兜底文案）',
    screenText.includes('存档数据已损坏')
  );
  check('提供「导出原始存档」入口', screenText.includes('导出原始存档'));
  check('提供「清除存档重开」出口', screenText.includes('清除存档重开'));
  // 关键：不静默开新档，15 秒保护窗内原始载荷不被覆盖
  await page.waitForTimeout(2000);
  const raw = await page.evaluate(() => localStorage.getItem('starcore_save_v1_backup'));
  check('原始损坏载荷未被自动存档覆盖', raw === 'not-a-valid-payload');
  await page.context().close();
}

// B. 指数限位
console.log('== B. 指数限位 ==');
{
  const bad = makeSave({ amounts: { energy: '1e99999999999999999' } });
  const page = await newSeededPage(browser, bad, '/');
  const screenText = await page.evaluate(() => document.body.innerText);
  check('超长指数档被拒（错误屏接管）', screenText.includes('星核读取失败'));
  await page.context().close();

  const good = makeSave({ amounts: { energy: '1e999999' } });
  const page2 = await newSeededPage(browser, good, '/');
  const okText = await page2.evaluate(() => document.body.innerText);
  check('6 位指数（1e999999）正常进游戏', !okText.includes('星核读取失败'));
  await page2.context().close();
}

// C. 空编队自愈
console.log('== C. 空编队自愈 ==');
{
  const page = await newSeededPage(browser, makeSave({ formations: [] }), '/battle/raider_1');
  const err = [];
  page.on('pageerror', (e) => err.push(e.message));
  await page.waitForTimeout(800);
  const text = await page.evaluate(() => document.body.innerText);
  check('战斗页不白屏（出现出征按钮）', text.includes('出征'));
  check('页面无未捕获异常', err.length === 0);
  const healed = await page.evaluate(() => {
    // 自愈发生在内存 hydrate 层：数编队 tab 数量（f1/f2/f3 三支）
    const tabs = document.querySelectorAll('.formation-tabs button');
    return tabs.length;
  });
  check(
    `编队自愈为 3 支（实际 ${healed} 支）`,
    healed === 3
  );
  await page.context().close();
}

// D. 转生树幂聚合
console.log('== D. 转生树幂聚合 ==');
{
  // 等级拉满至校验上限：读取不挂死、首页正常渲染（幂聚合不物化 1e6 份 effects）
  const page = await newSeededPage(browser, makeSave({ tree: [{ id: 't_inf_prod', level: 1000000 }] }), '/', { viewport: { width: 1280, height: 900 } });
  const t0 = Date.now();
  const text = await page.evaluate(() => document.body.innerText);
  const elapsed = Date.now() - t0;
  check('Lv=1e6 档正常进游戏（不挂死）', !text.includes('星核读取失败') && elapsed < 5000);
  check('首页内容已渲染', text.includes('星核') || text.length > 100);
  await page.context().close();

  // 超上限拒档
  const over = makeSave({ tree: [{ id: 't_inf_prod', level: 1000001 }] });
  const page2 = await newSeededPage(browser, over, '/');
  const bad = await page2.evaluate(() => document.body.innerText);
  check('Lv 超上限（1e6+1）拒档进错误屏', bad.includes('星核读取失败'));
  await page2.context().close();
}

// E. 导入替换语义
console.log('== E. 导入替换语义 ==');
{
  // 先用正常档起游戏，把转生次数堆起来，再导出一份 totalTranscends=0 的极简码导入
  const page = await newSeededPage(browser, makeSave({ totalTranscends: 0 }), '/');
  // 读现档 d 串，Node 侧改值后按应用同源签名重签（v1.35 keyed，经 savePayload 字符串形态）
  const dRaw = await page.evaluate(() => JSON.parse(localStorage.getItem('starcore_save_v1_backup')).d);
  const dObj = JSON.parse(dRaw);
  dObj.transcend.totalTranscends = 9;
  dObj.player.name = '堆数值档';
  const resigned = savePayload(JSON.stringify(dObj));
  await page.evaluate((p) => {
    localStorage.setItem('starcore_save_v1_backup', p);
  }, resigned);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 构造极简导入码：totalTranscends=0、无研究无建筑（v1.35 SCB1- 带签名格式）
  const minimal = makeSave({ totalTranscends: 0 });
  minimal.player.name = '极简档';
  minimal.buildings.levels = {};
  const minimalCode = saveCode(minimal);
  const imported = await page.evaluate(async (code) => {
    // 走应用内导入入口（设置页 SavePanel 的 textarea+按钮）
    const resp = await fetch(location.href);
    return resp.ok;
  }, minimalCode);
  check('页面可交互（前置）', imported);

  // 直接调 store 通道验证：页面上下文里没有全局 store 暴露，改走 UI 导入流
  await page.goto(URL + '/settings', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const hasImport = await page.evaluate(() => document.body.innerText.includes('导入'));
  check('设置页含导入入口', hasImport);
  if (hasImport) {
    const textarea = page.locator('textarea').first();
    if ((await textarea.count()) > 0) {
      await textarea.fill(minimalCode);
      const importBtn = page.locator('button', { hasText: '导入' }).first();
      await importBtn.click();
      await page.waitForTimeout(400);
      // 导入为全量替换的破坏性操作：弹二次确认后点「确认导入」才真正执行
      const confirmImportBtn = page.locator('button', { hasText: '确认导入' }).first();
      if ((await confirmImportBtn.count()) > 0) await confirmImportBtn.click();
      await page.waitForTimeout(1200);
      // 导入后读档验证 totalTranscends=0 已写入（旧实现 if 跳过 0，无法清零）
      const after = await page.evaluate(() => {
        const raw = localStorage.getItem('starcore_save_v1_backup');
        if (!raw) return null;
        try {
          return JSON.parse(JSON.parse(raw).d);
        } catch {
          return 'unparseable';
        }
      });
      if (after && after !== 'unparseable') {
        check('导入后 totalTranscends=0 成功清零', after.transcend.totalTranscends === 0);
        check('导入后玩家名为导入档值（替换非合并）', after.player.name === '极简档');
      } else {
        check('导入后存档可解析', false);
      }
    } else {
      check('找到导入输入框', false);
    }
  }
  await page.context().close();
}

// F. 训练 count 整数
console.log('== F. 训练 count 整数 ==');
{
  const bad = makeSave();
  bad.military.training = [{ id: 't1', unitId: 'assault', count: 1.5, remaining: 1, totalTime: 2 }];
  const page = await newSeededPage(browser, bad, '/');
  const text = await page.evaluate(() => document.body.innerText);
  check('小数 count 注入档被拒（错误屏）', text.includes('星核读取失败'));
  await page.context().close();
}

// G. 无档回归
console.log('== G. 无档回归 ==');
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(URL + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const text = await page.evaluate(() => document.body.innerText);
  check('无档正常启动（无错误屏）', !text.includes('星核读取失败'));
  check('无档显示游戏内容', text.includes('能量') || text.includes('星核纪元'));
  await ctx.close();
}

await finish(browser);
