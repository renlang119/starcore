#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
starcore-v120-milestone-calib.py — 远征里程碑奖励分档校准（2026-09-23）

复用 starcore-v092-battle-sim.py 的 resolveBattle 忠实移植（整模块导入），
叠加 endless.ts 的远征合成规则：
  敌方 = 模板 × endlessScale(d) × 模板归一化系数
  endlessScale(d) = 0.5 × 1.25^(d-1)；模板按 (d-1) mod 4 轮换
  归一化 = silencer_3 总强度 / 模板总强度（endless.ts TEMPLATE_NORMALIZE 口径）

测试点（档位，档A=刚通关深空 / 档B=深空中段 / 档C=深空满配，兵力与乘数承 v092）：
  D8-D10 / D12-15 / D16-20 / D21-25 / D26-30 / D31-35 / D36-40
每点输出：前沿战（best+1，main/counter/countered 三变体 × 8 种子）最差回合与胜率。
判定：胜率 6/8 以上视为「该档位约可达」，据此对照里程碑档位发放时点。
"""

import importlib.util
import os

spec = importlib.util.spec_from_file_location(
    "v092sim", os.path.join(os.path.dirname(os.path.abspath(__file__)),
                            "starcore-v092-battle-sim.py"))
sim = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sim)

# ---------- 远征模板（数值经 balance-data.json：pve.ts 快照） ----------
from lib import balance_data as bd

_TEMPLATE_IDS = ('silencer_3', 'raider_5', 'beast_4', 'ruin_4')
_SH = {s['id']: s for s in bd.table('pve')['strongholds']}
bd.require(all(tid in _SH for tid in _TEMPLATE_IDS), '远征模板据点缺失（pve 域）')
TEMPLATES = {tid: dict(enemies=[dict(e) for e in _SH[tid]['enemies']]) for tid in _TEMPLATE_IDS}
TEMPLATE_IDS = ['silencer_3', 'raider_5', 'beast_4', 'ruin_4']
ENEMY_GROWTH = bd.table('endless')['enemyGrowth']
BASE_POWER = sim.power(TEMPLATES['silencer_3'])
NORMALIZE = {tid: BASE_POWER / sim.power(TEMPLATES[tid]) for tid in TEMPLATE_IDS}

# ---------- 档位锚（profiles 域）：网格上界与 C 档锚深对齐 ----------
_PROFILES = bd.table('profiles')
_C_ANCHOR = _PROFILES['tiers']['C']['anchorDepth']
_C_MILESTONE = _PROFILES['tiers']['C']['milestoneTier']

def endless_enemies(depth):
    d = max(1, int(depth))
    tid = TEMPLATE_IDS[(d - 1) % 4]
    scale = 0.5 * (ENEMY_GROWTH ** (d - 1)) * NORMALIZE[tid]
    out = []
    for e in TEMPLATES[tid]['enemies']:
        r = lambda v: round(v * scale)
        out.append(dict(unitId=e['unitId'], attack=r(e['attack']),
                        defense=r(e['defense']), hp=r(e['hp']), count=e['count'],
                        counteredBy=list(e['counteredBy'])))
    return dict(enemies=out)

SEEDS = [0x1234 + i * 7919 for i in range(8)]

# (档, best, 前沿 target) ， target = best+1 的里程碑边界战
POINTS = [
    ('A', 8, 10), ('A', 12, 15),
    ('B', 16, 20), ('B', 21, 25),
    ('C', 26, 30), ('C', 31, 35), ('C', 36, 40),
]
# 档位锚守卫（profiles 域）：网格上界 = C 档可通关锚深（endless.ts 注记 D40 交叉锚定）
bd.require(POINTS[-1][2] == _C_ANCHOR, f'v120 网格上界 {POINTS[-1][2]} != C 档锚深 {_C_ANCHOR}')
bd.require(_C_MILESTONE == 4, f'profiles: C 档里程碑档 {_C_MILESTONE} != 4（endless.ts 注记口径）')

print('== 模板归一化系数（基准 = silencer_3）==')
for tid in TEMPLATE_IDS:
    print(f'  {tid:<11} ×{NORMALIZE[tid]:.4f}')
print()

print('== 远征深度分档校准（前沿战 = best+1，8 种子）==')
print(f"{'档':<3}{'深度':<10}{'强度':<14}{'main':<22}{'counter':<22}{'countered':<22}")
for tier, best, target in POINTS:
    atk_m, def_m = sim.tier_mults(tier)
    s = endless_enemies(target)
    row = []
    for variant in ['main', 'counter', 'countered']:
        f = sim.formation_variant(sim.TIERS[tier], variant)
        rounds_list, wins = [], 0
        for sd in SEEDS:
            v, r, _ = sim.resolve_battle(f, s, atk_m, def_m, sd)
            rounds_list.append(r)
            wins += v
        row.append(f'{max(rounds_list)}R 胜{wins}/8')
    print(f"{tier:<3}D{target:<9}{sim.power(s):<14,}{row[0]:<22}{row[1]:<22}{row[2]:<22}")

print()
print('== 里程碑边界战力参考（档位 ×5 公式的战斗奖励对照）==')
print('深度  战斗dark=100×1.35^(d-1)（取整）')
for d in [10, 20, 30, 40, 50, 60]:
    print(f'  D{d:<4} {round(100 * 1.35 ** (d - 1)):,}')
