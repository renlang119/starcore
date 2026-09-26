/**
 * navigation.ts — 统一导航项定义
 * SideNav / BottomNav / 首页快速操作等共用此数据源，通过 tier 字段筛选
 */

import { t } from '@/i18n'

interface NavItem {
  id: string
  label: string
  icon: string
  path: string
  tier: 'primary' | 'secondary'
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: t('nav.home'), icon: 'i-nav-home', path: '/', tier: 'primary' },
  { id: 'build', label: t('nav.build'), icon: 'i-nav-build', path: '/build', tier: 'primary' },
  { id: 'tech', label: t('nav.tech'), icon: 'i-nav-tech', path: '/tech', tier: 'primary' },
  { id: 'map', label: t('nav.map'), icon: 'i-nav-explore', path: '/map', tier: 'primary' },
  { id: 'army', label: t('nav.army'), icon: 'i-nav-army', path: '/army', tier: 'primary' },
  { id: 'relic', label: t('nav.relic'), icon: 'i-nav-relic', path: '/relic', tier: 'secondary' },
  {
    id: 'prestige',
    label: t('nav.prestige'),
    icon: 'i-nav-prestige',
    path: '/prestige',
    tier: 'secondary',
  },
  {
    id: 'achievements',
    label: t('nav.achievements'),
    icon: 'i-ui-check',
    path: '/achievements',
    tier: 'secondary',
  },
  {
    id: 'archive',
    label: t('nav.archive'),
    icon: 'i-nav-archive',
    path: '/archive',
    tier: 'secondary',
  },
  {
    id: 'settings',
    label: t('nav.settings'),
    icon: 'i-nav-settings',
    path: '/settings',
    tier: 'secondary',
  },
]
