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
  档 B 中位（深空中段）：科技 59 满(攻防×3.80859，含深空统帅×1.25)
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
  第 1 轮初值 FAIL：档B counter 变体终章 3R——主脑池 2.4e7 过厚，
    克制池（主脑+君王+壁垒）3.27e7，随机目标摊薄在单种子放大。
  第 2 轮 FAIL：杂兵微削（哨卫 12→10、守望 20→16）未触根因——拖轮在克制池
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

# ---------- 玩家兵种（units.ts） ----------
UNITS = {
    'assault': dict(attack=12, defense=5,  hp=60,  counterMult=1.5),
    'guard':   dict(attack=8,  defense=12, hp=120, counterMult=1.5),
    'heavy':   dict(attack=20, defense=12, hp=200, counterMult=1.5),
    'psionic': dict(attack=35, defense=8,  hp=150, counterMult=2.0),
}

# ---------- 遗物强化 ----------
def enhance(v, gain, lv):
    return 1 + (v - 1) * (1 + gain * lv)

def relic_mults(lv):
    atk = (enhance(1.4, 0.04, lv) * enhance(1.3, 0.04, lv)
           * enhance(1.05, 0.04, lv) * 1.10)
    dfn = enhance(1.2, 0.04, lv) * enhance(1.15, 0.04, lv)
    return atk, dfn

# ---------- 三档乘数（全部连乘） ----------
def tier_mults(name):
    ach    = 1.05 * 1.08 * 1.12 * 1.05 * 1.08 * 1.02  # 成就面攻防 ×1.469（终层无新攻防成就）
    t_c1   = 1.3
    inf_lv = {'A': 8, 'B': 10, 'C': 12}[name]
    t_inf  = 1.05 ** inf_lv
    rel_lv = {'A': 16, 'B': 18, 'C': 20}[name]
    tech   = 3.046875 if name == 'A' else 3.80859     # A=55满(星系终配), B/C=59满(含×1.25)
    r_atk, r_def = relic_mults(rel_lv)
    atk = tech * ach * t_c1 * t_inf * r_atk
    dfn = tech * ach * t_c1 * t_inf * r_def
    return atk, dfn

TIERS = {
    'A': dict(assault=8000,  guard=6400,  heavy=6400,  psionic=3200),
    'B': dict(assault=16000, guard=12400, heavy=12400, psionic=6200),
    'C': dict(assault=26000, guard=20000, heavy=20000, psionic=10400),
}

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

# ---------- 新据点敌人编成（v0.92 设计定稿，强度带 9.98e6–3.29e7） ----------
STRONGHOLDS = {
    'raider_12': dict(name='虚空掠夺者旗舰', enemies=[
        dict(unitId='raider_phantom',    name='虚空快艇',     attack=299,  defense=149, hp=2176,  count=900, counteredBy=['assault']),
        dict(unitId='raider_cruiser',    name='虚空巡洋舰',   attack=612,  defense=299, hp=6528,  count=400, counteredBy=['heavy']),
        dict(unitId='raider_sentinel',   name='虚空哨舰',     attack=762,  defense=462, hp=21760, count=80,  counteredBy=['guard', 'psionic']),
        dict(unitId='raider_dreadnought',name='劫掠无畏舰',   attack=3264, defense=1904,hp=81600, count=30,  counteredBy=['guard', 'psionic']),
        dict(unitId='hive_tyrant',       name='母巢暴君',     attack=2040, defense=1224,hp=244800,count=5,   counteredBy=['guard', 'psionic']),
    ]),
    'beast_8': dict(name='虚空白鲸群', enemies=[
        dict(unitId='void_matriarch',    name='虚空白鲸母兽', attack=1900, defense=700, hp=150000,count=5,   counteredBy=['guard', 'psionic']),
        dict(unitId='void_weaver',       name='虚空织网兽',   attack=480,  defense=190, hp=5800,  count=100, counteredBy=['assault']),
        dict(unitId='void_spawn',        name='虚空幼鲸',     attack=280,  defense=110, hp=2900,  count=200, counteredBy=['heavy']),
        dict(unitId='void_leviathan',    name='噬星利维坦',   attack=2500, defense=900, hp=400000,count=4,   counteredBy=['guard', 'psionic']),
        dict(unitId='star_whale_king',   name='虚空白鲸王',   attack=6000, defense=2300,hp=1350000,count=7,  counteredBy=['guard', 'psionic']),
    ]),
    'ruin_8': dict(name='先驱者归航港', enemies=[
        dict(unitId='pantheon_core',     name='万神殿核心',   attack=2300, defense=1550,hp=480000,count=20,  counteredBy=['guard', 'psionic']),
        dict(unitId='archon_core',       name='归航港核心',   attack=1750, defense=1150,hp=230000,count=12,  counteredBy=['guard', 'psionic']),
        dict(unitId='beacon_sentinel',   name='港卫哨卫',     attack=870,  defense=620, hp=58000, count=45,  counteredBy=['heavy']),
        dict(unitId='precursor_warden',  name='先驱守灵',     attack=580,  defense=350, hp=17500, count=130, counteredBy=['assault']),
        dict(unitId='ruin_drone',        name='遗迹无人机',   attack=290,  defense=155, hp=2900,  count=260, counteredBy=['heavy']),
        dict(unitId='void_drone_king',   name='虚空白蚁后',   attack=3100, defense=1500,hp=420000,count=3,   counteredBy=['guard', 'psionic']),
    ]),
    'raider_13': dict(name='深空裁决军团', enemies=[
        dict(unitId='raider_emperor',    name='深空主宰',     attack=4400, defense=2600,hp=680000,count=14,  counteredBy=['guard', 'psionic']),
        dict(unitId='hive_tyrant',       name='母巢暴君',     attack=1500, defense=900, hp=180000,count=10,  counteredBy=['guard', 'psionic']),
        dict(unitId='brood_carrier',     name='育群航母',     attack=700,  defense=450, hp=60000, count=18,  counteredBy=['heavy']),
        dict(unitId='raider_elite_flt',  name='精锐舰群',     attack=350,  defense=200, hp=2500,  count=300, counteredBy=['assault']),
        dict(unitId='raider_dreadnought',name='劫掠无畏舰',   attack=2400, defense=1400,hp=60000, count=32,  counteredBy=['guard', 'psionic']),
    ]),
    'silencer_7': dict(name='沉默者回响', enemies=[
        dict(unitId='silencer_echo',     name='沉默者回响',   attack=9000, defense=3100,hp=23000000,count=1, counteredBy=['guard', 'psionic']),
        dict(unitId='silencer_warden_lord',name='回响君王',   attack=6500, defense=2300,hp=7500000,count=1, counteredBy=['guard', 'psionic']),
        dict(unitId='void_bastion',      name='虚空壁垒',     attack=3700, defense=1400,hp=580000, count=2, counteredBy=['guard', 'psionic']),
        dict(unitId='silencer_sentinel', name='守门哨卫',     attack=1550, defense=770, hp=77000,  count=9, counteredBy=['heavy']),
        dict(unitId='silencer_warden',   name='沉默守望者',   attack=970,  defense=580, hp=38500,  count=14, counteredBy=['assault']),
    ]),
}
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
    print('== 三档乘数（连乘实测）==')
    mults = {}
    for t in 'ABC':
        a, d = tier_mults(t)
        mults[t] = (a, d)
        rel_lv = {'A': 16, 'B': 18, 'C': 20}[t]
        ra, rd = relic_mults(rel_lv)
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
