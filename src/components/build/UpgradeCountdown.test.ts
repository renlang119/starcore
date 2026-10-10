/**
 * UpgradeCountdown.test.ts：建筑升级倒计时组件测试
 *
 * 覆盖：ready / countdown / manual / 混合四形态渲染、空成本不渲染、
 * 点击展开明细的资源行状态类名与速率显示。
 * 四形态经直覆 game.buildings.getCost 与 game.getDisplayRate 驱动。
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { getActivePinia } from 'pinia'
import { useViewTestHooks } from '@/tests/view-mount'
import { resetProviderSingletons } from '@/tests/reset-providers'
import { D } from '@/lib/decimal'
import { t } from '@/i18n'
import { useGameStore } from '@/stores/game'
import type { ResourceType } from '@/data/buildings'
import UpgradeCountdown from './UpgradeCountdown.vue'

const BUILDING_ID = 'solar_collector'

/** 挂载并直覆成本与速率驱动形态 */
function mountCountdown(opts: {
  cost: Partial<Record<ResourceType, number>>
  amounts?: Partial<Record<ResourceType, number>>
  rates?: Partial<Record<ResourceType, number>>
}) {
  const game = useGameStore()
  game.buildings.getCost = (_id: string) => ({ ...opts.cost })
  game.getDisplayRate = ((rt: ResourceType) => D(opts.rates?.[rt] ?? 0)) as never
  for (const [rt, v] of Object.entries(opts.amounts ?? {})) {
    game.resources.setAmount(rt as ResourceType, v)
  }
  return mount(UpgradeCountdown, {
    props: { buildingId: BUILDING_ID },
    global: { plugins: [getActivePinia()!] },
  })
}

describe('UpgradeCountdown 升级倒计时', () => {
  useViewTestHooks()

  beforeEach(() => {
    resetProviderSingletons()
  })

  it('资源全满（ready）不渲染倒计时区', () => {
    const wrapper = mountCountdown({ cost: { energy: 100 }, amounts: { energy: 1000 } })
    expect(wrapper.find('.countdown-zone').exists()).toBe(false)
  })

  it('空成本不渲染倒计时区', () => {
    const wrapper = mountCountdown({ cost: {} })
    expect(wrapper.find('.countdown-zone').exists()).toBe(false)
  })

  it('可产出瓶颈（countdown）显示倒计时行与时长', () => {
    // 缺口 100 能量、速率 10/s → 预估 10 秒 → 不足一分钟
    const wrapper = mountCountdown({
      cost: { energy: 100 },
      rates: { energy: 10 },
    })

    const row = wrapper.find('.countdown-row')
    expect(row.exists()).toBe(true)
    expect(row.classes()).not.toContain('rate-zero')
    expect(row.find('.cd-time').text()).toBe(t('build.ltMinute'))
    expect(row.find('.cd-hint').exists()).toBe(true)
  })

  it('仅手动瓶颈（manual）显示需手动获取行', () => {
    const wrapper = mountCountdown({ cost: { dark: 50 } })

    const row = wrapper.find('.countdown-row')
    expect(row.exists()).toBe(true)
    expect(row.classes()).toContain('rate-zero')
    expect(row.find('.cd-time').text()).toBe(t('build.manual'))
  })

  it('混合瓶颈双行并列：倒计时行带入口、手动行无入口', () => {
    const wrapper = mountCountdown({
      cost: { energy: 100, dark: 50 },
      rates: { energy: 10 },
    })

    const rows = wrapper.findAll('.countdown-row')
    expect(rows.length).toBe(2)
    expect(rows[0].classes()).not.toContain('rate-zero')
    expect(rows[0].find('.cd-hint').exists()).toBe(true)
    expect(rows[1].classes()).toContain('rate-zero')
    expect(rows[1].find('.cd-hint').exists()).toBe(false)
  })

  it('点击展开明细：瓶颈行类名与时长、手动行类名与横杠、充足行对勾', async () => {
    const wrapper = mountCountdown({
      cost: { energy: 100, crystal: 50, dark: 10 },
      amounts: { crystal: 1000 },
      rates: { energy: 10 },
    })

    await wrapper.find('.countdown-row').trigger('click')
    const detail = wrapper.find('.countdown-detail')
    expect(detail.exists()).toBe(true)

    const rows = detail.findAll('.detail-row')
    expect(rows.length).toBe(3)

    // 能量：可产出瓶颈
    expect(rows[0].classes()).toContain('bottleneck')
    expect(rows[0].find('.d-status').classes()).toContain('bottleneck')
    expect(rows[0].find('.d-status').text()).toBe(t('build.bottleneck'))
    expect(rows[0].find('.d-eta').text()).toBe(t('build.ltMinute'))
    expect(rows[0].find('.d-rate').text()).toBe('+10 /s')

    // 晶体：充足
    expect(rows[1].classes()).not.toContain('bottleneck')
    expect(rows[1].find('.d-status').classes()).toContain('ok')
    expect(rows[1].find('.d-status').text()).toBe('✓')
    expect(rows[1].find('.d-eta').text()).toBe(t('build.satisfied'))

    // 暗物质：手动
    expect(rows[2].find('.d-status').classes()).toContain('manual')
    expect(rows[2].find('.d-status').text()).toBe(t('build.manual'))
    expect(rows[2].find('.d-eta').text()).toBe('—')
    expect(rows[2].find('.d-rate').classes()).toContain('zero')
    expect(rows[2].find('.d-rate').text()).toBe('0 /s')
  })

  it('键盘 Enter 同样切换展开', async () => {
    const wrapper = mountCountdown({
      cost: { energy: 100 },
      rates: { energy: 10 },
    })

    await wrapper.find('.countdown-row').trigger('keydown.enter')
    expect(wrapper.find('.countdown-detail').exists()).toBe(true)

    await wrapper.find('.countdown-row').trigger('keydown.enter')
    expect(wrapper.find('.countdown-detail').exists()).toBe(false)
  })
})
