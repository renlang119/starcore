// 星核纪元 v0.77 专项回归：UI 修复项（16 项）
// A. 首页宽度：route.meta 加宽 .content--wide（替代失效的 :deep 覆盖）
// B. toast z-index 300；五枚死样式已删除
// C. 未知据点 v-else 兜底 + 路由 catch-all
// D. Escape 关弹窗（useFocusTrap onEscape）+ 焦点入弹窗
// E. Icons 符号表全应用唯一挂载（无重复 symbol id）
// F. 键盘可达：装备槽 / 图鉴卡 / 编队卡
// G. 训练时长统一 fmtTime（队列 + 预估）
// H. 反馈口径：建造/训练开始 toast
// I. 视口允许缩放 + 移动端无横向溢出抽查
import { launch, check, finish, newSeededPage, BASE_URL as URL } from './starcore-pwlib.mjs';

function makeSave({ research = [], relics = [], equipped = [null, null, null, null], training = [] } = {}) {
  const owned = relics.map((r, i) => ({
    id: r.id,
    instanceId: `relic_v077_${i}`,
    obtainedAt: 1,
    ...(r.level ? { level: r.level } : {}),
  }));
  return {
    version: 1,
    savedAt: Date.now(),
    player: { id: 'test', name: '测试' },
    totalPlayTime: 0,
    resources: {
      amounts: { energy: '1e9', crystal: '1e6', alloy: '1e6', data: '1e6', dark: '1000' },
      totals: { energy: '1e9', crystal: '1e6', alloy: '1e6', data: '1e6', dark: '1000' },
    },
    buildings: { levels: {} },
    research: { completed: research },
    military: {
      owned: { assault: 500, guard: 500, heavy: 500, psionic: 500 },
      training,
      formations: [
        { id: 'f1', name: '先锋编队', units: { assault: 10, guard: 10, heavy: 10, psionic: 10 } },
        { id: 'f2', name: '第二编队', units: { assault: 0, guard: 0, heavy: 0, psionic: 0 } },
        { id: 'f3', name: '第三编队', units: { assault: 0, guard: 0, heavy: 0, psionic: 0 } },
      ],
    },
    combat: { garrisoned: {}, completed: [] },
    exploration: { progress: {} },
    relics: { owned, equipped },
    transcend: { negativeEntropy: '0', totalTranscends: 0, tree: [] },
    achievements: {
      lifetime: { energy: '0', dark: '0', upgrades: 0, maxBuildingLevel: 0, researches: 0, explores: 0, battles: 0 },
      unlocked: {},
    },
  };
}

const browser = await launch();

