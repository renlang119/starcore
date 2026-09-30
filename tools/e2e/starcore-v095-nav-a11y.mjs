// 星核纪元 v0.95 专项：导航族（侧栏折叠可见性 / aria-current 边界 / 更多面板键盘关闭）
// A. SideNav 折叠态：标签移出布局后图标可见（18×18）且水平居中；按钮保留可访问名；展开态回归
// B. aria-current 边界：/battle/:id 下侧栏与底部导航不高亮、无 aria-current；普通路由高亮回归
// C. 「更多」面板：aria-controls 关联；Escape 收起且焦点回到触发按钮；选择条目后收起与高亮回归
import { launch, check, finish, BASE_URL as URL } from './starcore-pwlib.mjs';

const browser = await launch();

// —— A. SideNav 折叠态图标可见性 ——
console.log('== A. SideNav 折叠态图标可见性 ==');
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => {
    localStorage.setItem('starcore_sidenav_collapsed', 'true');
    localStorage.setItem('starcore_onboarding', JSON.stringify({}));
  });
  const page = await ctx.newPage();
  await page.goto(URL + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const data = await page.evaluate(() => {
    const nav = document.querySelector('.side-nav');
    const nr = nav.getBoundingClientRect();
    const navCenter = nr.left + nr.width / 2;
    const items = [...document.querySelectorAll('.side-nav .nav-item')].map((it) => {
      const svg = it.querySelector('svg.icon');
      const label = it.querySelector('.nav-label');
      const sr = svg.getBoundingClientRect();
      return {
        w: +sr.width.toFixed(2),
        h: +sr.height.toFixed(2),
        centerOff: +Math.abs(sr.left + sr.width / 2 - navCenter).toFixed(2),
        labelDisplay: getComputedStyle(label).display,
        ariaLabel: it.getAttribute('aria-label'),
        text: (label.textContent || '').trim(),
      };
    });
    return { collapsed: nav.classList.contains('collapsed'), w: +nr.width.toFixed(2), items };
  });
  check(`侧栏处于折叠态（宽 ${data.w}px）`, data.collapsed && data.w < 60);
  check(`导航项全部可见（图标宽 ${data.items[0].w}px > 16）`, data.items.every((i) => i.w > 16));
  check(`图标高度正常（${data.items[0].h}px > 16）`, data.items.every((i) => i.h > 16));
  check(
    `图标水平居中（最大偏差 ${Math.max(...data.items.map((i) => i.centerOff))}px ≤ 2）`,
    data.items.every((i) => i.centerOff <= 2)
  );
  check('标签已移出布局（display:none）', data.items.every((i) => i.labelDisplay === 'none'));
  check('折叠态按钮保留可访问名', data.items.every((i) => i.ariaLabel && i.ariaLabel === i.text));
  // 展开回归：标签恢复可见、图标仍在位、不再附加 aria-label
  await page.locator('.collapse-toggle').click();
  await page.waitForTimeout(400);
  const exp = await page.evaluate(() => {
    const it = document.querySelector('.side-nav .nav-item');
    const label = it.querySelector('.nav-label');
    const svg = it.querySelector('svg.icon');
    return {
      labelShown: getComputedStyle(label).display !== 'none' && label.getBoundingClientRect().width > 10,
      iconW: +svg.getBoundingClientRect().width.toFixed(2),
      aria: it.getAttribute('aria-label'),
    };
  });
  check('展开后标签恢复可见', exp.labelShown);
  check(`展开后图标仍正常（${exp.iconW}px）`, exp.iconW > 16);
  check('展开后不再附加 aria-label（名称取自文本）', exp.aria === null);
  await ctx.close();
}

