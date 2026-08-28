/**
 * helpers.ts — Vue 组件测试辅助工具
 */
import { createPinia, setActivePinia } from 'pinia'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, type Component } from 'vue'

/**
 * 创建新 Pinia 实例并设为全局活动实例
 * 在每个测试的 beforeEach 中调用
 */
export function freshPinia() {
  const pinia = createPinia()
  setActivePinia(pinia)
  return pinia
}

/**
 * 挂载 Vue 组件，自动注入 Pinia + Router stub
 * @param component 要挂载的组件
 * @param options 额外的 mount 选项
 */
export function mountComponent<T extends Component>(
  component: T,
  options: { props?: Record<string, any>; shallow?: boolean } = {},
): VueWrapper {
  const pinia = createPinia()
  setActivePinia(pinia)

  // 简单 stub：RouterView / RouterLink
  const stubs: Record<string, any> = {
    RouterView: defineComponent({ template: '<div data-stub="router-view" />' }),
    RouterLink: defineComponent({
      props: ['to'],
      template: '<a data-stub="router-link"><slot /></a>',
    }),
    Icons: defineComponent({ template: '<svg data-stub="icons" />' }),
  }

  return mount(component as any, {
    props: options.props,
    global: {
      plugins: [pinia],
      stubs,
    },
  })
}
