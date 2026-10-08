// 星核纪元 v0.61 专项回归：遗物合成/套装
// A. 全新档：合成工坊/套装区块渲染，空库存时合成按钮禁用
// B. 注档（含重复遗物）：点选材料 → 合成按钮亮起 → 合成成功产物弹窗 → 库存 -2
// C. 校验矩阵：稀有度混选被拦（toast）、已装备卡置灰不可选、legendary 置灰
// D. 套装：装备 2 件沉默者系 → partial 高亮 + 当前效果含套装标签；卸下后失活
// E. 图鉴「X 件 / X 种」计数；成页 49 卡不回归；欧米伽传承文案显示 20 种
// F. 移动视口（390px）无横向溢出
import { launch, check, finish, newSeededPage } from './starcore-pwlib.mjs';

function makeSave({ relics = [] } = {}) {
  // relics: [{ id, times }] → 生成 owned 实例（instanceId 需唯一）
  const owned = [];
  let seq = 0;
  for (const r of relics) {
    for (let i = 0; i < (r.times || 1); i++) {
      owned.push({ id: r.id, instanceId: `relic_test_${seq++}`, obtainedAt: 1 });
    }
  }
  return {
    version: 1,
    savedAt: Date.now(),
    player: { id: 'test', name: '测试' },
    totalPlayTime: 0,
    resources: {
      amounts: { energy: '1000000', crystal: '100000', alloy: '100000', data: '100000', dark: '100' },
      totals: { energy: '1000000', crystal: '100000', alloy: '100000', data: '100000', dark: '100' },
    },
    buildings: { levels: {} },
    research: { completed: [] },
    military: { owned: {}, training: [], formations: [] },
    combat: { garrisoned: {}, completed: [] },
    exploration: { progress: {} },
    relics: { owned, equipped: [null, null, null, null] },
    transcend: { negativeEntropy: '0', totalTranscends: 0, tree: [] },
    achievements: {
      lifetime: { energy: '0', dark: '0', upgrades: 0, maxBuildingLevel: 0, researches: 0, explores: 0, battles: 0 },
      unlocked: {},
    },
  };
}

const browser = await launch();

// A. 全新档渲染
console.log('== A. 全新档：工坊/套装区块渲染 ==');
{
  const page = await newSeededPage(browser, makeSave(), '/relic');
  check('合成工坊区块渲染', (await page.locator('[data-testid="fusion-section"]').count()) === 1);
  check('套装区块渲染（4 行）', (await page.locator('[data-testid="sets-section"] .set-row').count()) === 4);
  check('空库存合成按钮禁用', await page.locator('[data-testid="fusion-button"]').isDisabled());
  check('空库存显示空状态', (await page.locator('.empty-inv').count()) === 1);
  await page.context().close();
}

// B. 注档合成全流程
console.log('== B. 注档：点选 → 合成 → 产物弹窗 ==');
{
  // 3 件普通（r_energy_1 / r_alloy_1 / r_data_1）+ 2 件沉默者系（r_dark_1/r_dark_2 供 D 用）
  const page = await newSeededPage(browser, makeSave({ relics: [{ id: 'r_energy_1', times: 2 }, { id: 'r_alloy_1' }, { id: 'r_data_1' }, { id: 'r_dark_1' }, { id: 'r_dark_2' }] }), '/relic');
  check('图鉴 6 件 / 5 种', (await page.locator('.inventory .section-title').textContent()).includes('6 件 / 5 种'));
  const cards = page.locator('.relic-card');
  check('图鉴卡 6 张', (await cards.count()) === 6);

  // 开启选材模式后点卡=选材料
  await page.locator('[data-testid="select-mode-button"]').click();
  await page.waitForTimeout(150);
  check('选材模式开启态文案', (await page.locator('[data-testid="select-mode-button"]').textContent()).includes('选材中'));

  // 点选 3 件普通：卡名精确匹配（能量碎片×2 同名 → 用 nth 兜底，先点第一张「能量碎片」）
  // v0.96 起选材走卡面「选为材料」按钮
  const pickByName = async (name, nth = 0) => {
    const card = page.locator('.relic-card', { has: page.locator(`.r-name:text-is("${name}")`) }).nth(nth);
    await card.locator('[data-testid="select-material-button"]').click();
    await page.waitForTimeout(150);
  };
  await pickByName('能量碎片', 0);
  await pickByName('合金碎屑');
  await pickByName('数据碎片');
  check('材料槽 3 格全填', (await page.locator('.fusion-slot.filled').count()) === 3);
  check('合成按钮亮起', !(await page.locator('[data-testid="fusion-button"]').isDisabled()));
  await page.locator('[data-testid="fusion-button"]').click();
  await page.waitForTimeout(500);
  const modal = page.locator('.modal');
  check('产物弹窗出现', (await modal.count()) === 1);
  check('产物为稀有档', (await modal.locator('[data-testid="synth-product-rare"]').count()) === 1);
  await modal.getByRole('button', { name: '确认' }).click();
  await page.waitForTimeout(400);
  check('合成后库存 -2（6→4 件）', (await page.locator('.relic-card').count()) === 4);
  check('材料选择已清空', (await page.locator('.fusion-slot.filled').count()) === 0);
  await page.context().close();
}

