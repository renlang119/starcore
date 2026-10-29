#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
starcore-ev-ledger.py — 全系统 EV 总账（第一段：收支骨架）

issue #18 口径（上游 2026-10-29 修订后）：
  1. 按时间口径分表，不做跨口径加总：
     - 一次性：探索总包（收入）/ 探索节点成本 + 训练满编成本（支出）
     - 周频：周强敌（收入）
     - 时薪：派遣（多路编队）/ 驻扎 / 离线（驻扎下界 + 结构标注）
  2. 汇总仅两指标：每档稳态时薪净收支、一次性投入回收小时数。
  3. 遗物概率面不进本轮资源收支（endless.ts 内联常量，#18 修订 1）。
  4. 离线建筑产出未画像化：离线项给驻扎下界（OFFLINE_CAP 封顶 24h）
     与自动协议三节点标注，不虚拟建筑等级。

折算率（能量当量，设计声明非市场价，v1.27 派遣 EV 定稿口径）：
  1 能量 = 1；1 合金 = 1；1 数据 = 6；1 晶体 = 55；1 暗物质 = 8000
  （晶体 55 与据点奖励带 energy:crystal 比价中值对账，见断言 1）

三档画像（profiles 域：导出器校准声明，聚值自 tech/achievements/relics/
transcend 域真值连乘推导）：
  档 A / B / C = 可通关深空 D34 / D38 / D40，里程碑档 3 / 3 / 4；
  兵量与聚值乘数同源经 balance-data.json（v092 / v120 / 本脚本统一消费）。

数据源：tools/balance/data/balance-data.json（schema:3）——
explore / weeklyBoss / transcend / profiles 域与 units.cost 投影；
奖励公式（里程碑 / 战斗 / 周强敌 / 派遣）自 pve 基准包 +
endless.rewardGrowth 同源重算，脚本不自带可能漂移的数值。
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import balance_data as bd

# ---------- 折算率（设计声明；断言 1 对账） ----------
RATE = {'energy': 1.0, 'alloy': 1.0, 'data': 6.0, 'crystal': 55.0, 'dark': 8000.0}

# ---------- 三档画像（profiles 域：导出器校准声明 + 域真值聚值） ----------
# 锚深 = 可通关深空深度（endless.ts 里程碑注记口径）；best 为终身远征前沿；
# 兵量与聚值乘数同源（v092/v120 消手抄后统一读 profiles）。
TIERS = {
    name: {'best': p['anchorDepth'], 'milestone': p['milestoneTier'], 'units': dict(p['units'])}
    for name, p in bd.table('profiles')['tiers'].items()
}

RES_KEYS = ['energy', 'crystal', 'alloy', 'data', 'dark']

failures = []


def check(cond, msg):
    if not cond:
        failures.append(msg)
    return cond


# ---------- 数据载入 ----------
UNITS = {u['id']: u for u in bd.table('units')}
EXPLORE = bd.table('explore')
WEEKLY = bd.table('weeklyBoss')
TRANSCEND = bd.table('transcend')
PVE = bd.table('pve')
ENDLESS = bd.table('endless')
DISPATCH = bd.table('dispatch')
BUILDINGS = bd.table('buildings')
OFFLINE = bd.table('offline')

GROWTH = ENDLESS['rewardGrowth']
MS_STEP = ENDLESS['milestoneStep']
# 基准包统一经导出域锚定（endless.unlockStronghold 与 dispatch.baseStronghold
# 交叉校验同源，不再脚本侧写死据点 id）
MS_UNLOCK = ENDLESS['unlockStronghold']
DISPATCH_BASE = DISPATCH['baseStronghold']
bd.require(
    MS_UNLOCK == DISPATCH_BASE,
    f'基准据点不同源: endless.unlockStronghold={MS_UNLOCK} vs dispatch.baseStronghold={DISPATCH_BASE}')
