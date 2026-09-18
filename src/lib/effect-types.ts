/**
 * effect-types.ts — 效果类型基线与构造 helper（v1.08）
 *
 * 四域效果定义同源：tech / relic / transcend / achievement 的 type 联合
 * 共享五型基线（EffectTypeBase，乘数族），各域在自身数据文件以
 * 「基线 | 增量」扩展（如 tech 另加 cost_mult / unlock / training_slot）。
 * 构造 helper 供数据表消除逐字重复的 effects 块（EffectSystem 零改动）。
 */

/** 四域共用的效果类型基线（乘数族） */
export type EffectTypeBase =
  'production_mult' | 'combat_mult' | 'explore_mult' | 'prestige_mult' | 'offline_bonus'

/** 部队攻防成对效果（攻击 / 防御 ×mult 各一条；配套科技同构块） */
export function combatPair(mult: number) {
  return [
    {
      type: 'combat_mult' as const,
      target: 'attack' as const,
      value: mult,
      label: `部队攻击 ×${mult}`,
    },
    {
      type: 'combat_mult' as const,
      target: 'defense' as const,
      value: mult,
      label: `部队防御 ×${mult}`,
    },
  ]
}
