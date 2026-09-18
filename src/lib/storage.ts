/**
 * storage.ts — 本地持久化门面（按职责拆分后的统一入口）
 *
 * 实现按职责分置于 save/ 子模块：schema（类型契约与版本）、
 * io（IndexedDB + localStorage 双通道读写）、validate（校验与自愈修复）、
 * codec（Base64 导入导出编码）。本文件仅同名转发公开导出，
 * 既有 `@/lib/storage` 引用零改动。
 */
export { SAVE_VERSION } from './save/schema'
export type {
  ResourceSaveData,
  BuildingSaveData,
  ResearchSaveData,
  MilitarySaveData,
  CombatSaveData,
  ExplorationSaveData,
  RelicSaveData,
  TranscendSaveData,
  PlayerSaveData,
  AchievementsSaveData,
  DailySaveData,
  SaveData,
} from './save/schema'
export { writeSave, writeSaveSync, readSave, clearSave, clearAllSaves } from './save/io'
export type { SaveReadOutcome } from './save/io'
export { exportSave, importSave } from './save/codec'
export type { ImportResult } from './save/codec'
