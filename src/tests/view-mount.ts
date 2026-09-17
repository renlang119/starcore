/**
 * view-mount.ts — 视图组件测试共享装配（v1.04 收敛）
 *
 * 七个 view 测试此前各自逐字携带同一套装配：
 * vue-router / useFocusTrap 的 vi.mock 工厂体、mountView + wrappers 登记、
 * 每个 describe 重复的 beforeEach（清 mock + 清 localStorage + 重建 pinia）
 * 与 afterEach（统一卸载）。此处收敛为单一出处。
 *
 * 用法：
 *   const mockPush = vi.fn()
 *   vi.mock('vue-router', () => vueRouterMock({ push: () => mockPush }))
 *   vi.mock('@/composables/useFocusTrap', () => focusTrapMock())
 *   describe('...', () => {
 *     useViewTestHooks()
 *     it('...', () => { const wrapper = mountView(MyView) })
 *   })
 *
 * 注意：vi.mock 调用会被提升到模块顶部，路由参数与 push 等可变值必须以
 * 惰性函数传入（params: () => ...），勿在调用处直接引用顶层变量求值。
 */
import { beforeEach, afterEach, vi, expect, type Mock } from 'vitest'
import { createPinia, setActivePinia, getActivePinia } from 'pinia'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, type Component } from 'vue'

const wrappers: VueWrapper[] = []

/** vue-router mock 工厂（各文件顶层 vi.mock 的工厂体委派于此） */
export function vueRouterMock(options?: {
  params?: Record<string, unknown> | (() => Record<string, unknown>)
  push?: Mock | (() => Mock)
}) {
  const paramsOf = () =>
    typeof options?.params === 'function' ? options.params() : (options?.params ?? {})
  const pushOf = () => (typeof options?.push === 'function' ? options.push() : options?.push)
  return {
    useRoute: () => ({ params: paramsOf() }),
    useRouter: () => ({ push: pushOf() ?? vi.fn() }),
    RouterLink: defineComponent({
      props: { to: { type: String, required: false, default: '' } },
      template: '<a><slot /></a>',
    }),
    RouterView: defineComponent({ template: '<div />' }),
  }
}

/** useFocusTrap mock 工厂（弹窗组件测试不验焦点陷阱本体） */
export function focusTrapMock() {
  return { useFocusTrap: () => {} }
}

/** 挂载并登记到卸载清单；Icons 恒桩，额外桩经 options.stubs 传入 */
export function mountView(
  component: Component,
  options?: { stubs?: Record<string, unknown> }
): VueWrapper {
  const wrapper = mount(component, {
    global: {
      // 测试 hooks 已在 beforeEach 重建并激活 pinia，此处读取当前实例
      plugins: [getActivePinia()!],
      stubs: {
        Icons: defineComponent({ template: '<svg />' }),
        ...options?.stubs,
      },
    },
  })
  wrappers.push(wrapper)
  return wrapper
}

/** 视图测试标准 hooks：在每个 describe 内调用一次 */
export function useViewTestHooks(): void {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    setActivePinia(createPinia())
  })
  afterEach(() => {
    for (const w of wrappers) w.unmount()
    wrappers.length = 0
  })
}

/** 引导气泡双态断言：未读显示，预置已读后重挂不显示（v1.04 收敛同构用例） */
export async function expectOnboardingBubble(
  component: Component,
  opts: { selector: string; stepId: string; stubs?: Record<string, unknown> }
): Promise<void> {
  const wrapper = mountView(component, { stubs: opts.stubs })
  await wrapper.vm.$nextTick()
  expect(wrapper.find(opts.selector).exists()).toBe(true)
  wrapper.unmount()

  localStorage.setItem('starcore_onboarding', JSON.stringify({ [opts.stepId]: true }))
  const wrapper2 = mountView(component, { stubs: opts.stubs })
  await wrapper2.vm.$nextTick()
  expect(wrapper2.find(opts.selector).exists()).toBe(false)
}

/** 切至 ×10 档位：找到切换器按钮并点击（含存在断言与 nextTick） */
export async function selectBulk10(wrapper: VueWrapper, toggleScope: string): Promise<void> {
  const btn = wrapper.findAll(`${toggleScope} .seg-btn`).find((b) => b.text() === '×10')
  expect(btn).toBeTruthy()
  await btn!.trigger('click')
  await wrapper.vm.$nextTick()
}
