// 星核纪元 v1.35 存档签名专项：keyed 完整性签名（HMAC-SHA256）+ SCB1- 导入格式 + 旧格式硬切
//
// A. 导出/导入 round-trip：SCB1- 导出码展示、导入成功替换、签名载荷结构正确
// B. 篡改拒收：改 d 任一字节（签名不匹配）→ corrupted；重签后仍被结构校验拦
// C. 旧格式拒绝：SCB- 裸 JSON / SCE- 裸 JSON / 无前缀 / 篡改码 → 存档无效或损坏提示
// D. 本地旧格式硬切：fnv1a 校验和载荷进 corrupt 错误屏（导出原始档 + 清除重开出口在位）
// E. 防回落：签名载荷内 c 长度 = 64（HMAC hex，非旧 fnv1a 8 位 hex）
// F. 正常存档回归：自动存档 15s 节拍后备份键载荷为合法签名形态（游戏写路径已换签名）
import { launch, check, finish, newSeededPage, savePayload, saveCode, checksum, BASE_URL as URL } from './starcore-pwlib.mjs';

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

// E 先行（零浏览器，签名实现自检）：Node 单源签名器 + 载荷形态
console.log('== E. 签名形态自检 ==');
{
  const probe = JSON.stringify(makeSave());
  const sig = checksum(probe);
  check('签名为 64 位 hex（HMAC-SHA256，非旧 8 位 fnv1a）', /^[0-9a-f]{64}$/.test(sig));
  const payload = JSON.parse(savePayload(probe));
  check('savePayload 载荷为 {d,c} 且 c=签名', payload.d === probe && payload.c === sig);
  const code = saveCode(makeSave());
  check('saveCode 前缀 SCB1- 且可解出 {d,c}', code.startsWith('SCB1-') &&
    (() => { const p = JSON.parse(Buffer.from(code.slice(5), 'base64').toString('utf8')); return typeof p.d === 'string' && typeof p.c === 'string'; })());
}

const browser = await launch();

// A. 导出/导入 round-trip
console.log('== A. SCB1- 导出/导入 round-trip ==');
{
  const page = await newSeededPage(browser, makeSave({ name: undefined }), '/settings');
  await page.locator('button', { hasText: '导出存档' }).first().click();
  await page.waitForTimeout(600);
  const code = await page.locator('.export-fallback textarea').inputValue().catch(() => '');
  check('应用导出码为 SCB1- 前缀', code.startsWith('SCB1-'));
  const payloadOk = await page.evaluate((c) => {
    const bin = atob(c.slice(5));
    const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
    const p = JSON.parse(new TextDecoder().decode(bytes));
    return typeof p.d === 'string' && typeof p.c === 'string' && /^[0-9a-f]{64}$/.test(p.c);
  }, code);
  check('导出码载荷为 {d, 64位hex签名}', payloadOk);

  // 换名导入 round-trip：构造替换档（读现档改值 + saveCode 重签）
  const dRaw = await page.evaluate(() => JSON.parse(localStorage.getItem('starcore_save_v1_backup')).d);
  const dObj = JSON.parse(dRaw);
  dObj.player.name = '签名轮换档';
  dObj.transcend.totalTranscends = 0;
  const importCode = saveCode(JSON.stringify(dObj));
  await page.locator('.import-box textarea').fill(importCode);
  await page.locator('button', { hasText: '导入存档' }).first().click();
  // 导入确认弹窗条件等待：负载下渲染可能迟于固定窗口，弹窗未到会点空
  const confirmBtn = page.locator('button', { hasText: '确认导入' }).first();
  await confirmBtn.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  if ((await confirmBtn.count()) > 0) await confirmBtn.click();
  // 导入成功后应用约 1.5 秒触发整页刷新：固定等待与刷新计时器同值存在
  // 相撞窗口（过晚撞刷新、过早读旧档），且种子按导航重放注入，刷新后
  // 读到的始终是种子档，回读只能在刷新前窗口捕获。改有界轮询、见替换
  // 档即收；刷新过程中的上下文销毁按未读到处理、下一轮重试
  let after = null;
  for (let i = 0; i < 40; i++) {
    try {
      after = await page.evaluate(() => {
        try { return JSON.parse(JSON.parse(localStorage.getItem('starcore_save_v1_backup')).d); } catch { return null; }
      });
    } catch {
      after = null; // 刷新进行中：上下文已销毁，下一轮重试
    }
    if (after !== null && after.player.name === '签名轮换档') break;
    await page.waitForTimeout(200);
  }
  check('SCB1- 导入成功（替换语义生效）', after !== null && after.player.name === '签名轮换档');
  await page.context().close();
}

