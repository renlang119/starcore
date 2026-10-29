#!/usr/bin/env python3
"""
starcore-v092-battle-sim.py — 深空层（v0.92 候选）新据点战斗平衡模拟

忠实移植 src/stores/combat.ts resolveBattle（同 v0.71/v0.90/v0.91 脚本口径）：
  - 伤害 = min(目标组总血, max(1, 攻×数量 − 防×数量×0.4))
  - 克制：敌方 counteredBy 含玩家兵种 id 时 dmg ×= 该兵种 counterMult
    （assault/guard/heavy 1.5，psionic 2.0）；敌方攻击无克制加成
  - 50 回合上限超时判负；mulberry32 种子化（8 个种子取分布）

三档玩家进度（终层口径：档 A = 星系层满配传承，乘数全部连乘实测）：
  档 A 门槛（深空开门档）：科技 55 满(攻防×3.046875) + 成就面全(×1.469)
            + t_combat_1(×1.3) + t_inf_combat L8(×1.05^8) + 遗物强化均 Lv16
  档 B 中位（深空中段）：科技 59 满(攻防×3.80859，含虚空统帅×1.25)
            + 成就面 + t_combat_1 + t_inf_combat L10 + 遗物强化均 Lv18
  档 C 满配：科技 59 满 + 成就面 + t_combat_1 + t_inf_combat L12 + 遗物 5 槽满 Lv20
  遗物代表配装（5 槽）：传说攻 1.4 / 史诗攻防 1.3+1.2 / 稀有防 1.15 /
            普通攻 1.05 / 掠夺者战团满套攻 +10%（套装不强化）
  强化公式：v → 1+(v−1)×(1+0.04×Lv)   （ENHANCE_GAIN combat_mult=0.04）
  兵：A 8000/6400/6400/3200（= v091 档 A ×2，乘数配置承 v091 档 B 满配期）
        B 16000/12400/12400/6200（= v091 档 B ×2；B/A 综合 DPS 比 ≈2.87 承 v091 档差 2.9）
        C 26000/20000/20000/10400（= v091 档 C ×2）

判定标准（v0.91 模板直译）：
  档 A → 仅判 gate 据点 raider_12（≈1.0e7）1–2 回合通过
  档 B → 全 5 据点 1–2 回合通过
  档 C → silencer_7（≈3.29e7）通过且 rounds ≥1（无 0 回合异常）
  非判定项：胜且 ≤3R 视为预期梯度（中部 2-3R / 终章 3-4R = 进度墙）

校准记录（2026-09-14，三轮迭代）：
  第 1 轮初值 FAIL：档B counter 变体终章 3R：主脑池 2.4e7 过厚，
    克制池（主脑+君王+壁垒）3.27e7，随机目标摊薄在单种子放大。
  第 2 轮 FAIL：杂兵微削（哨卫 12→10、守望 20→16）未触根因，拖轮在克制池
    不在杂兵池，档B counter 仍 3R。
  第 3 轮 PASS：主脑 HP 2.4e7→2.3e7 + 哨卫 12→9 + 守望 20→14
    （克制池收至 3.17e7）。
  实测：档A gate 2R 全变体、中部 2-3R、终章 3-4R 进度墙（8 种子多数 4R）；
    档B/C 全据点 2R；损耗上限 9%（档A counter 变体 vs ruin_8，参考值游戏内
    不扣兵）；档C 0R 异常 0。
"""
import math

# ---------- RNG：mulberry32（同 JS 语义，32 位回绕） ----------
M32 = 0xFFFFFFFF

def make_rng(seed: int):
    s = [seed & M32]
    def rng():
        s[0] = (s[0] + 0x6D2B79F5) & M32
        t = s[0]
        t = (t ^ (t >> 15)) * (1 | s[0]) & M32
        t = ((t + ((t ^ (t >> 7)) * (61 | t) & M32)) & M32) ^ t
        t &= M32
        return ((t ^ (t >> 14)) & M32) / 4294967296
    return rng

# ---------- 玩家兵种（units.ts，经 balance-data.json） ----------
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import balance_data as bd