// —— A. 首页宽度 ——
console.log('== A. 首页宽度（route.meta 加宽）==');
{
  const page = await newSeededPage(browser, makeSave(), '/');
  const home = await page.evaluate(() => {
    const c = document.querySelector('.content');
    const row = document.querySelector('.home-top-row');
    return {
      wide: c.classList.contains('content--wide'),
      max: getComputedStyle(c).maxWidth,
      display: getComputedStyle(row).display,
    };
  });
  check(`首页 .content--wide 生效（max-width=${home.max}）`, home.wide && home.max === '1280px');
  check('首页双列布局生效（grid）', home.display === 'grid');
  await page.goto(URL + '/build', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const build = await page.evaluate(() => {
    const c = document.querySelector('.content');
    return { wide: c.classList.contains('content--wide'), max: getComputedStyle(c).maxWidth };
  });
  check(`非宽版页面保持 720px（max-width=${build.max}）`, !build.wide && build.max === '720px');
  await page.context().close();
}

// —— B. toast z-index + 死样式删除 ——
console.log('== B. toast z-index + 死样式 ==');
{
  const page = await newSeededPage(browser, makeSave(), '/');
  const probe = await page.evaluate(() => {
    const z = {};
    const dead = new Set();
    const deadNames = ['.card', '.glow-core', '.glow-amber', '.shadow-card', '.no-scrollbar'];
    for (const ss of document.styleSheets) {
      let rules = [];
      try {
        rules = [...ss.cssRules];
      } catch {
        continue;
      }
      for (const r of rules) {
        if (!r.selectorText) continue;
        for (const sel of r.selectorText.split(',').map((x) => x.trim())) {
          if (sel === '.toast') z.toast = r.style.zIndex;
          if (deadNames.includes(sel)) dead.add(sel);
        }
      }
    }
    return { z: z.toast, dead: [...dead] };
  });
  check(`toast z-index = 300（实际 ${probe.z}）`, probe.z === '300');
  check(`五枚死样式已删除（残留 ${probe.dead.join(',') || '无'}）`, probe.dead.length === 0);
  await page.context().close();
}

// —— C. 未知据点 / 未知路径兜底 ——
console.log('== C. 未知据点 / 未知路径兜底 ==');
{
  const page = await newSeededPage(browser, makeSave(), '/battle/no_such_id');
  check('未知据点显示兜底空态', (await page.locator('.empty-state').count()) === 1);
  check('兜底文案「据点不存在」', (await page.locator('.empty-text').textContent()) === '据点不存在');
  const backBtn = page.locator('.es-action');
  check('兜底出口按钮「返回星图」', (await backBtn.textContent()) === '返回星图');
  await backBtn.click();
  await page.waitForTimeout(500);
  check('点击返回星图 → /map', new globalThis.URL(page.url()).pathname === '/map');
  await page.context().close();

  const page2 = await newSeededPage(browser, makeSave(), '/no-such-path-v077');
  check('未知路径 catch-all 重定向首页', new globalThis.URL(page2.url()).pathname === '/');
  check('首页正常渲染', (await page2.locator('.home').count()) === 1);
  await page2.context().close();
}

// —— D. Escape 关弹窗 + 焦点陷阱 ——
console.log('== D. Escape 关弹窗 + 焦点陷阱 ==');
{
  const page = await newSeededPage(browser, makeSave(), '/army');
  await page.locator('button:text-is("编组")').click();
  await page.waitForTimeout(300);
  await page.locator('.fu-btn-wide', { hasText: '全入' }).first().click();
  await page.waitForTimeout(400);
  check('全入确认弹窗打开', (await page.locator('.modal-overlay').count()) === 1);
  const focusIn = await page.evaluate(() => !!document.activeElement?.closest('.modal-overlay'));
  check('弹窗打开后焦点在弹窗内（immediate + 首元素聚焦）', focusIn);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  check('Escape 关闭弹窗', (await page.locator('.modal-overlay').count()) === 0);
  await page.context().close();
}

// —— E. Icons 符号表唯一挂载 ——
console.log('== E. Icons 符号表唯一挂载 ==');
for (const p of ['/', '/relic']) {
  const page = await newSeededPage(browser, makeSave({ relics: [{ id: 'r_energy_1' }] }), p);
  const info = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('symbol')].map((s) => s.id);
    return { total: ids.length, unique: new Set(ids).size };
  });
  check(`${p} 符号 id 无重复（${info.total} 个，唯一 ${info.unique}）`, info.total > 0 && info.total === info.unique);
  await page.context().close();
}

