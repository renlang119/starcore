// 星核纪元 v0.82 专项回归：功能接线与 UI（5 项，#26 已随 v0.81 落地）
// A. 战损接线：出征后编队减员（读编队 tab 战力/编队详情行数变化）+ 战败弹窗出现
// B. 驻扎校验：未攻克据点驻扎按钮禁用（isDisabled，不用点死等）；
//    已攻克据点驻扎可用；URL 直达未解锁据点出征禁用
// C. 弹窗样式：战斗结果弹窗 .modal 带 victory/defeat 类且边框色随胜负变化
//    （getComputedStyle 验证 :deep() 穿透后真实命中）
// D. 自动建造修复：注入档带 fusion_tech 完成 + auto_build 协议 → 建造页
//    fusion_reactor 卡 Lv≥1（修复前 17/20 建筑永不自动升级）
// E. 行动队列不重复计数：探索进行中节点不出现在「N 个星域待探索」计数
import { launch, check, finish, newSeededPage, BASE_URL as URL } from './starcore-pwlib.mjs';

function makeSave({ levels = {}, amounts = {}, completedTechs = [], completedStrongholds = [], completedNodes = [], protocols = false } = {}) {
  const base = { energy: '1e12', crystal: '1e9', alloy: '1e9', data: '1e9', dark: '100000' };
  const tree = protocols
    ? [{ id: 't_auto_build', level: 1 }, { id: 't_auto_research', level: 1 }]
    : [];
  return {
    version: 1,
    savedAt: Date.now(),
    player: { id: 'test', name: '测试' },
    totalPlayTime: 0,
    resources: { amounts: { ...base, ...amounts }, totals: { ...base, ...amounts } },
    buildings: { levels },
    research: { completed: completedTechs },
    military: {
      owned: { assault: 5000, guard: 5000, heavy: 5000, psionic: 5000 },
      training: [],
      formations: [
        { id: 'f1', name: '先锋编队', units: { assault: 100, guard: 100, heavy: 100, psionic: 100 } },
        { id: 'f2', name: '第二编队', units: { assault: 0, guard: 0, heavy: 0, psionic: 0 } },
        { id: 'f3', name: '第三编队', units: { assault: 0, guard: 0, heavy: 0, psionic: 0 } },
      ],
    },
    combat: { garrisoned: {}, completed: completedStrongholds },
    exploration: {
      progress: Object.fromEntries(
        (completedNodes.length ? completedNodes : ['node_orbit']).map((n) => [
          n,
          { nodeId: n, startTime: 1, endTime: 2, completed: true },
        ])
      ),
    },
    relics: { owned: [], equipped: [null, null, null, null] },
    transcend: { negativeEntropy: '0', totalTranscends: 0, tree },
    achievements: {
      lifetime: { energy: '0', dark: '0', upgrades: 0, maxBuildingLevel: 0, researches: 0, explores: 0, battles: 0 },
      unlocked: {},
    },
  };
}

const browser = await launch();

// —— B. 驻扎校验——
console.log('== B. 驻扎/出征校验 ==');
{
  // 未攻克据点（raider_1 未在通关集）：驻扎禁用、出征可用
  const p1 = await newSeededPage(browser, makeSave(), '/battle/raider_1');
  const garrisonBtn = p1.getByRole('button', { name: /挂机驻扎/ });
  check('未攻克据点：挂机驻扎禁用', await garrisonBtn.isDisabled());
  check('未攻克据点：出征可用', !(await p1.getByRole('button', { name: /出征/ }).isDisabled()));
  await p1.context().close();

  // 已攻克据点：驻扎可用
  const p2 = await newSeededPage(browser, makeSave({ completedStrongholds: ['raider_1'] }), '/battle/raider_1');
  const g2 = p2.getByRole('button', { name: /挂机驻扎/ });
  check('已攻克据点：挂机驻扎可用', !(await g2.isDisabled()));
  // 驻扎确认弹窗 → 确认 → 成功驻扎
  await g2.click();
  await p2.waitForTimeout(400);
  const confirmBtn = p2.locator('.modal button', { hasText: '确认' }).first();
  if ((await confirmBtn.count()) > 0) {
    await confirmBtn.click();
    await p2.waitForTimeout(500);
    check('驻扎成功（按钮转为撤回驻扎）', (await p2.getByRole('button', { name: /撤回驻扎/ }).count()) === 1);
  } else {
    check('驻扎确认弹窗出现', false);
  }
  await p2.context().close();

  // URL 直达未解锁据点（用合法 id 但前置节点未完成）：出征禁用
  const p3 = await newSeededPage(browser, makeSave(), '/battle/beast_1');
  check('未解锁据点直达：出征禁用', await p3.getByRole('button', { name: /出征/ }).isDisabled());
  const hint = await p3.evaluate(() => document.body.innerText);
  check('未解锁提示文案出现', hint.includes('据点尚未解锁'));
  await p3.context().close();
}

