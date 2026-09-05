/**
 * save-migrate.ts — 存档版本迁移链
 *
 * 每个迁移函数将存档从 version N 升级到 N+1。
 * 新字段在旧存档中不存在时，hydrate 自动取默认值；
 * 字段重命名 / 语义变更时必须写显式迁移。
 */
import type { SaveData } from './storage'

/** 迁移函数表：key = 源版本号（从此版本升级到下一版本） */
const MIGRATIONS: Record<number, (data: SaveData) => void> = {
  // v1→v2: 新增 exploration / relics / transcend 模块
  // 旧存档中不存在，hydrate 时自动取默认空值
  1: (_data: SaveData) => {
    /* 无需显式迁移 */
  },

  // v2→v3: 遗物 cost_mult 修复 + 驻扎离线收益 garrisonGains 字段
  // 均为逻辑层修复，存档结构无变化
  2: (_data: SaveData) => {
    /* 无需显式迁移 */
  },

  // v3→v4: 遗物存档精简——owned 从完整字段改为只存 id/instanceId/obtainedAt
  // hydrate 时从 RELIC_POOL 按 id 补全，无需在此处做数据转换
  // （hydrate 内部已兼容旧格式完整字段降级处理）
  3: (_data: SaveData) => {
    /* 无需显式迁移，hydrate 自动兼容 */
  },

  // v4→v5: 导出格式从 XOR 加密（SCE-）改为 Base64 编码（SCB-）
  // 旧 SCE- 格式的导出码无法导入（XOR 加密产物不是合法 Base64 JSON），
  // 但线上存档（IndexedDB/localStorage）不受影响——它们存的是原始 JSON
  4: (_data: SaveData) => {
    /* 存档结构无变化 */
  },
}

/**
 * 按版本链逐步迁移存档数据
 * @param data 待迁移的存档
 * @param targetVersion 目标版本号（当前 SAVE_VERSION）
 */
export function migrateSave(data: SaveData, targetVersion: number): void {
  let v = data.version ?? 0
  while (v < targetVersion) {
    const migrator = MIGRATIONS[v]
    if (migrator) migrator(data)
    v++
    data.version = v
  }
}
