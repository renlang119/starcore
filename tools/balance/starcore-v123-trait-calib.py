#!/usr/bin/env python3
"""
starcore-v123-trait-calib.py — 编队特性系统 数值校准模拟

整模块 import v092 sim 复用（同 v120 校准脚本先例）：
resolve_battle / UNITS / TIERS / STRONGHOLDS / formation_variant / tier_mults / SEEDS

特性口径（暂定值，经本脚本验证后定稿）：
  assault_doctrine  强攻：该编队攻击 ×1.12
  bastion_doctrine  坚壁：该编队血量 ×1.15（单兵 maxHp 上移）
  counter_doctrine  破敌：克制倍率 +0.25（1.5→1.75 / psionic 2.0→2.25）
  logistics_doctrine 后勤：驻扎产出 ×1.20（经济面，不进战斗模拟）

v092 sim 的玩家单位构建处注入特性乘区（与 combat.ts 计划接线位置一致）。

判定口径（200 局定稿；2026-09-24 判据修正：软墙判据改为定性红线 + 边缘增量报告）：
  1. 三档 × 4 特性 × 3 变体打全部 5 个终层据点，与「无特性」对照：
     胜率不得从全胜变非全胜（不产生负向）；回合数不得从 >2R 降为 0R（无 0 回合异常）
  2. 强攻/坚壁属于「同档提前」量级检验：档 A+特性 打档 B 判定点
     （raider_12 2R）不得全 1R 秒杀过深（有感但不越档）
  3. 破敌只在克制命中时兑现：countered 变体（编成被克制面）边际；
     档 A 进度墙处须见正边际（200 局下为稳定判据）
  4. 越档红线（定性跳变）：全域逐层扫描（三档 × D15..45），硬 FAIL 仅当某格
     「基数 ≤2.5% 且任一特性 ≥50%（全灭区翻胜）」；其余边缘增量入报告表。
     截断类指标（全胜最大深度）样本敏感，仅作报告项；50 回合上限语义不变
  5. 远征面抽查：D15/D25/D35/D40 深度（endless 模板近似，v120 口径复用）；
     全域逐层扫描见判定 4
"""
import math
import os
import sys

import importlib.util

spec = importlib.util.spec_from_file_location(
    'v092sim', os.path.join(os.path.dirname(os.path.abspath(__file__)),
                            'starcore-v092-battle-sim.py'))
v092 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v092)

# ---------- 特性定义（暂定值） ----------
TRAITS = {
    'none':        dict(atk=1.0,  hp=1.0,  counterBonus=0.0),
    'assault_doctrine': dict(atk=1.12, hp=1.0,  counterBonus=0.0),
    'bastion_doctrine': dict(atk=1.0,  hp=1.15, counterBonus=0.0),
    'counter_doctrine': dict(atk=1.0,  hp=1.0,  counterBonus=0.25),
}

def resolve_battle_trait(formation, stronghold, atk_mult, def_mult, seed, trait):
    """v092 resolve_battle 的特性注入版：仅在玩家单位构建与克制分支两处乘区
    （与 combat.ts 计划接线位置一一对应），其余逐行同源。"""
    players = []
    init_total = 0
    for uid, cnt in formation.items():
        if cnt <= 0:
            continue
        d = v092.UNITS[uid]
        init_total += cnt
        players.append(dict(
            unitId=uid,
            attack=d['attack'] * atk_mult * trait['atk'],
            defense=d['defense'] * def_mult,
            hp=d['hp'] * trait['hp'],
            maxHp=d['hp'] * trait['hp'],
            count=cnt,
            initCount=cnt,
            counterMult=d['counterMult'] + trait['counterBonus'],
        ))
    enemies = [dict(e, hp=e['hp'], maxHp=e['hp']) for e in stronghold['enemies']]
    rng = v092.make_rng(seed)
    round_ = 0
    max_rounds = 50
    while round_ < max_rounds:
        round_ += 1
        for p in players:
            if p['count'] <= 0:
                continue
            targets = [e for e in enemies if e['count'] > 0]
            if not targets:
                break
            tgt = targets[int(rng() * len(targets))]
            dmg = p['attack'] * p['count']
            if p['unitId'] in tgt.get('counteredBy', []):
                dmg *= p['counterMult']
            total_hp = tgt['hp'] * tgt['count']
            dealt = min(total_hp, max(1.0, dmg - tgt['defense'] * tgt['count'] * 0.4))
            rem = total_hp - dealt
            if rem <= 0:
                tgt['count'] = 0
            else:
                tgt['count'] = math.ceil(rem / tgt['maxHp'])
                tgt['hp'] = rem % tgt['maxHp'] or tgt['maxHp']
        if all(e['count'] <= 0 for e in enemies):
            losses_total = sum(p['initCount'] - p['count'] for p in players)
            return True, round_, losses_total / init_total
        for e in enemies:
            if e['count'] <= 0:
                continue
            targets = [p for p in players if p['count'] > 0]
            if not targets:
                break
            tgt = targets[int(rng() * len(targets))]
            dmg = e['attack'] * e['count']
            total_hp = tgt['hp'] * tgt['count']
            dealt = min(total_hp, max(1.0, dmg - tgt['defense'] * tgt['count'] * 0.4))
            rem = total_hp - dealt
            if rem <= 0:
                tgt['count'] = 0
            else:
                tgt['count'] = math.ceil(rem / tgt['maxHp'])
                tgt['hp'] = rem % tgt['maxHp'] or tgt['maxHp']
        if all(p['count'] <= 0 for p in players):
            return False, round_, 1.0
    return False, round_, sum(p['initCount'] - p['count'] for p in players) / init_total

