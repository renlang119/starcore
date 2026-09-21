/**
 * src/tests/force-zh-locale.ts — 测试环境固定 zh-CN 语言语境（v1.15）
 *
 * 背景：jsdom 的 navigator.language 缺省为 en-US。多语言上线前注册表只有
 * zh-CN，浏览器匹配落空回退默认语言；注册 en 后英文前缀匹配命中，测试环境
 * 整体变成英文语境，全部中文断言失效。
 *
 * 本文件由 vitest.config.ts 的 setupFiles 挂载（须排在首位），在每个测试
 * 文件的模块图求值前把浏览器语言钉在 zh-CN（locale 模块在 import 时解析
 * 一次，setupFiles 先于测试文件执行，故此处覆盖生效）。需要英文语境的
 * 测试自行用 resolveLocale 依赖注入或 vi.stubGlobal 覆盖。
 */
Object.defineProperty(navigator, 'languages', {
  value: ['zh-CN'],
  configurable: true,
})
Object.defineProperty(navigator, 'language', { value: 'zh-CN', configurable: true })
