/**
 * reload.ts — 整页刷新封装（语言切换等场景，v1.13）
 *
 * 独立成模块：jsdom 的 location.reload 不可替换（不可配置属性），
 * 单元测试经模块替身注入；浏览器环境行为即 location.reload()。
 */
export function reloadPage(): void {
  location.reload()
}
