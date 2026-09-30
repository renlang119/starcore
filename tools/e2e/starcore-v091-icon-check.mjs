// v0.91 星系层 4 枚新科技图标可读性验证 + 消费点核验（overlay 法）
// 用法: node starcore-v091-icon-check.mjs  （SC_URL/OUT 可参）
import { chromium } from 'playwright-core'

import { EXE, PREVIEW_URL } from './starcore-pwlib.mjs'
const SC_URL = process.env.SC_URL || PREVIEW_URL
const OUT = process.env.OUT || '/tmp/v091-icons.png'

const NEW_ICONS = [
  ['i-tech-explore-4', '星系测绘', '#2EE6A0'],
  ['i-tech-galaxy-command', '星河统帅', '#F43F5E'],
  ['i-tech-dark-web', '暗物质星网', '#94A3B8'],
  ['i-tech-data-4', '银河记忆库', '#A78BFA'],
]
// 对照组：系列前身与同面易混邻居
const GROUPS = {
  'i-tech-explore-4': ['i-tech-explore-1', 'i-tech-explore-2', 'i-tech-explore-3', 'i-tech-deep-space'],
  'i-tech-galaxy-command': ['i-tech-armada', 'i-tech-fleet', 'i-tech-flagship', 'i-tech-adv-units'],
  'i-tech-dark-web': ['i-tech-dark-harvester', 'i-tech-dark-eff', 'i-tech-dark-capture', 'i-tech-singularity'],
  'i-tech-data-4': ['i-tech-data-2', 'i-tech-data-3', 'i-tech-data-flow', 'i-tech-holo'],
}

const browser = await chromium.launch({ executablePath: EXE, headless: true })
const page = await browser.newPage({ deviceScaleFactor: 3, viewport: { width: 1280, height: 1000 } })
await page.goto(SC_URL, { waitUntil: 'networkidle' })

// overlay 法：append 覆盖层，绝不动 body.innerHTML（会清掉 symbol 定义表）
await page.evaluate(([newIcons, groups]) => {
  const ov = document.createElement('div')
  ov.style.cssText =
    'position:fixed;inset:0;z-index:99999;background:#0b1120;padding:24px;overflow:auto;font-family:system-ui;color:#e2e8f0'
  const cell = (id, color, mark) =>
    `<div style="display:inline-flex;flex-direction:column;align-items:center;margin:4px 10px">
       <svg width="24" height="24" style="color:${color}"><use href="#${id}"/></svg>
       <svg width="20" height="20" style="color:${color}"><use href="#${id}"/></svg>
       <svg width="16" height="16" style="color:${color}"><use href="#${id}"/></svg>
       <span style="font-size:9px;opacity:.75;max-width:64px;text-align:center">${mark ? '★ ' : ''}${id.replace('i-tech-', '')}</span>
     </div>`
  let html = '<h3 style="margin:0 0 12px">v0.91 新 4 枚（★）与系列/邻居对照 × 24/20/16px 竖排</h3>'
  for (const [id, name, color] of newIcons) {
    html += `<div style="margin:14px 0;border-top:1px solid #334155;padding-top:8px">
      <div style="font-size:13px;margin-bottom:6px">★ <b>${name}</b> <code>${id}</code></div>
      <div style="display:flex;flex-wrap:wrap;align-items:flex-start">`
    html += cell(id, color, true)
    for (const ref of groups[id]) html += cell(ref, '#64748b', false)
    html += '</div></div>'
  }
  ov.innerHTML = html
  document.body.appendChild(ov)
}, [NEW_ICONS, GROUPS])
await page.screenshot({ path: OUT })
console.log('对照截图:', OUT)

// 消费点核验：科技页 .t-icon use 应含 4 新 id 且总数 = 59（双视口）
for (const vp of [{ width: 1280, height: 900 }, { width: 375, height: 700 }]) {
  const p2 = await browser.newPage({ viewport: vp })
  await p2.goto(SC_URL + '/tech', { waitUntil: 'networkidle' })
  const info = await p2.evaluate(() => {
    const uses = [...document.querySelectorAll('.t-icon use')].map((u) =>
      (u.getAttribute('href') || '').replace('#', '')
    )
    return { total: uses.length, set: [...new Set(uses)] }
  })
  const miss = NEW_ICONS.map((x) => x[0]).filter((id) => !info.set.includes(id))
  console.log(
    `视口 ${vp.width}: 消费点 ${info.total} 个（去重 ${info.set.length}）` +
      (info.total === 59 && miss.length === 0 ? ' PASS' : ` FAIL miss=${miss}`)
  )
  await p2.close()
}
await browser.close()