// —— F. 键盘可达 ——
console.log('== F. 键盘可达：装备槽 / 卡面按钮（v0.96 起图鉴卡与编队卡去伪交互语义） ==');
{
  const page = await newSeededPage(browser, makeSave({ relics: [{ id: 'r_energy_1' }, { id: 'r_alloy_1' }], equipped: ['relic_v077_0', null, null, null] }), '/relic');
  check('初始：槽位已装备 1 件', (await page.locator('.slot-filled').count()) === 1);
  await page.locator('.slot').first().press('Enter');
  await page.waitForTimeout(400);
  check('装备槽 Enter → 卸下', (await page.locator('.slot-filled').count()) === 0);
  await page.locator('.relic-card [data-testid="equip-button"]').first().press('Enter');
  await page.waitForTimeout(400);
  check('装备按钮 Enter → 装备', (await page.locator('.slot-filled').count()) === 1);
  await page.context().close();

  const page2 = await newSeededPage(browser, makeSave(), '/army');
  await page2.locator('button:text-is("编组")').click();
  await page2.waitForTimeout(300);
  const fcard = page2.locator('.formation-card').nth(1);
  check(
    '编队卡无伪选择语义（无 role/tabindex）',
    (await fcard.getAttribute('role')) === null && (await fcard.getAttribute('tabindex')) === null
  );
  // 行内按钮原生键盘可达：聚焦 +1 后 Enter 编入（按钮序 -10/-1/+1/+10/全入/全撤）
  const plus1 = fcard.locator('.f-unit-row').first().locator('.fu-btn').nth(2);
  await plus1.focus();
  await plus1.press('Enter');
  await page2.waitForTimeout(300);
  check(
    '编队卡按钮 Enter → 编入生效',
    ((await fcard.locator('.fu-count').first().textContent()) || '').includes('编入 1')
  );
  await page2.context().close();
}

// —— G. 训练时长 fmtTime ——
console.log('== G. 训练时长统一 fmtTime ==');
{
  const training = [{ id: 'task_v077', unitId: 'assault', count: 10, remaining: 50000, totalTime: 50000 }];
  const page = await newSeededPage(browser, makeSave({ research: ['military_basic'], training }), '/army');
  const qTime = await page.locator('.q-time').first().textContent();
  check(`队列剩余时间格式化为「13h 53m」（实际 ${qTime}）`, qTime === '13h 53m');
  check('训练队列裸秒已消除（不含 "50000s"）', !(await page.locator('.train-queue').textContent()).includes('50000s'));
  await page.context().close();
}

// —— H. 反馈口径：建造 / 训练开始 toast ——
console.log('== H. 反馈口径：建造 / 训练开始 toast ==');
{
  const page = await newSeededPage(browser, makeSave(), '/build');
  await page.locator('.build-card').first().locator('button.btn-primary').click();
  await page.waitForTimeout(400);
  const buildToast = (await page.locator('.toast').count()) ? await page.locator('.toast').textContent() : '';
  check(`建造 toast 出现（「${buildToast}」）`, buildToast.startsWith('开始建造：'));
  await page.context().close();

  const page2 = await newSeededPage(browser, makeSave({ research: ['military_basic'] }), '/army');
  const unitCard = page2.locator('.unit-card').first();
  await unitCard.locator('.count-btn', { hasText: '+10' }).click();
  await page2.waitForTimeout(200);
  await unitCard.locator('button', { hasText: '训练' }).click();
  await page2.waitForTimeout(400);
  const trainToast = (await page2.locator('.toast').count()) ? await page2.locator('.toast').textContent() : '';
  check(`训练 toast 出现（「${trainToast}」）`, trainToast.startsWith('开始训练：'));
  await page2.context().close();
}

// —— I. 视口缩放 + 移动端抽查 ——
console.log('== I. 视口缩放 + 移动端抽查 ==');
{
  const page = await newSeededPage(browser, makeSave(), '/');
  const vp = await page.evaluate(() => document.querySelector('meta[name=viewport]').content);
  check(`视口 meta 允许缩放（${vp}）`, !vp.includes('user-scalable') && !vp.includes('maximum-scale'));
  await page.context().close();

  const mobile = { width: 390, height: 844 };
  for (const p of ['/', '/relic', '/army', '/map']) {
    const page2 = await newSeededPage(browser, makeSave({ relics: [{ id: 'r_energy_1' }] }), p, { viewport: mobile });
    const overflow = await page2.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    check(`${p} 移动端无横向溢出（差 ${overflow}px）`, overflow <= 1);
    await page2.context().close();
  }
}

await finish(browser);
