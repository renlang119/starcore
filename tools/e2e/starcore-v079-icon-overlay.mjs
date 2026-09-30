// 科技图标可读性核验：19 枚图标 overlay 法截图
import { chromium } from 'playwright-core'

import { EXE, PREVIEW_URL } from './starcore-pwlib.mjs'
const SC_URL = process.env.SC_URL || PREVIEW_URL
const OUT = process.env.OUT || '/tmp/tech-icons-overlay.png'

const NEW_ICONS = [
  ['i-tech-fusion', '聚变点火'],
  ['i-tech-energy-1', '能效优化I'],
  ['i-tech-core-mine', '星核采矿'],
  ['i-tech-crystal-1', '晶体工艺'],
  ['i-tech-alloy-1', '合金工艺I'],
  ['i-tech-quantum', '量子计算'],
  ['i-tech-data-flow', '数据流优化'],
  ['i-tech-neural', '深度学习'],
  ['i-tech-holo', '全息计算理论'],
  ['i-tech-adv-units', '高级兵种'],
  ['i-tech-mil-drill', '集群操练I'],
  ['i-tech-deep-space', '深空探索'],
  ['i-tech-dark-scan', '暗物质探测'],
  ['i-tech-dark-theory', '暗物质理论'],
  ['i-tech-dark-capture', '暗物质捕获'],
  ['i-tech-dark-well', '暗物质奇点井'],
  ['i-tech-singularity', '奇点理论'],
  ['i-tech-fleet', '舰队后勤学'],
  ['i-tech-flagship', '旗舰协同'],
]
// 对照组:同面邻居+跨面前身(易混对象)
const REF_ICONS = [
  ['i-tech-energy-2', '能效II(系列对照)'],
  ['i-tech-crystal-2', '晶体II(系列对照)'],
  ['i-res-dark', '暗物质资源(前身)'],
  ['i-bld-dark-capture', '暗物质捕获井(前身)'],
  ['i-bld-quantum', '量子电脑(前身)'],
  ['i-nav-army', '部队导航(前身)'],
  ['i-nav-prestige', '转生导航(前身)'],
  ['i-bld-reactor', '反应堆(前身)'],
]

const browser = await chromium.launch({ executablePath: EXE, headless: true })
const page = await browser.newPage({ deviceScaleFactor: 3, viewport: { width: 1280, height: 900 } })
await page.goto(SC_URL, { waitUntil: 'networkidle' })

// overlay 法:append 覆盖层,绝不动 body.innerHTML(会清掉 symbol 定义表)
await page.evaluate(([newIcons, refIcons]) => {
  const ov = document.createElement('div')
  ov.style.cssText =
    'position:fixed;inset:0;z-index:99999;background:#0b1120;padding:24px;overflow:auto;font-family:system-ui;color:#e2e8f0'
  let html = '<h2 style="margin:0 0 8px">新 19 枚(青) vs 对照 8 枚(橙) × 24/20/16px × 3 色</h2>'
  const row = (id, name, color) => {
    let h = `<div style="display:flex;align-items:center;gap:12px;margin:6px 0">
      <span style="width:110px;font-size:12px">${name}<br><code style="font-size:10px;opacity:.7">${id}</code></span>`
    for (const c of ['#2EE6A0', '#F43F5E', '#94A3B8']) {
      for (const s of [24, 20, 16]) {
        h += `<svg width="${s}" height="${s}" style="color:${c}"><use href="#${id}"/></svg>`
      }
      h += '<span style="width:8px"></span>'
    }
    return h + '</div>'
  }
  for (const [id, name] of newIcons) html += row(id, name, 'cyan')
  html += '<hr style="border-color:#334155;margin:12px 0">'
  for (const [id, name] of refIcons) html += row(id, name, 'orange')
  ov.innerHTML = html
  document.body.appendChild(ov)
}, [NEW_ICONS, REF_ICONS])

await page.waitForTimeout(400)
await page.screenshot({ path: OUT, fullPage: true })
console.log('saved:', OUT)

// 双视口科技页实测(新图标真实消费点)
for (const [vp, label] of [
  [{ width: 1280, height: 900 }, 'desktop-1280'],
  [{ width: 390, height: 844 }, 'mobile-390'],
]) {
  await page.setViewportSize(vp)
  await page.waitForTimeout(300)
  // 直接导航到科技页
  await page.goto(SC_URL + '/tech', { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  const t = await page.evaluate(() => {
    const uses = [...document.querySelectorAll('.t-icon use')]
    const hrefs = uses.map((u) => u.getAttribute('href'))
    const symbols = hrefs.filter((h) => h && h.startsWith('#i-tech-'))
    return { total: uses.length, tech: symbols.length }
  })
  console.log(`${label}: use elements=${t.total}, i-tech-* refs=${t.tech}`)
  await page.screenshot({ path: `/tmp/tech-page-${label}.png`, fullPage: false })
  console.log(`saved: /tmp/tech-page-${label}.png`)
}
await browser.close()
