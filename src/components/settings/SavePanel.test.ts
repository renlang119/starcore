/**
 * SavePanel.test.ts：存档管理面板组件测试
 *
 * 覆盖：导出（剪贴板成功与回退两路）、导入（空码提示 / 确认窗 / 无效码 /
 * 有效码）、手动保存、清除存档两段确认。
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { mountView, useViewTestHooks, focusTrapMock } from '@/tests/view-mount'
import { resetProviderSingletons } from '@/tests/reset-providers'
import { t } from '@/i18n'
import { useGameStore } from '@/stores/game'
import { START_ENERGY } from '@/stores/resources'
import SavePanel from './SavePanel.vue'

vi.mock('@/composables/useFocusTrap', () => focusTrapMock())

/** 按文案定位按钮 */
function btnByText(wrapper: VueWrapper, text: string) {
  const btn = wrapper.findAll('button').find((b) => b.text() === text)
  expect(btn, `未找到按钮：${text}`).toBeTruthy()
  return btn!
}

/** 置入剪贴板成功桩；afterEach 统一还原 */
function stubClipboardOk() {
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true })
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  })
  return writeText
}

describe('SavePanel 存档管理', () => {
  useViewTestHooks()

  beforeEach(() => {
    resetProviderSingletons()
  })
  afterEach(() => {
    Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true })
    // @ts-expect-error 还原剪贴板桩
    delete navigator.clipboard
  })

  it('导出成功：剪贴板写入并显示导出码与已复制提示', async () => {
    const writeText = stubClipboardOk()
    const wrapper = mountView(SavePanel)

    await btnByText(wrapper, t('save.export')).trigger('click')
    await flushPromises()

    expect(writeText).toHaveBeenCalledOnce()
    const textarea = wrapper.find('.export-fallback textarea')
    expect(textarea.exists()).toBe(true)
    expect((textarea.element as HTMLTextAreaElement).value.length).toBeGreaterThan(0)
    expect(wrapper.find('.import-msg').text()).toBe(t('save.exportCopied'))
  })

  it('导出回退：剪贴板不可用时仍显示导出码并提示手动复制', async () => {
    // jsdom 默认无 clipboard 且非安全上下文，走 execCommand 回退后失败
    const wrapper = mountView(SavePanel)

    await btnByText(wrapper, t('save.export')).trigger('click')
    await flushPromises()

    const textarea = wrapper.find('.export-fallback textarea')
    expect(textarea.exists()).toBe(true)
    expect((textarea.element as HTMLTextAreaElement).value.length).toBeGreaterThan(0)
    expect(wrapper.find('.import-msg').text()).toBe(t('save.copyUnavailable'))
  })

  it('导入码为空时提示粘贴且不弹确认窗', async () => {
    const wrapper = mountView(SavePanel)

    await btnByText(wrapper, t('save.import')).trigger('click')

    expect(wrapper.find('.import-msg').text()).toBe(t('save.needPaste'))
    expect(wrapper.find('.modal-overlay').exists()).toBe(false)
  })

  it('导入码非空弹确认窗，取消后关闭', async () => {
    const wrapper = mountView(SavePanel)

    await wrapper.find('.import-box textarea').setValue('some-code')
    await btnByText(wrapper, t('save.import')).trigger('click')

    const modal = wrapper.find('.modal-overlay')
    expect(modal.exists()).toBe(true)
    expect(modal.text()).toContain(t('save.importConfirmTitle'))

    await modal.find('.btn-secondary').trigger('click')
    expect(wrapper.find('.modal-overlay').exists()).toBe(false)
  })

  it('确认导入无效码显示无效提示并恢复按钮态', async () => {
    const wrapper = mountView(SavePanel)

    await wrapper.find('.import-box textarea').setValue('not-a-valid-save!!!')
    await btnByText(wrapper, t('save.import')).trigger('click')
    await wrapper.find('.modal-overlay .btn-accent').trigger('click')
    await flushPromises()

    expect(wrapper.find('.import-msg').text()).toBe(t('save.errInvalid'))
    const importBtn = btnByText(wrapper, t('save.import'))
    expect(importBtn.attributes('disabled')).toBeUndefined()
  })

  it('确认导入有效码显示成功提示', async () => {
    const game = useGameStore()
    const wrapper = mountView(SavePanel)

    const code = await game.doExport()
    await wrapper.find('.import-box textarea').setValue(code)
    await btnByText(wrapper, t('save.import')).trigger('click')
    await wrapper.find('.modal-overlay .btn-accent').trigger('click')
    await flushPromises()

    expect(wrapper.find('.import-msg').text()).toBe(t('save.importOk'))
  })

  it('手动保存显示已保存提示', async () => {
    const wrapper = mountView(SavePanel)

    await btnByText(wrapper, t('save.manualSave')).trigger('click')
    await flushPromises()

    expect(wrapper.find('.save-msg').text()).toBe(t('save.saved'))
  })

  it('清除存档两段确认后重置游戏状态', async () => {
    const game = useGameStore()
    game.resources.setAmount('energy', 999999)
    const wrapper = mountView(SavePanel)

    await btnByText(wrapper, t('save.clear')).trigger('click')
    const modal = wrapper.find('.modal-overlay')
    expect(modal.exists()).toBe(true)
    expect(modal.text()).toContain(t('save.clearConfirmTitle'))

    await modal.find('.btn-accent').trigger('click')
    await flushPromises()

    expect(game.resources.getAmount('energy').eq(START_ENERGY)).toBe(true)
    expect(wrapper.find('.modal-overlay').exists()).toBe(false)
  })
})
