/**
 * i18n 门面：唯一对外取词接口
 *
 * 用法（组件 / 模块通用）：import { t } from '@/i18n'
 *  - 模板：{{ t('home.hero.aria') }}（script setup 会暴露导入的 t）
 *  - 脚本：t('save.export')、t('home.daily.checkedIn', { streak: 3 })
 * 键规则：'域.子路径'（域 = 语言模块文件名；内容层为 content.<数据域>.<id>.<字段>）。
 * 缺键回退：当前语言 → 基线语言 zh-CN → 返回键名（开发态告警一次）。
 *
 * 加载模型（按需加载）：语言包经动态 import 移出首包，入口在求值应用主体前
 * 先 await loadLocaleBundles()。数据表等模块级取词因此必须位于语言包就绪后
 * 才求值的模块图内（main.ts 以动态 import 延迟整个应用主体，见其头注）；
 * 语言包未就绪时 t() 在开发与测试态直接抛错（v1.53 起，防模块级取词静默
 * 固化为键名），生产态返回键名兜底。
 * 环境安全：不发散浏览器 API（交给 locale.ts 守卫），可被纯 Node 工具链导入。
 * 切换语义：整页刷新生效（locale 模块加载时解析一次）。
 */
import { DEFAULT_LOCALE, getLocale } from './locale.ts'

export type I18nParams = Record<string, string | number>
type Bundle = Record<string, string>

/** 语言包装载器（新增语言：locale.ts 注册表加项 + 此处补 loader + 补 src/locales/<code>/ 目录） */
const BUNDLE_LOADERS: Record<string, () => Promise<{ default: Bundle }>> = {
  'zh-CN': () => import('../locales/zh-CN/index.ts'),
  en: () => import('../locales/en/index.ts'),
}

let bundle: Bundle | undefined
let fallbackBundle: Bundle | undefined
const warned = new Set<string>()

/** 装载语言包：当前语言 +（非基线时并装基线作缺键回退）；应用挂载与工具链取词前调用 */
export async function loadLocaleBundles(): Promise<void> {
  const cur = getLocale()
  const loader = BUNDLE_LOADERS[cur]
  if (!loader) {
    throw new Error(`[i18n] 未注册的语言: ${cur}`)
  }
  bundle = (await loader()).default
  const fallbackLoader = cur === DEFAULT_LOCALE ? undefined : BUNDLE_LOADERS[DEFAULT_LOCALE]
  fallbackBundle = fallbackLoader ? (await fallbackLoader()).default : undefined
}

/** 取词：支持 {param} 命名插值；缺参保留占位符，缺键返回键名 */
export function t(key: string, params?: I18nParams): string {
  if (bundle === undefined) {
    // 未就绪守卫（v1.53）：开发与测试态直接抛错，把「数据表模块级取词在
    // 语言包就绪前静默固化为键名」变成当场失败；生产态维持返回键名兜底
    let dev = false
    try {
      dev = !!(import.meta as { env?: { DEV?: boolean } }).env?.DEV
    } catch {
      /* 非 Vite 环境按生产态处理 */
    }
    if (dev) {
      throw new Error(
        `[i18n] 语言包未就绪就调用了 t('${key}')：先 await loadLocaleBundles() 再求值数据模块`
      )
    }
  }
  let msg = bundle?.[key]
  if (msg === undefined) msg = fallbackBundle?.[key]
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
  FALLBACK_LOCALE,
  LOCALE_STORAGE_KEY,
  clearLocale,
  getLocale,
  isSupportedLocale,
  setLocale,
} from './locale.ts'
