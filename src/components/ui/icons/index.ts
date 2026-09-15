/**
 * icons/index.ts — 统一导出 7 个图标子组件
 *
 * Icons.vue facade 通过此入口 import 全部子组件；
 * 符号表由 AppShell 单点挂载（v0.77 收敛）。
 *
 * 图标 id 为裸字符串（v0.84 掂量未改为联合类型：需维护全量 id 清单并随
 * 新增图标持续同步，维护成本大于收益；总数与引用面由守恒脚本与专项守护，
 * 当前 120 项）。
 */

export { default as IconsBase } from './IconsBase.vue'
export { default as IconsResource } from './IconsResource.vue'
export { default as IconsBuilding } from './IconsBuilding.vue'
export { default as IconsTech } from './IconsTech.vue'
export { default as IconsRelic } from './IconsRelic.vue'
export { default as IconsStronghold } from './IconsStronghold.vue'
export { default as IconsUnit } from './IconsUnit.vue'
