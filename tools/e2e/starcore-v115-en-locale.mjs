// 星核纪元 v1.15 专项：英文语言包（浏览器识别 / 手动切换 / 优先级 / html lang）
// A. 中文浏览器环境（pwlib 统一 --lang=zh-CN）：默认渲染中文、lang=zh-CN、语言列表三项
// B. 英文浏览器环境（context locale 覆盖）：自动匹配英文、lang=en、自动项选中
// C. 手动切换：设置页选 English 刷新后英文生效并持久化；切回简体中文恢复
// D. 优先级：显式选择 > 浏览器识别（en 浏览器存 zh-CN 仍中文；zh 浏览器存 en 渲染英文）
// E. 无匹配回退与繁体（v1.17）：法语、日语、韩语环境 → 英文；zh-TW 环境 → 简体中文
import { launch, check, finish, BASE_URL as URL } from './starcore-pwlib.mjs';

// 断言值直接取语言包真值（避免译文调整时改脚本）
const zh = (await import('../../src/locales/zh-CN/index.ts')).default;
const en = (await import('../../src/locales/en/index.ts')).default;

const browser = await launch();

// —— A. 中文浏览器环境默认渲染 ——
console.log('== A. 中文环境默认渲染 ==');
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => localStorage.setItem('starcore_onboarding', JSON.stringify({})));
  const page = await ctx.newPage();
  await page.goto(URL + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const a = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    firstNav: document.querySelector('.side-nav .nav-item')?.textContent.trim() ?? '',
    stored: localStorage.getItem('starcore_locale'),
  }));
  check(`中文环境 html lang=zh-CN（实际 ${a.lang}）`, a.lang === 'zh-CN');
  check(`侧栏首项为「${zh['nav.home']}」`, a.firstNav.includes(zh['nav.home']));
  check('无显式语言持久化', a.stored === null);
  // 设置页语言列表：自动 + 简体中文 + English
  await page.goto(URL + '/settings', { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  const items = await page.evaluate(() =>
    [...document.querySelectorAll('.lang-item')].map((b) => b.textContent.trim())
  );
  check(
    `语言列表三项（${items.join(' / ')}）`,
    items.length === 3 && items[1].includes('简体中文') && items[2].includes('English')
  );
  await ctx.close();
}

// —— B. 英文浏览器环境自动匹配 ——
console.log('== B. 英文环境自动匹配 ==');
{
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: 'en-US',
  });
  await ctx.addInitScript(() => localStorage.setItem('starcore_onboarding', JSON.stringify({})));
  const page = await ctx.newPage();
  await page.goto(URL + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const b = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    firstNav: document.querySelector('.side-nav .nav-item')?.textContent.trim() ?? '',
    title: document.title,
  }));
  check(`英文环境 html lang=en（实际 ${b.lang}）`, b.lang === 'en');
  check(`侧栏首项为「${en['nav.home']}」`, b.firstNav.includes(en['nav.home']));
  await page.goto(URL + '/settings', { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  const s = await page.evaluate(() => ({
    autoChecked:
      document.querySelector('.lang-item')?.getAttribute('aria-checked') === 'true',
    blockTitle:
      [...document.querySelectorAll('.settings-view h2, .settings-view .section-title')]
        .map((h) => h.textContent.trim())
        .join('|'),
  }));
  check('英文环境设置页「自动」项选中', s.autoChecked);
  await ctx.close();
}

// —— C. 手动切换：English → 简体中文 ——
console.log('== C. 手动切换 ==');
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => localStorage.setItem('starcore_onboarding', JSON.stringify({})));
  const page = await ctx.newPage();
  await page.goto(URL + '/settings', { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  // 选 English（第三项，整页刷新生效）
  await page.locator('.lang-item').nth(2).click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);
  const c1 = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    firstNav: document.querySelector('.side-nav .nav-item')?.textContent.trim() ?? '',
    stored: localStorage.getItem('starcore_locale'),
  }));
  check('选择 English 后持久化为 en', c1.stored === 'en');
  check(`刷新后英文渲染（${c1.firstNav}）`, c1.firstNav.includes(en['nav.home']));
  check(`html lang=en（实际 ${c1.lang}）`, c1.lang === 'en');
  // 切回简体中文（第二项）
  await page.locator('.lang-item').nth(1).click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);
  const c2 = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    firstNav: document.querySelector('.side-nav .nav-item')?.textContent.trim() ?? '',
    stored: localStorage.getItem('starcore_locale'),
  }));
  check('切回简体中文持久化为 zh-CN', c2.stored === 'zh-CN');
  check(`中文渲染恢复（${c2.firstNav}）`, c2.firstNav.includes(zh['nav.home']));
  check(`html lang=zh-CN（实际 ${c2.lang}）`, c2.lang === 'zh-CN');
  await ctx.close();
}

