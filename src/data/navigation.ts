/**
 * navigation.ts — 统一导航项定义
 * SideNav 和 BottomNav 共用此数据源，通过 tier 字段筛选
 */

export interface NavItem {
  id: string
  label: string
  icon: string
  path: string
  tier: 'primary' | 'secondary'
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: '主界面', icon: 'i-nav-home', path: '/', tier: 'primary' },
  { id: 'build', label: '建造', icon: 'i-nav-build', path: '/build', tier: 'primary' },
  { id: 'tech', label: '科技树', icon: 'i-nav-tech', path: '/tech', tier: 'primary' },
  { id: 'map', label: '探索', icon: 'i-nav-explore', path: '/map', tier: 'primary' },
  { id: 'army', label: '部队', icon: 'i-nav-army', path: '/army', tier: 'primary' },
  { id: 'relic', label: '遗物', icon: 'i-nav-relic', path: '/relic', tier: 'secondary' },
  {
    id: 'prestige',
    label: '奇点重启',
    icon: 'i-nav-prestige',
    path: '/prestige',
    tier: 'secondary',
  },
  {
    id: 'achievements',
    label: '成就',
    icon: 'i-ui-check',
    path: '/achievements',
    tier: 'secondary',
  },
]
