/**
 * content.test.ts — 内容层语言包结构守护（v1.14）
 *
 * 每个数据条目的文案键必须在内容语言包中可解析（不得回落键名且含中文）；
 * 参数化键（endless 命名 / 成就助手模板）插值正确。
 */
import { describe, it, expect } from 'vitest'
import { t } from '@/i18n'
import { BUILDINGS, SECTORS } from '@/data/buildings'
import { TECHS, TECH_BRANCHES } from '@/data/tech'
import { UNITS } from '@/data/units'
import { STRONGHOLDS, STRONGHOLD_TYPES } from '@/data/pve'
import { EXPLORE_NODES, LAYER_INFO } from '@/data/explore'
import { RELIC_POOL, RARITY_INFO, RELIC_SETS } from '@/data/relics'
import { ACHIEVEMENTS, ACHIEVEMENT_CATEGORIES } from '@/data/achievements'
import { NODE_STORIES } from '@/data/story'
import { DEFAULT_NODES } from '@/stores/transcend'

const CJK = /[一-鿿]/

function assertKey(key: string) {
  const v = t(key)
  expect(v).not.toBe(key)
  expect(v).toMatch(CJK)
}

describe('内容层键闭合（数据条目 → 语言包键）', () => {
  it('建筑与扇区', () => {
    for (const s of Object.values(SECTORS)) {
      assertKey(`content.buildings.sector.${s.id}.name`)
      assertKey(`content.buildings.sector.${s.id}.desc`)
    }
    for (const b of BUILDINGS) {
      assertKey(`content.buildings.${b.id}.name`)
      assertKey(`content.buildings.${b.id}.desc`)
    }
  })

  it('科技树与分支', () => {
    for (const br of Object.values(TECH_BRANCHES)) assertKey(`content.tech.branch.${br.id}.name`)
    for (const tech of TECHS) {
      assertKey(`content.tech.${tech.id}.name`)
      assertKey(`content.tech.${tech.id}.desc`)
      // 效果标签：数据内字面量走 content.* 键，combatPair 助手生成走 effects.* 键
      for (const e of tech.effects) {
        expect(e.label).toBeTruthy()
        expect(e.label).toMatch(CJK)
      }
    }
    // 字面量效果键抽查（首条字面量效果）
    assertKey('content.tech.energy_eff_1.effect.0.label')
  })

  it('兵种与编队', () => {
    for (const u of UNITS) {
      assertKey(`content.units.${u.id}.name`)
      assertKey(`content.units.${u.id}.desc`)
    }
    assertKey('content.units.formation.f1.name')
    assertKey('content.units.formation.f2.name')
    assertKey('content.units.formation.f3.name')
  })

  it('据点与敌方编成', () => {
    for (const tp of Object.values(STRONGHOLD_TYPES)) assertKey(`content.pve.type.${tp.id}.name`)
    for (const s of STRONGHOLDS) {
      assertKey(`content.pve.${s.id}.name`)
      assertKey(`content.pve.${s.id}.desc`)
      s.enemies.forEach((_, i) => assertKey(`content.pve.${s.id}.enemy.${i}.name`))
    }
  })

  it('探索节点与层级', () => {
    for (const layer of Object.values(LAYER_INFO))
      assertKey(`content.explore.layer.${layer.id}.name`)
    for (const n of EXPLORE_NODES) {
      assertKey(`content.explore.${n.id}.name`)
      assertKey(`content.explore.${n.id}.desc`)
    }
  })

  it('遗物、稀有度与套装', () => {
    for (const r of Object.values(RARITY_INFO)) assertKey(`content.relics.rarity.${r.id}.name`)
    for (const rl of RELIC_POOL) {
      assertKey(`content.relics.${rl.id}.name`)
      assertKey(`content.relics.${rl.id}.desc`)
      rl.effects.forEach((_, i) => assertKey(`content.relics.${rl.id}.effect.${i}.label`))
    }
    for (const s of RELIC_SETS) {
      assertKey(`content.relics.set.${s.id}.name`)
      assertKey(`content.relics.set.${s.id}.partial.label`)
      assertKey(`content.relics.set.${s.id}.full.label`)
    }
  })

  it('成就与类别', () => {
    for (const [catId] of Object.entries(ACHIEVEMENT_CATEGORIES))
      assertKey(`content.achievements.cat.${catId}.label`)
    for (const a of ACHIEVEMENTS) {
      assertKey(`content.achievements.${a.id}.name`)
      assertKey(`content.achievements.${a.id}.desc`)
    }
  })

  it('转生节点', () => {
    for (const n of DEFAULT_NODES) {
      assertKey(`content.transcend.${n.id}.name`)
      assertKey(`content.transcend.${n.id}.desc`)
      n.effects.forEach((_, i) => assertKey(`content.transcend.${n.id}.effect.${i}.label`))
    }
  })

  it('剧情文本', () => {
    for (const nodeId of Object.keys(NODE_STORIES)) assertKey(`content.story.${nodeId}`)
  })
})

describe('参数化内容键插值', () => {
  it('endless 命名与据点描述', () => {
    expect(t('content.endless.name', { d: 3 })).toBe('无尽深渊·第3层')
    expect(t('content.endless.prefix', { d: 12 })).toBe('深渊·第12层')
    expect(t('content.endless.desc')).toContain('未知威胁')
  })

  it('成就助手模板', () => {
    expect(t('content.achievements.prodLabel', { pct: 10 })).toBe('全产出 +10%')
    expect(t('content.achievements.combatAttackLabel', { pct: 5 })).toBe('攻击 +5%')
    expect(t('content.achievements.combatDefenseLabel', { pct: 5 })).toBe('防御 +5%')
  })
})