// —— D. 显式选择优先于浏览器识别 ——
console.log('== D. 显式选择优先级 ==');
{
  // en 浏览器 + 显式 zh-CN → 中文
  const ctx1 = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: 'en-US',
  });
  await ctx1.addInitScript(() => {
    localStorage.setItem('starcore_onboarding', JSON.stringify({}));
    localStorage.setItem('starcore_locale', 'zh-CN');
  });
  const p1 = await ctx1.newPage();
  await p1.goto(URL + '/', { waitUntil: 'networkidle' });
  await p1.waitForTimeout(800);
  const d1 = await p1.evaluate(() => ({
    lang: document.documentElement.lang,
    firstNav: document.querySelector('.side-nav .nav-item')?.textContent.trim() ?? '',
  }));
  check('en 浏览器 + 存 zh-CN → 中文', d1.lang === 'zh-CN' && d1.firstNav.includes(zh['nav.home']));
  await ctx1.close();
  // zh 浏览器 + 显式 en → 英文
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx2.addInitScript(() => {
    localStorage.setItem('starcore_onboarding', JSON.stringify({}));
    localStorage.setItem('starcore_locale', 'en');
  });
  const p2 = await ctx2.newPage();
  await p2.goto(URL + '/', { waitUntil: 'networkidle' });
  await p2.waitForTimeout(800);
  const d2 = await p2.evaluate(() => ({
    lang: document.documentElement.lang,
    firstNav: document.querySelector('.side-nav .nav-item')?.textContent.trim() ?? '',
  }));
  check('zh 浏览器 + 存 en → 英文', d2.lang === 'en' && d2.firstNav.includes(en['nav.home']));
  await ctx2.close();
}

// —— E. 无匹配统一回退英文 / 繁体归简体（v1.17）——
console.log('== E. 无匹配回退与繁体 ==');
{
  const E_CASES = [
    ['fr-FR + de-DE', ['fr-FR', 'de-DE'], 'en'],
    ['ja-JP（单值）', ['ja-JP'], 'en'],
    ['ko-KR + ja-JP', ['ko-KR', 'ja-JP'], 'en'],
    ['zh-TW + zh-Hant', ['zh-TW', 'zh-Hant'], 'zh-CN'],
  ];
  for (const [label, langs, want] of E_CASES) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.addInitScript(
      `Object.defineProperty(navigator,'languages',{get:()=>${JSON.stringify(langs)}});` +
        `Object.defineProperty(navigator,'language',{get:()=>${JSON.stringify(langs[0])}});` +
        `localStorage.setItem('starcore_onboarding', JSON.stringify({}));`
    );
    const page = await ctx.newPage();
    await page.goto(URL + '/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    const r = await page.evaluate(() => ({
      lang: document.documentElement.lang,
      firstNav: document.querySelector('.side-nav .nav-item')?.textContent.trim() ?? '',
    }));
    const wantHome = want === 'en' ? en['nav.home'] : zh['nav.home'];
    check(`${label} → ${want}（实际 ${r.lang}）`, r.lang === want && r.firstNav.includes(wantHome));
    await ctx.close();
  }
}

await finish(browser);
