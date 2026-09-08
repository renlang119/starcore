/**
 * research.test.ts — 科技 store 测试
 * 覆盖：complete / available 前置判定 / unlockedSet 派生 / allEffects /
 * getMult 连乘聚合 / getValue 累加 / cost_mult /
 * reset / serialize-hydrate / 数值规范守恒断言（docs/游戏数值设定规范.md §四）
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useResearchStore } from './research'
import { TECHS, TECH_BRANCHES, getTech, techAvailable } from '@/data/tech'
import { BUILDINGS } from '@/data/buildings'
import { UNITS } from '@/data/units'

let store: ReturnType<typeof useResearchStore>
beforeEach(() => {
  setActivePinia(createPinia())
  store = useResearchStore()
})

/** 完成科技（绕过 available 校验，直接走 complete） */
function complete(id: string) {
  expect(store.complete(id)).toBe(true)
}

describe('research — complete / isCompleted / count', () => {
  it('初始空集', () => {
    expect(store.count).toBe(0)
    expect(store.isCompleted('fusion_tech')).toBe(false)
  })

  it('complete 成功后不可重复完成', () => {
    complete('fusion_tech')
    expect(store.isCompleted('fusion_tech')).toBe(true)
    expect(store.count).toBe(1)
    expect(store.complete('fusion_tech')).toBe(false)
    expect(store.count).toBe(1)
  })

  it('complete 未知 id 拒绝', () => {
    expect(store.complete('tech_ghost')).toBe(false)
  })
})

describe('research — available 前置判定', () => {
  it('无前置科技恒可研究', () => {
    const def = getTech('fusion_tech')!
    expect(store.available(def)).toBe(true)
  })

  it('前置未满足不可研究；满足后可研究', () => {
    const def = getTech('energy_eff_1')! // requires fusion_tech
    expect(store.available(def)).toBe(false)
    complete('fusion_tech')
    expect(store.available(def)).toBe(true)
  })

  it('多前置须全部完成', () => {
    const def = getTech('ion_casting')! // requires nano_forge_tech + alloy_eff_1
    expect(store.available(def)).toBe(false)
    complete('nano_forge_tech')
    expect(store.available(def)).toBe(false)
    complete('alloy_eff_1')
    expect(store.available(def)).toBe(true)
  })

  it('已完成的科技不再可研究', () => {
    complete('fusion_tech')
    expect(store.available(getTech('fusion_tech')!)).toBe(false)
  })

  it('techAvailable 纯函数口径与 store 一致', () => {
    const def = getTech('energy_eff_1')!
    expect(techAvailable(def, new Set())).toBe(false)
    expect(techAvailable(def, new Set(['fusion_tech']))).toBe(true)
    expect(techAvailable(def, new Set(['fusion_tech', 'energy_eff_1']))).toBe(false)
  })

  it('深链前置：singularity_theory 需 dyson_theory + dark_matter_theory（跨分支）', () => {
    const def = getTech('singularity_theory')!
    expect(store.available(def)).toBe(false)
    complete('dyson_theory')
    expect(store.available(def)).toBe(false)
    complete('dark_matter_theory')
    expect(store.available(def)).toBe(true)
  })
})

describe('research — unlockedSet 派生', () => {
  it('初始空集', () => {
    expect(store.unlockedSet.size).toBe(0)
  })

  it('unlock 效果的目标进入 unlockedSet，数值效果不进入', () => {
    complete('fusion_tech') // unlock fusion_reactor
    expect(store.unlockedSet.has('fusion_reactor')).toBe(true)
    complete('energy_eff_1') // production_mult，无 unlock
    expect(store.unlockedSet.has('energy')).toBe(false)
    expect(store.unlockedSet.size).toBe(1)
  })
})

describe('research — 效果聚合', () => {
  it('allEffects 过滤 unlock，仅含数值效果', () => {
    complete('fusion_tech') // 仅 unlock
    expect(store.allEffects).toHaveLength(0)
    complete('energy_eff_1') // production_mult ×1.2
    expect(store.allEffects).toHaveLength(1)
    expect(store.allEffects[0].type).toBe('production_mult')
  })

  it('getMult 同源连乘：能量两级科技 ×1.2×1.3 = ×1.56', () => {
    complete('energy_eff_1')
    complete('energy_eff_2')
    expect(store.getMult('production_mult', 'energy').toNumber()).toBeCloseTo(1.56, 10)
  })

  it('getMult 跨目标隔离：能量乘数不影响晶体', () => {
    complete('energy_eff_1')
    expect(store.getMult('production_mult', 'crystal').toNumber()).toBe(1)
  })

  it('getMult 连乘聚合：多源效果逐条相乘', () => {
    complete('energy_eff_1')
    complete('research_speed') // 另一类型，不应串扰
    expect(store.getMult('production_mult', 'energy').toNumber()).toBeCloseTo(1.2, 10)
  })

  it('getMult 未研究恒为 1', () => {
    expect(store.getMult('combat_mult', 'attack').toNumber()).toBe(1)
  })

  it('getValue 累加：训练槽 2 科技各 +1 合计 2', () => {
    complete('parallel_training_1')
    complete('parallel_training_2')
    expect(store.getValue('training_slot')).toBe(2)
  })

  it('getValue 未研究为 0；非累加型效果不计入', () => {
    expect(store.getValue('training_slot')).toBe(0)
    complete('energy_eff_1') // 乘数型
    expect(store.getValue('training_slot')).toBe(0)
  })

  it('getMult cost_mult/tech：研究加速 ×0.85（techCostMult 已收敛至 game 聚合）', () => {
    expect(store.getMult('cost_mult', 'tech').toNumber()).toBe(1)
    complete('research_speed')
    expect(store.getMult('cost_mult', 'tech').toNumber()).toBeCloseTo(0.85, 10)
  })

  it('双效果科技逐条生效：fleet_logistics 攻防各 ×1.3', () => {
    complete('fleet_logistics')
    expect(store.getMult('combat_mult', 'attack').toNumber()).toBeCloseTo(1.3, 10)
    expect(store.getMult('combat_mult', 'defense').toNumber()).toBeCloseTo(1.3, 10)
  })
})

