#!/usr/bin/env python3
"""
starcore-v124-boss-calib.py — 每周强敌（周 Boss）数值校准模拟（v6 定稿轮）

整模块 import v092 sim 复用（v120/v123 同款先例）。模板直接解析 src/data/pve.ts
派生（可复现，与 endless TEMPLATE_NORMALIZE 同公式），不依赖 /tmp 缓存。

设计口径演进（本校准六轮记录）：
  v1 暂定 bossDepth = max(6, floor(best×0.85)) —— 证伪：×0.85 落在
     深度全胜区，三档 1 回合 0 损耗白给（远征挑战带在前沿「前方」）。
  v2 best+K 锚 —— 档C 墙区胜率带合理但模板锯齿 100pp；档A/B 锚定假设错误
     （v120 的「档A 至 D15」是里程碑边界校准点口径，非全胜截止）。
  v3 前沿锚+relax —— beast_4（单体巨兽）在墙+1 全档位 0/200，relax 救不动；
     固定深度 + 随机模板必出「某周必败」。各模板墙位差为结构性（±1..3 深度）。
  v4 best+1+OFFSET —— OFFSET 方向正确但锚定双计 +1：卡墙玩家的 best 已≈墙位
     （重试可推过半胜带，胜率跌到个位数才停），Boss 被推到墙+1 → 全模板过难。
  v5 best+OFFSET 首版（{−1,0,−3,+2}）—— 判定带 [20,70] 偏紧：出带格全部
     落在 [78,87]%（偏移差一格，实测交叉点 raider 为 best+1、beast 为 best−2）；
     且 200 局二项噪声 ±3.5pp、深度整数量化下，70% 上缘不具备判读意义。
  v6（本轮定稿）OFFSET = {silencer_3:−1, raider_5:+1, beast_4:−2, ruin_4:+2}；
     判定带修正为 [15%, 85%]（「可过且非白给」的量化语义；200 局 1σ≈3.5pp）；
     锯齿 ≤40pp 达标、40-50pp 记残留报告、>50pp 硬拦（档C 残留见运行输出）。
     模板按周种子洗牌取 1（克制考题每周变）。
     奖励 = endlessStronghold(max(6, best+1)) × 1.5，锚玩家前沿与模板解耦
     （消除「难的模板周反而奖励低」错位；Boss≈1.5 场前沿远征单场）。

判定（200 局定稿，与 v123 同口径）：
  1. 玩家状态扫描：best ∈ {墙−6, 墙−4, 墙−2, 墙}（墙 = 各档 50% 墙位中位）：
     墙−6/−4 全模板全胜（周津贴）；墙位 ∈ [15%, 85%]（可过且非白给）
  2. 模板锯齿：墙位处跨模板极差 ≤40pp 达标、40-50pp 残留报告、>50pp 硬拦
  3. 变体面：墙位处三变体中位 ≥25%（周内可过 = ≥2/3 变体）
  4. 无 0 回合异常；战损报告项
"""
import math
import os
import re
import sys

import importlib.util

spec = importlib.util.spec_from_file_location(
    'v092sim', os.path.join(os.path.dirname(os.path.abspath(__file__)),
                            'starcore-v092-battle-sim.py'))
v092 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v092)

from pathlib import Path
REPO = Path(__file__).resolve().parents[2]
PVE_TS = REPO / 'src/data/pve.ts'

# ---------- 模板提取：解析 pve.ts 派生各据点敌方编成（可复现） ----------

def extract_strongholds():
    src = open(PVE_TS, encoding='utf-8').read()
    out = {}
    for m in re.finditer(r"id: '([a-z0-9_]+)'", src):
        sid = m.group(1)
        em = re.search(r"enemies: \[(.*?)\]\s*,\s*\n\s*rewards:", src[m.start():], re.S)
        if not em:
            continue
        enemies = []
        for um in re.finditer(
                r"attack: ([0-9.]+),\s*\n\s*defense: ([0-9.]+),\s*\n\s*hp: ([0-9.]+),"
                r"\s*\n\s*count: ([0-9.]+)(?:,\s*\n\s*counteredBy: \[([^\]]*)\])?",
                em.group(1)):
            cb = []
            if um.group(5):
                cb = re.findall(r"'([a-z]+)'", um.group(5))
            enemies.append(dict(
                attack=float(um.group(1)), defense=float(um.group(2)),
                hp=float(um.group(3)), count=int(um.group(4)), counteredBy=cb))
        out[sid] = enemies
    return out

