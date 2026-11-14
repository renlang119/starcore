/**
 * imperial.ts：帝庭档案数据（帝庭 · 贡道核验仪卫裁决炉音观察留档）
 *
 * 5 节，每节 1 条节名 + 3 条观察留档（name / text / note，
 * note = 帝庭档案批注）；五节依次为贡道、核验、仪卫、裁决、炉音，
 * 炉音节只收信仰与传闻，不写炉的实体。档案馆帝庭档案分组在完成
 * 银盘枢纽探索节点后解锁展示，转生后随本轮重新上锁（判读即算，
 * 无持久化字段）。取词沿数据实体字段口径：模块加载时逐键字面量
 * 取词，UI 读字段不做动态键拼接（语言切换为整页刷新，既有先例
 * 成立）。
 */

import { t } from '@/i18n'

/** 帝庭留档条目（name = 条目名，text = 观察正文，note = 帝庭档案批注） */
export interface ImperialEntry {
  id: string
  name: string
  text: string
  note: string
}

/** 帝庭档案之节（节名做段头，每节恰含三条留档） */
export interface ImperialSection {
  id: string
  name: string
  entries: readonly ImperialEntry[]
}

/** 帝庭档案（有序：贡道、核验、仪卫、裁决在前，炉音压轴） */
export const IMPERIAL_SECTIONS: readonly ImperialSection[] = [
  {
    id: 'section_01',
    name: t('content.imperial.section_01'),
    entries: [
      {
        id: 'imp_01',
        name: t('content.imperial.imp_01.name'),
        text: t('content.imperial.imp_01.text'),
        note: t('content.imperial.imp_01.note'),
      },
      {
        id: 'imp_02',
        name: t('content.imperial.imp_02.name'),
        text: t('content.imperial.imp_02.text'),
        note: t('content.imperial.imp_02.note'),
      },
      {
        id: 'imp_03',
        name: t('content.imperial.imp_03.name'),
        text: t('content.imperial.imp_03.text'),
        note: t('content.imperial.imp_03.note'),
      },
    ],
  },
  {
    id: 'section_02',
    name: t('content.imperial.section_02'),
    entries: [
      {
        id: 'imp_04',
        name: t('content.imperial.imp_04.name'),
        text: t('content.imperial.imp_04.text'),
        note: t('content.imperial.imp_04.note'),
      },
      {
        id: 'imp_05',
        name: t('content.imperial.imp_05.name'),
        text: t('content.imperial.imp_05.text'),
        note: t('content.imperial.imp_05.note'),
      },
      {
        id: 'imp_06',
        name: t('content.imperial.imp_06.name'),
        text: t('content.imperial.imp_06.text'),
        note: t('content.imperial.imp_06.note'),
      },
    ],
  },
  {
    id: 'section_03',
    name: t('content.imperial.section_03'),
    entries: [
      {
        id: 'imp_07',
        name: t('content.imperial.imp_07.name'),
        text: t('content.imperial.imp_07.text'),
        note: t('content.imperial.imp_07.note'),
      },
      {
        id: 'imp_08',
        name: t('content.imperial.imp_08.name'),
        text: t('content.imperial.imp_08.text'),
        note: t('content.imperial.imp_08.note'),
      },
      {
        id: 'imp_09',
        name: t('content.imperial.imp_09.name'),
        text: t('content.imperial.imp_09.text'),
        note: t('content.imperial.imp_09.note'),
      },
    ],
  },
  {
    id: 'section_04',
    name: t('content.imperial.section_04'),
    entries: [
      {
        id: 'imp_10',
        name: t('content.imperial.imp_10.name'),
        text: t('content.imperial.imp_10.text'),
        note: t('content.imperial.imp_10.note'),
      },
      {
        id: 'imp_11',
        name: t('content.imperial.imp_11.name'),
        text: t('content.imperial.imp_11.text'),
        note: t('content.imperial.imp_11.note'),
      },
      {
        id: 'imp_12',
        name: t('content.imperial.imp_12.name'),
        text: t('content.imperial.imp_12.text'),
        note: t('content.imperial.imp_12.note'),
      },
    ],
  },
  {
    id: 'section_05',
    name: t('content.imperial.section_05'),
    entries: [
      {
        id: 'imp_13',
        name: t('content.imperial.imp_13.name'),
        text: t('content.imperial.imp_13.text'),
        note: t('content.imperial.imp_13.note'),
      },
      {
        id: 'imp_14',
        name: t('content.imperial.imp_14.name'),
        text: t('content.imperial.imp_14.text'),
        note: t('content.imperial.imp_14.note'),
      },
      {
        id: 'imp_15',
        name: t('content.imperial.imp_15.name'),
        text: t('content.imperial.imp_15.text'),
        note: t('content.imperial.imp_15.note'),
      },
    ],
  },
]

