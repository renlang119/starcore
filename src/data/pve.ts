/**
 * pve.ts — PVE 据点定义
 * 4 类据点：掠夺者营地、异星巨兽、古代遗迹、沉默者前哨
 * 每类有多个难度层级，难度越高奖励越好
 */

import type { UnitId } from './units'

export type StrongholdType = 'raider' | 'beast' | 'ruin' | 'silencer'

export interface EnemyUnit {
  unitId: string // 复用 UnitId 概念，但用自定义 id 表示敌方
  name: string
  attack: number
  defense: number
  hp: number
  count: number
  /** 该敌方单位被哪些玩家兵种克制（命中时触发 attacker.counterMult） */
  counteredBy?: UnitId[]
}

export interface StrongholdDef {
  id: string
  name: string
  type: StrongholdType
  /** 剧情章节标签（探索层级对应的叙事阶段），不代表难度排序；
   *  同 tier 内强度可差一个数量级（如 ruin_3 与 silencer_2 同为 tier 4），
   *  难度梯度以敌方总强度为准，见 endless.ts 的 TEMPLATE_NORMALIZE */
  tier: number
  desc: string
  icon: string
  enemies: EnemyUnit[]
  /** 胜利奖励 */
  rewards: {
    energy?: number
    crystal?: number
    alloy?: number
    data?: number
    dark?: number
    relicChance?: number // 0-1 掉落遗物概率
    relicRarityBias?: number // 偏向稀有度
  }
  /** 驻扎挂机每秒奖励（占领后） */
  idle: {
    energy?: number
    alloy?: number
    data?: number
    dark?: number
  }
  /** 解锁条件：需要完成的探索节点 */
  requires?: string
}

export const STRONGHOLD_TYPES: Record<
  StrongholdType,
  { id: StrongholdType; name: string; color: string; icon: string }
> = {
  raider: { id: 'raider', name: '掠夺者营地', color: '#F43F5E', icon: 'i-stronghold-raider' },
  beast: { id: 'beast', name: '异星巨兽', color: '#FFB627', icon: 'i-stronghold-beast' },
  ruin: { id: 'ruin', name: '古代遗迹', color: '#A78BFA', icon: 'i-stronghold-ruin' },
  silencer: { id: 'silencer', name: '沉默者前哨', color: '#94A3B8', icon: 'i-stronghold-silencer' },
}

