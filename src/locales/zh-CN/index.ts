/**
 * zh-CN — 中文语言包（基线语言；值 = 界面实际文案，逐字保真）
 *
 * 结构：ui/ 界面层按域拆分；content/ 内容层按域拆分（镜像 src/data 文件名）。
 * 纯数据模块：相对路径 + 显式 .ts 后缀，保证纯 Node 工具链（守卫脚本等）可直接加载。
 *
 * 注意：合并为扁平键表；各域键前缀 = 域名（如 nav.* / home.* / resources.*），
 * 跨域重复键会在合并时静默覆盖，新增键须遵循前缀约定。
 */
import achievements from './ui/achievements.ts'
import app from './ui/app.ts'
import archive from './ui/archive.ts'
import army from './ui/army.ts'
import battle from './ui/battle.ts'
import build from './ui/build.ts'
import common from './ui/common.ts'
import effects from './ui/effects.ts'
import game from './ui/game.ts'
import home from './ui/home.ts'
import map from './ui/map.ts'
import nav from './ui/nav.ts'
import offline from './ui/offline.ts'
import prestige from './ui/prestige.ts'
import relics from './ui/relics.ts'
import resources from './ui/resources.ts'
import save from './ui/save.ts'
import settings from './ui/settings.ts'
import tech from './ui/tech.ts'
import ui from './ui/ui.ts'

import achievementsContent from './content/achievements.ts'
import buildingsContent from './content/buildings.ts'
import endlessContent from './content/endless.ts'
import exploreContent from './content/explore.ts'
import pveContent from './content/pve.ts'
import relicsContent from './content/relics.ts'
import storyContent from './content/story.ts'
import techContent from './content/tech.ts'
import traitsContent from './content/traits.ts'
import transcendContent from './content/transcend.ts'
import unitsContent from './content/units.ts'

export default {
  ...achievements,
  ...app,
  ...archive,
  ...army,
  ...battle,
  ...build,
  ...common,
  ...effects,
  ...game,
  ...home,
  ...map,
  ...nav,
  ...offline,
  ...prestige,
  ...relics,
  ...resources,
  ...save,
  ...settings,
  ...tech,
  ...ui,

  // —— 内容层（content/）——
  ...achievementsContent,
  ...buildingsContent,
  ...endlessContent,
  ...exploreContent,
  ...pveContent,
  ...relicsContent,
  ...storyContent,
  ...techContent,
  ...traitsContent,
  ...transcendContent,
  ...unitsContent,
}