UNITS = {u['id']: u for u in bd.table('units')}

# ---------- 三档画像与乘数（profiles 域，消手抄） ----------
# 兵量与聚值乘数统一经 balance-data.json profiles 域（导出器校准声明 +
# 从 tech/achievements/relics/transcend 域真值连乘推导）；本脚本仅按
# v092 原校准口径做漂移守卫（清单变更即聚值变更，在此拦截）。
PROFILES = bd.table('profiles')
TIERS = {k: dict(v['units']) for k, v in PROFILES['tiers'].items()}
_DERIVED = PROFILES['derived']

# 漂移守卫：科技面 A=3.046875、B/C=3.80859375（原头注 3.80859 为截尾写法，
# 结构断言 B/A 比 == void_command 效果值）；成就面 1.469076；t_inf 1.05^lv
bd.require(bd.approx(_DERIVED['A']['techAtk'], 3.046875, 1e-9), 'profiles: 档 A 科技面漂移')
bd.require(bd.approx(_DERIVED['B']['techAtk'], 3.80859375, 1e-9), 'profiles: 档 B 科技面漂移')
bd.require(bd.approx(_DERIVED['C']['techAtk'], 3.80859375, 1e-9), 'profiles: 档 C 科技面漂移')
bd.require(bd.approx(_DERIVED['B']['techAtk'] / _DERIVED['A']['techAtk'], 1.25, 1e-9),
           'profiles: B/A 科技面比 != void_command(1.25)')
bd.require(bd.approx(_DERIVED['A']['achProduct'], 1.469076, 1e-6), 'profiles: 成就面漂移')
bd.require(bd.approx(_DERIVED['A']['tCombat1'], 1.3, 1e-9), 'profiles: t_combat_1 漂移')
bd.require(bd.approx(_DERIVED['A']['tInf'], 1.05 ** 8, 1e-9), 'profiles: 档 A t_inf 漂移')
bd.require(bd.approx(_DERIVED['C']['tInf'], 1.05 ** 12, 1e-9), 'profiles: 档 C t_inf 漂移')

def tier_mults(name):
    d = _DERIVED[name]
    return d['multsAtk'], d['multsDef']

def formation_variant(base, variant):
    if variant == 'counter':
        f = dict(base); f['guard'] = int(f['guard'] * 1.6); f['psionic'] = int(f['psionic'] * 1.6)
        f['assault'] = int(f['assault'] * 0.6); f['heavy'] = int(f['heavy'] * 0.6)
        return f
    if variant == 'countered':
        f = dict(base); f['assault'] = int(f['assault'] * 1.5); f['heavy'] = int(f['heavy'] * 1.5)
        f['guard'] = int(f['guard'] * 0.6); f['psionic'] = int(f['psionic'] * 0.6)
        return f
    return dict(base)

# ---------- 新据点敌人编成（v0.92 设计定稿，强度带 9.98e6~3.29e7） ----------
# 数值经 balance-data.json（pve.ts 快照）；终层五座参与口径为本脚本的校准选择
_SH = {s['id']: s for s in bd.table('pve')['strongholds']}
_FINAL_IDS = ['raider_12', 'beast_8', 'ruin_8', 'raider_13', 'silencer_7']
bd.require(all(sid in _SH for sid in _FINAL_IDS), '终层据点缺失: ' + ', '.join(sid for sid in _FINAL_IDS if sid not in _SH))
STRONGHOLDS = {sid: dict(name=_SH[sid]['name'], enemies=_SH[sid]['enemies']) for sid in _FINAL_IDS}
# ---------- resolveBattle 忠实移植 ----------
def resolve_battle(formation: dict, stronghold: dict, atk_mult: float, def_mult: float, seed: int):
    """返回 (victory, rounds, losses_total)；战斗为瞬时结算，游戏内不扣兵，
    losses 仅为强度参考（combat.ts 语义一致）"""
    players = []
    init_total = 0
    for uid, cnt in formation.items():
        if cnt <= 0: continue
        d = UNITS[uid]
        init_total += cnt
        players.append(dict(unitId=uid, attack=d['attack'] * atk_mult, defense=d['defense'] * def_mult,
                            hp=d['hp'], maxHp=d['hp'], count=cnt, initCount=cnt, counterMult=d['counterMult']))
    enemies = [dict(e, hp=e['hp'], maxHp=e['hp']) for e in stronghold['enemies']]
    rng = make_rng(seed)
    round_ = 0
    max_rounds = 50
    while round_ < max_rounds:
        round_ += 1
        # 玩家攻击
        for p in players:
            if p['count'] <= 0: continue
            targets = [e for e in enemies if e['count'] > 0]
            if not targets: break
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
        # 敌方攻击（无克制加成）
        for e in enemies:
            if e['count'] <= 0: continue
            targets = [p for p in players if p['count'] > 0]
            if not targets: break
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
    return False, round_, sum(p['initCount'] - p['count'] for p in players) / init_total  # 超时

