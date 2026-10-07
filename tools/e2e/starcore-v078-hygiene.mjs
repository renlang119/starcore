// 星核纪元 v0.78 专项回归：行为卫生与数据扫尾（7 项）
// A. 遗物图标独立化：r_combat_2 改 i-relic-armor、r_offline_1 改 i-relic-capsule，
//    同图标件保持原图标（战术手册 / 奇点印记）
// B. fmt 进位：999.99B 升 1T、999.95M 边界升 1B、999.949M 不误升
// C. 粒子 reduced-motion 运行时切换：reduce 停、恢复再启；初始 reduce 不生成
// D. 断点行为不变：桌面侧栏 / 移动底栏（useBreakpoint 删死代码后）
import { launch, check, finish, newSeededPage } from './starcore-pwlib.mjs';

function makeSave({ relics = [], equipped = [null, null, null, null], levels = {}, amounts = {} } = {}) {
  const owned = relics.map((r, i) => ({
    id: r.id,
    instanceId: `relic_v078_${i}`,
    obtainedAt: 1,
  }));
  const base = { energy: '1e9', crystal: '1e6', alloy: '1e6', data: '1e6', dark: '1000' };
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

// —— A. 遗物图标独立化 ——
console.log('== A. 遗物图标独立化 ==');
{
  const page = await newSeededPage(browser, makeSave({
      relics: [{ id: 'r_combat_1' }, { id: 'r_combat_2' }, { id: 'r_offline_1' }, { id: 'r_prestige_1' }],
    }), '/relic');
  const cards = await page.evaluate(() => {
    const out = {};
    document.querySelectorAll('.relic-card').forEach((c) => {
      const name = c.querySelector('.r-name')?.textContent?.trim();
      const href = c.querySelector('use')?.getAttribute('href') || '';
      if (name) out[name] = href;
    });
    return out;
  });
  check(`战术手册保持 i-relic-combat-1（实际 ${cards['战术手册']}）`, cards['战术手册'] === '#i-relic-combat-1');
  check(`强化装甲板独立为 i-relic-armor（实际 ${cards['强化装甲板']}）`, cards['强化装甲板'] === '#i-relic-armor');
  check(`时间胶囊独立为 i-relic-capsule（实际 ${cards['时间胶囊']}）`, cards['时间胶囊'] === '#i-relic-capsule');
  check(
    `奇点印记保持 i-relic-singularity（实际 ${cards['奇点印记']}）`,
    cards['奇点印记'] === '#i-relic-singularity'
  );
  const sym = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('symbol')].map((s) => s.id);
    return {
      armor: ids.filter((i) => i === 'i-relic-armor').length,
      capsule: ids.filter((i) => i === 'i-relic-capsule').length,
      total: ids.length,
      unique: new Set(ids).size,
    };
  });
  check(`新符号挂载唯一（armor=${sym.armor} capsule=${sym.capsule}）`, sym.armor === 1 && sym.capsule === 1);
  check(`符号表无重复 id（${sym.total} 个 / 唯一 ${sym.unique}）`, sym.total > 0 && sym.total === sym.unique);
  await page.context().close();
}

// —— B. fmt 进位边界 ——
// v1.43 起首页隐藏顶栏资源条，顶栏药丸改在 /build 读取
console.log('== B. fmt 进位边界 ==');
{
  const page = await newSeededPage(browser, makeSave({ amounts: { energy: '999999999999.9', crystal: '999949000', alloy: '999950000' } }), '/build');
  const pills = await page.evaluate(() => {
    const out = {};
    document.querySelectorAll('.res-pill').forEach((p) => {
      const icon = (p.querySelector('use')?.getAttribute('href') || '').replace('#', '');
      out[icon] = p.querySelector('.r-amount')?.textContent?.trim();
    });
    return out;
  });
  check(`能量 999.99B → 1T（实际 ${pills['i-res-energy']}）`, pills['i-res-energy'] === '1T');
  check(`晶体 999.949M 不误升（实际 ${pills['i-res-crystal']}）`, pills['i-res-crystal'] === '999.9M');
  check(`合金 999.95M 边界 → 1B（实际 ${pills['i-res-alloy']}）`, pills['i-res-alloy'] === '1B');
  await page.context().close();
}

// —— C. 粒子 reduced-motion 运行时切换 ——
console.log('== C. 粒子 reduced-motion 运行时切换 ==');
{
  const save = makeSave({ levels: { solar_collector: 30 } });
  // v1.43 起首页隐藏顶栏资源条，顶栏药丸改在 /build 读取
  const page = await newSeededPage(browser, save, '/build', { viewport: { width: 1280, height: 900 }, extraCtx: { reducedMotion: 'no-preference' } });
  const rateText = await page.evaluate(() => {
    const pill = [...document.querySelectorAll('.res-pill')].find((p) =>
      (p.querySelector('use')?.getAttribute('href') || '').includes('i-res-energy')
    );
    return pill?.querySelector('.r-rate')?.textContent?.trim();
  });
  check(`能量产出为正（${rateText}）`, !!rateText && rateText !== '0 /s');
  await page.waitForTimeout(600);
  const initial = await page.locator('.res-particle').count();
  check(`no-preference 下粒子生成（${initial} 个）`, initial > 0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(2000);
  const afterReduce = await page.locator('.res-particle').count();
  check(`切换 reduce 后粒子停止并清空（${afterReduce} 个）`, afterReduce === 0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForTimeout(1400);
  const resumed = await page.locator('.res-particle').count();
  check(`恢复 no-preference 后粒子重启（${resumed} 个）`, resumed > 0);
  await page.context().close();

  const page2 = await newSeededPage(browser, save, '/', { viewport: { width: 1280, height: 900 }, extraCtx: { reducedMotion: 'reduce' } });
  await page2.waitForTimeout(1400);
  const rmInitial = await page2.locator('.res-particle').count();
  check(`初始 reduce 上下文不生成粒子（${rmInitial} 个）`, rmInitial === 0);
  await page2.context().close();
}

// —— D. 断点行为不变 ——
console.log('== D. 断点行为不变 ==');
{
  const page = await newSeededPage(browser, makeSave(), '/');
  check('桌面渲染侧栏（.side-nav）', (await page.locator('.side-nav').count()) === 1);
  check('桌面不渲染底栏（.bottom-nav）', (await page.locator('.bottom-nav').count()) === 0);
  await page.context().close();

  const page2 = await newSeededPage(browser, makeSave(), '/', { viewport: { width: 390, height: 844 } });
  check('移动渲染底栏（.bottom-nav）', (await page2.locator('.bottom-nav').count()) === 1);
  check('移动不渲染侧栏（.side-nav）', (await page2.locator('.side-nav').count()) === 0);
  await page2.context().close();
}

await finish(browser);