describe('research — reset / serialize / hydrate', () => {
  it('reset 清空完成集', () => {
    complete('fusion_tech')
    store.reset()
    expect(store.count).toBe(0)
    expect(store.unlockedSet.size).toBe(0)
  })

  it('serialize/hydrate 往返一致', () => {
    complete('fusion_tech')
    complete('energy_eff_1')
    const data = store.serialize()

    setActivePinia(createPinia())
    const s2 = useResearchStore()
    s2.hydrate(data)
    expect(s2.count).toBe(2)
    expect(s2.isCompleted('fusion_tech')).toBe(true)
    expect(s2.isCompleted('energy_eff_1')).toBe(true)
  })

  it('hydrate(undefined) 不改变现状', () => {
    complete('fusion_tech')
    store.hydrate(undefined)
    expect(store.count).toBe(1)
  })
})

describe('research — 数值规范守恒（docs/游戏数值设定规范.md §四）', () => {
  it('总量守恒：47 科技、8 分支', () => {
    expect(TECHS).toHaveLength(47)
    expect(Object.keys(TECH_BRANCHES)).toHaveLength(8)
  })

  it('无前置根科技 = 5（各主线入口）', () => {
    const roots = TECHS.filter((t) => !t.requires)
    expect(roots.map((t) => t.id).sort()).toEqual(
      ['explore_basic', 'fusion_tech', 'military_basic', 'quantum_tech', 'refine_tech'].sort()
    )
  })

  it('引用完整性：requires 全部指向存在的科技', () => {
    const ids = new Set(TECHS.map((t) => t.id))
    for (const t of TECHS) {
      for (const r of t.requires ?? []) {
        expect(ids.has(r), `${t.id} requires ${r}`).toBe(true)
      }
    }
  })

  it('无循环依赖：全部科技可拓扑排序完成', () => {
    const completed = new Set<string>()
    let progress = true
    while (progress && completed.size < TECHS.length) {
      progress = false
      for (const t of TECHS) {
        if (completed.has(t.id)) continue
        if ((t.requires ?? []).every((r) => completed.has(r))) {
          completed.add(t.id)
          progress = true
        }
      }
    }
    expect(completed.size).toBe(TECHS.length)
  })

  it('全研究后各资源科技乘数（规范 §四 口径）', () => {
    for (const t of TECHS) store.complete(t.id)
    expect(store.getMult('production_mult', 'energy').toNumber()).toBeCloseTo(1.56, 10)
    expect(store.getMult('production_mult', 'crystal').toNumber()).toBeCloseTo(1.82, 10)
    expect(store.getMult('production_mult', 'alloy').toNumber()).toBeCloseTo(1.75, 10)
    expect(store.getMult('production_mult', 'data').toNumber()).toBeCloseTo(2.73, 10)
    expect(store.getMult('production_mult', 'dark').toNumber()).toBeCloseTo(2.73, 10)
    expect(store.getMult('combat_mult', 'attack').toNumber()).toBeCloseTo(1.95, 10)
    expect(store.getMult('combat_mult', 'defense').toNumber()).toBeCloseTo(1.95, 10)
    expect(store.getMult('explore_mult').toNumber()).toBeCloseTo(5.3235, 10)
    expect(store.getMult('prestige_mult').toNumber()).toBeCloseTo(1.5, 10)
    expect(store.getMult('offline_bonus').toNumber()).toBeCloseTo(1.2, 10)
    expect(store.getMult('cost_mult', 'tech').toNumber()).toBeCloseTo(0.85, 10)
    expect(store.getValue('training_slot')).toBe(2)
  })

  it('能量科技乘数为五资源最低（有意口径，规范 §四）', () => {
    for (const t of TECHS) store.complete(t.id)
    const mults = ['energy', 'crystal', 'alloy', 'data', 'dark'].map((res) =>
      store.getMult('production_mult', res).toNumber()
    )
    expect(mults[0]).toBe(Math.min(...mults))
  })

  it('unlock 目标全部指向存在的建筑/兵种/系统标记（零悬空）', () => {
    const SYSTEM_TARGETS = new Set(['barracks', 'advanced_units', 'starmap', 'prestige'])
    const valid = new Set([...BUILDINGS.map((b) => b.id), ...UNITS.map((u) => u.id)])
    for (const t of TECHS) {
      for (const e of t.effects) {
        if (e.type !== 'unlock' || !e.target) continue
        expect(
          valid.has(e.target) || SYSTEM_TARGETS.has(e.target),
          `${t.id} unlock ${e.target}`
        ).toBe(true)
      }
    }
  })

  it('每项科技都有 icon（i- 前缀）与非空 name/desc', () => {
    for (const t of TECHS) {
      expect(t.icon.startsWith('i-'), t.id).toBe(true)
      expect(t.name.length, t.id).toBeGreaterThan(0)
      expect(t.desc.length, t.id).toBeGreaterThan(0)
    }
  })
})