// —— B. aria-current 边界（战斗页不高亮） ——
console.log('== B. aria-current 边界 ==');
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => localStorage.setItem('starcore_onboarding', JSON.stringify({})));
  const page = await ctx.newPage();
  await page.goto(URL + '/battle/raider_1', { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  const r = await page.evaluate(() => ({
    path: location.pathname,
    navActive: document.querySelectorAll('.side-nav .nav-item.active').length,
    navAria: document.querySelectorAll('.side-nav [aria-current="page"]').length,
  }));
  check(`战斗页路由正确（${r.path}）`, r.path.startsWith('/battle/'));
  check('战斗页侧栏无高亮项', r.navActive === 0);
  check('战斗页侧栏无 aria-current', r.navAria === 0);
  // 回归：普通路由高亮正常（/build → 建造）
  await page.goto(URL + '/build', { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  const r2 = await page.evaluate(() => {
    const item = document.querySelector('.side-nav .nav-item.active');
    return {
      count: document.querySelectorAll('.side-nav .nav-item.active').length,
      text: item ? item.textContent.trim() : '',
      aria: document.querySelectorAll('.side-nav [aria-current="page"]').length,
    };
  });
  check(`普通路由高亮仍正常（${r2.text}）`, r2.count === 1 && r2.text.includes('建造') && r2.aria === 1);
  await ctx.close();
}
{
  // 移动端：战斗页底部导航不高亮；主界面回归
  const ctx = await browser.newContext({ viewport: { width: 375, height: 780 } });
  await ctx.addInitScript(() => localStorage.setItem('starcore_onboarding', JSON.stringify({})));
  const page = await ctx.newPage();
  await page.goto(URL + '/battle/raider_1', { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  const m = await page.evaluate(() => ({
    tabsActive: document.querySelectorAll('.bottom-nav .tab.active').length,
    aria: document.querySelectorAll('.bottom-nav [aria-current="page"]').length,
  }));
  check('战斗页底部导航无高亮项', m.tabsActive === 0);
  check('战斗页底部导航无 aria-current', m.aria === 0);
  await page.goto(URL + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  const m2 = await page.evaluate(() => {
    const tab = document.querySelector('.bottom-nav .tab.active');
    return {
      count: document.querySelectorAll('.bottom-nav .tab.active').length,
      text: tab ? tab.textContent.trim() : '',
    };
  });
  check(`移动端主界面 tab 高亮（${m2.text}）`, m2.count === 1 && m2.text.includes('主界面'));
  await ctx.close();
}

// —— C. 「更多」面板键盘关闭与关联语义 ——
console.log('== C. 更多面板键盘关闭 ==');
{
  const ctx = await browser.newContext({ viewport: { width: 375, height: 780 } });
  await ctx.addInitScript(() => localStorage.setItem('starcore_onboarding', JSON.stringify({})));
  const page = await ctx.newPage();
  await page.goto(URL + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  const moreBtn = page.locator('.bottom-nav .tab[aria-haspopup="true"]');
  check(
    '更多按钮带 aria-controls="bottom-nav-more"',
    (await moreBtn.getAttribute('aria-controls')) === 'bottom-nav-more'
  );
  await moreBtn.click();
  await page.waitForTimeout(300);
  check(
    '面板打开且 id 与 aria-controls 对应',
    (await page.locator('#bottom-nav-more.more-panel').count()) === 1
  );
  check('aria-expanded=true', (await moreBtn.getAttribute('aria-expanded')) === 'true');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(350);
  const after = await page.evaluate(() => ({
    panel: document.querySelectorAll('#bottom-nav-more').length,
    expanded: document.querySelector('.bottom-nav .tab[aria-haspopup="true"]').getAttribute('aria-expanded'),
    focusMore: document.activeElement === document.querySelector('.bottom-nav .tab[aria-haspopup="true"]'),
  }));
  check('Escape 收起面板', after.panel === 0);
  check('aria-expanded=false', after.expanded === 'false');
  check('焦点回到「更多」按钮', after.focusMore);
  // 回归：打开面板 → 点条目 → 面板收起并跳转、更多按钮高亮
  await moreBtn.click();
  await page.waitForTimeout(300);
  await page.locator('#bottom-nav-more .more-item', { hasText: '成就' }).click();
  await page.waitForTimeout(700);
  const done = await page.evaluate(() => ({
    panel: document.querySelectorAll('#bottom-nav-more').length,
    path: location.pathname,
    moreActive: document.querySelector('.bottom-nav .tab[aria-haspopup="true"]').classList.contains('active'),
  }));
  check(`选择条目后收起并跳转（${done.path}）`, done.panel === 0 && done.path === '/achievements');
  check('次级页「更多」按钮高亮', done.moreActive);
  // 回归：设置项在「更多」面板并可达（v1.13）
  await moreBtn.click();
  await page.waitForTimeout(300);
  const items = await page.evaluate(() =>
    [...document.querySelectorAll('#bottom-nav-more .more-item')].map((b) => b.textContent.trim())
  );
  check(`更多面板含设置与档案馆项（${items.join(' / ')}）`, items.length === 5 && items.includes('设置') && items.includes('档案馆'));
  await page.locator('#bottom-nav-more .more-item', { hasText: '设置' }).click();
  await page.waitForTimeout(700);
  const st = await page.evaluate(() => ({
    path: location.pathname,
    moreActive: document
      .querySelector('.bottom-nav .tab[aria-haspopup="true"]')
      .classList.contains('active'),
  }));
  check(`设置页可达且「更多」高亮（${st.path}）`, st.path === '/settings' && st.moreActive);
  await moreBtn.click();
  await page.waitForTimeout(300);
  const st2 = await page.evaluate(() => {
    const act = document.querySelector('#bottom-nav-more .more-item.active');
    return { text: act ? act.textContent.trim() : '', aria: act ? act.getAttribute('aria-current') : null };
  });
  check(`设置项激活态与 aria-current（${st2.text}）`, st2.text.includes('设置') && st2.aria === 'page');
  await ctx.close();
}

// —— D. 设置路由侧栏高亮（v1.13） ——
console.log('== D. 设置路由侧栏高亮 ==');
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => localStorage.setItem('starcore_onboarding', JSON.stringify({})));
  const page = await ctx.newPage();
  await page.goto(URL + '/settings', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const d = await page.evaluate(() => {
    const item = document.querySelector('.side-nav .nav-item.active');
    return {
      text: item ? item.textContent.trim() : '',
      aria: document.querySelectorAll('.side-nav [aria-current="page"]').length,
      items: document.querySelectorAll('.side-nav .nav-item').length,
      settingsIcon: !!document.querySelector('.side-nav use[href="#i-nav-settings"]'),
    };
  });
  check(`设置页侧栏高亮（${d.text}）`, d.text.includes('设置') && d.aria === 1);
  check(`侧栏共 ${d.items} 项且含设置图标`, d.items === 10 && d.settingsIcon);
  await ctx.close();
}

await finish(browser);