/** 帝庭档案留档条目总数（计数展示用，5 节 × 3 条 = 15 条） */
export const IMPERIAL_ENTRY_COUNT = IMPERIAL_SECTIONS.reduce((n, s) => n + s.entries.length, 0)

/**
 * 炉前节（v1.81）：6 座贡道据点全部接管后的亲见留档，独立于五节
 * 观察档案（分组解锁走银盘枢纽，本节解锁走接管数，见 ArchiveView）。
 * 炉音节只收传闻，本节收站在炉前的所见，叙事推进到炉是活的，不揭来源。
 */
export const IMPERIAL_FINAL_SECTION: ImperialSection = {
  id: 'section_06',
  name: t('content.imperial.section_06'),
  entries: [
    {
      id: 'imp_16',
      name: t('content.imperial.imp_16.name'),
      text: t('content.imperial.imp_16.text'),
      note: t('content.imperial.imp_16.note'),
    },
    {
      id: 'imp_17',
      name: t('content.imperial.imp_17.name'),
      text: t('content.imperial.imp_17.text'),
      note: t('content.imperial.imp_17.note'),
    },
    {
      id: 'imp_18',
      name: t('content.imperial.imp_18.name'),
      text: t('content.imperial.imp_18.text'),
      note: t('content.imperial.imp_18.note'),
    },
  ],
}

/** 炉前节条目数（含入分组计数：15 + 3 = 18） */
export const IMPERIAL_FINAL_ENTRY_COUNT = IMPERIAL_FINAL_SECTION.entries.length

/**
 * 炉域节（v1.83）：首次进入炉域后的亲见留档。半揭口径「只揭行为，
 * 不揭本体」：炉的自主行为、规模轮廓与拣贡亲证可写；来源、目的、
 * 与门后侧的关系保持留白（台账勾稽与排除词表见 references/
 * i18n-en-glossary.md §三⑤）。解锁 = forgeEntered 终身置位（跨转生
 * 保持解锁，与炉前节 everCompleted 口径同构），判读在 ArchiveView。
 */
export const IMPERIAL_FORGE_SECTION: ImperialSection = {
  id: 'section_07',
  name: t('content.imperial.section_07'),
  entries: [
    {
      id: 'imp_19',
      name: t('content.imperial.imp_19.name'),
      text: t('content.imperial.imp_19.text'),
      note: t('content.imperial.imp_19.note'),
    },
    {
      id: 'imp_20',
      name: t('content.imperial.imp_20.name'),
      text: t('content.imperial.imp_20.text'),
      note: t('content.imperial.imp_20.note'),
    },
    {
      id: 'imp_21',
      name: t('content.imperial.imp_21.name'),
      text: t('content.imperial.imp_21.text'),
      note: t('content.imperial.imp_21.note'),
    },
  ],
}

/** 炉域节条目数（含入分组计数：18 + 3 = 21） */
export const IMPERIAL_FORGE_ENTRY_COUNT = IMPERIAL_FORGE_SECTION.entries.length

/** 帝庭档案分组条目总数（五节观察留档 + 炉前亲见留档 + 炉域亲见留档） */
export const IMPERIAL_TOTAL_ENTRY_COUNT =
  IMPERIAL_ENTRY_COUNT + IMPERIAL_FINAL_ENTRY_COUNT + IMPERIAL_FORGE_ENTRY_COUNT
