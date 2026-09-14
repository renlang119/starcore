/**
 * combat.test.ts — combat.ts 战斗结算基础测试
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useCombatStore, setGarrisonGuard } from './combat'
import { D } from '@/lib/decimal'
import { STRONGHOLDS } from '@/data/pve'
import type { StrongholdDef } from '@/data/pve'
import type { Formation } from './military'

function makeFormation(id: string, units: Record<string, number>): Formation {
  return { id, name: `编队-${id}`, units: units as any }
}

describe('combat store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    // 守卫是模块级单例（isolate:false 下跨文件共享）：全量跑时 game.test 可能已注入
    // 持有其 pinia 实例的守卫，会拒绝本文件新实例的驻扎 → 每用例重置为全放行，
    // 本体门槛（已攻克）不受影响；守卫行为由注入测试与 Playwright 端到端覆盖
    setGarrisonGuard(() => true)
  })

  it('empty formation → defeat', () => {
    const combat = useCombatStore()
    const formation = makeFormation('f1', {})
    const result = combat.resolveBattle(formation, STRONGHOLDS[0], D(1), D(1))
    expect(result.victory).toBe(false)
    expect(result.rounds).toBe(0)
  })

  it('winning battle — large army vs tier-1 stronghold', () => {
    const combat = useCombatStore()
    // 100 assault units should easily beat raider_1 (5 grunts, 40hp each)
    const formation = makeFormation('f1', { assault: 100 })
    const stronghold = STRONGHOLDS.find((s) => s.id === 'raider_1')!
    const result = combat.resolveBattle(formation, stronghold, D(1), D(1))
    expect(result.victory).toBe(true)
    expect(result.rounds).toBeGreaterThan(0)
    expect(result.rewards.energy).toBe(stronghold.rewards.energy)
  })

  it('losing battle — tiny army vs tier-4 stronghold', () => {
    const combat = useCombatStore()
    // 1 assault vs silencer_1 (5 scouts 1500hp + 2 elites 4000hp)
    const formation = makeFormation('f1', { assault: 1 })
    const stronghold = STRONGHOLDS.find((s) => s.id === 'silencer_1')!
    const result = combat.resolveBattle(formation, stronghold, D(1), D(1))
    expect(result.victory).toBe(false)
  })

  // —— v0.93：战斗 HP 记账修复回归 ——

  /** 构造只有单一敌方单位的据点（直改编成，绕开数据表） */
  function makeDummyStronghold(hp: number, count: number): StrongholdDef {
    return {
      id: 'dummy_battle_regression',
      name: '测试据点',
      type: 'raider',
      tier: 1,
      desc: '',
      icon: 'i-stronghold-raider',
      enemies: [{ unitId: 'dummy', name: '测试单位', attack: 0, defense: 0, hp, count }],
      rewards: {},
      idle: {},
    }
  }

  it('低攻打高血堆叠应超时判负：血池不变量修复回', () => {
    const combat = useCombatStore()
    // 敌 10 单位×100HP（真值 1000）；玩家 1 突击兵裸乘数，每回合保底 1 点伤害。
    // 修复前血池逐轮坍缩，16 回合即清空；修复后血池守恒，50 回合超时判负
    const formation = makeFormation('f1', { assault: 1 })
    const result = combat.resolveBattle(formation, makeDummyStronghold(100, 10), D(1), D(1))
    // 全额血池 1000，每回合最多磨掉 1 点（攻击 12 − 敌防 0×0.4 → 保底 1 取全额伤害 12？
    // 敌防为 0 时无保底参与：dmg=12 − 0 = 12/回合 → 1000/12 = 84 回合 > 50 上限
    expect(result.victory).toBe(false)
    expect(result.rounds).toBe(50)
    expect(result.log.some((e) => e.msg.includes('战斗超时'))).toBe(true)
  })

  it('血池不变量：受伤后有效血量不被腰斩（真值扣除口径）', () => {
    const combat = useCombatStore()
    // 敌 4 单位×100HP，玩家攻击恰好 300（一次打掉 3 个整单位）：
    // 第二轮再打 300 应恰好清空 → 2 回合胜利。
    // 若回归为 hp×count 口径，第一轮后血池会被错记为 1×100=100，第二轮即「提前」清空。
    // 本用例锚定「整单位扣除后残组血池仍按 (count-1)*maxHp+hp 还原」
    const formation = makeFormation('f1', { assault: 1 })
    const result = combat.resolveBattle(
      formation,
      makeDummyStronghold(100, 4),
      D(25), // 12×25=300
      D(1)
    )
    expect(result.victory).toBe(true)
    expect(result.rounds).toBe(2)
  })

  // —— v0.94：敌方空编成防御 ——

  it('敌方空编成防御判负：不走空数组恒真判胜', () => {
    const combat = useCombatStore()
    const formation = makeFormation('f1', { assault: 10 })
    const empty = { ...makeDummyStronghold(100, 1), enemies: [] }
    const result = combat.resolveBattle(formation, empty, D(1), D(1))
    expect(result.victory).toBe(false)
    expect(result.rounds).toBe(0)
    expect(result.log.some((e) => e.msg.includes('敌方编成缺失'))).toBe(true)
    expect(Object.keys(result.rewards).length).toBe(0)
  })

  it('rewards only on victory', () => {
    const combat = useCombatStore()
    const formation = makeFormation('f1', {})
    const result = combat.resolveBattle(formation, STRONGHOLDS[0], D(1), D(1))
    expect(result.victory).toBe(false)
    expect(Object.keys(result.rewards).length).toBe(0)
  })

  it('atkMult/defMult affect battle outcome', () => {
    const combat = useCombatStore()
    const formation = makeFormation('f1', { assault: 5 })
    const stronghold = STRONGHOLDS.find((s) => s.id === 'raider_1')!
    // With 1x mult, 5 assault might lose or barely win
    const weakResult = combat.resolveBattle(formation, stronghold, D(1), D(1))
    // With 100x mult, 5 assault should dominate
    const strongResult = combat.resolveBattle(formation, stronghold, D(100), D(100))
    expect(strongResult.victory).toBe(true)
    // Strong result should take fewer rounds than weak result (if weak wins at all)
    if (weakResult.victory) {
      expect(strongResult.rounds).toBeLessThanOrEqual(weakResult.rounds)
    }
  })

  it('serialize / hydrate round-trip', () => {
    const combat = useCombatStore()
    // v0.82 起驻扎须先攻克（completedStrongholds 门槛），测试先补攻克状态
    combat.completedStrongholds.add('raider_1')
    combat.garrison('raider_1', 'f1')
    const data = combat.serialize()
    expect(data.garrisoned['raider_1']).toBeDefined()

    // Reset and hydrate
    combat.reset()
    expect(Object.keys(combat.garrisoned).length).toBe(0)
    combat.hydrate(data)
    expect(combat.garrisoned['raider_1']).toBeDefined()
  })

  // —— 无尽远征（v0.60）——

  it('远征战果：仅攻克当前前沿推进，重打/失败/跳层不推进', () => {
    const combat = useCombatStore()
    expect(combat.expeditionBest).toBe(0)
    // 失败不推进
    expect(combat.recordExpedition(1, false)).toBe(false)
    expect(combat.expeditionBest).toBe(0)
    // 跳层（D3）不推进
    expect(combat.recordExpedition(3, true)).toBe(false)
    // 依次攻克前沿
    expect(combat.recordExpedition(1, true)).toBe(true)
    expect(combat.expeditionBest).toBe(1)
    // 重打已过深度不推进
    expect(combat.recordExpedition(1, true)).toBe(false)
    expect(combat.expeditionBest).toBe(1)
    expect(combat.recordExpedition(2, true)).toBe(true)
    expect(combat.expeditionBest).toBe(2)
    // 小数钳制为整数
    expect(combat.recordExpedition(3.9, true)).toBe(true)
    expect(combat.expeditionBest).toBe(3)
  })

  it('转生 reset() 保留远征深度、清本轮通关；hardReset reset(true) 全清', () => {
    const combat = useCombatStore()
    combat.completedStrongholds.add('raider_1')
    combat.completedStrongholds.add('raider_2')
    combat.garrison('raider_2', 'f1')
    combat.recordExpedition(1, true)
    combat.recordExpedition(2, true)
    expect(combat.expeditionBest).toBe(2)

    // 转生：清驻扎/通关，保留远征深度
    combat.reset()
    expect(combat.completedStrongholds.size).toBe(0)
    expect(Object.keys(combat.garrisoned).length).toBe(0)
    expect(combat.expeditionBest).toBe(2)

    // hardReset：全清
    combat.reset(true)
    expect(combat.expeditionBest).toBe(0)
  })

  it('serialize/hydrate 含 expeditionBest；旧档字段缺失默认 0', () => {
    const combat = useCombatStore()
    combat.recordExpedition(1, true)
    combat.recordExpedition(2, true)
    const data = combat.serialize()
    expect(data.expeditionBest).toBe(2)

    // 新 store hydrate
    const other = useCombatStore()
    other.hydrate(data)
    expect(other.expeditionBest).toBe(2)

    // 旧档无 expeditionBest：保持 0，不抛错（先归零再验 hydrate 容缺）
    const legacy = useCombatStore()
    legacy.$patch({ expeditionBest: 2 })
    legacy.hydrate({ garrisoned: {}, completed: ['raider_1'] })
    expect(legacy.expeditionBest).toBe(2)

    // 防御：负数/NaN/小数钳制
    const weird = useCombatStore()
    weird.hydrate({ garrisoned: {}, completed: [], expeditionBest: -5 })
    expect(weird.expeditionBest).toBe(0)
    weird.hydrate({ garrisoned: {}, completed: [], expeditionBest: 7.9 })
    expect(weird.expeditionBest).toBe(7)
  })

  it('远征解锁链：攻克沉默者旗舰后 isEndlessUnlocked 为真', async () => {
    const combat = useCombatStore()
    expect(combat.isEndlessUnlocked()).toBe(false)
    combat.completedStrongholds.add('silencer_3')
    expect(combat.isEndlessUnlocked()).toBe(true)
    // 合成据点可从 store 取（深度 1）
    const s = combat.getEndlessStronghold(1)
    expect(s.id).toBe('endless')
  })

  // —— v0.75：远征通关集污染修复 ——

  it('远征胜利不写入正式通关集；serialize 白名单过滤兜底', () => {
    const combat = useCombatStore()
    const stronghold = combat.getEndlessStronghold(1)
    const formation = makeFormation('f1', { assault: 100000 })
    const result = combat.resolveBattle(formation, stronghold, D(1), D(1))
    expect(result.victory).toBe(true)
    // 不污染 completed（否则存档校验整档失败）
    expect(combat.completedStrongholds.has('endless')).toBe(false)
    expect(combat.serialize().completed).not.toContain('endless')
    // 双保险：即使非法 id 混入内存集合，serialize 也按白名单过滤
    combat.completedStrongholds.add('endless')
    combat.completedStrongholds.add('raider_1')
    expect(combat.serialize().completed).toEqual(['raider_1'])
  })

  it('hydrate 白名单过滤：completed 含 endless 不载入', () => {
    const combat = useCombatStore()
    combat.hydrate({ garrisoned: {}, completed: ['raider_1', 'endless'] })
    expect(combat.completedStrongholds.has('raider_1')).toBe(true)
    expect(combat.completedStrongholds.has('endless')).toBe(false)
  })

  // —— v0.82：驻扎校验 ——

  it('驻扎门槛：未攻克据点拒绝驻扎（combat 本体校验）', () => {
    const combat = useCombatStore()
    expect(combat.garrison('raider_1', 'f1')).toBe(false)
    combat.completedStrongholds.add('raider_1')
    expect(combat.garrison('raider_1', 'f1')).toBe(true)
  })

  it('驻扎守卫：注入的跨 store 校验（解锁/编队存在/未被占用）生效', () => {
    const combat = useCombatStore()
    // 模拟 game store 注入：编队必须存在（第二参数 fX 存在才放行）
    combat.completedStrongholds.add('raider_1')
    setGarrisonGuard((_sid, fid) => fid !== 'fGhost')
    expect(combat.garrison('raider_1', 'fGhost')).toBe(false)
    expect(combat.garrison('raider_1', 'f1')).toBe(true)
    setGarrisonGuard(() => true) // 还原守卫，防跨文件状态泄漏（isolate:false）
  })
})
