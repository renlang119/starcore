/**
 * i18n 门面 — 唯一对外取词接口
 *
 * 用法（组件 / 模块通用）：import { t } from '@/i18n'
 *  - 模板：{{ t('home.hero.coreLabel') }}（script setup 会暴露导入的 t）
 *  - 脚本：t('save.export')、t('home.daily.checkedIn', { streak: 3 })
 * 键规则：'域.子路径'（域 = 语言模块文件名；内容层为 content.<数据域>.<id>.<字段>）。
 * 缺键回退：当前语言 → 默认语言 zh-CN → 返回键名（开发态告警一次）。
 *
 * 环境安全：不发散浏览器 API（交给 locale.ts 守卫），可被纯 Node 工具链导入。
 * 切换语义：整页刷新生效（locale 模块加载时解析一次）。
 */
import zhCN from '../locales/zh-CN/index.ts'
import { DEFAULT_LOCALE, getLocale } from './locale.ts'

export type I18nParams = Record<string, string | number>
type Bundle = Record<string, string>

const BUNDLES: Record<string, Bundle> = { 'zh-CN': zhCN }
const warned = new Set<string>()

/** 取词：支持 {param} 命名插值；缺参保留占位符，缺键返回键名 */
export function t(key: string, params?: I18nParams): string {
  const cur = getLocale()
  let msg = BUNDLES[cur]?.[key]
  if (msg === undefined) msg = BUNDLES[DEFAULT_LOCALE]?.[key]
  if (msg === undefined) {
    if (!warned.has(key)) {
      warned.add(key)
      try {
        if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
          console.warn(`[i18n] 缺键: ${key}`)
        }
      } catch {
        /* 非 Vite 环境静默 */
      }
    }
    return key
  }
  if (!params) return msg
  return msg.replace(/\{(\w+)\}/g, (raw, name: string) => {
    const v = params[name]
    return v === undefined ? raw : String(v)
  })
}

export {
  AVAILABLE_LOCALES,
  DEFAULT_LOCALE,
  clearLocale,
  getLocale,
  isSupportedLocale,
  setLocale,
} from './locale.ts'
