/**
 * effect-system.ts — 统一效果聚合系统
 *
 * 解决 research / relics / transcend 三个 store 各自实现 getMult 的重复问题。
 * 各 store 只需实现 EffectSource 接口，EffectSystem 负责聚合所有来源的乘数。
 *
 * 契约（v0.78 固化，用例见 effect-system.test.ts）：
 * - 带 target 语义的类型：production_mult（资源 id）、combat_mult（attack/defense）、
 *   cost_mult（tech 等），调用方必须传具体 target；
 * - 不带 target 语义的类型：explore_mult / prestige_mult / offline_bonus 及所有
 *   getValue 型（training_slot / relic_slot / starting_energy / auto_*），
 *   调用方不得传 target；
 * - 效果条目的 target 字段：缺省或 'all' 表示对任意 target 生效，具体值仅对匹配
 *   的 target 生效；
 * - 误给无 target 类型传 target 当前不改变结果，但属契约违规：一旦该类型的数据
 *   引入 target 字段，行为会静默漂移。
 */
import { D, type Decimal } from './decimal'

export interface EffectSource {
  /** 返回指定类型+目标的乘数（Decimal 或 number）；无 target 语义的类型不得接收 target */
  getMult(type: string, target?: string): Decimal | number
  /** 返回指定类型的累加值（非乘数型效果，如 relic_slot） */
  getValue?(type: string): number
}

/**
 * 聚合多个效果来源，返回合并后的乘数。
 *
 * 各来源返回的乘数会相乘：
 *   final = source1.mult × source2.mult × source3.mult
 *
 * 用法：
 *   const system = new EffectSystem()
 *   system.register(research)
 *   system.register(relics)
 *   system.register(transcend)
 *   system.getMult('production_mult', 'energy')  // → Decimal
 */
/** 可聚合效果条目的最小形状（repeat 缺省按 1 计，对应 transcend 的幂聚合口径） */
export interface EffectEntry {
  type: string
  target?: string
  value: number
  repeat?: number
}

/**
 * 聚合乘数：type 过滤 + target 过滤（缺省或 'all' 对任意 target 生效）+
 * repeat 次幂。四个 EffectSource store 的 getMult 统一委托于此（v1.03）。
 */
export function aggregateMult(effects: EffectEntry[], type: string, target?: string): Decimal {
  let m = D(1)
  for (const eff of effects) {
    if (eff.type !== type) continue
    if (target && eff.target && eff.target !== target && eff.target !== 'all') continue
    m = m.times(D(eff.value).pow(eff.repeat ?? 1))
  }
  return m
}

/** 聚合累加值：type 过滤 + repeat 次累乘（getValue 型效果，如 training_slot） */
export function aggregateValue(effects: EffectEntry[], type: string): number {
  let total = 0
  for (const eff of effects) {
    if (eff.type === type) total += eff.value * (eff.repeat ?? 1)
  }
  return total
}

export class EffectSystem {
  private sources: EffectSource[] = []

  register(source: EffectSource): void {
    this.sources.push(source)
  }

  /** 获取合并后的乘数；带 target 语义的类型必须传 target（见文件头契约） */
  getMult(type: string, target?: string): Decimal {
    let result = D(1)
    for (const src of this.sources) {
      const m = src.getMult(type, target)
      result = result.times(m)
    }
    return result
  }

  /** 获取累加值（非乘数型效果） */
  getValue(type: string): number {
    let total = 0
    for (const src of this.sources) {
      if (src.getValue) total += src.getValue(type)
    }
    return total
  }
}