// C. 校验矩阵
console.log('== C. 校验：混选拦截 / 已装备与 legendary 置灰 ==');
{
  const page = await newSeededPage(browser, makeSave({
      relics: [
        { id: 'r_energy_1' }, // 普通
        { id: 'r_energy_2' }, // 稀有
        { id: 'r_alloy_1' }, // 普通
        { id: 'r_omega' }, // 传说
      ],
    }), '/relic');
  const pickByName = async (name, nth = 0) => {
    const card = page.locator('.relic-card', { has: page.locator(`.r-name:text-is("${name}")`) }).nth(nth);
    await card.locator('[data-testid="select-material-button"]').click();
    await page.waitForTimeout(150);
  };
  await page.locator('[data-testid="select-mode-button"]').click();
  await page.waitForTimeout(150);
  await pickByName('能量碎片');
  // 混选稀有档 → toast 拦截
  await pickByName('星核晶簇');
  check('稀有度混选被 toast 拦截', (await page.locator('.toast').textContent().catch(() => '')).includes('稀有度须一致'));
  check('混选后材料仍 1 件', (await page.locator('.fusion-slot.filled').count()) === 1);
  // legendary 卡置灰
  const omega = page.locator('.relic-card', { has: page.locator('.r-name:text-is("欧米伽协议")') });
  check('legendary 卡有置灰态', (await omega.evaluate((el) => el.classList.contains('material-disabled'))) === true);
  // 关闭选材模式 → 装备按钮恢复装备路径
  await page.locator('[data-testid="select-mode-button"]').click();
  await page.waitForTimeout(150);
  check('退出选材后材料清空', (await page.locator('.fusion-slot.filled').count()) === 0);
  await page.locator('.relic-card', { has: page.locator('.r-name:text-is("星核晶簇")') }).locator('[data-testid="equip-button"]').click();
  await page.waitForTimeout(200);
  check('稀有档可装备（装备按钮路径）', (await page.locator('.slot-filled').count()) === 1);
  const equippedRare = page.locator('.relic-card', { has: page.locator('.r-name:text-is("星核晶簇")') });
  check('已装备卡有置灰态', (await equippedRare.evaluate((el) => el.classList.contains('material-disabled'))) === true);
  await page.context().close();
}

// D. 套装激活
console.log('== D. 套装：2 件 partial 激活 / 卸下失活 ==');
{
  const page = await newSeededPage(browser, makeSave({ relics: [{ id: 'r_dark_1' }, { id: 'r_dark_2' }, { id: 'r_energy_1' }] }), '/relic');
  // 点两张沉默者系卡的装备按钮（当前效果含套装标签）
  await page.locator('.relic-card', { has: page.locator('.r-name:text-is("暗物质微粒")') }).locator('[data-testid="equip-button"]').click();
  await page.waitForTimeout(150);
  await page.locator('.relic-card', { has: page.locator('.r-name:text-is("暗物质凝聚体")') }).locator('[data-testid="equip-button"]').click();
  await page.waitForTimeout(300);
  const silencerRow = page.locator('[data-testid="set-row-silencer"]');
  check('沉默者行 2/3', (await silencerRow.locator('.set-count').textContent()).trim() === '2/3');
  check('沉默者行激活态', (await silencerRow.evaluate((el) => el.classList.contains('active'))) === true);
  check('当前效果含套装标签', (await page.locator('.active-effects .eff-tag').allTextContents()).some((t) => t.includes('暗物质产出 +6%')));
  // 卸下：点装备槽
  await page.locator('.slot-filled').first().click();
  await page.waitForTimeout(200);
  check('卸下后套装失活（1/3 无激活态）', (await silencerRow.evaluate((el) => el.classList.contains('active'))) === false);
  await page.context().close();
}