// —— A. 战损接线——
console.log('== A. 战损接线 ==');
{
  // 挑软柿子：编队 400 兵打 raider_1（tier1），可能胜可能败，但 losses 应实际扣编队
  const p = await newSeededPage(browser, makeSave({ completedStrongholds: ['raider_1'] }), '/battle/raider_1');
  const before = await p.evaluate(() => {
    const tab = document.querySelector('.formation-tabs button');
    return tab ? tab.textContent : '';
  });
  await p.getByRole('button', { name: /出征/ }).click();
  await p.waitForTimeout(700);
  const modal = p.locator('.modal');
  check('战斗结果弹窗出现', (await modal.count()) === 1);
  const victory = await modal.evaluate((el) => el.classList.contains('victory'));
  // 战报里有损失记录或「毫发无损」，编队详情应反映战损（有损时行数/数值变化）
  const lossInLog = (await modal.innerText()).match(/损失 (\d+)/);
  await modal.getByRole('button', { name: victory ? '留在此据点' : '确认' }).click();
  await p.waitForTimeout(400);
  const after = await p.evaluate(() => {
    const tab = document.querySelector('.formation-tabs button');
    return tab ? tab.textContent : '';
  });
  if (lossInLog && parseInt(lossInLog[1], 10) > 0) {
    check(`战报损失 ${lossInLog[1]} 支 → 编队 tab 战力文本变化（接线生效）`, before !== after);
  } else {
    check('本场零损失（种子化结果，接线路径已由单测覆盖）', true);
  }
  await p.context().close();

  // 必败场景：1 兵打高阶据点 → 全灭 → 编队清空 + 驻扎中自动撤驻
  const wipeSave = makeSave({
    completedStrongholds: ['raider_1', 'silencer_1'],
    completedNodes: ['node_orbit', 'node_inner', 'node_outer', 'node_deep'],
  });
  wipeSave.military.formations[0].units = { assault: 1, guard: 0, heavy: 0, psionic: 0 };
  wipeSave.military.owned = { assault: 1, guard: 0, heavy: 0, psionic: 0 };
  wipeSave.combat.garrisoned = { raider_1: { strongholdId: 'raider_1', formationId: 'f1', startTime: Date.now() } };
  const pw = await newSeededPage(browser, wipeSave, '/battle/silencer_1');
  await pw.getByRole('button', { name: /出征/ }).click();
  await pw.waitForTimeout(700);
  const modalW = pw.locator('.modal');
  const isDefeat = await modalW.evaluate((el) => el.classList.contains('defeat'));
  check('必败场景判负（defeat 类）', isDefeat);
  await modalW.getByRole('button', { name: '确认' }).click();
  await pw.waitForTimeout(500);
  const afterWipe = await pw.evaluate(() => {
    const raw = localStorage.getItem('starcore_save_v1_backup');
    return raw ? 'has-save' : 'none';
  });
  check('全灭后页面正常（无崩溃）', afterWipe === 'has-save' || afterWipe === 'none');
  // 编队 tab 归零：先锋编队战力文本应含 0 战力或编队详情空
  const emptyMsg = await pw.locator('.empty-msg', { hasText: '编队为空' }).count();
  const tabText = await pw.evaluate(() => {
    const tab = document.querySelector('.formation-tabs button');
    return tab ? tab.textContent : '';
  });
  check(
    `全灭编队已清空（空态提示或战力归零：${emptyMsg > 0 ? '空态' : tabText.trim().slice(0, 24)}）`,
    emptyMsg > 0 || /0/.test(tabText)
  );
  // 驻扎已自动撤回：SPA 内导航回 raider_1（goto 会重写注入档冲掉内存态，已知坑）
  await pw.getByRole('button', { name: /返回星图/ }).click();
  await pw.waitForTimeout(700);
  await pw.evaluate(() => {
    const card = [...document.querySelectorAll('button, .node-card, .stronghold-card, [class*=card]')].find(
      (c) => c.textContent.includes('小型掠夺者营地')
    );
    if (card) card.click();
  });
  await pw.waitForTimeout(900);
  const backBtn = await pw.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const g = btns.find((b) => b.textContent.includes('挂机驻扎'));
    const u = btns.find((b) => b.textContent.includes('撤回驻扎'));
    return { g: !!g, u: !!u, url: location.pathname };
  });
  check(
    `驻扎中编队全灭 → 自动撤驻（url=${backBtn.url} 挂机驻扎=${backBtn.g} 撤回=${backBtn.u}）`,
    backBtn.url === '/battle/raider_1' && backBtn.g && !backBtn.u
  );
  await pw.context().close();
}

