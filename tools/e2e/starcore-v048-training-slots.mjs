// 星核纪元 v0.48 专项回归：训练并行槽位
// 基础 1 槽；集群操练 I/II 各 +1，上限 3；满槽禁用训练按钮并提示下一级科技。
// 存档注入方式同 v046：addInitScript 在应用 JS 前写 localStorage 备份。
import { launch, check, finish, savePayload, PREVIEW_URL as URL } from './starcore-pwlib.mjs';

function makeSave(completed) {
  return {
    version: 1,
    savedAt: Date.now(),
    player: { id: 'test', name: '测试' },
    resources: {
      amounts: { energy: '1000000000', crystal: '1000000', alloy: '1000000', data: '1000000', dark: '1000' },
      totals: { energy: '1000000000', crystal: '1000000', alloy: '1000000', data: '1000000', dark: '1000' },
    },
    buildings: { levels: {} },
    research: { completed },
    military: { owned: {}, training: [], formations: [] },
    combat: { garrisoned: {}, completed: [] },
    exploration: { progress: {} },
    relics: { owned: [], equipped: [null, null, null, null] },
    transcend: { negativeEntropy: '0', totalTranscends: 0, tree: [] },
  };
}

async function newArmyPage(browser, completed) {
  const save = makeSave(completed);
  const payload = savePayload(save);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript((p) => {
    localStorage.setItem('starcore_save_v1_backup', p);
    localStorage.removeItem('starcore_save_v1');
    // 跳过引导气泡，避免遮挡点击（v0.51 起 key=starcore_onboarding，对象结构）
    localStorage.setItem('starcore_onboarding', JSON.stringify({ 'army-train': true }));
  }, payload);
  const page = await ctx.newPage();
  await page.goto(URL + '/army', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  return page;
}

// 在指定单位卡片上 +10 并返回训练按钮
async function fillTrain(page, cardIdx) {
  const card = page.locator('.unit-card').nth(cardIdx);
  await card.locator('.count-btn', { hasText: '+10' }).click();
  return card.locator('button.btn-accent', { hasText: '训练' });
}

const norm = (s) => (s || '').replace(/\s+/g, '');

const browser = await launch();

// —— A. 无科技：基础 1 槽 ——
console.log('== A. 基础 1 槽（无集群操练）==');
{
  const page = await newArmyPage(browser, ['military_basic']);
  check('空态轻提示与卡片同屏', (await page.locator('.empty-state').count()) === 1
    && (await page.locator('.unit-card').count()) >= 3);
  const btn0 = await fillTrain(page, 0); // 突击兵 ×10（50s，不会中途完成）
  check('首个任务可训练', await btn0.isEnabled());
  await btn0.click();
  await page.waitForTimeout(400);
  const title = norm(await page.locator('.train-queue .section-title').textContent());
  check(`标题显示 训练中（1/1）（实际 ${title}）`, title === '训练中（1/1）');
  const btn1 = await fillTrain(page, 1); // 护卫兵
  check('满槽后第二张卡训练按钮禁用', await btn1.isDisabled());
  const hint = norm(await page.locator('.slot-hint').textContent());
  check(`提示指向集群操练 I（实际 ${hint}）`, hint.includes('集群操练I'));
  await page.context().close();
}

// —— B. 集群操练 I：2 槽 ——
console.log('== B. 集群操练 I → 2 槽 ==');
{
  const page = await newArmyPage(browser, ['military_basic', 'parallel_training_1']);
  await (await fillTrain(page, 0)).click();
  await page.waitForTimeout(300);
  const btn1 = await fillTrain(page, 1);
  check('第二任务可入队', await btn1.isEnabled());
  await btn1.click();
  await page.waitForTimeout(400);
  const title = norm(await page.locator('.train-queue .section-title').textContent());
  check(`标题显示 训练中（2/2）（实际 ${title}）`, title === '训练中（2/2）');
  const btn2 = await fillTrain(page, 2); // 重装兵
  check('满 2 槽后第三张卡禁用', await btn2.isDisabled());
  const hint = norm(await page.locator('.slot-hint').textContent());
  check(`提示指向集群操练 II（实际 ${hint}）`, hint.includes('集群操练II'));
  await page.context().close();
}

// —— C. 集群操练 I+II：3 槽封顶 ——
console.log('== C. 集群操练 I+II → 3 槽封顶 ==');
{
  const page = await newArmyPage(browser, ['military_basic', 'adv_units', 'parallel_training_1', 'parallel_training_2']);
  await (await fillTrain(page, 0)).click();
  await page.waitForTimeout(200);
  await (await fillTrain(page, 1)).click();
  await page.waitForTimeout(200);
  await (await fillTrain(page, 2)).click();
  await page.waitForTimeout(400);
  const title = norm(await page.locator('.train-queue .section-title').textContent());
  check(`标题显示 训练中（3/3）（实际 ${title}）`, title === '训练中（3/3）');
  const btn3 = await fillTrain(page, 3); // 灵能者
  check('满 3 槽后第四张卡禁用', await btn3.isDisabled());
  const hint = norm(await page.locator('.slot-hint').textContent());
  check(`提示为「训练槽已满」无科技指向（实际 ${hint}）`, hint === '训练槽已满');
  await page.context().close();
}

await finish(browser);
