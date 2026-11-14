/**
 * 帝庭据点线内容文案（v1.80 系统层）
 *
 * 键前缀 content.imperialStrongholds.*：据点名 / 描述 / 巡检舰队。
 * 与帝庭档案的 content.imperial.* 分域，避免覆盖。
 */
export default {
  'content.imperialStrongholds.imp_pass.name': '贡道关',
  'content.imperialStrongholds.imp_pass.desc':
    '贡道咽喉上的旧关卡，帝庭的核验灯不分昼夜地扫过来往船队。',
  'content.imperialStrongholds.imp_audit.name': '核验台',
  'content.imperialStrongholds.imp_audit.desc':
    '臂脊航道旁的核验台，所有进贡船都要在这里交出航程与货单。',
  'content.imperialStrongholds.imp_guard.name': '仪卫坞',
  'content.imperialStrongholds.imp_guard.desc': '摇篮星区外的仪卫驻泊坞，帝庭的仪仗舰在此轮值。',
  'content.imperialStrongholds.imp_verdict.name': '裁决港',
  'content.imperialStrongholds.imp_verdict.desc':
    '星尘牧场深处的裁决港，裁决舰队从这里出发收束各王庭的贡物。',
  'content.imperialStrongholds.imp_echo.name': '炉音台',
  'content.imperialStrongholds.imp_echo.desc':
    '静默银晕旁的炉音台，监听器把银心深处的低频脉动记成一条细线。',
  'content.imperialStrongholds.imp_court.name': '炉前庭',
  'content.imperialStrongholds.imp_court.desc':
    '银盘枢纽外缘的炉前庭，贡道在此汇入最后一道庭门，门后是炉。',
  'content.imperialStrongholds.audit.name': '帝庭巡检舰队',
  'content.imperialStrongholds.audit.desc': '按周巡查贡道节点的裁决分舰队，核验不通过即收回据点。',

  // 炉域（v1.83）：倾贡与炉火稳定度；投入四选一（不含数据），产出数据
  'content.imperialStrongholds.forge.name': '炉域',
  'content.imperialStrongholds.forge.desc':
    '贡道尽头的炉域。倾贡回填炉火，稳定度越高，回礼越厚；炉每周点名一种贡物，点名倾贡回礼三倍。',
  'content.imperialStrongholds.forge.stabilityLabel': '炉火稳定度',
  'content.imperialStrongholds.forge.stabilityDesc':
    '稳定度随时间回落，每次倾贡回填；80/50/20 以上分三档回礼，20 以下无回礼。',
  'content.imperialStrongholds.forge.remaining': '今日剩余倾贡 {n} 次',
  'content.imperialStrongholds.forge.enter': '进入炉域',
  'content.imperialStrongholds.forge.tributeHint': '投入固定量资源，回填炉火 +24',
  'content.imperialStrongholds.forge.yieldDesc':
    '回礼按稳定度档位结算：80/50/20 以上三档递增，点名资源 ×3，20 以下无回礼；每日 4 次。',
  'content.imperialStrongholds.forge.tribute': '倾贡',
  'content.imperialStrongholds.forge.pickHint': '本周点名：{res}（回礼 ×3）',
  'content.imperialStrongholds.forge.lockedDesc': '需接管全部六座贡道据点，且至少一次通过巡检。',
}
