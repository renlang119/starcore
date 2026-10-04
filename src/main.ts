import { getLocale, loadLocaleBundles } from '@/i18n'
import './style.css'

// 语言标签同步：<html lang> 反映实际生效语言（v1.13 起，多语言扩展前置）
document.documentElement.lang = getLocale()

// 按需加载：语言包与应用主体均在入口求值之外——应用主体（含数据表与 store）
// 在模块求值阶段取词，必须先装载语言包再加载求值，否则文案固化为键名
// （详见 i18n/index.ts 与 app.ts 头注）。
loadLocaleBundles()
  .then(() => import('./app'))
  .then(({ startApp }) => {
    startApp()
  })
  .catch((err: unknown) => {
    console.error('[starcore] bootstrap failed:', err)
  })