BASE = next(s for s in PVE['strongholds'] if s['id'] == MS_UNLOCK)
BASE_RW = {k: BASE['rewards'].get(k, 0) for k in RES_KEYS}


def ev(res):
    """资源包 → 能量当量。键集合守卫：未知资源键按 0 静默吞会掩盖漂移。"""
    unknown = set(res or {}) - set(RATE)
    if res and unknown:
        bd.require(False, f'ev() 遇未知资源键 {sorted(unknown)}（RATE 未覆盖）')
    return sum(RATE.get(k, 0) * v for k, v in (res or {}).items() if v)


def reward_at(depth):
    """深 d 合成据点奖励（endless.ts endlessStronghold 同源：base × GROWTH^(d-1) 逐值 round）。"""
    rs = GROWTH ** (max(1, math.floor(depth)) - 1)
    return {k: (round(BASE_RW[k] * rs) if BASE_RW[k] else 0) for k in RES_KEYS}


def milestone_reward(tier):
    """里程碑档 tier 一次性奖励（endless.ts endlessMilestoneReward 同源：锚 tier×MS_STEP）。"""
    return reward_at(tier * MS_STEP)


def weekly_reward(best):
    """周强敌（weekly-boss.ts weeklyBossReward 同源：前沿锚 × REWARD_MULT）。"""
    anchor = reward_at(max(WEEKLY['floor'], best + 1))
    return {k: round(v * WEEKLY['rewardMult']) for k, v in anchor.items()}


def dispatch_hourly(best, hours, count=1):
    """派遣时薪（dispatch.ts dispatchReward 同源：base × GROWTH^(best-1) × w；
    traitMult 基准 1.0，count = 并行路数。逐资源 round 后经 ev() 折算当量）。"""
    tier = next((t for t in DISPATCH['tiers'] if t['hours'] == hours), None)
    bd.require(tier is not None, f'派遣档缺失: {hours}h')
    rs = GROWTH ** (best - 1)
    total = ev({k: round(BASE_RW[k] * rs * tier['weight']) for k in RES_KEYS if BASE_RW[k]})
    return total * count / (hours * 3600)


def next_cost(node, level=0):
    """转生节点下一级成本（transcend.ts nextCost 同源：无限 = ceil(cost × growth^level)）。"""
    if node['maxLevel'] is None:
        return math.ceil(node['cost'] * (node.get('costGrowth', 1.5) ** level))
    return node['cost']


# ---------- 断言 1：折算率对账（晶体 55 与据点奖励带比价中值，v127 同式同容差） ----------
import statistics

pairs = [
    s['rewards'] for s in PVE['strongholds']
    if s['rewards'].get('energy') and s['rewards'].get('crystal')
]
median = statistics.median(s['energy'] / s['crystal'] for s in pairs)
check(bd.approx(median, 55.0, 0.5),
      f'晶体折算对账失败：奖励带比价中值 {median:.1f} vs 声明 55')

# ---------- 断言 2：里程碑 27% 口径（endless.ts 注记 1/ΣG^-k ≈ 1/3.67 ≈ 27%） ----------
# milestone(t+1) / Σ(段内 10 场战斗) = G^10 / ΣG^k = 1/Σ(k=0..9) G^-k
k_ratio = 1.0 / sum(GROWTH ** -k for k in range(10))
check(bd.approx(k_ratio, 0.27, 0.01),
      f'里程碑 27% 口径失败：1/ΣG^-k = {k_ratio:.4f}')

# ---------- 断言 3：周强敌公式同源（weekly-boss.ts weeklyBossReward 逐资源恒等） ----------
for name, p in TIERS.items():
    anchor = reward_at(max(WEEKLY['floor'], p['best'] + 1))
    recomputed = {k: round(v * WEEKLY['rewardMult']) for k, v in anchor.items()}
    got = weekly_reward(p['best'])
    check(all(got[k] == recomputed[k] for k in RES_KEYS),
          f'周强敌公式重算不等（档 {name}）：{got} vs {recomputed}')

