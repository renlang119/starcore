/**
 * effect-system.ts — 统一效果聚合系统
 *
 * 解决 research / relics / transcend 三个 store 各自实现 getMult 的重复问题。
 * 各 store 只需实现 EffectSource 接口，EffectSystem 负责聚合所有来源的乘数。
 */
import { D, type Decimal } from './decimal'

export interface EffectSource {
  /** 返回指定类型+目标的乘数（Decimal 或 number） */
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
export class EffectSystem {
  private sources: EffectSource[] = []

  register(source: EffectSource): void {
    this.sources.push(source)
  }

  /** 获取合并后的乘数 */
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
