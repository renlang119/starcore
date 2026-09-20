/**
 * units.ts — 兵种定义与三角克制
 * 4 种兵种，形成双三角克制链：
 *   常规三角：突击兵 → 护卫兵 → 重装兵 → 突击兵
 *   灵能独立线：灵能者 vs 重装兵（额外克制）
 */

import { t } from '@/i18n'

export type UnitId = 'assault' | 'guard' | 'heavy' | 'psionic'

export interface UnitDef {
  id: UnitId
  name: string
  desc: string
  icon: string
  /** 基础属性（每个兵的数值） */
  attack: number
  defense: number
  hp: number
  /** 训练成本 {资源: 每兵} */
  cost: Partial<Record<'energy' | 'alloy' | 'data' | 'dark', number>>
  /** 训练时间（秒/兵） */
  trainTime: number
  /** 克制的目标兵种列表（对其造成 1.5x 伤害） */
  counters: UnitId[]
  /** 克制倍率 */
  counterMult: number
  /** 解锁科技 */
  requires: string
  rarity: 'common' | 'rare'
}

export const UNITS: UnitDef[] = [
  {
    id: 'assault',
    name: t('content.units.assault.name'),
    desc: t('content.units.assault.desc'),
    icon: 'i-unit-assault',
    attack: 12,
    defense: 5,
    hp: 60,
    cost: { energy: 50, alloy: 10 },
    trainTime: 5,
    counters: ['guard', 'psionic'],
    counterMult: 1.5,
    requires: 'military_basic',
    rarity: 'common',
  },
  {
    id: 'guard',
    name: t('content.units.guard.name'),
    desc: t('content.units.guard.desc'),
    icon: 'i-unit-guard',
    attack: 8,
    defense: 12,
    hp: 120,
    cost: { energy: 40, alloy: 20 },
    trainTime: 8,
    counters: ['heavy'],
    counterMult: 1.5,
    requires: 'military_basic',
    rarity: 'common',
  },
  {
    id: 'heavy',
    name: t('content.units.heavy.name'),
    desc: t('content.units.heavy.desc'),
    icon: 'i-unit-heavy',
    attack: 20,
    defense: 12,
    hp: 200,
    cost: { energy: 120, alloy: 60, data: 10 },
    trainTime: 15,
    counters: ['assault'],
    counterMult: 1.5,
    requires: 'military_basic',
    rarity: 'common',
  },
  {
    id: 'psionic',
    name: t('content.units.psionic.name'),
    desc: t('content.units.psionic.desc'),
    icon: 'i-unit-psionic',
    attack: 35,
    defense: 8,
    hp: 150,
    cost: { energy: 300, alloy: 30, dark: 1 },
    trainTime: 30,
    counters: ['heavy'],
    counterMult: 2.0,
    requires: 'adv_units',
    rarity: 'rare',
  },
]

/** 默认编队骨架工厂：初始/重置/存档自愈三处共用（每次返回新副本，v1.03 收敛） */
export function defaultFormations(): { id: string; name: string; units: Record<UnitId, number> }[] {
  return [
    {
      id: 'f1',
      name: t('content.units.formation.f1.name'),
      units: { assault: 0, guard: 0, heavy: 0, psionic: 0 },
    },
    {
      id: 'f2',
      name: t('content.units.formation.f2.name'),
      units: { assault: 0, guard: 0, heavy: 0, psionic: 0 },
    },
    {
      id: 'f3',
      name: t('content.units.formation.f3.name'),
      units: { assault: 0, guard: 0, heavy: 0, psionic: 0 },
    },
  ]
}

/** 兵种查找 Map（O(1) 查找） */
const UNIT_MAP = new Map(UNITS.map((u) => [u.id, u]))

export const getUnit = (id: UnitId): UnitDef | undefined => UNIT_MAP.get(id)