# ---------- 断言 4：里程碑锚恒等 + 档间比（GROWTH^10，round 容差 0.1%） ----------
for t in [1, 2, 3, 4]:
    check(bd.approx(ev(milestone_reward(t + 1)) / ev(milestone_reward(t)), GROWTH ** 10, 0.001),
          f'里程碑档间比 ≠ GROWTH^10（档 {t}）')

# ---------- 断言 5：派遣与同锚里程碑同量级（v127 口径：best=档1锚 的 4h 派遣 vs 档 1 里程碑） ----------
d4h_ms1 = dispatch_hourly(MS_STEP, 4, 1) * 4 * 3600
ms1 = ev(milestone_reward(1))
check(0.5 <= d4h_ms1 / ms1 <= 2,
      f'派遣/里程碑量级失锚：4h 派遣(best={MS_STEP}) {d4h_ms1:.3e} vs 里程碑档1 {ms1:.3e}')

# ---------- 一次性面 ----------
explore_total_rw = sum(ev(n['rewards']) for n in EXPLORE)
explore_total_cost = sum(ev(n['cost']) for n in EXPLORE)
check(explore_total_rw > explore_total_cost,
      f'探索净盈为负：收 {explore_total_rw:.3e} / 支 {explore_total_cost:.3e}')

# 训练满编成本（units.cost 为每兵单价 × 档位兵量）。
# 口径：按 1× TIERS 兵量计（编队满编一份）；3 路派遣编队按 3× 计——
# 量级远小于探索成本（<1e-5 比例），两种口径下汇总结论不变。
def train_cost(units):
    total = 0.0
    for uid, count in units.items():
        c = UNITS[uid].get('cost', {})
        total += ev({k: v * count for k, v in c.items()})
    return total

# ---------- 时薪面 ----------
garrison_top = max(
    ((s['id'], ev(s['idle'])) for s in PVE['strongholds'] if s.get('idle')),
    key=lambda x: x[1])
OFFLINE_CAP_S = OFFLINE['capSeconds']

AUTO_NODES = [n for n in TRANSCEND['nodes']
              if any(e['type'].startswith('auto_') for e in n['effects'])]

# ---------- 输出：三口径分表 + 两汇总指标 ----------
print('== 全系统 EV 总账（schema:3，折算：1 合金=1 / 1 数据=6 / 1 晶体=55 / 1 暗物质=8000 能量） ==')
print(f'基准包 {MS_UNLOCK}：{BASE_RW}')
print()

print('-- 一次性面（不随档深缩放；探索 34 节点全量） --')
print(f'  探索总包（收入）      {explore_total_rw:>14.3e} 当量')
print(f'  探索节点成本（支出）  {explore_total_cost:>14.3e} 当量')
print(f'  探索净盈              {explore_total_rw - explore_total_cost:>14.3e} 当量')
print(f'  转生门槛能量          {TRANSCEND["minEnergy"]:>14.3e}（{MS_STEP} 层一档的里程碑带内）')
print()

print('-- 周频面（随档深缩放，一次性/周） --')
for name, p in TIERS.items():
    print(f'  档 {name}（best={p["best"]:<2}）  周强敌 {ev(weekly_reward(p["best"])):>12.3e} 当量'
          f'  = {WEEKLY["rewardMult"]} × 前沿战斗（锚 D{max(WEEKLY["floor"], p["best"] + 1)}）')
print()

print('-- 时薪面（每档，折算当量/s） --')
d24_best = {}
for name, p in TIERS.items():
    d1 = dispatch_hourly(p['best'], 24, 1)
    d3 = dispatch_hourly(p['best'], 24, 3)
    battle = ev(reward_at(p['best'] + 1))
    ms_ev = ev(milestone_reward(p['milestone']))
    print(f'  档 {name}：单路 24h 派遣 {d1:>10.3e}/s | 3 路编队 {d3:>10.3e}/s'
          f' | 驻扎上限（{garrison_top[0]}）{garrison_top[1]:>10.3e}/s'
          f' | 前沿单场 {battle:>10.3e} | 里程碑档 {MS_STEP * p["milestone"]} 一次性 {ms_ev:>10.3e}')
