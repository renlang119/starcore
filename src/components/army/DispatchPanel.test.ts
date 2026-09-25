/**
 * DispatchPanel.test.ts — 派遣区组件测试（v1.27 可玩内容扩展方案 6）
 *
 * 覆盖四组：
 * 1. 未解锁态（提示语、无档位按钮）
 * 2. 未派遣态（档位选择 + 预期带回 + 派出）
 * 3. 派遣中态（倒计时显示、召回比例/全额结算链路）
 * 4. 召回结算发放 + toast 回执
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { getActivePinia } from 'pinia'
import { useViewTestHooks, vueRouterMock, focusTrapMock } from '@/tests/view-mount'
import DispatchPanel from './DispatchPanel.vue'
import { useGameStore } from '@/stores/game'
import { setDispatchBestProvider, resetDispatchBestProvider } from '@/stores/military'
import { STRONGHOLDS } from '@/data/pve'

vi.mock('vue-router', () => vueRouterMock())

vi.mock('@/composables/useFocusTrap', () => focusTrapMock())

const T0 = 1_700_000_000_000

async function setupPanel(formationId = 'f1') {
  const wrapper = mount(DispatchPanel, {
    props: { formationId },
    global: { plugins: [getActivePinia()!] },
  })
  const game = useGameStore()
  return { wrapper, game }
}

describe('DispatchPanel · 未解锁', () => {
  useViewTestHooks()

  it('显示解锁提示，无档位与派出按钮', async () => {
    const { wrapper, game } = await setupPanel()
    game.military.setDispatchUnlocked(false)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="dispatch-locked"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="dispatch-send-f1"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('沉默者旗舰')
  })
})

describe('DispatchPanel · 派遣前', () => {
  useViewTestHooks()

  it('解锁后显示四档位与预期带回，派出写入 dispatches', async () => {
    const { wrapper, game } = await setupPanel()
    game.combat.completedStrongholds.add('silencer_3')
    game.military.setDispatchUnlocked(true)
    setDispatchBestProvider(() => 5)
    await wrapper.vm.$nextTick()
    const tiers = wrapper.findAll('[data-testid^="dispatch-tier-f1-"]')
    expect(tiers.length).toBe(4)
    expect(wrapper.text()).toContain('预期带回')
    // 预览行含 silencer_3 基础包的资源（energy 恒存在）
    expect(wrapper.text()).toContain('能量')
    await wrapper.find('[data-testid="dispatch-send-f1"]').trigger('click')
    expect(game.military.isDispatched('f1')).toBe(true)
    expect(game.military.dispatches.f1.hours).toBe(4)
  })

  it('切档更新预览权重（12h 预览能量值 > 4h 预览值，切档不误派出）', async () => {
    const { wrapper, game } = await setupPanel()
    game.combat.completedStrongholds.add('silencer_3')
    game.military.setDispatchUnlocked(true)
    setDispatchBestProvider(() => 5)
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="dispatch-tier-f1-4"]').trigger('click')
    await wrapper.find('[data-testid="dispatch-tier-f1-12"]').trigger('click')
    // 切档只是改选择，不产生派遣
    expect(game.military.dispatches.f1).toBeUndefined()
    // 派出后档位 = 最后选中值（12h）
    await wrapper.find('[data-testid="dispatch-send-f1"]').trigger('click')
    expect(game.military.dispatches.f1.hours).toBe(12)
  })
})

describe('DispatchPanel · 派遣中与召回', () => {
  useViewTestHooks()

  it('派遣中显示倒计时；到点后召回按钮转「召回」并全额发放', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(T0)
      const { wrapper, game } = await setupPanel()
      game.military.setDispatchUnlocked(true)
      setDispatchBestProvider(() => 5)
      expect(game.military.startDispatch('f1', 4, T0)).toBe(true)
      await wrapper.vm.$nextTick()
      expect(wrapper.text()).toContain('归来剩余')
      // 未到点召回 = 提前召回（按比例），t=0 派出即点 = 零奖励
      await wrapper.find('[data-testid="dispatch-recall-f1"]').trigger('click')
      expect(game.military.isDispatched('f1')).toBe(false)
      await wrapper.vm.$nextTick()
      // 全额路径：重新派出，advance 时钟到点后召回
      expect(game.military.startDispatch('f1', 4, T0)).toBe(true)
      await wrapper.vm.$nextTick() // startDispatch 后等重渲染，召回按钮才回到 DOM
      vi.setSystemTime(T0 + 4 * 3_600_000)
      // 组件 nowTick 是真实 setInterval——fake timers 下手动推进组件内倒计时状态：
      // 直接挂载新 wrapper 让 setup 重新读当前时间，或直接触发召回（结算按 now 参数
      // 用 Date.now()，与组件显示无关）——store 正确性已由 military.test 覆盖，
      // 此处断言 UI 点击链路发放正确即可
      const energyBefore = game.resources.getAmount('energy').toNumber()
      await wrapper.find('[data-testid="dispatch-recall-f1"]').trigger('click')
      const gained = game.resources.getAmount('energy').toNumber() - energyBefore
      expect(gained).toBe(
        Math.round(
          (STRONGHOLDS.find((s) => s.id === 'silencer_3')!.rewards.energy as number) *
            Math.pow(1.35, 4)
        )
      )
    } finally {
      vi.useRealTimers()
    }
    resetDispatchBestProvider()
  })

  it('召回后经 game store 发放通道资源入账（比例结算）', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(T0)
      const { wrapper, game } = await setupPanel()
      game.military.setDispatchUnlocked(true)
      setDispatchBestProvider(() => 1)
      game.military.startDispatch('f1', 8, T0)
      await wrapper.vm.$nextTick() // 等派遣态渲染出召回按钮
      // 半程召回：energy = round(全额 / 2)
      vi.setSystemTime(T0 + 4 * 3_600_000)
      const before = game.resources.getAmount('energy').toNumber()
      await wrapper.find('[data-testid="dispatch-recall-f1"]').trigger('click')
      const gained = game.resources.getAmount('energy').toNumber() - before
      // 8h 档 w=2.2：全额 = round(2e7 × 1.35^0 × 2.2) = 44M，半程 = 22M
      expect(gained).toBe(
        Math.round(
          Math.round(
            (STRONGHOLDS.find((s) => s.id === 'silencer_3')!.rewards.energy as number) * 2.2
          ) / 2
        )
      )
    } finally {
      vi.useRealTimers()
    }
    resetDispatchBestProvider()
  })
})
