// 星核纪元 v0.83 专项：守护网 e2e（#23 锁定态调色五视图 + #20 symbol 总数）
// A. --color-locked 调亮为 #6387ab 后，五视图锁定态文字实测色 = rgb(99,135,171)
// B. 符号表挂载 123 个 symbol 且 id 无重复（与守恒脚本 SFC 真值同口径）
import { launch, check, finish, newSeededPage } from './starcore-pwlib.mjs';

function makeSave(opts = {}) {
  const base = { energy: '1e9', crystal: '1e6', alloy: '1e6', data: '1e6', dark: '1000' };
  return {
    version: 1,
    savedAt: Date.now(),
    player: { id: 'test', name: '测试' },
    totalPlayTime: 0,
    resources: { amounts: { ...base }, totals: { ...base } },
    buildings: { levels: {} },
    research: { completed: opts.research || [] },
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

// —— A. 锁定态文字色五视图——
console.log('== A. 锁定态文字色五视图 ==');
const EXPECT = 'rgb(99, 135, 171)'; // #6387ab
const views = [
  ['/build', '.lock-msg', () => makeSave()],
  ['/tech', '.t-req', () => makeSave()],
  ['/map', '.n-locked', () => makeSave()],
  // 部队面：完成基础军事科技后近战三兵种解锁、进阶兵种保持锁定态
  ['/army', '.u-locked', () => makeSave({ research: ['military_basic'] })],
  ['/relic', '.slot-empty', () => makeSave()],
];
{
  let tokenChecked = false;
  for (const [path, sel, makeSaveFn] of views) {
    const page = await newSeededPage(browser, makeSaveFn(), path);
    if (!tokenChecked) {
      const token = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--color-locked').trim()
      );
      check(`token --color-locked = #6387ab（实际 ${token}）`, token === '#6387ab');
      tokenChecked = true;
    }
    const res = await page.evaluate((s) => {
      const els = [...document.querySelectorAll(s)];
      const el = els[0];
      return { count: els.length, color: el ? getComputedStyle(el).color : null };
    }, sel);
    check(`${path} 锁定态元素存在（${sel} × ${res.count}）`, res.count > 0);
    check(`${path} 锁定态文字色 = ${EXPECT}（实际 ${res.color}）`, res.color === EXPECT);
    await page.context().close();
  }
}

// —— B. symbol 总数守护——
console.log('== B. symbol 总数守护 ==');
{
  const page = await newSeededPage(browser, makeSave(), '/');
  const sym = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('symbol[id]')].map((s) => s.id);
    return { total: ids.length, unique: new Set(ids).size };
  });
  check(`symbol 挂载总数 = 123（实际 ${sym.total}）`, sym.total === 123);
  check(`symbol id 无重复（唯一 ${sym.unique} / 总数 ${sym.total}）`, sym.unique === sym.total);
  await page.context().close();
}

await finish(browser);
