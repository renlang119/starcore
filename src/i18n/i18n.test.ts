import { describe, expect, it, vi } from 'vitest'
import { t } from '@/i18n'

describe('t — 取词与回退', () => {
  it('基础取词', () => {
    expect(t('nav.home')).toBe('主界面')
  })

  it('多段路径与共享键', () => {
    expect(t('home.actionQueue.title')).toBe('行动队列')
    expect(t('common.brand')).toBe('星核纪元')
  })

  it('命名插值', () => {
    expect(t('home.daily.checkedIn', { streak: 3 })).toBe('今日已签 · 连击 3 天')
    expect(t('home.actions.upgradable', { count: 2 })).toBe('2 个建筑可升级')
  })

  it('缺参保留占位符（不静默吞）', () => {
    expect(t('home.daily.dayTitle')).toBe('第 {day} 天')
  })

  it('缺键返回键名', () => {
    expect(t('no.such.key')).toBe('no.such.key')
  })

  it('资源名基线值', () => {
    expect(t('resources.energy')).toBe('能量')
    expect(t('resources.dark')).toBe('暗物质')
  })
})

// 未就绪守卫用例置于文件末尾：vi.resetModules 后动态 import 取全新模块实例，
// 不影响文件内既有用例的顶层绑定；后续测试文件的 setupFiles 会重新预装语言包
describe('t — 语言包未就绪守卫（v1.53）', () => {
  it('未就绪时 t() 抛错并指引装载入口', async () => {
    vi.resetModules()
    const fresh = await import('@/i18n')
    expect(() => fresh.t('nav.home')).toThrowError(/语言包未就绪/)
    expect(() => fresh.t('nav.home')).toThrowError(/loadLocaleBundles/)
  })

  it('装载后取词恢复，缺键仍返回键名', async () => {
    vi.resetModules()
    const fresh = await import('@/i18n')
    await fresh.loadLocaleBundles()
    expect(fresh.t('nav.home')).toBe('主界面')
    expect(fresh.t('no.such.key')).toBe('no.such.key')
  })

  it('未就绪时导入数据表在求值期即抛错', async () => {
    vi.resetModules()
    await expect(import('@/data/navigation')).rejects.toThrow(/语言包未就绪/)
  })
})