// B. 篡改拒收
console.log('== B. 篡改拒收（签名不匹配 / 重签后结构拦） ==');
{
  const page = await newSeededPage(browser, makeSave(), '/settings');
  // B1: 合法码换入被篡改 d（不改 c）→ 签名不匹配 → 「已损坏或被篡改」
  // 篡改目标 = 负值能量（结构白名单拒绝项），使 B2 重签后仍必被结构校验拦
  const codeRaw = await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('starcore_save_v1_backup')).d;
    return d;
  });
  const tampered = codeRaw.replace('"energy":"1000000"', '"energy":"-999"');
  check('篡改串构造命中（d 已变）', tampered !== codeRaw);
  const signed = JSON.parse(savePayload(codeRaw));
  const tamperCode = 'SCB1-' + Buffer.from(JSON.stringify({ d: tampered, c: signed.c }), 'utf8').toString('base64');
  await page.locator('.import-box textarea').fill(tamperCode);
  await page.locator('button', { hasText: '导入存档' }).first().click();
  await page.waitForTimeout(400);
  const confirmB1 = page.locator('button', { hasText: '确认导入' }).first();
  if ((await confirmB1.count()) > 0) await confirmB1.click();
  await page.waitForTimeout(600);
  const msg1 = (await page.locator('.import-msg').textContent().catch(() => '')) || '';
  check('篡改 d 导入被拒（篡改提示）', msg1.includes('篡改') || msg1.includes('损坏'), `实际提示: ${msg1.trim().slice(0, 40)}`);

  // B2: 篡改 + 用应用同源签名器重签 → 签名合法但结构校验拦（负资源）
  const resignCode = saveCode(tampered);
  await page.locator('.import-box textarea').fill(resignCode);
  await page.locator('button', { hasText: '导入存档' }).first().click();
  await page.waitForTimeout(400);
  const confirm2 = page.locator('button', { hasText: '确认导入' }).first();
  if ((await confirm2.count()) > 0) await confirm2.click();
  await page.waitForTimeout(600);
  const msg2 = (await page.locator('.import-msg').textContent().catch(() => '')) || '';
  check('重签后仍被结构校验拦（负值白名单）', msg2.includes('无效') || msg2.includes('损坏') || msg2.includes('篡改'), `实际提示: ${msg2.trim().slice(0, 40)}`);
  const accepted2 = await page.evaluate(() => {
    try { return JSON.parse(JSON.parse(localStorage.getItem('starcore_save_v1_backup')).d).resources.amounts.energy; } catch { return null; }
  });
  check('篡改值未入库（存档 energy 未被替换）', accepted2 !== '-999', `实际 energy: ${accepted2}`);
  await page.context().close();
}

// C. 旧格式导入拒绝
console.log('== C. 旧格式导入拒绝 ==');
{
  const page = await newSeededPage(browser, makeSave(), '/settings');
  const legacySave = makeSave();
  legacySave.player.name = '旧前缀档';
  const legacyJson = JSON.stringify(legacySave);
  const legacyB64 = Buffer.from(legacyJson, 'utf8').toString('base64');
  const cases = [
    { name: 'SCB- 裸JSON', code: 'SCB-' + legacyB64 },
    { name: 'SCE- 裸JSON', code: 'SCE-' + legacyB64 },
    { name: '无前缀base64', code: legacyB64 },
  ];
  for (const c of cases) {
    await page.locator('.import-box textarea').fill(c.code);
    await page.locator('button', { hasText: '导入存档' }).first().click();
    await page.waitForTimeout(400);
    // 确认弹窗在格式初检前弹出（v0.87 确认流）；旧格式无论在初检还是 doImport 被拒，先关弹窗再判提示
    const confirmC = page.locator('button', { hasText: '确认导入' }).first();
    if ((await confirmC.count()) > 0) {
      await confirmC.click();
      await page.waitForTimeout(600);
    }
    const msgAfter = (await page.locator('.import-msg').textContent().catch(() => '')) || '';
    check(`${c.name} 导入被拒`, msgAfter.includes('无效') || msgAfter.includes('损坏') || msgAfter.includes('篡改'), `实际提示: ${msgAfter.trim().slice(0, 40)}`);
  }
  await page.context().close();
}

// D. 本地旧格式硬切
console.log('== D. 本地 fnv1a 旧载荷硬切 ==');
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => {
    // v1.35 之前的应用写路径形态：c 为 fnv1a 8 位 hex（此处按旧算法现造一份合法旧载荷）
    const save = { version: 1, savedAt: Date.now(), player: { id: 'legacy', name: '旧档玩家' }, totalPlayTime: 0 };
    const json = JSON.stringify(save);
    let h = 0x811c9dc5;
    for (let i = 0; i < json.length; i++) {
      h ^= json.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    localStorage.setItem('starcore_save_v1_backup', JSON.stringify({ d: json, c: (h >>> 0).toString(16) }));
    localStorage.removeItem('starcore_save_v1');
  });
  const page = await ctx.newPage();
  await page.goto(URL + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const text = await page.evaluate(() => document.body.innerText);
  check('fnv1a 旧载荷进损坏错误屏', text.includes('星核读取失败') && text.includes('存档数据已损坏'));
  check('导出原始存档出口在位', text.includes('导出原始存档'));
  check('清除存档重开出口在位', text.includes('清除存档重开'));
  // 原始载荷保留可导出（15s 保护窗内不被覆盖）
  await page.waitForTimeout(1500);
  const raw = await page.evaluate(() => localStorage.getItem('starcore_save_v1_backup'));
  check('旧载荷未被自动存档覆盖（可导出原始档）', raw !== null && raw.includes('旧档玩家'));
  await ctx.close();
}

// F. 正常写路径防回落
console.log('== F. 正常存档写路径签名形态 ==');
{
  const page = await newSeededPage(browser, makeSave(), '/');
  // 触发一次手动保存，读备份键载荷验形态
  await page.goto(URL + '/settings', { waitUntil: 'networkidle' });
  await page.locator('button', { hasText: '手动保存' }).first().click();
  await page.waitForTimeout(800);
  const shape = await page.evaluate(() => {
    const raw = localStorage.getItem('starcore_save_v1_backup');
    if (!raw) return null;
    const p = JSON.parse(raw);
    return { hasD: typeof p.d === 'string', sigLen: typeof p.c === 'string' ? p.c.length : 0 };
  });
  check('写路径载荷为 {d, 64位hex签名}', shape !== null && shape.hasD && shape.sigLen === 64, `实际: ${JSON.stringify(shape)}`);
  await page.context().close();
}

await finish(browser);