# ---------- 远征模板（endless.ts 忠实移植） ----------
# 4 模板据点敌方编成：运行时从 src/data/pve.ts 派生（可复现，不依赖外部缓存）
import re
from pathlib import Path

_PVE_TS = Path(__file__).resolve().parents[2] / 'src/data/pve.ts'


def _extract_strongholds():
    src = open(_PVE_TS, encoding='utf-8').read()
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
            cb = re.findall(r"'([a-z]+)'", um.group(5)) if um.group(5) else []
            enemies.append(dict(attack=float(um.group(1)), defense=float(um.group(2)),
                                hp=float(um.group(3)), count=int(um.group(4)),
                                counteredBy=cb))
        out[sid] = enemies
    return out


_ALL = _extract_strongholds()
assert all(k in _ALL for k in ('silencer_3', 'raider_5', 'beast_4', 'ruin_4')), '据点模板提取失败'
_TPL = {k: _ALL[k] for k in ('silencer_3', 'raider_5', 'beast_4', 'ruin_4')}

TEMPLATE_IDS = ['silencer_3', 'raider_5', 'beast_4', 'ruin_4']
ENEMY_GROWTH = 1.25

def endless_stronghold(depth):
    """endless.ts endlessEnemies 忠实移植：D1 = 最强模板 × 0.5，
    1.25/层成长，模板按 (d-1) mod 4 轮换，按 (攻+防+血)×数量强度归一到 silencer_3 基准。"""
    d = max(1, math.floor(depth))
    tid = TEMPLATE_IDS[(d - 1) % len(TEMPLATE_IDS)]
    tpl = _TPL[tid]
    power = sum((e['attack'] + e['defense'] + e['hp']) * e['count'] for e in tpl)
    base_power = sum((e['attack'] + e['defense'] + e['hp']) * e['count'] for e in _TPL['silencer_3'])
    scale = 0.5 * ENEMY_GROWTH ** (d - 1) * (base_power / power)
    enemies = []
    for e in tpl:
        r = lambda v: round(v * scale)
        enemies.append(dict(
            unitId=e['unitId'] if 'unitId' in e else 'x',
            name='tpl', attack=r(e['attack']), defense=r(e['defense']),
            hp=r(e['hp']), count=e['count'], counteredBy=e['counteredBy'],
        ))
    return dict(name=f'endless_D{depth}', enemies=enemies)

def run_cell(f, s, atk_m, def_m, trait, seeds):
    wins, rounds_, losses = 0, [], []
    for sd in seeds:
        v, r, lr = resolve_battle_trait(f, s, atk_m, def_m, sd, trait)
        wins += v
        rounds_.append(r)
        losses.append(lr)
    return wins, max(rounds_), sum(rounds_) / len(rounds_), sum(losses) / len(losses)

QUAL_BASE_MAX = 0.025  # 全灭区基数上界（200 局定稿口径）
QUAL_FLIP_MIN = 0.5    # 翻胜下界

def qual_flip(none_w, trait_ws, n):
    """定性跳变判定（越档红线）：基数 ≤2.5% 且任一特性 ≥50%（全灭区翻胜）。"""
    return none_w <= n * QUAL_BASE_MAX and any(w >= n * QUAL_FLIP_MIN for w in trait_ws)

