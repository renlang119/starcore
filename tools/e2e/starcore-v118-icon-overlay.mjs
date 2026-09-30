// v1.18 档案馆图标区分度目检：i-nav-archive vs 近邻导航图标 overlay 对照
import { chromium } from 'playwright-core'

import { EXE, PREVIEW_URL } from './starcore-pwlib.mjs'
const SC_URL = process.env.SC_URL || PREVIEW_URL
const OUT = process.env.OUT || '/tmp/v118-archive-icon-overlay.png'

// 新图标 1 枚
const NEW_ICONS = [['i-nav-archive', '档案馆(新)']]
// 对照组：同族近邻 + 易混对象
const REF_ICONS = [
  ['i-nav-relic', '遗物导航(近邻)'],
  ['i-nav-settings', '设置导航(近邻)'],
  ['i-nav-build', '建造导航(近邻)'],
  ['i-nav-tech', '科技导航(近邻)'],
  ['i-nav-home', '主界面导航(近邻)'],
]

const browser = await chromium.launch({ executablePath: EXE, headless: true })
const page = await browser.newPage({ deviceScaleFactor: 3, viewport: { width: 1280, height: 900 } })
await page.goto(SC_URL, { waitUntil: 'networkidle' })

// overlay 法:append 覆盖层,绝不动 body.innerHTML(会清掉 symbol 定义表)
await page.evaluate(([newIcons, refIcons]) => {
  const ov = document.createElement('div')
  ov.style.cssText =
    'position:fixed;inset:0;z-index:99999;background:#0b1120;padding:24px;overflow:auto;font-family:system-ui;color:#e2e8f0'
  let html = '<h2 style="margin:0 0 8px">新 1 枚(青) vs 对照 5 枚(橙) × 24/20/16px × 3 色</h2>'
  const row = (id, name) => {
    let h = `<div style="display:flex;align-items:center;gap:12px;margin:6px 0">
      <span style="width:130px;font-size:12px">${name}<br><code style="font-size:10px;opacity:.7">${id}</code></span>`
    for (const c of ['#2EE6A0', '#F43F5E', '#94A3B8']) {
      for (const s of [24, 20, 16]) {
        h += `<svg width="${s}" height="${s}" style="color:${c}"><use href="#${id}"/></svg>`
      }
      h += '<span style="width:8px"></span>'
    }
    return h + '</div>'
  }
  for (const [id, name] of newIcons) html += row(id, name)
  html += '<hr style="border-color:#334155;margin:12px 0">'
  for (const [id, name] of refIcons) html += row(id, name)
  ov.innerHTML = html
  document.body.appendChild(ov)
}, [NEW_ICONS, REF_ICONS])

await page.waitForTimeout(400)
await page.screenshot({ path: OUT })
console.log('saved:', OUT)

// 消费点实测：档案馆导航项图标真实渲染（桌面侧栏 + 移动更多面板）
for (const [vp, label] of [
  [{ width: 1280, height: 900 }, 'desktop'],
  [{ width: 375, height: 800 }, 'mobile'],
]) {
  await page.setViewportSize(vp)
  await page.goto(SC_URL, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  const r = await page.evaluate(() => ({
    side: document.querySelectorAll('.side-nav use[href="#i-nav-archive"]').length,
    more: document.querySelectorAll('.more-panel use[href="#i-nav-archive"]').length,
  }))
  console.log(`${label}: side-nav refs=${r.side}, more-panel refs=${r.more}`)
  await page.screenshot({ path: `/tmp/v118-nav-${label}.png` })
  console.log(`saved: /tmp/v118-nav-${label}.png`)
}
await browser.close()