/**
 * military.test.ts — 训练并行槽位（v0.48）；另含编队特性（v1.23）与派遣远征（v1.27）
 * 基础 1 槽，科技「集群操练 I/II」各 +1，上限 3；满槽拒绝入队，队列中任务不受影响；旧档超槽任务继续跑完，仅限新入队
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import {
  useMilitaryStore,
  setTrainingSlotProvider,
  setDispatchBestProvider,
  resetDispatchBestProvider,
  BASE_TRAINING_SLOTS,
  MAX_TRAINING_SLOTS,
} from './military'
import { TECHS } from '@/data/tech'
import { UNITS } from '@/data/units'
import { D } from '@/lib/decimal'
import { validateAndRepair } from '@/lib/save/validate'
import { minimalSaveData } from '@/tests/fixtures'

const afford = () => true

describe('military store · 训练并行槽', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    // provider 是模块级状态，每个用例重置为基础槽位
    setTrainingSlotProvider(() => BASE_TRAINING_SLOTS)
  })

  it('默认 1 槽：第二个任务被拒绝且不扣费', () => {
    const m = useMilitaryStore()
    const spend = vi.fn(() => true)
    expect(m.maxTrainingSlots).toBe(1)
    expect(m.startTraining('assault', 1, afford, spend)).toBe(true)
    expect(m.startTraining('assault', 1, afford, spend)).toBe(false)
    expect(spend).toHaveBeenCalledTimes(1)
    expect(m.trainingQueue.length).toBe(1)
  })

  it('科技加成扩容：2 槽可同时排 2 个任务', () => {
    setTrainingSlotProvider(() => 2)
    const m = useMilitaryStore()
    expect(m.maxTrainingSlots).toBe(2)
    expect(m.startTraining('assault', 1, afford, afford)).toBe(true)
    expect(m.startTraining('guard', 1, afford, afford)).toBe(true)
    expect(m.startTraining('assault', 1, afford, afford)).toBe(false)
    expect(m.trainingQueue.length).toBe(2)
  })

  it('槽位封顶 3：provider 超上限仍按 3 计', () => {
    setTrainingSlotProvider(() => 99)
    const m = useMilitaryStore()
    expect(m.maxTrainingSlots).toBe(MAX_TRAINING_SLOTS)
  })

  it('任务完成后槽位释放，可再次入队', () => {
    const m = useMilitaryStore()
    m.startTraining('assault', 1, afford, afford)
    m.applyTick(9999) // 直接跑完
    expect(m.trainingQueue.length).toBe(0)
    expect(m.getOwned('assault')).toBe(1)
    expect(m.startTraining('assault', 1, afford, afford)).toBe(true)
  })

  it('旧档兼容：hydrate 超槽任务继续跑完，仅限制新入队', () => {
    const m = useMilitaryStore()
    m.hydrate({
      owned: { assault: 0, guard: 0, heavy: 0, psionic: 0 },
      training: [
        { id: 't1', unitId: 'assault', count: 1, remaining: 5, totalTime: 5 },
        { id: 't2', unitId: 'guard', count: 2, remaining: 5, totalTime: 5 },
        { id: 't3', unitId: 'heavy', count: 1, remaining: 5, totalTime: 5 },
      ],
      formations: [],
    })
    // 超出当前 1 槽：新任务被拒，但旧任务照常完成
    expect(m.startTraining('assault', 1, afford, afford)).toBe(false)
    const done = m.applyTick(10)
    expect(done).toEqual({ assault: 1, guard: 2, heavy: 1 })
    expect(m.trainingQueue.length).toBe(0)
  })
})

describe('集群操练科技数据契约', () => {
  it('两个科技各 +1 槽，顺序解锁（I → II）', () => {
    const t1 = TECHS.find((t) => t.id === 'parallel_training_1')
    const t2 = TECHS.find((t) => t.id === 'parallel_training_2')
    expect(t1?.effects).toEqual([{ type: 'training_slot', value: 1, label: '训练并行槽 +1' }])
    expect(t2?.effects).toEqual([{ type: 'training_slot', value: 1, label: '训练并行槽 +1' }])
    expect(t1?.requires).toEqual(['military_basic'])
    expect(t2?.requires).toEqual(['parallel_training_1'])
    // 基础 1 + I + II = 上限 3
    expect(BASE_TRAINING_SLOTS + 1 + 1).toBe(MAX_TRAINING_SLOTS)
  })
})

// —— v0.75：hydrate 加固（小数兵力取整 / 编队缺键补零防 NaN）——
describe('military — hydrate 加固（v0.75）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('owned 小数兵力取整（防御直接 hydrate 调用）', () => {
    const m = useMilitaryStore()
    m.hydrate({
      owned: { assault: 3.7, guard: 2 } as never,
      training: [],
      formations: [],
    })
    expect(m.getOwned('assault')).toBe(3)
    expect(m.getOwned('guard')).toBe(2)
  })

  it('v0.81：training.count 小数兜底取整，完成后 owned 保持整数', () => {
    const m = useMilitaryStore()
    m.hydrate({
      owned: {},
      training: [{ id: 't1', unitId: 'assault', count: 2.7, remaining: 0.5, totalTime: 5 }],
      formations: [],
    })
    expect(m.trainingQueue[0].count).toBe(2)
    m.applyTick(1) // 完成训练
    expect(m.getOwned('assault')).toBe(2)
    expect(Number.isInteger(m.getOwned('assault'))).toBe(true)
  })

  it('formations 缺键补零：编队操作不再产 NaN', () => {
    const m = useMilitaryStore()
    m.hydrate({
      owned: { assault: 0, guard: 3, heavy: 0, psionic: 0 },
      training: [],
      formations: [{ id: 'f1', name: '编队', units: { assault: 1 } as never }],
    })
    expect(m.formations[0].units.psionic).toBe(0)
    expect(m.assignToFormation('f1', 'guard', 2)).toBe(true)
    expect(m.formations[0].units.guard).toBe(2) // 缺键补零后正常累加，非 NaN
    expect(Number.isNaN(m.formations[0].units.guard)).toBe(false)
  })
})

describe('military store · 全量口径（v0.95）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    setTrainingSlotProvider(() => BASE_TRAINING_SLOTS)
  })

  it('totalOwnedOf 与 totalPower 含已编入编队', () => {
    const m = useMilitaryStore()
    m.owned.assault = 10
    m.formations[0].units.assault = 40
    expect(m.totalOwnedOf('assault')).toBe(50)
    const assault = UNITS.find((u) => u.id === 'assault')!
    const p = m.totalPower(D(1), D(1))
    expect(p.atk).toBe(Math.round(assault.attack * 50))
    expect(p.hp).toBe(assault.hp * 50)
    // 仅库存口径为 10 支，全量口径应显著更大
    expect(p.hp).toBeGreaterThan(assault.hp * 10)
  })
})

// —— v1.23 方案 7：编队特性 ——
describe('military store · 编队特性（v1.23）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('setFormationTrait：切换入库，切回均衡删字段保持旧档同构', () => {
    const m = useMilitaryStore()
    expect(m.setFormationTrait('f1', 'assault_doctrine')).toBe(true)
    expect(m.formations[0].trait).toBe('assault_doctrine')
    expect(m.setFormationTrait('f1', 'balanced')).toBe(true)
    expect(m.formations[0].trait).toBeUndefined()
    // 序列化面：均衡编队不携带 trait 键
    expect(m.serialize().formations[0]).not.toHaveProperty('trait')
  })

  it('setFormationTrait：未知 id 拒绝，编队不存在拒绝', () => {
    const m = useMilitaryStore()
    expect(m.setFormationTrait('f1', 'unknown_trait' as never)).toBe(false)
    expect(m.setFormationTrait('f9', 'assault_doctrine')).toBe(false)
    expect(m.formations[0].trait).toBeUndefined()
  })

  it('三支编队特性互相独立', () => {
    const m = useMilitaryStore()
    m.setFormationTrait('f1', 'assault_doctrine')
    m.setFormationTrait('f2', 'logistics_doctrine')
    expect(m.formations[0].trait).toBe('assault_doctrine')
    expect(m.formations[1].trait).toBe('logistics_doctrine')
    expect(m.formations[2].trait).toBeUndefined()
  })

  it('hydrate：带 trait 旧档往返，未知 id 自愈回落均衡（真缺键载荷）', () => {
    const m = useMilitaryStore()
    m.hydrate({
      owned: {},
      training: [],
      formations: [
        { id: 'f1', name: 'A', trait: 'bastion_doctrine', units: {} },
        { id: 'f2', name: 'B', trait: 'legacy_gone', units: {} },
        { id: 'f3', name: 'C', units: {} },
      ],
    } as never)
    expect(m.formations[0].trait).toBe('bastion_doctrine')
    expect(m.formations[1].trait).toBeUndefined()
    expect(m.formations[2].trait).toBeUndefined()
  })

  it('serialize → hydrate 往返保真', () => {
    const m = useMilitaryStore()
    m.setFormationTrait('f2', 'counter_doctrine')
    const data = m.serialize()
    const m2 = useMilitaryStore()
    m2.hydrate(JSON.parse(JSON.stringify(data)))
    expect(m2.formations[1].trait).toBe('counter_doctrine')
    expect(m2.formations[0].trait).toBeUndefined()
  })
})

describe('military store · 派遣远征（v1.27 方案 6）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetDispatchBestProvider()
    setDispatchBestProvider(() => 10) // 测试锚 best=10
  })

  it('未解锁拒绝派遣；解锁后合法档位接受', () => {
    const m = useMilitaryStore()
    expect(m.startDispatch('f1', 4, 1_000_000)).toBe(false)
    m.setDispatchUnlocked(true)
    expect(m.startDispatch('f1', 4, 1_000_000)).toBe(true)
    expect(m.isDispatched('f1')).toBe(true)
    expect(m.startDispatch('f1', 8, 2_000_000)).toBe(false) // 已在途
  })

  it('非法时长与未知编队拒绝', () => {
    const m = useMilitaryStore()
    m.setDispatchUnlocked(true)
    expect(m.startDispatch('f1', 5, 1_000_000)).toBe(false)
    expect(m.startDispatch('f9', 4, 1_000_000)).toBe(false)
    expect(m.startDispatch('f1', 0, 1_000_000)).toBe(false)
  })

  it('三编队各自独立派遣', () => {
    const m = useMilitaryStore()
    m.setDispatchUnlocked(true)
    expect(m.startDispatch('f1', 4, 1_000_000)).toBe(true)
    expect(m.startDispatch('f2', 24, 1_000_000)).toBe(true)
    expect(m.startDispatch('f3', 12, 1_000_000)).toBe(true)
    expect(Object.keys(m.dispatches).length).toBe(3)
  })

  it('到点结算：未到点不清状态，到点结算并清除（best 锚生效）', () => {
    const m = useMilitaryStore()
    m.setDispatchUnlocked(true)
    const t0 = 1_000_000_000
    m.startDispatch('f1', 4, t0)
    expect(Object.keys(m.collectCompletedDispatches(t0 + 3 * 3_600_000)).length).toBe(0)
    expect(m.isDispatched('f1')).toBe(true)
    const results = m.collectCompletedDispatches(t0 + 4 * 3_600_000)
    expect(Object.keys(results)).toEqual(['f1'])
    expect(results.f1.completed).toBe(true)
    // best=10 锚：energy = round(2e7 × 1.35^9 × 1.0)（1.35 系 dispatch 层缩放，与 endless.REWARD_GROWTH 同源）
    expect(results.f1.reward.energy).toBe(Math.round(20_000_000 * Math.pow(1.35, 9)))
    expect(m.isDispatched('f1')).toBe(false)
  })

  it('提前召回按比例结算，t=0 零奖励（completed=false）', () => {
    const m = useMilitaryStore()
    m.setDispatchUnlocked(true)
    const t0 = 1_000_000_000
    m.startDispatch('f2', 8, t0)
    const zero = m.recallDispatch('f2', t0)
    expect(zero?.completed).toBe(false)
    expect(Object.values(zero!.reward).every((v) => v === 0)).toBe(true)
    // 半程
    m.startDispatch('f2', 8, t0)
    const full = m.recallDispatch('f2', t0 + 8 * 3_600_000)!
    expect(full.completed).toBe(true)
    // 未在途召回返回 null
    expect(m.recallDispatch('f2', t0)).toBeNull()
  })

  it('后勤特性作用派遣结算（×1.2）', () => {
    const m = useMilitaryStore()
    m.setDispatchUnlocked(true)
    m.setFormationTrait('f1', 'logistics_doctrine')
    const t0 = 1_000_000_000
    m.startDispatch('f1', 4, t0)
    const r = m.collectCompletedDispatches(t0 + 4 * 3_600_000).f1!
    const plain = Math.round(20_000_000 * Math.pow(1.35, 9))
    expect(r.reward.energy).toBe(Math.round(plain * 1.2))
  })

  it('serialize：无在途不写 dispatches 键；有在途往返保真', () => {
    const m = useMilitaryStore()
    m.setDispatchUnlocked(true)
    expect(m.serialize()).not.toHaveProperty('dispatches')
    const t0 = 1_000_000_000
    m.startDispatch('f1', 12, t0)
    const data = m.serialize()
    expect(data.dispatches).toBeDefined()
    const m2 = useMilitaryStore()
    m2.hydrate(JSON.parse(JSON.stringify(data)))
    expect(m2.isDispatched('f1')).toBe(true)
    expect(m2.dispatches.f1).toEqual({ formationId: 'f1', hours: 12, startTime: t0 })
  })

  it('hydrate 兜底：未知编队 id / 非法档位 / 非法时间戳条目级剥离不拒档', () => {
    const m = useMilitaryStore()
    m.hydrate({
      owned: {},
      training: [],
      formations: [
        { id: 'f1', name: 'A', units: {} },
        { id: 'f2', name: 'B', units: {} },
      ],
      dispatches: {
        f1: { hours: 8, startTime: 1_000_000_000 },
        fX: { hours: 4, startTime: 1_000_000_000 }, // 未知编队
        f2: { hours: 5, startTime: 1_000_000_000 }, // 非法档位
      } as never,
    } as never)
    expect(m.isDispatched('f1')).toBe(true)
    expect(m.isDispatched('f2')).toBe(false)
  })

  it('hydrate 兜底：非法时间戳条目级剥离（-1 与 NaN 形态）', () => {
    const m = useMilitaryStore()
    m.hydrate({
      owned: {},
      training: [],
      formations: [{ id: 'f1', name: 'A', units: {} }],
      dispatches: {
        f1: { hours: 4, startTime: -1 }, // 负时间戳
      } as never,
    } as never)
    expect(m.isDispatched('f1')).toBe(false)
    const m2 = useMilitaryStore()
    m2.hydrate({
      owned: {},
      training: [],
      formations: [{ id: 'f1', name: 'A', units: {} }],
      dispatches: {
        f1: { hours: 4, startTime: Number.NaN }, // 非有限
      } as never,
    } as never)
    expect(m2.isDispatched('f1')).toBe(false)
  })

  it('reset 清派遣与解锁面（转生随部队/编队一起清）', () => {
    const m = useMilitaryStore()
    m.setDispatchUnlocked(true)
    m.startDispatch('f1', 4, 1_000_000)
    m.reset()
    expect(Object.keys(m.dispatches).length).toBe(0)
    expect(m.dispatchUnlocked).toBe(false)
  })

  it('离线补算：离线窗口内到点全额结算并清除，未到点保留', () => {
    const m = useMilitaryStore()
    m.setDispatchUnlocked(true)
    const t0 = 1_000_000_000_000 // ms
    m.startDispatch('f1', 4, t0) // t0+4h 到点
    m.startDispatch('f2', 24, t0 + 23 * 3_600_000) // 离线窗外
    const done = m.collectOfflineDispatches(t0 + 1_000, t0 + 10 * 3_600_000)
    expect(Object.keys(done)).toEqual(['f1'])
    expect(done.f1.hours).toBe(4)
    expect(done.f1.reward.energy).toBe(Math.round(20_000_000 * Math.pow(1.35, 9)))
    expect(m.isDispatched('f1')).toBe(false)
    expect(m.isDispatched('f2')).toBe(true)
  })

  it('validateAndRepair：未知编队派遣条目剥离后过校验（不拒档）', () => {
    const data = minimalSaveData({
      military: {
        owned: {},
        training: [],
        formations: [
          { id: 'f1', name: 'A', units: {} },
          { id: 'f2', name: 'B', units: {} },
        ],
        dispatches: { f1: { hours: 4, startTime: 1 }, fX: { hours: 4, startTime: 1 } },
      } as never,
    })
    expect(validateAndRepair(data)).toBe(true)
    expect(Object.keys((data.military as { dispatches: object }).dispatches)).toEqual(['f1'])
  })

  it('validateAndRepair：派遣字段结构非法整档拒绝', () => {
    const bad = (dispatches: unknown) =>
      minimalSaveData({
        military: {
          owned: {},
          training: [],
          formations: [{ id: 'f1', name: 'A', units: {} }],
          dispatches,
        } as never,
      })
    expect(validateAndRepair(bad('garbage'))).toBe(false)
    expect(validateAndRepair(bad({ f1: { hours: 0, startTime: 1 } }))).toBe(false)
    expect(validateAndRepair(bad({ f1: { hours: 4, startTime: -1 } }))).toBe(false)
    expect(validateAndRepair(bad({ f1: { hours: 4 } }))).toBe(false)
  })
})
