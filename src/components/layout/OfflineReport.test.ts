/**
 * OfflineReport.test.ts：离线收益报告组件测试
 *
 * 覆盖：无报告不渲染、单分组与五分组渲染、空报告提示、
 * 继续按钮与点遮罩两条关闭路径。
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mountView, useViewTestHooks, focusTrapMock } from '@/tests/view-mount'
import { resetProviderSingletons } from '@/tests/reset-providers'
import { t } from '@/i18n'
import { useGameStore } from '@/stores/game'
import { UNITS } from '@/data/units'
import OfflineReport from './OfflineReport.vue'

vi.mock('@/composables/useFocusTrap', () => focusTrapMock())

/** 建筑产出单分组报告 */
function gainsOnlyReport() {
  return { duration: 3600, gains: { energy: '100' } }
}

describe('OfflineReport 离线收益报告', () => {
  useViewTestHooks()

  beforeEach(() => {
    resetProviderSingletons()
  })

  it('无报告时不渲染弹窗', () => {
    const wrapper = mountView(OfflineReport)
    expect(wrapper.find('.modal-overlay').exists()).toBe(false)
  })

  it('有报告时渲染标题与单分组收益行', () => {
    const game = useGameStore()
    game.setOfflineReport(gainsOnlyReport())
    const wrapper = mountView(OfflineReport)

    expect(wrapper.find('.modal-overlay').exists()).toBe(true)
    expect(wrapper.find('.title').text()).toBe(t('offline.title'))
    expect(wrapper.findAll('.gain-section').length).toBe(1)

    const row = wrapper.find('.gain-item')
    expect(row.find('.g-name').text()).toBe(t('resources.energy'))
    expect(row.find('.g-amount').text()).toBe('+100')
  })

  it('五类收益齐备时渲染五个分组，训练行显示兵种名', () => {
    const game = useGameStore()
    game.setOfflineReport({
      duration: 7200,
      gains: { energy: '100' },
      garrisonGains: { crystal: '5' },
      eventGains: { alloy: '2' },
      dispatchGains: { dark: '1' },
      dispatchCount: 2,
      trainedUnits: { assault: 3 },
    })
    const wrapper = mountView(OfflineReport)

    expect(wrapper.findAll('.gain-section').length).toBe(5)
    const unitName = UNITS.find((u) => u.id === 'assault')!.name
    const rows = wrapper.findAll('.gain-item')
    const trainedRow = rows.find((r) => r.find('.g-name').text() === unitName)
    expect(trainedRow, '未找到训练收益行').toBeTruthy()
    expect(trainedRow!.find('.g-amount').text()).toBe('+3')
    // 派遣分组标题带路数
    expect(wrapper.text()).toContain(t('offline.dispatchTitle', { count: 2 }))
  })

  it('无收益行时显示空态提示', () => {
    const game = useGameStore()
    game.setOfflineReport({ duration: 60, gains: {} })
    const wrapper = mountView(OfflineReport)

    expect(wrapper.find('.modal-overlay').exists()).toBe(true)
    expect(wrapper.findAll('.gain-section').length).toBe(0)
    expect(wrapper.find('.empty').text()).toBe(t('offline.emptyNote'))
  })

  it('点继续按钮清空报告并关闭弹窗', async () => {
    const game = useGameStore()
    game.setOfflineReport(gainsOnlyReport())
    const wrapper = mountView(OfflineReport)

    await wrapper.find('.btn-primary').trigger('click')
    expect(game.offlineReport).toBeNull()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.modal-overlay').exists()).toBe(false)
  })

  it('点遮罩清空报告并关闭弹窗', async () => {
    const game = useGameStore()
    game.setOfflineReport(gainsOnlyReport())
    const wrapper = mountView(OfflineReport)

    await wrapper.find('.modal-overlay').trigger('click')
    expect(game.offlineReport).toBeNull()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.modal-overlay').exists()).toBe(false)
  })
})
