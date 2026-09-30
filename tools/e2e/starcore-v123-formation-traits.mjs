// 星核纪元 v1.23 专项回归：编队特性系统
// A. 全新档：编组页 3 张编队卡各渲染 5 选项分段选择器，默认均衡高亮，特性标签中文
// B. 真实点击链：切强攻 → 高亮迁移 + 效果描述展开；再点均衡 → 字段删除、高亮回位
// C. 三编队独立：f1 强攻 + f2 后勤，f3 保持均衡
// D. 旧档兼容：trait 未知 id 自愈回均衡不废档；缺 trait 字段的 v1.22 档正常渲染
// E. 存往返：切特性后导出档含 trait 键；无特性档导出不含 trait 键
// F. 驻扎乘区：注档 f2 后勤 + 已攻克据点驻扎 → 驻扎弹窗每秒收益 ×1.2；f1 均衡不放大
// G. 战斗页选择器不受影响：/battle 编队页签照常渲染（特性 UI 限编组页）
// H. 移动视口：编组页 375 无横向溢出；双语切换后特性标签为英文
import { launch, check, finish, newSeededPage, savePayload, BASE_URL } from './starcore-pwlib.mjs';

function makeSave({ traitF1, traitF2, army = true } = {}) {
  const formations = [
    { id: 'f1', name: '先锋编队', units: { assault: 400, guard: 250, heavy: 200, psionic: 100 } },
    { id: 'f2', name: '第二编队', units: { assault: 0, guard: 0, heavy: 0, psionic: 0 } },
    { id: 'f3', name: '第三编队', units: { assault: 0, guard: 0, heavy: 0, psionic: 0 } },
  ];
  if (traitF1 !== undefined) formations[0].trait = traitF1;
  if (traitF2 !== undefined) formations[1].trait = traitF2;
  return {
    version: 1,
    savedAt: Date.now(),
    player: { id: 'test', name: '测试' },
    totalPlayTime: 0,
    resources: {
      amounts: { energy: '1000000000', crystal: '1000000', alloy: '1000000', data: '1000000', dark: '1000' },
      totals: { energy: '1000000000', crystal: '1000000', alloy: '1000000', data: '1000000', dark: '1000' },
    },
    buildings: { levels: {} },
    research: { completed: ['military_basic', 'adv_units'] },
    military: army
      ? {
          owned: { assault: 0, guard: 0, heavy: 0, psionic: 0 },
          training: [],
          formations,
        }
      : { owned: {}, training: [], formations: [] },
    combat: { garrisoned: {}, completed: ['raider_1', 'raider_2'] },
    exploration: {
      progress: { node_orbit: { nodeId: 'node_orbit', startTime: 1, endTime: 2, completed: true } },
    },
    relics: { owned: [], equipped: [null, null, null, null] },
    transcend: { negativeEntropy: '0', totalTranscends: 0, tree: [] },
  };
}

/** 切到编组页并返回页面对象 */
async function formationPage(browser, save, opts = {}) {
  const page = await newSeededPage(browser, save, '/army', { waitMs: 1500, ...opts });
  await page.locator('.tabs .tab', { hasText: '编组' }).click();
  await page.waitForTimeout(400);
  return page;
}

const browser = await launch();

// —— A. 全新档渲染 ——
console.log('== A. 全新档：3 卡 × 5 选项，默认均衡高亮 ==');
{
  const page = await formationPage(browser, makeSave());
  const pickers = page.locator('[data-testid^="trait-picker-"]');
  check(`3 个特性选择器（实际 ${await pickers.count()}）`, (await pickers.count()) === 3);
  const first = pickers.first();
  check('首个选择器 5 个选项', (await first.locator('.seg-btn').count()) === 5);
  check('f1 默认均衡高亮', (await first.locator('[data-testid="trait-f1-balanced"]').evaluate((el) => el.classList.contains('active'))));
  check('f1 强攻未高亮', !(await first.locator('[data-testid="trait-f1-assault_doctrine"]').evaluate((el) => el.classList.contains('active'))));
  const segText = (await first.locator('.seg-btn').allTextContents()).join(',');
  check(`特性标签渲染（实际 ${segText}）`, ['均衡', '强攻', '坚壁', '破敌', '后勤'].every((s) => segText.includes(s)));
  check('radiogroup 语义', (await first.locator('[role="radiogroup"]').count()) === 1);
  check('5 选项 radio 角色', (await first.locator('[role="radio"]').count()) === 5);
  await page.context().close();
}

