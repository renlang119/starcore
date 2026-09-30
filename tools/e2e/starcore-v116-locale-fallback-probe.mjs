// 星核纪元 · 语言识别回退探针（非套件脚本）
// 用途：浏览器语言非简体中文/英文时的识别与回退实测。当前规则（v1.17 起）：
//   中文各变体（含繁体）→ 简体中文；英文族 → English；其余语言 → 统一英文。
// 用法：node starcore-v116-locale-fallback-probe.mjs   （默认打本地预览；SC_URL 可指定远程）
// 设计：每个用例 = 独立空上下文 + addInitScript 覆写 navigator.languages / navigator.language，
//       加载后读取页面实际所见 languages、html[lang] 与首屏文本样例。
import { chromium } from 'playwright-core'
import { EXE, PREVIEW_URL } from './starcore-pwlib.mjs'

const URL = process.env.SC_URL || PREVIEW_URL
const CASES = [
  // 预期（v1.17 起）：ja / fr / ko 各例 → en；zh-TW 例 → zh-CN；en-GB 例 → en
  ['ja-JP 单值（全列表无匹配）', ['ja-JP']],
  ['ja-JP + en-US + en（日语浏览器典型偏好列表）', ['ja-JP', 'en-US', 'en']],
  ['fr-FR + de-DE（无匹配）', ['fr-FR', 'de-DE']],
  ['zh-TW + zh（繁体归简体）', ['zh-TW', 'zh']],
  ['en-GB（英文变体）', ['en-GB']],
  ['ko-KR + ja-JP + fr-FR（全程无匹配）', ['ko-KR', 'ja-JP', 'fr-FR']],
]

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] })
for (const [name, langs] of CASES) {
  const ctx = await browser.newContext()
  await ctx.addInitScript(
    `Object.defineProperty(navigator, 'languages', { get: () => ${JSON.stringify(langs)} });` +
      `Object.defineProperty(navigator, 'language', { get: () => ${JSON.stringify(langs[0])} });`
  )
  const page = await ctx.newPage()
  try {
    await page.goto(URL, { waitUntil: 'load', timeout: 30000 })
    await page.waitForTimeout(1200)
    const info = await page.evaluate(() => ({
      seen: navigator.languages,
      lang: document.documentElement.lang,
      sample: (document.body.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 48),
    }))
    console.log(`- ${name}`)
    console.log(`    页面所见 languages=${JSON.stringify(info.seen)} → html lang=${info.lang}`)
    console.log(`    首屏样例: ${info.sample}`)
  } catch (e) {
    console.log(`- ${name}\n    !! 失败: ${String(e).slice(0, 120)}`)
  }
  await ctx.close()
}
await browser.close()
console.log('DONE')