export const STRONGHOLDS: StrongholdDef[] = [
  // —— 掠夺者营地 ——
  {
    id: 'raider_1',
    name: '小型掠夺者营地',
    type: 'raider',
    tier: 1,
    desc: '盘踞在轨道残骸带的零散掠夺者，适合新兵练手',
    icon: 'i-stronghold-raider',
    enemies: [
      {
        unitId: 'raider_grunt',
        name: '掠夺者步兵',
        attack: 6,
        defense: 3,
        hp: 40,
        count: 5,
        counteredBy: ['assault'],
      },
    ],
    rewards: { energy: 500, alloy: 50, data: 20, relicChance: 0.1 },
    idle: { energy: 2, alloy: 0.2 },
    requires: 'node_orbit',
  },
  {
    id: 'raider_2',
    name: '掠夺者据点',
    type: 'raider',
    tier: 2,
    desc: '有组织的掠夺者据点，火力较强',
    icon: 'i-stronghold-raider',
    enemies: [
      {
        unitId: 'raider_grunt',
        name: '掠夺者步兵',
        attack: 10,
        defense: 5,
        hp: 60,
        count: 8,
        counteredBy: ['assault'],
      },
      {
        unitId: 'raider_gun',
        name: '掠夺者机枪手',
        attack: 15,
        defense: 4,
        hp: 50,
        count: 4,
        counteredBy: ['guard', 'psionic'],
      },
    ],
    rewards: { energy: 3000, alloy: 200, data: 100, relicChance: 0.15 },
    idle: { energy: 10, alloy: 1, data: 0.5 },
    requires: 'node_inner',
  },
  {
    id: 'raider_3',
    name: '掠夺者要塞',
    type: 'raider',
    tier: 3,
    desc: '掠夺者的大型要塞，重兵把守',
    icon: 'i-stronghold-raider',
    enemies: [
      {
        unitId: 'raider_gun',
        name: '掠夺者机枪手',
        attack: 25,
        defense: 8,
        hp: 100,
        count: 10,
        counteredBy: ['guard', 'psionic'],
      },
      {
        unitId: 'raider_tank',
        name: '掠夺者坦克',
        attack: 40,
        defense: 20,
        hp: 300,
        count: 3,
        counteredBy: ['heavy'],
      },
    ],
    rewards: {
      energy: 20000,
      alloy: 1000,
      data: 500,
      dark: 2,
      relicChance: 0.25,
      relicRarityBias: 0.3,
    },
    idle: { energy: 50, alloy: 5, data: 3 },
    requires: 'node_outer',
  },

  // —— 异星巨兽 ——
  {
    id: 'beast_1',
    name: '晶体蛛群',
    type: 'beast',
    tier: 1,
    desc: '栖息在晶体矿脉中的群体生物，防御较低但数量多',
    icon: 'i-stronghold-beast',
    enemies: [
      {
        unitId: 'crystal_spider',
        name: '晶体蛛',
        attack: 8,
        defense: 2,
        hp: 30,
        count: 12,
        counteredBy: ['assault'],
      },
    ],
    rewards: { crystal: 500, energy: 300, relicChance: 0.12 },
    idle: { energy: 3, alloy: 0.3 },
    requires: 'node_inner',
  },
  {
    id: 'beast_2',
    name: '虚空巨兽',
    type: 'beast',
    tier: 3,
    desc: '游荡于深空的巨型生物，单体极强',
    icon: 'i-stronghold-beast',
    enemies: [
      {
        unitId: 'void_beast',
        name: '虚空巨兽',
        attack: 80,
        defense: 30,
        hp: 5000,
        count: 1,
        counteredBy: ['guard', 'psionic'],
      },
    ],
    rewards: {
      energy: 50000,
      alloy: 2000,
      data: 1000,
      dark: 10,
      relicChance: 0.4,
      relicRarityBias: 0.5,
    },
    idle: { energy: 100, alloy: 10, data: 8, dark: 0.5 },
    requires: 'node_deep',
  },

  // —— 古代遗迹 ——
  {
    id: 'ruin_1',
    name: '先驱者遗迹',
    type: 'ruin',
    tier: 2,
    desc: '先驱文明留下的自动防御设施，内含珍贵数据',
    icon: 'i-stronghold-ruin',
    enemies: [
      {
        unitId: 'ancient_drone',
        name: '古代无人机',
        attack: 18,
        defense: 10,
        hp: 80,
        count: 6,
        counteredBy: ['heavy'],
      },
    ],
    rewards: { data: 500, energy: 2000, alloy: 300, relicChance: 0.3, relicRarityBias: 0.4 },
    idle: { data: 5, energy: 15, alloy: 2 },
    requires: 'node_outer',
  },
  {
    id: 'ruin_2',
    name: '奇点圣殿',
    type: 'ruin',
    tier: 4,
    desc: '传说中储存奇点知识的圣殿，守护者极其强大',
    icon: 'i-stronghold-ruin',
    enemies: [
      {
        unitId: 'temple_guardian',
        name: '圣殿守护者',
        attack: 120,
        defense: 80,
        hp: 8000,
        count: 2,
        counteredBy: ['guard', 'psionic'],
      },
      {
        unitId: 'ancient_drone',
        name: '古代无人机',
        attack: 40,
        defense: 20,
        hp: 200,
        count: 10,
        counteredBy: ['heavy'],
      },
    ],
    rewards: {
      energy: 200000,
      alloy: 5000,
      data: 5000,
      dark: 30,
      relicChance: 0.6,
      relicRarityBias: 0.8,
    },
    idle: { energy: 300, alloy: 30, data: 20, dark: 1 },
    requires: 'node_deep',
  },

  // —— 沉默者前哨 ——
  {
    id: 'silencer_1',
    name: '沉默者前哨站',
    type: 'silencer',
    tier: 4,
    desc: '神秘的沉默者种族建立的前哨，终局挑战',
    icon: 'i-stronghold-silencer',
    enemies: [
      {
        unitId: 'silencer_scout',
        name: '沉默者侦察兵',
        attack: 100,
        defense: 50,
        hp: 1500,
        count: 5,
        counteredBy: ['assault'],
      },
      {
        unitId: 'silencer_elite',
        name: '沉默者精英',
        attack: 200,
        defense: 100,
        hp: 4000,
        count: 2,
        counteredBy: ['heavy'],
      },
    ],
    rewards: {
      energy: 500000,
      alloy: 10000,
      data: 10000,
      dark: 50,
      relicChance: 0.8,
      relicRarityBias: 1.0,
    },
    idle: { energy: 500, alloy: 50, data: 40, dark: 2 },
    requires: 'node_deep',
  },

  // —— 恒星系层据点 ——
  {
    id: 'raider_4',
    name: '掠夺者星际舰队',
    type: 'raider',
    tier: 5,
    desc: '越过虫洞的掠夺者主力舰队，在门户星系劫掠往来的殖民船',
    icon: 'i-stronghold-raider',
    enemies: [
      {
        unitId: 'raider_gun',
        name: '掠夺者机枪手',
        attack: 50,
        defense: 16,
        hp: 200,
        count: 12,
        counteredBy: ['guard', 'psionic'],
      },
      {
        unitId: 'raider_tank',
        name: '掠夺者坦克',
        attack: 80,
        defense: 40,
        hp: 600,
        count: 4,
        counteredBy: ['heavy'],
      },
    ],
    rewards: {
      energy: 2000000,
      alloy: 20000,
      data: 10000,
      dark: 8,
      relicChance: 0.5,
      relicRarityBias: 0.9,
    },
    idle: { energy: 800, alloy: 80, data: 60, dark: 0.8 },
    requires: 'node_stellar_gate',
  },
  {
    id: 'beast_3',
    name: '晶背巨兽群',
    type: 'beast',
    tier: 4,
    desc: '以晶脉为食的巨型生物群落，晶化背甲坚不可摧',
    icon: 'i-stronghold-beast',
    enemies: [
      {
        unitId: 'crystal_back_beast',
        name: '晶背巨兽',
        attack: 40,
        defense: 12,
        hp: 300,
        count: 20,
        counteredBy: ['assault'],
      },
    ],
    rewards: { crystal: 20000, energy: 1000000, relicChance: 0.45 },
    idle: { energy: 600, alloy: 60 },
    requires: 'node_stellar_mine',
  },
  {
    id: 'ruin_3',
    name: '先驱星系档案馆',
    type: 'ruin',
    tier: 4,
    desc: '先驱文明设在年轻星系的资料库，封存着远航年代的星图',
    icon: 'i-stronghold-ruin',
    enemies: [
      {
        unitId: 'ancient_drone',
        name: '古代无人机',
        attack: 36,
        defense: 20,
        hp: 160,
        count: 16,
        counteredBy: ['heavy'],
      },
    ],
    rewards: { data: 150000, energy: 800000, relicChance: 0.5, relicRarityBias: 0.7 },
    idle: { data: 90, energy: 400 },
    requires: 'node_stellar_forge',
  },
  {
    id: 'silencer_2',
    name: '沉默者殖民舰',
    type: 'silencer',
    tier: 4,
    desc: '静静悬浮在死寂星系中的殖民舰队，没有战斗痕迹，也没有生还者',
    icon: 'i-stronghold-silencer',
    enemies: [
      {
        unitId: 'silencer_scout',
        name: '沉默者侦察兵',
        attack: 200,
        defense: 100,
        hp: 3000,
        count: 8,
        counteredBy: ['assault'],
      },
      {
        unitId: 'silencer_elite',
        name: '沉默者精英',
        attack: 400,
        defense: 200,
        hp: 8000,
        count: 3,
        counteredBy: ['heavy'],
      },
    ],
    rewards: {
      energy: 1200000,
      data: 20000,
      dark: 60,
      relicChance: 0.7,
      relicRarityBias: 0.9,
    },
    idle: { energy: 1000, data: 100, dark: 2.5 },
    requires: 'node_stellar_dead',
  },
  {
    id: 'raider_5',
    name: '掠夺者母巢',
    type: 'raider',
    tier: 5,
    desc: '围绕中子星建立的掠夺者母巢，所有星际劫掠舰队的源头',
    icon: 'i-stronghold-raider',
    enemies: [
      {
        unitId: 'raider_grunt',
        name: '掠夺者步兵',
        attack: 60,
        defense: 30,
        hp: 400,
        count: 30,
        counteredBy: ['assault'],
      },
      {
        unitId: 'raider_tank',
        name: '掠夺者坦克',
        attack: 120,
        defense: 60,
        hp: 1000,
        count: 6,
        counteredBy: ['heavy'],
      },
    ],
    rewards: { energy: 5000000, alloy: 50000, dark: 12, relicChance: 0.55 },
    idle: { energy: 2000, alloy: 150, dark: 1.2 },
    requires: 'node_stellar_core',
  },
  {
    id: 'beast_4',
    name: '虚空巨兽母体',
    type: 'beast',
    tier: 5,
    desc: '在中子星引力摇篮中产卵的虚空巨兽母体，幼兽环绕',
    icon: 'i-stronghold-beast',
    enemies: [
      {
        unitId: 'void_matriarch',
        name: '虚空巨兽母体',
        attack: 500,
        defense: 150,
        hp: 20000,
        count: 1,
        counteredBy: ['guard', 'psionic'],
      },
      {
        unitId: 'void_hatchling',
        name: '虚空幼兽',
        attack: 90,
        defense: 30,
        hp: 500,
        count: 12,
        counteredBy: ['assault'],
      },
    ],
    rewards: {
      energy: 3000000,
      crystal: 50000,
      dark: 15,
      relicChance: 0.6,
      relicRarityBias: 1.0,
    },
    idle: { energy: 1500, alloy: 120, dark: 1.5 },
    requires: 'node_stellar_core',
  },
  {
    id: 'ruin_4',
    name: '奇点方舟',
    type: 'ruin',
    tier: 5,
    desc: '先驱文明的最后方舟，载着奇点知识停泊在悬臂边缘',
    icon: 'i-stronghold-ruin',
    enemies: [
      {
        unitId: 'temple_guardian',
        name: '圣殿守护者',
        attack: 300,
        defense: 200,
        hp: 16000,
        count: 4,
        counteredBy: ['guard', 'psionic'],
      },
      {
        unitId: 'ancient_drone',
        name: '古代无人机',
        attack: 80,
        defense: 40,
        hp: 400,
        count: 20,
        counteredBy: ['heavy'],
      },
    ],
    rewards: {
      data: 800000,
      energy: 5000000,
      dark: 25,
      relicChance: 0.75,
      relicRarityBias: 1.0,
    },
    idle: { data: 250, energy: 2000, dark: 2 },
    requires: 'node_stellar_edge',
  },
  {
    id: 'silencer_3',
    name: '沉默者旗舰',
    type: 'silencer',
    tier: 5,
    desc: '沉默者舰队的旗舰残骸，黑匣子里藏着来自星团深处的回应',
    icon: 'i-stronghold-silencer',
    enemies: [
      {
        unitId: 'silencer_flagship',
        name: '沉默者旗舰',
        attack: 1200,
        defense: 400,
        hp: 50000,
        count: 1,
        counteredBy: ['guard', 'psionic'],
      },
      {
        unitId: 'silencer_elite',
        name: '沉默者精英',
        attack: 500,
        defense: 250,
        hp: 10000,
        count: 6,
        counteredBy: ['heavy'],
      },
    ],
    rewards: {
      energy: 20000000,
      crystal: 100000,
      alloy: 100000,
      data: 100000,
      dark: 100,
      relicChance: 0.9,
      relicRarityBias: 1.0,
    },
    idle: { energy: 5000, alloy: 300, data: 400, dark: 4 },
    requires: 'node_stellar_edge',
  },
]

/** 据点查找 Map（O(1) 查找） */
const STRONGHOLD_MAP = new Map(STRONGHOLDS.map((s) => [s.id, s]))

export const getStronghold = (id: string): StrongholdDef | undefined => STRONGHOLD_MAP.get(id)