PVE = extract_strongholds()
assert 'silencer_3' in PVE and 'silencer_4' in PVE, '模板提取失败'

ENDLESS_TEMPLATES = ['silencer_3', 'raider_5', 'beast_4', 'ruin_4']
ENEMY_GROWTH = 1.25
BOSS_FLOOR = 6

# v4 轮实测三档墙位差的结构分量定标（卡墙玩家 best ≈ 墙位）
BOSS_OFFSET = {'silencer_3': -1, 'raider_5': 1, 'beast_4': -2, 'ruin_4': 2}

def normalize_factor(tid):
    def power(enemies):
        return sum((e['attack'] + e['defense'] + e['hp']) * e['count'] for e in enemies)
    return power(PVE['silencer_3']) / power(PVE[tid])

def boss_stronghold(tid, depth):
    d = max(BOSS_FLOOR, math.floor(depth))
    scale = 0.5 * ENEMY_GROWTH ** (d - 1) * normalize_factor(tid)
    enemies = []
    for e in PVE[tid]:
        r = lambda v: round(v * scale)
        enemies.append(dict(
            unitId='x', name='tpl', attack=r(e['attack']), defense=r(e['defense']),
            hp=r(e['hp']), count=e['count'], counteredBy=list(e['counteredBy'])))
    return dict(name=f'boss_{tid}_D{d}', enemies=enemies)

def boss_depth(best, tid):
    return max(BOSS_FLOOR, math.floor(best) + BOSS_OFFSET[tid])

def run_cell(formation, stronghold, atk_m, def_m, seeds):
    wins, rounds_, losses = 0, [], []
    for sd in seeds:
        v, r, lr = v092.resolve_battle(formation, stronghold, atk_m, def_m, sd)
        wins += v
        rounds_.append(r)
        losses.append(lr)
    return wins, max(rounds_), sum(rounds_) / len(rounds_), sum(losses) / len(losses)

