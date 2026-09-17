/**
 * CostTag.test.ts — 成本标签组件测试
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import CostTag from './CostTag.vue'
import { useResourcesStore } from '@/stores/resources'

let pinia: ReturnType<typeof createPinia>

function mountTag(cost: Record<string, number>) {
  return mount(CostTag, { props: { cost }, global: { plugins: [pinia] } })
}

describe('CostTag — 资源足够/不足显示', () => {
  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    const resources = useResourcesStore()
    resources.setAmount('energy', 500)
    resources.setAmount('crystal', 100)
  })

  it('资源足够时显示 enough 样式', () => {
    const wrapper = mountTag({ energy: 100 })

    const tag = wrapper.find('.cost-tag')
    expect(tag.exists()).toBe(true)
    expect(tag.classes()).toContain('enough')
  })

  it('资源不足时显示 not-enough 样式', () => {
    const wrapper = mountTag({ energy: 999999 })

    const tag = wrapper.find('.cost-tag')
    expect(tag.exists()).toBe(true)
    expect(tag.classes()).toContain('not-enough')
  })

  it('多种资源分别显示', () => {
    const wrapper = mountTag({ energy: 100, crystal: 5000 })

    const tags = wrapper.findAll('.cost-tag')
    expect(tags).toHaveLength(2)
    // energy 500 >= 100 → enough
    expect(tags[0].classes()).toContain('enough')
    // crystal 100 < 5000 → not-enough
    expect(tags[1].classes()).toContain('not-enough')
  })
})
