import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  clearLocale,
  getLocale,
  isSupportedLocale,
  matchLocale,
  resolveLocale,
  setLocale,
} from './locale'

function fakeStorage() {
  const store = new Map<string, string>()
  return {
    store,
    api: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
    },
  }
}

describe('matchLocale — 匹配算法（mock 注册表）', () => {
  it('完整标签精确命中', () => {
    expect(matchLocale(['zh-CN'], ['zh-CN'])).toBe('zh-CN')
  })

  it('大小写不敏感', () => {
    expect(matchLocale(['ZH-cn'], ['zh-CN'])).toBe('zh-CN')
  })

  it('语言前缀回退：zh-TW 现归 zh-CN', () => {
    expect(matchLocale(['zh-TW'], ['zh-CN'])).toBe('zh-CN')
  })

  it('按偏好顺序取首个命中', () => {
    expect(matchLocale(['fr-FR', 'en-US'], ['en', 'zh-CN'])).toBe('en')
  })

  it('前缀多候选时取注册表顺序首个', () => {
    expect(matchLocale(['zh-HK'], ['zh-CN', 'zh-TW'])).toBe('zh-CN')
  })

  it('无匹配返回 null', () => {
    expect(matchLocale(['en-US'], ['zh-CN'])).toBeNull()
  })

  it('空偏好返回 null', () => {
    expect(matchLocale([], ['zh-CN'])).toBeNull()
  })
})

describe('resolveLocale — 生效顺序（显式选择 > 浏览器 > 默认）', () => {
  it('显式选择优先于浏览器', () => {
    expect(resolveLocale({ stored: 'zh-CN', browser: ['en-US'], available: ['en', 'zh-CN'] })).toBe(
      'zh-CN'
    )
  })

  it('存储值未注册则忽略并看浏览器', () => {
    expect(resolveLocale({ stored: 'jp', browser: ['en-US'], available: ['en', 'zh-CN'] })).toBe(
      'en'
    )
  })

  it('浏览器匹配（未来多语言）', () => {
    expect(resolveLocale({ stored: null, browser: ['en-GB'], available: ['en', 'zh-CN'] })).toBe(
      'en'
    )
  })

  it('无匹配回退默认中文', () => {
    expect(resolveLocale({ browser: ['fr-FR'] })).toBe(DEFAULT_LOCALE)
  })

  it('无浏览器信息回退默认中文', () => {
    expect(resolveLocale({ browser: [] })).toBe(DEFAULT_LOCALE)
  })
})

describe('setLocale / clearLocale — 持久化', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('支持的语言写入成功且落键', () => {
    const { store, api } = fakeStorage()
    vi.stubGlobal('localStorage', api)
    expect(setLocale('zh-CN')).toBe(true)
    expect(store.get(LOCALE_STORAGE_KEY)).toBe('zh-CN')
  })

  it('未支持的语言拒绝', () => {
    const { api } = fakeStorage()
    vi.stubGlobal('localStorage', api)
    expect(setLocale('fr')).toBe(false)
  })

  it('存储不可用时返回 false 不抛', () => {
    vi.stubGlobal('localStorage', undefined)
    expect(setLocale('zh-CN')).toBe(false)
  })

  it('clearLocale 移除持久化键', () => {
    const { store, api } = fakeStorage()
    vi.stubGlobal('localStorage', api)
    setLocale('zh-CN')
    clearLocale()
    expect(store.has(LOCALE_STORAGE_KEY)).toBe(false)
  })
})

describe('当前语言与支持面', () => {
  it('测试环境（无浏览器信息）回退默认中文', () => {
    expect(getLocale()).toBe(DEFAULT_LOCALE)
  })

  it('isSupportedLocale 判定', () => {
    expect(isSupportedLocale('zh-CN')).toBe(true)
    expect(isSupportedLocale('en')).toBe(true)
    expect(isSupportedLocale('fr')).toBe(false)
  })
})