def power(s):
    return sum((e['attack'] + e['defense'] + e['hp']) * e['count'] for e in s['enemies'])

def hp_pool(s):
    return sum(e['hp'] * e['count'] for e in s['enemies'])

# ---------- 主流程 ----------
if __name__ == '__main__':
    SEEDS = [0x1234 + i * 7919 for i in range(8)]
    print('== 强度总表（Σ(攻+防+血)×数量）==')
    for sid, s in STRONGHOLDS.items():
        print(f'  {sid:<12} {s["name"]:<10} power={power(s):>11,}  HP池={hp_pool(s):>11,}')
    print()
    print('== 三档乘数（profiles 域推导聚值）==')
    mults = {}
    for t in 'ABC':
        a, d = tier_mults(t)
        mults[t] = (a, d)
        rel_lv = PROFILES['tiers'][t]['relicEnhanceLevel']
        ra, rd = _DERIVED[t]['relicAtk'], _DERIVED[t]['relicDef']
        print(f'  档 {t}: 攻 ×{a:.4f} / 防 ×{d:.4f}   (遗物 Lv{rel_lv}: 攻×{ra:.3f} 防×{rd:.3f})')
    print()
    ok_all = True
    JUDGE = {
        'A': {'raider_12': 2},
        'B': {sid: 2 for sid in STRONGHOLDS},
        'C': {'silencer_7': 2},
    }
    for t in 'ABC':
        atk_m, def_m = mults[t]
        print(f'== 档 {t}（兵力 {TIERS[t]}）==')
        for variant in ['main', 'counter', 'countered']:
            f = formation_variant(TIERS[t], variant)
            row = []
            for sid, s in STRONGHOLDS.items():
                rounds_list, loss_list = [], []
                wins = 0
                for sd in SEEDS:
                    v, r, lr = resolve_battle(f, s, atk_m, def_m, sd)
                    rounds_list.append(r); loss_list.append(lr)
                    wins += v
                worst = max(rounds_list)
                avg_loss = sum(loss_list) / len(loss_list)
                limit = JUDGE[t].get(sid)
                if limit is None:
                    flag = 'OK' if wins == len(SEEDS) and worst <= 3 else 'grad'
                else:
                    flag = 'OK' if wins == len(SEEDS) and worst <= limit else '!!'
                if flag == '!!': ok_all = False
                row.append(f'{sid}:{worst}R 损{avg_loss*100:.0f}% {flag}')
            print(f'  [{variant:<9}] ' + '  '.join(row))
        print()
    a_c, d_c = mults['C']
    zero = 0
    for sid, s in STRONGHOLDS.items():
        for sd in SEEDS:
            v, r, lr = resolve_battle(formation_variant(TIERS['C'], 'main'), s, a_c, d_c, sd)
            if r < 1: zero += 1
    print(f'档 C 0 回合异常次数: {zero}（须 0）')
    if zero: ok_all = False
    print('总判定:', 'PASS：A 档 gate 2R、终章进度墙在 3-4R，B/C 档全 2R 无卡点' if ok_all else 'FAIL：存在卡点，需调整编成')
