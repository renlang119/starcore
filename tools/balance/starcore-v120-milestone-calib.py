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

# ---------- 远征模板（自 pve.ts 原值移植，与 endless.ts TEMPLATE_IDS 一致） ----------
def sh(enemies):
    return dict(enemies=enemies)

TEMPLATES = {
    'silencer_3': sh([
        dict(unitId='silencer_flagship', name='沉默者旗舰', attack=1200, defense=400, hp=50000, count=1, counteredBy=['guard', 'psionic']),
        dict(unitId='silencer_elite', name='沉默者精锐', attack=500, defense=250, hp=10000, count=6, counteredBy=['heavy']),
    ]),
    'raider_5': sh([
        dict(unitId='raider_hunter', name='掠夺者猎舰', attack=480, defense=220, hp=9000, count=10, counteredBy=['guard', 'psionic']),
        dict(unitId='raider_marauder', name='掠夺者劫掠舰', attack=300, defense=150, hp=4500, count=20, counteredBy=['heavy']),
        dict(unitId='raider_warlord', name='掠夺者军阀', attack=900, defense=400, hp=22000, count=2, counteredBy=['guard', 'psionic']),
    ]),
    'beast_4': sh([
        dict(unitId='beast_behemoth', name='虚空巨兽', attack=650, defense=280, hp=30000, count=3, counteredBy=['guard', 'psionic']),
        dict(unitId='beast_swarm', name='虫群飞翼', attack=180, defense=90, hp=1500, count=40, counteredBy=['assault']),
    ]),
    'ruin_4': sh([
        dict(unitId='ruin_sentinel', name='遗迹守卫', attack=520, defense=380, hp=14000, count=6, counteredBy=['heavy']),
        dict(unitId='ruin_colossus', name='遗迹巨像', attack=1100, defense=520, hp=36000, count=2, counteredBy=['guard', 'psionic']),
    ]),
}
TEMPLATE_IDS = ['silencer_3', 'raider_5', 'beast_4', 'ruin_4']
ENEMY_GROWTH = 1.25
BASE_POWER = sim.power(TEMPLATES['silencer_3'])
NORMALIZE = {tid: BASE_POWER / sim.power(TEMPLATES[tid]) for tid in TEMPLATE_IDS}

def endless_enemies(depth):
    d = max(1, int(depth))
    tid = TEMPLATE_IDS[(d - 1) % 4]
    scale = 0.5 * (ENEMY_GROWTH ** (d - 1)) * NORMALIZE[tid]
    out = []
    for e in TEMPLATES[tid]['enemies']:
        r = lambda v: round(v * scale)
        out.append(dict(unitId=e['unitId'], name=e['name'], attack=r(e['attack']),
                        defense=r(e['defense']), hp=r(e['hp']), count=e['count'],
                        counteredBy=e['counteredBy']))
    return sh(out)

SEEDS = [0x1234 + i * 7919 for i in range(8)]

# (档, best, 前沿 target) —— target = best+1 的里程碑边界战
POINTS = [
    ('A', 8, 10), ('A', 12, 15),
    ('B', 16, 20), ('B', 21, 25),
    ('C', 26, 30), ('C', 31, 35), ('C', 36, 40),
]

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