// E. 成就不回归
console.log('== E. 成就页 49 卡 + 欧米伽传承 20 种口径 ==');
{
  const page = await newSeededPage(browser, makeSave(), '/achievements');
  check('成就页 49 卡', (await page.locator('.ach-card').count()) === 49);
  const omega = page.locator('.ach-card', { has: page.locator('text=欧米伽传承') });
  check('欧米伽传承卡存在', (await omega.count()) === 1);
  check('文案为「集齐全部 20 种遗物」', (await omega.textContent()).includes('集齐全部 20 种遗物'));
  await page.context().close();
}

// F. 移动视口
console.log('== F. 移动视口不溢出 ==');
{
  const mob = await newSeededPage(browser, makeSave({ relics: [{ id: 'r_dark_1' }, { id: 'r_dark_2' }, { id: 'r_dark_3' }, { id: 'r_omega' }] }), '/relic', { viewport: { width: 390, height: 844 } });
  const overflow = await mob.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  );
  check('移动视口（390px）无横向溢出', !overflow);
  await mob.context().close();
}

// G. 强化等级轴（v0.70）
console.log('== G. 强化：注档 Lv5 卡面 → 面板 → 强化 Lv6 ==');
{
  const save = makeSave({ relics: [{ id: 'r_energy_3' }] });
  save.relics.owned[0].level = 5;
  save.resources.amounts.energy = '1000000000';
  save.resources.totals.energy = '1000000000';
  const page = await newSeededPage(browser, save, '/relic');

  check('卡面 Lv5 徽章', (await page.locator('[data-testid="relic-level-badge"]').textContent()).trim() === 'Lv5');
  check('卡面效果 label 为强化后值（Lv5 epic +48%）', (await page.locator('.relic-card .eff-mini').textContent()).includes('能量产出 +48%'));

  // 打开强化面板
  await page.locator('[data-testid="enhance-button"]').click();
  await page.waitForTimeout(300);
  check('强化面板出现', (await page.locator('[data-testid="enhance-modal"]').count()) === 1);
  check('面板等级 5 / 20', (await page.locator('[data-testid="enhance-level"]').textContent()).includes('5 / 20'));
  check('面板显示下一级成本（亿级）', (await page.locator('[data-testid="enhance-cost"]').textContent()).includes('M'));
  check('面板预览出现', (await page.locator('.enhance-preview').count()) === 1);

  // 强化 1 级 → Lv6
  await page.locator('[data-testid="enhance-confirm"]').click();
  await page.waitForTimeout(400);
  check('强化后面板等级 6 / 20', (await page.locator('[data-testid="enhance-level"]').textContent()).includes('6 / 20'));
  check('关闭面板后卡面 Lv6 徽章', await (async () => {
    await page.locator('.modal').getByRole('button', { name: '关闭' }).click();
    await page.waitForTimeout(300);
    return (await page.locator('[data-testid="relic-level-badge"]').textContent()).trim() === 'Lv6';
  })());
  check('卡面 label 更新为 Lv6 值（+50%）', (await page.locator('.relic-card .eff-mini').textContent()).includes('能量产出 +50%'));
  await page.context().close();
}

// H. 强化面板移动视口
console.log('== H. 移动视口（390px）开强化面板不溢出 ==');
{
  const save = makeSave({ relics: [{ id: 'r_energy_3' }] });
  save.relics.owned[0].level = 3;
  save.resources.amounts.energy = '1000000000';
  save.resources.totals.energy = '1000000000';
  const mob = await newSeededPage(browser, save, '/relic', { viewport: { width: 390, height: 844 } });
  await mob.locator('[data-testid="enhance-button"]').click();
  await mob.waitForTimeout(300);
  check('移动视口面板打开', (await mob.locator('[data-testid="enhance-modal"]').count()) === 1);
  const overflow = await mob.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  );
  check('移动视口面板无横向溢出', !overflow);
  await mob.context().close();
}

await finish(browser);
