/**
 * en — English language pack (translated from the zh-CN baseline)
 *
 * Structure mirrors zh-CN: ui/ for interface copy, content/ for content copy
 * (mirroring src/data filenames). Pure data modules: relative imports with
 * explicit .ts suffixes so plain Node toolchains (guard scripts etc.) can load them.
 *
 * Note: merged into a flat key table; each domain's keys carry the domain prefix
 * (e.g. nav.* / home.* / resources.*). Follow the prefix convention for new keys.
 */
import achievements from './ui/achievements.ts'
import app from './ui/app.ts'
import archive from './ui/archive.ts'
import encounter from './ui/encounter.ts'
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
import weeklyBossContent from './content/weeklyBoss.ts'
import encountersContent from './content/encounters.ts'

export default {
  ...achievements,
  ...app,
  ...archive,
  ...encounter,
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

  // —— content layer (content/) ——
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
  ...weeklyBossContent,
  ...encountersContent,
}