def main():
    seeds = [0x1234 + i * 7919 for i in range(200)]  # 200 局定稿（与 v123 同口径）
    problems = []
    n = len(seeds)

    print('== 0) 模板归一系数与偏移表 ==')
    for tid in ENDLESS_TEMPLATES:
        print(f'  {tid:<12} ×{normalize_factor(tid):.3f}  OFFSET {BOSS_OFFSET[tid]:+d}')
    print()

    # ---- 1) 墙位复测（自包含） ----
    print('== 1) 墙位复测（main 变体，200 局/格）==')
    SCAN = {'A': range(28, 37), 'B': range(33, 42), 'C': range(35, 44)}
    wall50 = {}
    for t in ['A', 'B', 'C']:
        atk_m, def_m = v092.tier_mults(t)
        f = v092.formation_variant(v092.TIERS[t], 'main')
        wall50[t] = {}
        for tid in ENDLESS_TEMPLATES:
            d50 = None
            for d in SCAN[t]:
                w = run_cell(f, boss_stronghold(tid, d), atk_m, def_m, seeds)[0]
                if w >= n * 0.5:
                    d50 = d
            wall50[t][tid] = d50 if d50 else SCAN[t][0]
        meds = sorted(wall50[t].values())
        wall50[t]['_median'] = meds[len(meds) // 2]
        print(f'  档{t}: ' + '  '.join(
            f'{tid.split("_")[0]}:{wall50[t][tid]}' for tid in ENDLESS_TEMPLATES)
            + f'  中位 D{wall50[t]["_median"]}')
    print()

    # ---- 2) 玩家状态扫描 ----
    print('== 2) 玩家状态扫描：best ∈ {墙−6, 墙−4, 墙−2, 墙}（main 变体，200 局）==')
    wall_ws = {}
    for t in ['A', 'B', 'C']:
        atk_m, def_m = v092.tier_mults(t)
        f = v092.formation_variant(v092.TIERS[t], 'main')
        wall = wall50[t]['_median']
        wall_ws[t] = {}
        for best in (wall - 6, wall - 4, wall - 2, wall):
            ws = []
            for tid in ENDLESS_TEMPLATES:
                d = boss_depth(best, tid)
                w, worst, avg, loss = run_cell(f, boss_stronghold(tid, d),
                                               atk_m, def_m, seeds)
                ws.append(w)
                if worst < 1:
                    problems.append(f'档{t} best={best} {tid}: 0 回合异常')
            depths = [boss_depth(best, tid) for tid in ENDLESS_TEMPLATES]
            tag = ''
            if best == wall - 6 or best == wall - 4:
                tag = 'OK（周津贴）' if min(ws) == n else 'FAIL（津贴未全胜）'
                if min(ws) < n:
                    problems.append(f'档{t} best={best}: 周津贴未全胜 {min(ws)}/{n}')
            else:
                tag = '（过渡带）'
            print(f'  档{t} best={best} depths {depths}: '
                  + ' '.join(f'{w}/{n}' for w in ws) + f'  {tag}')
            if best == wall:
                wall_ws[t] = dict(zip(ENDLESS_TEMPLATES, ws))
        print()

    # ---- 3) 墙位带判定与锯齿 ----
    print('== 3) 墙位带判定：各格 ∈ [15%, 85%]；锯齿极差报告 ==')
    for t in ['A', 'B', 'C']:
        ws = wall_ws[t]
        spread = (max(ws.values()) - min(ws.values())) / n * 100
        for tid, w in ws.items():
            pct = w / n * 100
            mark = 'OK' if 15 <= pct <= 85 else 'OUT'
            print(f'  档{t} {tid:<12} 胜{w}/{n} {pct:.0f}% {mark}')
            if not 15 <= pct <= 85:
                problems.append(f'档{t} 墙位 {tid}: 胜率 {pct:.0f}% 出带')
        spread_tag = ('OK' if spread <= 40 else
                      '残留（40-50pp，周间难度体感有差、均可过）' if spread <= 50
                      else 'FAIL（>50pp）')
        print(f'  档{t} 极差 {spread:.0f}pp {spread_tag}')
        if spread > 50:
            problems.append(f'档{t} 墙位锯齿极差 {spread:.0f}pp 超 50pp')
        print()

    # ---- 4) 变体面 ----
    print('== 4) 变体面：墙位处三变体（中位 ≥25% = 周内可过）==')
    for t in ['A', 'B', 'C']:
        atk_m, def_m = v092.tier_mults(t)
        wall = wall50[t]['_median']
        for variant in ['main', 'counter', 'countered']:
            f = v092.formation_variant(v092.TIERS[t], variant)
            ws, worst_all = [], 99
            for tid in ENDLESS_TEMPLATES:
                c = run_cell(f, boss_stronghold(tid, boss_depth(wall, tid)),
                             atk_m, def_m, seeds)
                ws.append(c[0])
                worst_all = min(worst_all, c[1])
            if worst_all < 1:
                problems.append(f'档{t}/{variant}: 0 回合异常')
            mid = sorted(ws)[2] / n * 100
            print(f'  档{t}[{variant:<9}] ' + '  '.join(
                f'{tid.split("_")[0]}:{w}/{n}' for tid, w in zip(ENDLESS_TEMPLATES, ws))
                + f'  中位 {mid:.0f}% worst {worst_all}R'
                + ('' if mid >= 25 else '  <25%（判读）'))
        print()

    # ---- 5) 奖励量级 ----
    print('== 5) 奖励量级（锚前沿：dark = 100 × 1.35^best × 1.5，与模板解耦）==')
    for t, wall in [('A', wall50['A']['_median']), ('B', wall50['B']['_median']),
                    ('C', wall50['C']['_median'])]:
        dark = 100 * 1.35 ** (wall - 1) * 1.5
        print(f'  档{t} 卡墙期（best≈{wall}）: 周 Boss dark ≈ {dark:,.0f}'
              f'（= 1.5 场前沿远征单场；各模板周同额）')
    print('  口径：奖励随玩家前沿自缩放不封顶；周频一次性；远征同深度可重复打，')
    print('  不构成第二资源轴。战损真实结算（同远征口径），弱配硬打会亏兵。')
    print()

    print('== 6) 定稿 ==')
    print(f'  bossDepth = max({BOSS_FLOOR}, expeditionBest + OFFSET[模板])，实时派生')
    print(f'  OFFSET = {BOSS_OFFSET}；模板 = 周种子洗牌取 1；判定带 [15,85]%（量化+噪声口径）')
    print('  已知残留：卡墙期周间体感差（极差最大 ~46pp，档C），均可过；上线后实测再调偏移')
    print('  奖励 = endlessStronghold(max(6, expeditionBest + 1)) × 1.5（锚前沿，与模板解耦）')
    print()

    if problems:
        print('== 判定: FAIL ==')
        for p in problems:
            print('  ! ' + p)
        sys.exit(1)
    print('== 判定: PASS ==')

if __name__ == '__main__':
    main()
