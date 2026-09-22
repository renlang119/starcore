/**
 * ArchiveView.test.ts — 档案馆视图组件测试（v1.18）
 *
 * 重点测试：
 * 1. 页面渲染（标题 + 星图档案/敌方档案两区块与计数）
 * 2. 星图档案：已完成节点显示剧情文案，未完成显示锁定占位不剧透
 * 3. 敌方档案：未遭遇显示未知敌影；交战收录后显示名称与属性；
 *    同名聚合口径
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { vueRouterMock, focusTrapMock, mountView, useViewTestHooks } from '@/tests/view-mount'
import ArchiveView from './ArchiveView.vue'
import { exploredNodes } from '@/tests/fixtures'
import { STRONGHOLDS } from '@/data/pve'
import { useArchiveStore } from '@/stores/archive'
import { useGameStore } from '@/stores/game'

vi.mock('vue-router', () => vueRouterMock({ push: () => vi.fn() }))
vi.mock('@/composables/useFocusTrap', () => focusTrapMock())

describe('ArchiveView — 渲染', () => {
  useViewTestHooks()

  it('渲染标题与两区块及计数', () => {
    const wrapper = mountView(ArchiveView)

    expect(wrapper.find('.archive-view').exists()).toBe(true)
    expect(wrapper.text()).toContain('星图档案馆')
    expect(wrapper.find('[data-testid="archive-story-group"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('已留档 0 / 34')
    // 56 种聚合名 + 0 已收录
    expect(wrapper.text()).toContain('已收录 0 / 56')
    expect(wrapper.findAll('[data-testid="archive-story-card"]').length).toBe(34)
    expect(wrapper.findAll('[data-testid="archive-enemy-card"]').length).toBe(56)
  })

  it('未完成节点显示锁定占位，不剧透剧情', () => {
    const wrapper = mountView(ArchiveView)
    const cards = wrapper.findAll('[data-testid="archive-story-card"]')

    // 全新档：全部锁定态（名称 ???，无剧情文本）
    for (const c of cards) {
      expect(c.text()).not.toContain('扫描器')
    }
    expect(wrapper.text()).toContain('尚未踏足这片空域')
  })

  it('已完成节点显示名称与剧情文案', async () => {
    exploredNodes('node_orbit')
    const wrapper = mountView(ArchiveView)
    await wrapper.vm.$nextTick()

    const cards = wrapper.findAll('[data-testid="archive-story-card"]')
    const unlocked = cards.find((c) => c.text().includes('轨道残骸带'))
    expect(unlocked).toBeTruthy()
    expect(unlocked!.text()).toContain('扫描器在轨道残骸带中发现了掠夺者的踪迹')
    expect(wrapper.text()).toContain('已留档 1 / 34')
  })
})

describe('ArchiveView — 敌方档案', () => {
  useViewTestHooks()

  it('未遭遇显示未知敌影占位', () => {
    const wrapper = mountView(ArchiveView)
    const cards = wrapper.findAll('[data-testid="archive-enemy-card"]')

    for (const c of cards) {
      expect(c.text()).not.toContain('掠夺者步兵')
    }
    expect(wrapper.text()).toContain('未知敌影')
  })

  it('交战收录后显示名称与属性', async () => {
    const archive = useArchiveStore()
    const s = STRONGHOLDS[0] // raider_1
    archive.recordEncounter(s.id, s.enemies)
    const wrapper = mountView(ArchiveView)
    await wrapper.vm.$nextTick()

    const seenCard = wrapper
      .findAll('[data-testid="archive-enemy-card"]')
      .find((c) => c.text().includes(s.enemies[0].name))
    expect(seenCard).toBeTruthy()
    expect(seenCard!.text()).toContain('攻')
    expect(wrapper.text()).toContain('已收录 1 / 56')
  })

  it('存档注入的遭遇记录渲染已收录态', async () => {
    const archive = useArchiveStore()
    archive.hydrate({ enemies: ['raider_1#0', 'beast_1#0'] })
    const wrapper = mountView(ArchiveView)
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('已收录 2 / 56')
  })
})

describe('ArchiveView — 集成（game store 挂载面）', () => {
  useViewTestHooks()

  it('archive 随 game store 暴露（记录路径可达）', () => {
    setActivePinia(createPinia())
    const game = useGameStore()
    expect(game.archive).toBeDefined()
    expect(typeof game.archive.recordEncounter).toBe('function')
    game.archive.recordEncounter('raider_1', STRONGHOLDS[0].enemies)
    expect(game.archive.seenCount).toBeGreaterThan(0)
  })
})
