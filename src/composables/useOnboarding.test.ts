/**
 * useOnboarding.test.ts — 新手引导存储口径（v0.51）
 *
 * 体验增强设计规范 §3.3.4：localStorage key = starcore_onboarding，
 * JSON 对象，每个 step 一个 boolean，state[stepId] === true 表示已 dismiss。
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, type Ref } from 'vue'
import { useOnboarding } from './useOnboarding'

const KEY = 'starcore_onboarding'
const STEPS = ['s1', 's2', 's3']

let activeRef: Ref<string | null> | null = null
let api: ReturnType<typeof useOnboarding> | null = null

function mountOnboarding() {
  const Comp = defineComponent({
    setup() {
      api = useOnboarding('home', STEPS)
      activeRef = api.activeStep
      return () => h('div')
    },
  })
  return mount(Comp)
}

const stored = () => JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, boolean>

describe('useOnboarding 存储结构', () => {
  beforeEach(() => {
    localStorage.clear()
    activeRef = null
    api = null
  })

  it('首次挂载显示第一个未完成 step', () => {
    mountOnboarding()
    expect(activeRef!.value).toBe('s1')
  })

  it('dismiss 后以对象结构写入 starcore_onboarding', () => {
    mountOnboarding()
    api!.dismiss()
    expect(stored()).toEqual({ s1: true })
    expect(activeRef!.value).toBe('s2')
  })

  it('skipAll 后全部 step 标记 true 且不再显示', () => {
    mountOnboarding()
    api!.skipAll()
    expect(stored()).toEqual({ s1: true, s2: true, s3: true })
    expect(activeRef!.value).toBeNull()
  })

  it('预置对象结构时跳过已完成 step', () => {
    localStorage.setItem(KEY, JSON.stringify({ s1: true, s2: true }))
    mountOnboarding()
    expect(activeRef!.value).toBe('s3')
  })

  it('损坏的存储内容按全新处理（不抛错）', () => {
    localStorage.setItem(KEY, '{oops')
    mountOnboarding()
    expect(activeRef!.value).toBe('s1')
  })
})