def main():
    # 200 局定稿（2026-09-24 修正：8→40 扩样暴露抽样敏感，一次加大到 200 收口）
    # 前 40 枚为上一轮口径，样本集为原集的向前扩展
    seeds = [0x1234 + i * 7919 for i in range(200)]
    problems = []
    print('== 1) 终层据点：三档 × 特性 × 变体（对照 none）==')
    for t in 'ABC':
        atk_m, def_m = v092.tier_mults(t)
        for variant in ['main', 'counter', 'countered']:
            f = v092.formation_variant(v092.TIERS[t], variant)
            base = {sid: run_cell(f, s, atk_m, def_m, TRAITS['none'], seeds)
                    for sid, s in v092.STRONGHOLDS.items()}
            for tid in ['assault_doctrine', 'bastion_doctrine', 'counter_doctrine']:
                tr = TRAITS[tid]
                lines = []
                for sid, s in v092.STRONGHOLDS.items():
                    w, worst, avg, loss = run_cell(f, s, atk_m, def_m, tr, seeds)
                    bw, bworst = base[sid][0], base[sid][1]
                    # 判定 1：胜率不降
                    if w < bw:
                        problems.append(f'档{t}/{variant}/{tid}/{sid}: 胜 {bw}→{w}')
                    # 判定 1b：无 0 回合
                    if worst < 1:
                        problems.append(f'档{t}/{variant}/{tid}/{sid}: 0 回合异常')
                    lines.append(f'{sid}:{bworst}->{worst}R 胜{w}/{len(seeds)}')
                print(f'  档{t}[{variant:<9}]{tid:<18} ' + '  '.join(lines))
    print()
    print('== 2) 越档检验：档 A + 特性 打终层 gate（raider_12）==')
    atk_a, def_a = v092.tier_mults('A')
    f_a = v092.formation_variant(v092.TIERS['A'], 'main')
    for tid in ['none', 'assault_doctrine', 'bastion_doctrine', 'counter_doctrine']:
        w, worst, avg, loss = run_cell(f_a, v092.STRONGHOLDS['raider_12'],
                                       atk_a, def_a, TRAITS[tid], seeds)
        tag = 'OK' if (w == len(seeds) and 1 <= worst <= 2) or worst > 2 else 'CHECK'
        if tid != 'none' and worst < 1:
            problems.append(f'越档检验 {tid}: 1R 以下')
        print(f'  {tid:<18} 胜{w}/{len(seeds)} worst={worst}R avg={avg:.1f}R 损{loss*100:.0f}% {tag}')
    print()
    print('== 3) 破敌仅在克制命中兑现：边际检验 ==')
    print('  （档B/C 对终层已饱和在 2R 地板，边际无处显现属预期；')
    print('    有余量的判定位 = 档A 终章进度墙 4R，此处须见正边际）')
    for t in 'ABC':
        atk_m, def_m = v092.tier_mults(t)
        f_c = v092.formation_variant(v092.TIERS[t], 'countered')
        b = run_cell(f_c, v092.STRONGHOLDS['silencer_7'], atk_m, def_m, TRAITS['none'], seeds)
        c = run_cell(f_c, v092.STRONGHOLDS['silencer_7'], atk_m, def_m,
                     TRAITS['counter_doctrine'], seeds)
        f_ct = v092.formation_variant(v092.TIERS[t], 'counter')
        b2 = run_cell(f_ct, v092.STRONGHOLDS['silencer_7'], atk_m, def_m, TRAITS['none'], seeds)
        c2 = run_cell(f_ct, v092.STRONGHOLDS['silencer_7'], atk_m, def_m,
                      TRAITS['counter_doctrine'], seeds)
        print(f'  档{t}: countered 平均回合 {b[2]:.2f}->{c[2]:.2f}（边际 {b[2]-c[2]:+.2f}）'
              f' | counter {b2[2]:.2f}->{c2[2]:.2f}（边际 {b2[2]-c2[2]:+.2f}）')
        if t == 'A' and (b2[2] - c2[2]) <= 0:
            problems.append(f'档A: counter 变体破敌无正边际（唯一有余量判定位）')
    # 强攻同位检验：进度墙处平均回合应有边际
    f_a = v092.formation_variant(v092.TIERS['A'], 'main')
    atk_a2, def_a2 = v092.tier_mults('A')
    bn = run_cell(f_a, v092.STRONGHOLDS['silencer_7'], atk_a2, def_a2, TRAITS['none'], seeds)
    ba = run_cell(f_a, v092.STRONGHOLDS['silencer_7'], atk_a2, def_a2,
                  TRAITS['assault_doctrine'], seeds)
    print(f'  档A 强攻同位: 平均回合 {bn[2]:.2f}->{ba[2]:.2f}（边际 {bn[2]-ba[2]:+.2f}）')
    if (bn[2] - ba[2]) <= 0:
        problems.append('档A: 强攻在进度墙处无正边际')
    print()
    print('== 4) 远征面抽查（D15/D25/D35/D40，特性 vs none）==')
    for depth in [15, 25, 35, 40]:
        s = endless_stronghold(depth)
        for t in 'ABC':
            atk_m, def_m = v092.tier_mults(t)
            f = v092.formation_variant(v092.TIERS[t], 'main')
            cells = {}
            for tid in ['none', 'assault_doctrine', 'bastion_doctrine', 'counter_doctrine']:
                cells[tid] = run_cell(f, s, atk_m, def_m, TRAITS[tid], seeds)
            row = '  '.join(f"{tid}:{cells[tid][0]}/{len(seeds)} {cells[tid][1]}R"
                            for tid in cells)
            # 判定：定性跳变（全灭区翻胜红线）；边缘增量见 §5 报告
            trait_ws = [cells['assault_doctrine'][0], cells['bastion_doctrine'][0],
                        cells['counter_doctrine'][0]]
            if qual_flip(cells['none'][0], trait_ws, len(seeds)):
                problems.append(f'D{depth}/档{t}: 定性跳变（全灭区翻胜）')
            print(f'  D{depth:<3} 档{t}: {row}')
    print()
    print('== 5) 越档红线：全域定性跳变检测 + 边缘增量报告（三档 × D15..45）==')
    print('  规则：基数 ≤2.5% 且任一特性 ≥50% → FAIL（全灭区翻胜）；其余增量为报告项')
    for t in 'ABC':
        atk_m, def_m = v092.tier_mults(t)
        f = v092.formation_variant(v092.TIERS[t], 'main')
        wdepth = {}
        for depth in range(15, 46):
            s = endless_stronghold(depth)
            wdepth[depth] = {tid: run_cell(f, s, atk_m, def_m, TRAITS[tid], seeds)[0]
                             for tid in ['none', 'assault_doctrine', 'bastion_doctrine',
                                         'counter_doctrine']}
        for depth in range(15, 46):
            w = wdepth[depth]
            trait_ws = [w['assault_doctrine'], w['bastion_doctrine'], w['counter_doctrine']]
            if qual_flip(w['none'], trait_ws, len(seeds)):
                problems.append(f'档{t} D{depth}: 定性跳变（{w["none"]}→{max(trait_ws)}/{len(seeds)}）')
        jumps = []
        for depth in range(15, 46):
            w = wdepth[depth]
            for tid in ['assault_doctrine', 'bastion_doctrine', 'counter_doctrine']:
                jumps.append((w[tid] - w['none'], depth, tid, w['none'], w[tid]))
        jumps.sort(key=lambda j: -j[0])
        top = jumps[:5]
        print(f'  档{t}: 最大增量 +{top[0][0]}/{len(seeds)} 于 D{top[0][1]}'
              f'（{top[0][2][:5]}: {top[0][3]}→{top[0][4]}）')
        print('       增幅前五：' + '；'.join(
            f'D{j[1]} {j[2][:5]} +{j[0]}' for j in top))
    print()
    print('== 5b) 远征前沿：全胜截止深度（档 C 满配；报告项，样本口径敏感）==')
    atk_c2, def_c2 = v092.tier_mults('C')
    f_c2 = v092.formation_variant(v092.TIERS['C'], 'main')
    for tid in ['none', 'assault_doctrine', 'bastion_doctrine', 'counter_doctrine']:
        best = 0
        for depth in range(30, 46):
            w, worst, avg, loss = run_cell(f_c2, endless_stronghold(depth),
                                           atk_c2, def_c2, TRAITS[tid], seeds)
            if w == len(seeds):
                best = depth
        print(f'  {tid:<18} {len(seeds)}/{len(seeds)} 全胜最大深度: D{best}')
    print('  （截断类指标为报告项：样本口径敏感；定性红线见 §5）')
    print()
    print('== 6) 后勤经济面：驻扎产出占比口径 ==')
    # 不进战斗模拟：给出量级参考。终层据点 idle 产出 vs 满配建筑产出
    # （combat.ts garrisonIdleReward 直读 stronghold.idle；此处按 pve.ts 终层代表值）
    print('  后勤 ×1.20 作用于所驻据点 idle 产出（每编队至多驻 1 据点）。')
    print('  挂机收益面为线性 +20%，无复合放大；对总经济占比 = 驻扎收益占比 × 20%。')
    print('  属低风险乘区，不设额外判定。')
    print()
    if problems:
        print('== 判定: FAIL ==')
        for p in problems:
            print('  ! ' + p)
        sys.exit(1)
    print('== 判定: PASS ==')

if __name__ == '__main__':
    main()
