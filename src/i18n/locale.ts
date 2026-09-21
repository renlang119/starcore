/**
 * locale.ts — 语言注册与默认语言识别（i18n 门面内层）
 *
 * 生效顺序：显式选择（localStorage 持久化）> 浏览器语言匹配 > 浏览器环境统一
 * 回退英文（FALLBACK_LOCALE，2026-09-21 起）；非浏览器环境（Node 工具链）回退
 * 基线 zh-CN（DEFAULT_LOCALE），保证工具链确定性。
 * 匹配规则：逐项对照注册表，完整标签优先、语言前缀次之（zh-TW / zh-HK 等
 * 中文变体现均归 zh-CN；未来加入繁中后凭精确标签优先自动分流）。
 *
 * 环境安全：不裸引用 window / localStorage / navigator（全程 typeof 守卫 +
 * try/catch），可被纯 Node 工具链直接导入（守卫脚本等）；无浏览器
 * 环境（含 Node 21+ 自带 navigator 全局的 CLI）一律回退基线语言。
 *
 * 切换语义：整页刷新生效。解析在模块加载时求值一次（一次会话内不变），
 * 显式选择写持久化后由调用方负责刷新。
 */

export interface LocaleInfo {
  code: string
  label: string
}

/** 已支持语言注册表（新增语言：加一项 + 补 src/locales/<code>/ 目录） */
export const AVAILABLE_LOCALES: LocaleInfo[] = [
  { code: 'zh-CN', label: '简体中文' },
  { code: 'en', label: 'English' },
]

/** 基线语言：语言包基准（键面参照与缺键回退链）＋非浏览器环境（Node 工具链）确定性回退 */
export const DEFAULT_LOCALE = 'zh-CN'

/** 浏览器环境统一回退语言（无显式选择且偏好列表无可匹配项时；2026-09-21 起） */
export const FALLBACK_LOCALE = 'en'

/** 显式选择持久化键（与既有 starcore_* 键风格一致） */
export const LOCALE_STORAGE_KEY = 'starcore_locale'

const supported = new Set(AVAILABLE_LOCALES.map((l) => l.code))

/** 纯函数：按偏好列表匹配注册表；精确标签优先、语言前缀次之；无匹配返回 null */
export function matchLocale(
  preferences: readonly string[],
  available: readonly string[]
): string | null {
  const prefs = preferences.map((p) => p.trim().toLowerCase()).filter(Boolean)
  const avail = available.map((a) => ({ code: a, lower: a.toLowerCase() }))
  for (const pref of prefs) {
    const exact = avail.find((a) => a.lower === pref)
    if (exact) return exact.code
    const lang = pref.split('-')[0]
    const byLang = avail.find((a) => a.lower.split('-')[0] === lang)
    if (byLang) return byLang.code
  }
  return null
}

/** 读取显式选择（无存储或值未注册时返回 null） */
function readStoredLocale(): string | null {
  try {
    if (typeof localStorage === 'undefined') return null
    const v = localStorage.getItem(LOCALE_STORAGE_KEY)
    return v && supported.has(v) ? v : null
  } catch {
    return null
  }
}

/** 读取浏览器偏好语言列表（缺失时退回单值；全无返回空数组） */
function readBrowserLocales(): string[] {
  try {
    // 仅在真实浏览器/类 DOM 环境采信 navigator：Node 21+ 的 CLI 也带
    // navigator 全局（随系统 locale），守卫脚本等纯 Node 工具链须回退基线语言
    if (typeof document === 'undefined') return []
    if (typeof navigator === 'undefined') return []
    const list = navigator.languages
    if (Array.isArray(list) && list.length > 0) return [...list]
    return navigator.language ? [navigator.language] : []
  } catch {
    return []
  }
}

/** 解析当前语言（可注入依赖便于测试；缺省读真实存储与浏览器） */
export function resolveLocale(
  opts: {
    stored?: string | null
    browser?: readonly string[]
    available?: readonly string[]
  } = {}
): string {
  const available = opts.available ?? [...supported]
  const allowed = new Set(available)
  const stored = opts.stored === undefined ? readStoredLocale() : opts.stored
  if (stored && allowed.has(stored)) return stored
  const browser = opts.browser === undefined ? readBrowserLocales() : [...opts.browser]
  const matched = matchLocale(browser, available)
  if (matched) return matched
  // 浏览器语境（类 DOM 环境，或显式传入偏好列表）无匹配统一回退英文；
  // 纯 Node 工具链环境回退基线 zh-CN，保持确定性
  const inBrowser = opts.browser !== undefined || typeof document !== 'undefined'
  return inBrowser ? FALLBACK_LOCALE : DEFAULT_LOCALE
}

const currentLocale = resolveLocale()

/** 当前语言（刷新级语义：一次会话内不变） */
export function getLocale(): string {
  return currentLocale
}

/** 是否为已支持的语言码 */
export function isSupportedLocale(code: string): boolean {
  return supported.has(code)
}

/** 显式选择语言：写入持久化；未支持或存储不可用时返回 false */
export function setLocale(code: string): boolean {
  if (!supported.has(code)) return false
  try {
    if (typeof localStorage === 'undefined') return false
    localStorage.setItem(LOCALE_STORAGE_KEY, code)
    return true
  } catch {
    return false
  }
}

/** 清除显式选择（回到浏览器识别；刷新后生效） */
export function clearLocale(): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(LOCALE_STORAGE_KEY)
  } catch {
    /* 静默降级 */
  }
}
