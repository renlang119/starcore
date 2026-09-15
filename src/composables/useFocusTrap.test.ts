/**
 * useFocusTrap.test.ts — 焦点陷阱行为（v0.96 新增）
 *
 * 覆盖：激活聚焦首元素（禁用/隐藏节点跳过）、末位 Tab 与首位 Shift+Tab 环绕、
 * 焦点落弹窗外时的 contains 兜底、Escape 回调、关闭还焦、
 * 「常真 active + 父级 v-if 卸载」路径的卸载还焦、卸载后监听移除。
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, nextTick, ref, type Ref } from 'vue'
import { useFocusTrap } from './useFocusTrap'

/** 等 v-if 渲染 + 陷阱内首轮 rAF 聚焦完成 */
async function flushTrap() {
  await nextTick()
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
}

function tabKey(shift = false) {
  const e = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: shift, cancelable: true })
  document.dispatchEvent(e)
  return e
}

/** 通用载具：外部触发按钮 + 可开关弹窗（内含可聚焦、禁用、隐藏三类节点） */
function mountTrap() {
  const Comp = defineComponent({
    setup() {
      const show = ref(false)
      const escaped = ref(0)
      const container = ref<HTMLElement | null>(null)
      useFocusTrap(container as Ref<HTMLElement | null>, show, {
        onEscape: () => {
          escaped.value++
        },
      })
      return { show, escaped, container }
    },
    template: `
      <div>
        <button class="trigger">触发</button>
        <div v-if="show" class="dialog" :ref="(el) => { container = el }">
          <button class="first">一</button>
          <button class="mid" disabled>禁用</button>
          <button class="hid" hidden>隐藏</button>
          <button class="last">二</button>
        </div>
      </div>`,
  })
  return mount(Comp, { attachTo: document.body })
}

/** 「常真 active + v-if 卸载」载具（照 EnhanceModal 路径） */
function mountConstantTrap() {
  const Comp = defineComponent({
    setup() {
      const container = ref<HTMLElement | null>(null)
      useFocusTrap(container as Ref<HTMLElement | null>, ref(true))
      return { container }
    },
    template: `
      <div class="dialog" :ref="(el) => { container = el }">
        <button class="inside">内</button>
      </div>`,
  })
  return mount(Comp, { attachTo: document.body })
}

describe('useFocusTrap', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('激活后聚焦首个可交互元素（禁用与隐藏节点跳过）', async () => {
    const wrapper = mountTrap()
    wrapper.vm.show = true
    await flushTrap()
    expect(document.activeElement).toBe(wrapper.find('.first').element)
    wrapper.unmount()
  })

  it('末位 Tab 环绕回首位，首位 Shift+Tab 环绕回末位', async () => {
    const wrapper = mountTrap()
    wrapper.vm.show = true
    await flushTrap()

    const last = wrapper.find('.last').element as HTMLElement
    last.focus()
    const e1 = tabKey()
    expect(e1.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(wrapper.find('.first').element)

    const e2 = tabKey(true)
    expect(e2.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(last)
    wrapper.unmount()
  })

  it('焦点落在弹窗外时 Tab 拉回弹窗（contains 兜底）', async () => {
    const wrapper = mountTrap()
    wrapper.vm.show = true
    await flushTrap()

    // 点击非聚焦区域后 activeElement 落到 body
    ;(document.activeElement as HTMLElement | null)?.blur?.()
    expect(wrapper.find('.dialog').element.contains(document.activeElement)).toBe(false)
    const e1 = tabKey()
    expect(e1.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(wrapper.find('.first').element)

    // 倒序兜底回末位
    ;(document.activeElement as HTMLElement | null)?.blur?.()
    const e2 = tabKey(true)
    expect(e2.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(wrapper.find('.last').element)
    wrapper.unmount()
  })

  it('Escape 触发回调', async () => {
    const wrapper = mountTrap()
    wrapper.vm.show = true
    await flushTrap()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }))
    expect(wrapper.vm.escaped).toBe(1)
    wrapper.unmount()
  })

  it('关闭后焦点恢复到触发元素', async () => {
    const wrapper = mountTrap()
    const trigger = wrapper.find('.trigger').element as HTMLElement
    trigger.focus()
    wrapper.vm.show = true
    await flushTrap()
    expect(document.activeElement).not.toBe(trigger)

    wrapper.vm.show = false
    await nextTick()
    expect(document.activeElement).toBe(trigger)
    wrapper.unmount()
  })

  it('常真激活路径卸载时还焦（watch 收不到 false）', async () => {
    const outside = document.createElement('button')
    document.body.appendChild(outside)
    outside.focus()

    const wrapper = mountConstantTrap()
    await flushTrap()
    expect(document.activeElement).toBe(wrapper.find('.inside').element)

    wrapper.unmount()
    expect(document.activeElement).toBe(outside)
    outside.remove()
  })

  it('卸载后监听移除，Escape 与 Tab 不再被拦截', async () => {
    const wrapper = mountTrap()
    wrapper.vm.show = true
    await flushTrap()
    wrapper.unmount()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }))
    expect(wrapper.vm.escaped).toBe(0)
    const e = tabKey()
    expect(e.defaultPrevented).toBe(false)
  })
})