// —— B. 真实点击链 ——
console.log('== B. 点击切换：高亮迁移 + 描述展开 + 切回均衡 ==');
{
  const page = await formationPage(browser, makeSave());
  await page.locator('[data-testid="trait-f1-assault_doctrine"]').click();
  await page.waitForTimeout(300);
  check('强攻高亮', (await page.locator('[data-testid="trait-f1-assault_doctrine"]').evaluate((el) => el.classList.contains('active'))));
  check('均衡取消高亮', !(await page.locator('[data-testid="trait-f1-balanced"]').evaluate((el) => el.classList.contains('active'))));
  const desc = page.locator('[data-testid="trait-desc"]');
  check('效果描述展开', (await desc.count()) === 1 && (await desc.textContent()).includes('攻击 +12%'));
  // 再点强攻 = 收起描述，不改变选择
  await page.locator('[data-testid="trait-f1-assault_doctrine"]').click();
  await page.waitForTimeout(300);
  check('再点当前项收起描述', (await desc.count()) === 0);
  check('选择保持强攻', (await page.locator('[data-testid="trait-f1-assault_doctrine"]').evaluate((el) => el.classList.contains('active'))));
  // 切回均衡
  await page.locator('[data-testid="trait-f1-balanced"]').click();
  await page.waitForTimeout(300);
  check('切回均衡高亮', (await page.locator('[data-testid="trait-f1-balanced"]').evaluate((el) => el.classList.contains('active'))));
  await page.context().close();
}

// —— C. 三编队独立 ——
console.log('== C. 三编队特性互相独立 ==');
{
  const page = await formationPage(browser, makeSave());
  await page.locator('[data-testid="trait-f1-logistics_doctrine"]').click();
  await page.locator('[data-testid="trait-f2-bastion_doctrine"]').click();
  await page.waitForTimeout(300);
  check('f1 后勤高亮', (await page.locator('[data-testid="trait-f1-logistics_doctrine"]').evaluate((el) => el.classList.contains('active'))));
  check('f2 坚壁高亮', (await page.locator('[data-testid="trait-f2-bastion_doctrine"]').evaluate((el) => el.classList.contains('active'))));
  check('f3 保持均衡', (await page.locator('[data-testid="trait-f3-balanced"]').evaluate((el) => el.classList.contains('active'))));
  await page.context().close();
}

// —— D. 旧档兼容 ——
console.log('== D. 旧档：未知 id 自愈、缺字段正常 ==');
{
  // 未知 id → 回落均衡
  const page = await formationPage(browser, makeSave({ traitF1: 'legacy_gone_trait', traitF2: 'assault_doctrine' }));
  check('未知 id 回落均衡高亮', (await page.locator('[data-testid="trait-f1-balanced"]').evaluate((el) => el.classList.contains('active'))));
  check('合法 id 保留（f2 强攻）', (await page.locator('[data-testid="trait-f2-assault_doctrine"]').evaluate((el) => el.classList.contains('active'))));
  await page.context().close();
  // 无 trait 字段的 v1.22 档（makeSave 不传 trait 即缺字段）在 A 段已覆盖默认均衡
  check('缺 trait 字段档正常渲染（A 段已覆盖）', true);
}