print(f'  驻扎与派遣共用 3 编队：稳态最优 = 全派遣（3 路上表）；驻扎为无编队空余时的补位下界')
print(f'  离线挂机（OFFLINE_CAP {OFFLINE_CAP_S // 3600:.0f}h 封顶）：驻扎下界 {garrison_top[1]:.3e}/s'
      f' × 24h；建筑产出未画像化不计入，离线派遣补算单列（OfflineReport.dispatchGains）')
print(f'  自动协议三节点（离线自动化，效果面）：{", ".join(n["id"] for n in AUTO_NODES)}')
print()

print('-- 汇总指标 --')
for name, p in TIERS.items():
    steady = dispatch_hourly(p['best'], 24, 3)
    oneshot = explore_total_cost + train_cost(p['units'])
    print(f'  档 {name}：稳态时薪净收支 {steady:>10.3e}/s'
          f'（支出 0：战斗不损兵，训练为一次性）'
          f' | 一次性投入 {oneshot:>10.3e} 回收 {oneshot / steady / 3600 if steady else float("inf"):>8.3f} 小时'
          f' | 转生门槛 {TRANSCEND["minEnergy"] / steady if steady else float("inf"):>8.3g} 秒可积')
print()

# ---------- 断言 6：训练满编成本 / 前沿单场（可回收比例带） ----------
for name, p in TIERS.items():
    ratio = train_cost(p['units']) / ev(reward_at(p['best'] + 1))
    check(0 < ratio < 0.01,
          f'训练成本比例超带（档 {name}）：{ratio:.4f}（预期终局口径 < 0.01）')

# ---------- 断言 7：三档训练成本比例（v092 兵量带同源） ----------
tA, tB, tC = (train_cost(TIERS[k]['units']) for k in 'ABC')
check(tB > tA and tC > tB, '训练满编成本非随档递增')

# ---------- 断言 8：转生门槛结构（首档里程碑可覆盖；终局时薪下秒级可积） ----------
for name, p in TIERS.items():
    steady = dispatch_hourly(p['best'], 24, 3)
    check(steady > TRANSCEND['minEnergy'],
          f'稳态时薪未过转生门槛（档 {name}）：{steady:.3e}/s vs {TRANSCEND["minEnergy"]:.3e}')
check(TRANSCEND['minEnergy'] < ev(milestone_reward(1)),
      f'转生门槛超首档里程碑：{TRANSCEND["minEnergy"]:.3e} vs {ev(milestone_reward(1)):.3e}')

# ---------- 断言 9：无限节点成本曲线封闭（手算点对照） ----------
inf_nodes = [n for n in TRANSCEND['nodes'] if n['maxLevel'] is None]
check(len(inf_nodes) == 4, f'无限节点数 ≠ 4：{len(inf_nodes)}')
for n in inf_nodes:
    g = n.get('costGrowth', 1.5)
    # nextCost(0)=cost, nextCost(1)=ceil(cost×g), nextCost(2)=ceil(cost×g^2)
    c0, c1, c2 = next_cost(n), next_cost(n, 1), next_cost(n, 2)
    check(c0 == n['cost'] and c1 == math.ceil(n['cost'] * g) and c2 == math.ceil(n['cost'] * g * g),
          f'无限节点成本曲线断言失败：{n["id"]}')

if failures:
    print(f'FAIL {len(failures)} 项：')
    for f in failures:
        print('  -', f)
    raise SystemExit(1)
print('PASS：全部断言通过（9 组：折算对账 / 27% 口径 / 周强敌倍率 / 档间比 / '
      '派遣量级 / 训练回收带 / 递增性 / 转生门槛 / 无限曲线）')
