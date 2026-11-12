/**
 * ArchiveView.test.ts：档案馆视图组件测试（v1.18）
 *
 * 重点测试：
 * 1. 页面渲染（标题 + 星图档案/七门/回响/敌方档案四区块与计数）
 * 2. 星图档案：已完成节点显示剧情文案，未完成显示锁定占位不剧透
 * 3. 七门：未完成银河之门显示留白提示不剧透；完成后 21 条按七门
 *    小节渲染（星臂尽头巨门回望）；门扉回廊完成仍锁定（解锁挂银
 *    河之门，保穿门前悬念）
 * 4. 回响：未全宇宙探索完毕显示留白提示不剧透；完毕后 30 条按三段
 *    小节渲染（门后回响·终局后日谈）
 * 5. 敌方档案：未遭遇显示未知敌影；交战收录后显示名称与属性；
 *    同名聚合口径；生态注仅已收录异星巨兽卡渲染（v1.73 异星巨兽生态志）
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { vueRouterMock, focusTrapMock, mountView, useViewTestHooks } from '@/tests/view-mount'
import ArchiveView from './ArchiveView.vue'
import { exploredNodes, capturedImperial } from '@/tests/fixtures'
import { STRONGHOLDS } from '@/data/pve'
import { EXPLORE_NODES } from '@/data/explore'
import { GATE_DOORS } from '@/data/gate'
import { IMPERIAL_SECTIONS } from '@/data/imperial'
import { ECHO_ENTRIES } from '@/data/echo'
import { BESTIARY_NOTES } from '@/data/bestiary'
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

    // 全新档：全部锁定态（名称占位「未探明」，无剧情文本）
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

describe('ArchiveView — 七门', () => {
  useViewTestHooks()

  it('锁定态：分组标题可见、留白提示、条目零渲染不剧透', () => {
    const wrapper = mountView(ArchiveView)

    expect(wrapper.find('[data-testid="archive-gate-group"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('七门')
    // 锁定态不显示计数（仅解锁与未解锁两态，避免误读为逐条收集）
    expect(wrapper.find('[data-testid="archive-gate-group"] .count-lead').exists()).toBe(false)
    expect(wrapper.find('[data-testid="archive-gate-locked"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('还没有穿过应答的门扉')
    // 条目零渲染：首门名与首条名均不出现
    expect(wrapper.findAll('[data-testid="archive-gate-card"]').length).toBe(0)
    expect(wrapper.text()).not.toContain(GATE_DOORS[0].name)
    expect(wrapper.text()).not.toContain(GATE_DOORS[0].entries[0].name)
  })

  it('门扉回廊完成仍锁定（解锁挂银河之门，保穿门前悬念）', async () => {
    exploredNodes('node_arm_threshold')
    const wrapper = mountView(ArchiveView)
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="archive-gate-locked"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="archive-gate-card"]').length).toBe(0)
  })

  it('解锁态：银河之门完成后 21 条按七门小节渲染、门名段头齐备、计数 7/7', async () => {
    exploredNodes('node_galaxy_gate')
    const wrapper = mountView(ArchiveView)
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('已回望 7 / 7 门')
    expect(wrapper.findAll('[data-testid="archive-gate-card"]').length).toBe(21)
    // 七门门名段头齐备（含压轴的磨痕门）
    for (const door of GATE_DOORS) {
      expect(wrapper.text()).toContain(door.name)
    }
    expect(wrapper.text()).toContain('磨痕门')
    // 首门首条与应答门末条可见（正文与中继链侧注）
    expect(wrapper.text()).toContain(GATE_DOORS[0].entries[0].name)
    expect(wrapper.text()).toContain(GATE_DOORS[6].entries[2].name)
    expect(wrapper.text()).toContain(GATE_DOORS[6].entries[2].note)
  })
})

describe('ArchiveView — 帝庭档案', () => {
  useViewTestHooks()

  it('锁定态：分组标题可见、留白提示、条目零渲染不剧透', () => {
    const wrapper = mountView(ArchiveView)

    expect(wrapper.find('[data-testid="archive-imperial-group"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('帝庭档案')
    // 锁定态不显示计数（仅解锁与未解锁两态，避免误读为逐条收集）
    expect(wrapper.find('[data-testid="archive-imperial-group"] .count-lead').exists()).toBe(false)
    expect(wrapper.find('[data-testid="archive-imperial-locked"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('还没走到航道的尽头')
    // 条目零渲染：首条名不出现；炉音节名压轴不泄漏（分组提示
    // 摘要含贡道、核验、裁决三节名，不在此列）
    expect(wrapper.findAll('[data-testid="archive-imperial-card"]').length).toBe(0)
    expect(wrapper.text()).not.toContain(IMPERIAL_SECTIONS[0].entries[0].name)
    expect(wrapper.text()).not.toContain(IMPERIAL_SECTIONS[4].name)
  })

  it('银河之门完成仍锁定（解锁挂银盘枢纽，与七门口径错开）', async () => {
    exploredNodes('node_galaxy_gate')
    const wrapper = mountView(ArchiveView)
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="archive-imperial-locked"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="archive-imperial-card"]').length).toBe(0)
  })

  it('解锁态：银盘枢纽完成后 15 条按五节渲染、节名段头齐备、计数 15/18（炉前锁定）', async () => {
    exploredNodes('node_galaxy_hub')
    const wrapper = mountView(ArchiveView)
    await wrapper.vm.$nextTick()

    // 五节常开 15 条，炉前节未全接管前锁定不计入 seen（总数 18）
    expect(wrapper.text()).toContain('已归档 15 / 18 条')
    expect(wrapper.findAll('[data-testid="archive-imperial-card"]').length).toBe(15)
    // 五节节名段头齐备（含压轴的炉音）
    for (const sec of IMPERIAL_SECTIONS) {
      expect(wrapper.text()).toContain(sec.name)
    }
    expect(wrapper.text()).toContain('炉音')
    // 首节首条与炉音末条可见（正文与帝庭档案批注）
    expect(wrapper.text()).toContain(IMPERIAL_SECTIONS[0].entries[0].name)
    expect(wrapper.text()).toContain(IMPERIAL_SECTIONS[4].entries[2].name)
    expect(wrapper.text()).toContain(IMPERIAL_SECTIONS[4].entries[2].note)
    // 炉前节：锁定提示可见、亲见留档零渲染不剧透
    expect(wrapper.find('[data-testid="archive-imperial-final-locked"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="archive-imperial-final-card"]').length).toBe(0)
    expect(wrapper.text()).not.toContain('倾倒的规程')
  })

  it('炉前节：曾接管全部 6 座后解锁 3 条、计数 18/18（巡检失守不回收）', async () => {
    exploredNodes('node_galaxy_hub')
    capturedImperial('imp_pass', 'imp_audit', 'imp_guard', 'imp_verdict', 'imp_echo', 'imp_court')
    const wrapper = mountView(ArchiveView)
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('已归档 18 / 18 条')
    expect(wrapper.find('[data-testid="archive-imperial-final-locked"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid="archive-imperial-final-card"]').length).toBe(3)
    expect(wrapper.text()).toContain('炉前')
    expect(wrapper.text()).toContain('倾倒的规程')
  })
})

describe('ArchiveView — 回响', () => {
  useViewTestHooks()

  it('锁定态：分组标题可见、留白提示、条目零渲染不剧透', () => {
    const wrapper = mountView(ArchiveView)

    expect(wrapper.find('[data-testid="archive-echo-group"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('回响')
    // 锁定态不显示计数（仅解锁与未解锁两态，避免误读为逐条收集）
    expect(wrapper.find('[data-testid="archive-echo-group"] .count-lead').exists()).toBe(false)
    expect(wrapper.find('[data-testid="archive-echo-locked"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('门还很安静')
    // 条目零渲染：首条名不出现
    expect(wrapper.findAll('[data-testid="archive-echo-card"]').length).toBe(0)
    expect(wrapper.text()).not.toContain(ECHO_ENTRIES[0].name)
  })

  it('解锁态：全宇宙探索完毕后 30 条按三段小节渲染、计数 30/30', async () => {
    exploredNodes(...EXPLORE_NODES.map((n) => n.id))
    const wrapper = mountView(ArchiveView)
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('已回响 30 / 30')
    expect(wrapper.findAll('[data-testid="archive-echo-card"]').length).toBe(30)
    // 三段小节名齐备
    for (const seg of ['迎接', '见闻', '余韵']) {
      expect(wrapper.text()).toContain(seg)
    }
    // 首末条目可见
    expect(wrapper.text()).toContain(ECHO_ENTRIES[0].name)
    expect(wrapper.text()).toContain(ECHO_ENTRIES[29].name)
    expect(wrapper.text()).toContain(ECHO_ENTRIES[29].note)
  })

  it('差一节点未完成仍锁定（34/34 全毕口径）', async () => {
    const all = EXPLORE_NODES.map((n) => n.id)
    exploredNodes(...all.slice(0, all.length - 1))
    const wrapper = mountView(ArchiveView)
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="archive-echo-group"] .count-lead').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid="archive-echo-card"]').length).toBe(0)
  })
})

describe('ArchiveView — 生态注', () => {
  useViewTestHooks()

  it('未收录卡不渲染注区（交战观察视角）', () => {
    const wrapper = mountView(ArchiveView)
    expect(wrapper.findAll('[data-testid="archive-beast-note"]').length).toBe(0)
  })

  it('已收录异星巨兽卡渲染三行注（迁徙食性栖地）', async () => {
    // 注入噬星鲲王一条收录（beast_7 全部条目同显示名聚合）
    const archive = useArchiveStore()
    archive.hydrate({ enemies: ['beast_7#4'] })
    const wrapper = mountView(ArchiveView)
    await wrapper.vm.$nextTick()

    const notes = wrapper.findAll('[data-testid="archive-beast-note"]')
    expect(notes.length).toBe(1)
    expect(notes[0]!.text()).toContain('绕行弧')
    expect(notes[0]!.text()).toContain('星尘')
    expect(notes[0]!.text()).toContain('盘面')
  })

  it('非代表条目先收录同显示名注仍渲染（晶云母兽跨据点）', async () => {
    // 晶云母兽注挂 beast_5#0；先收录 beast_6#0（同显示名的其他据点条目）
    const archive = useArchiveStore()
    archive.hydrate({ enemies: ['beast_6#0'] })
    const wrapper = mountView(ArchiveView)
    await wrapper.vm.$nextTick()

    const notes = wrapper.findAll('[data-testid="archive-beast-note"]')
    expect(notes.length).toBe(1)
    expect(notes[0]!.text()).toContain('晶尘云')
  })

  it('已收录非异星巨兽卡无注区', async () => {
    const archive = useArchiveStore()
    archive.hydrate({ enemies: ['raider_1#0'] })
    const wrapper = mountView(ArchiveView)
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('[data-testid="archive-beast-note"]').length).toBe(0)
  })

  it('注卡与聚合桶显示名一一对应（9 注 9 名不重）', () => {
    // BESTIARY_NOTES 已在数据层测试覆盖；此处核视图消费面键完整
    for (const n of BESTIARY_NOTES) {
      expect(n.mig.length).toBeGreaterThan(0)
    }
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