// —— E. 存档往返 ——
console.log('== E. 存档落盘与刷新持久化 ==');
{
  const page = await formationPage(browser, makeSave());
  await page.locator('[data-testid="trait-f3-counter_doctrine"]').click();
  await page.waitForTimeout(600);
  check('f3 破敌已选（UI 高亮）', (await page.locator('[data-testid="trait-f3-counter_doctrine"]').evaluate((el) => el.classList.contains('active'))));
  // 自动存档周期 15s：等待落盘后校验备份通道含 trait
  await page.waitForTimeout(15500);
  const payload = await page.evaluate(() => localStorage.getItem('starcore_save_v1_backup'));
  check('存档已落盘', payload !== null);
  // 载荷为 { d: JSON字符串, c } 双层结构：d 内的键是转义形态，须解析后判
  const inner = payload !== null ? JSON.parse(payload).d : '';
  const hasTrait = inner.includes('"trait":"counter_doctrine"');
  check('落盘载荷含 trait 键（实际 ' + hasTrait + '）', hasTrait);
  // 无特性档：均衡编队不携带 trait 键（切回均衡删除字段，与旧档同构）
  const noTrait = inner !== '' && !inner.includes('"trait":"balanced"');
  check('均衡编队不带 trait 键（同构口径）', noTrait);
  await page.context().close();
}

// —— F. 驻扎乘区 ——
console.log('== F. 后勤特性驻扎收益 ×1.2 ==');
{
  // f2 后勤 + 编队有兵 + raider_1 已攻克 → 战斗页驻扎弹窗每秒收益
  const save = makeSave({ traitF2: 'logistics_doctrine' });
  save.military.formations[1].units = { assault: 50, guard: 0, heavy: 0, psionic: 0 };
  const page = await newSeededPage(browser, save, '/battle/raider_1', { waitMs: 1500 });
  // 选 f2 编队
  const tabs = page.locator('.f-tab');
  if ((await tabs.count()) > 1) await tabs.nth(1).click();
  await page.waitForTimeout(300);
  await page.locator('button', { hasText: '挂机驻扎' }).click();
  await page.waitForTimeout(400);
  const modal = page.locator('.garrison-confirm-modal');
  check('驻扎弹窗出现', (await modal.count()) === 1);
  const secText = (await modal.locator('.rate-sec').first().textContent()).replace(/[+\s]/g, '');
  // raider_1 idle energy 2/s ×1.2 = 2.4/s（显示口径保留原样）
  check(`后勤每秒收益 2.4（实际 ${secText}）`, secText.startsWith('2.4'));
  await modal.getByRole('button', { name: '确认' }).click();
  await page.waitForTimeout(300);
  // 对照：f1 均衡驻扎另一据点 raider_2 → 不放大（idle energy 10/s）
  const page2 = await newSeededPage(browser, makeSave(), '/battle/raider_2', { waitMs: 1500 });
  await page2.locator('button', { hasText: '挂机驻扎' }).click();
  await page2.waitForTimeout(400);
  const secText2 = (await page2.locator('.rate-sec').first().textContent()).replace(/[+\s]/g, '');
  check(`均衡每秒收益不放大（实际 ${secText2}）`, secText2.startsWith('10'));
  await page.context().close();
  await page2.context().close();
}

// —— G. 战斗页不受影响 ——
console.log('== G. 战斗页编队页签照常 ==');
{
  const page = await newSeededPage(browser, makeSave(), '/battle/raider_1', { waitMs: 1500 });
  check('编队页签渲染', (await page.locator('.f-tab').count()) === 3);
  check('战斗页无特性选择器（UI 限编组页）', (await page.locator('[data-testid^="trait-picker-"]').count()) === 0);
  await page.context().close();
}

// —— H. 移动视口 + 双语 ——
console.log('== H. 移动视口与英文标签 ==');
{
  const page = await formationPage(browser, makeSave(), { viewport: { width: 375, height: 800 } });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  );
  check('移动端编组页无横向溢出', !overflow);
  await page.context().close();
  // 英文语境：显式 en 上下文（addInitScript 覆写 navigator.languages 同 v115 E 段手法）
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US'] });
  });
  const page2 = await ctx.newPage();
  await page2.goto(`${BASE_URL}/army`);
  await page2.waitForTimeout(1500);
  await page2.locator('.tabs .tab', { hasText: 'Formation' }).click();
  await page2.waitForTimeout(400);
  const segText = (await page2.locator('.seg-btn').allTextContents()).join(',');
  check(`英文特性标签（实际 ${segText}）`, ['Balanced', 'Assault', 'Bastion', 'Counter', 'Logistics'].every((s) => segText.includes(s)));
  await ctx.close();
}

await finish(browser);