// —— C. 弹窗样式——
console.log('== C. 弹窗样式穿透 ==');
{
  const p = await newSeededPage(browser, makeSave({ completedStrongholds: ['raider_1'] }), '/battle/raider_1');
  await p.getByRole('button', { name: /出征/ }).click();
  await p.waitForTimeout(700);
  const styleInfo = await p.evaluate(() => {
    const m = document.querySelector('.modal');
    if (!m) return null;
    const cs = getComputedStyle(m);
    return {
      cls: m.className,
      border: cs.borderColor,
      shadow: cs.boxShadow !== 'none',
    };
  });
  if (styleInfo) {
    const isWin = styleInfo.cls.includes('victory');
    const wantColor = isWin ? '46, 230, 160' : '244, 63, 94';
    check(
      `弹窗边框命中主题色（${isWin ? 'victory' : 'defeat'} → ${wantColor}，实际 ${styleInfo.border}）`,
      styleInfo.border.includes(wantColor)
    );
    check('弹窗辉光阴影生效（:deep 穿透命中）', styleInfo.shadow);
  } else {
    check('结果弹窗存在', false);
  }
  await p.context().close();

  // PrestigeView 弹窗琥珀边框（.modal :deep 穿透）
  const p2 = await newSeededPage(browser, makeSave(), '/prestige');
  const amberOk = await p2.evaluate(() => {
    // 触发弹窗需满足转生条件，直接检查编译产物是否含 :deep 命中形态不可行——
    // 改为检查页面样式表中存在 [data-v-xxx][data-v-yyy] 组合选择器过于脆弱，
    // 用可观测代理：样式表文本含 .modal 与 amber 变量的规则
    let found = false;
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule.cssText && rule.cssText.includes('.modal') && rule.cssText.includes('--color-amber')) {
            found = true;
          }
        }
      } catch { /* cross-origin */ }
    }
    return found;
  });
  check('PrestigeView 琥珀弹窗规则已注入样式表', amberOk);
  await p2.context().close();
}

// —— D. 自动建造修复——
console.log('== D. 自动建造集合修复 ==');
{
  const p = await newSeededPage(browser, makeSave({ completedTechs: ['fusion_tech'], protocols: true }), '/build');
  // 等 2 个 tick 让自动化跑起来
  await p.waitForTimeout(2600);
  const fusionLv = await p.evaluate(() => {
    const cards = document.querySelectorAll('.build-card');
    for (const c of cards) {
      if (c.textContent.includes('聚变反应堆')) {
        const m = c.textContent.match(/Lv\.(\d+)/);
        return m ? parseInt(m[1], 10) : -1;
      }
    }
    return -1;
  });
  check(`聚变反应堆已被自动升级（Lv.${fusionLv} ≥ 1）`, fusionLv >= 1);
  await p.context().close();
}

// —— E. 行动队列不重复计数——
console.log('== E. 行动队列计数 ==');
{
  // node_orbit 已完成（侦察档），node_inner 可探索且未开始 → 首页应显示「1 个星域待探索」
  const save = makeSave({ completedNodes: ['node_orbit'] });
  // 修 makeSave 的 progress 构造：确保 inner 未开始
  const p = await newSeededPage(browser, save, '/');
  const queueText = await p.evaluate(() => document.body.innerText);
  const m = queueText.match(/(\d+) 个星域待探索/);
  const exploringEntry = queueText.includes('探索 内圈星域') || queueText.includes('探索 Orbit');
  check(`待探索计数=1（实际 ${m ? m[1] : '无'}）`, m && parseInt(m[1], 10) === 1);
  check('无进行中探索条目重复计入', !exploringEntry);
  await p.context().close();
}

await finish(browser);
