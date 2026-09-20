import { describe, expect, it } from 'vitest'
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
