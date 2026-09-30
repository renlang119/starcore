#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
starcore-v126-encounter-ev.py — 随机遭遇事件 EV 核验表

对设计稿的 10 个事件模板做程序化断言：
  1. 每事件两选项 EV 差 <= 15%（以 max(EV_A, EV_B) 为基）
  2. 能量当量落 [4.4e3, 1.2e5] 量级带（「顺路的糖」口径，对照签到 2e4-1e5）
  3. 每选项概率分布归一（Σp = 1）
  4. 资源数值非负整数、暗物质个位数（损失类结果允许负合金，至多扣空）
  5. 赌注类方差显著大于资源类（结果跨度 / EV >= 1.0，资源类 < 1.0）

折算率（设计声明，非市场价）：
  1 合金   = 1 能量    —— 依据：重装兵训练成本 120 能量 + 60 合金 + 10 数据
  1 数据   = 6 能量    —— 依据：同上，60 合金 : 10 数据 比价
  1 暗物质 = 8000 能量 —— 依据：据点奖励带 energy/dark = 1e4/5e3/6.7e3/1e4 中值
  1 突击兵 = 60 能量当量 —— 依据：训练成本 50 能量 + 10 合金

演进记录：
  - 2026-09-24 v1：初版 10 模板定稿核验。
"""

# 折算率（能量当量）
RATE = {"energy": 1, "alloy": 1, "data": 6, "dark": 8000, "unit_assault": 60}

# 量级带（能量当量）
BAND_MIN = 4.4e3
BAND_MAX = 1.2e5

# EV 差上限
EV_GAP_MAX = 0.15

# 赌注类方差门槛：结果跨度（max-min）/ EV
GAMBLE_SPREAD_MIN = 1.0
RESOURCE_SPREAD_MAX = 1.0

# ---- 10 模板数值表（与设计稿同源；outcomes = [(p, {资源: 数量}), ...]) ----
ENCOUNTERS = [
    # —— 资源类 4 ——
    {
        "id": "enc_flux", "flavor": "resource", "name": "能量涌流",
        "optA": {"label": "就地收集", "outcomes": [(1.0, {"energy": 8000})]},
        "optB": {"label": "引导汇聚", "outcomes": [(0.80, {"energy": 10600}), (0.20, {"energy": 3400})]},
    },
    {
        "id": "enc_vein", "flavor": "resource", "name": "合金矿脉",
        "optA": {"label": "标准开采", "outcomes": [(1.0, {"alloy": 4800})]},
        "optB": {"label": "定向爆破", "outcomes": [(0.80, {"alloy": 6300}), (0.20, {"alloy": 1500})]},
    },
    {
        "id": "enc_signal", "flavor": "resource", "name": "数据截获",
        "optA": {"label": "完整破译", "outcomes": [(1.0, {"data": 900})]},
        "optB": {"label": "快速扫描", "outcomes": [(0.50, {"data": 1450}), (0.50, {"data": 550})]},
    },
    {
        "id": "enc_depot", "flavor": "resource", "name": "破损补给舱",
        "optA": {"label": "小心回收", "outcomes": [(1.0, {"energy": 6000, "alloy": 400})]},
        "optB": {"label": "加压拖曳", "outcomes": [(0.65, {"energy": 9200, "alloy": 600}), (0.35, {"energy": 2500, "alloy": 300})]},
    },
    # —— 军事类 2 ——
    {
        "id": "enc_salvage", "flavor": "military", "name": "残骸回收",
        "optA": {"label": "拆解装甲", "outcomes": [(1.0, {"alloy": 2800, "data": 280})]},
        "optB": {"label": "赌一把武器核心", "outcomes": [(0.60, {"alloy": 6400, "data": 400}), (0.40, {"alloy": -1400})]},
    },
    {
        "id": "enc_recruit", "flavor": "military", "name": "流浪编队",
        "optA": {"label": "收编入伍", "outcomes": [(1.0, {"unit_assault": 80})]},
        "optB": {"label": "收下装备", "outcomes": [(1.0, {"energy": 4400, "alloy": 400})]},
    },
    # —— 探索类 1 ——
    {
        "id": "enc_beacon", "flavor": "explore", "name": "未知信标",
        "optA": {"label": "解码数据核", "outcomes": [(1.0, {"data": 90, "dark": 1})]},
        "optB": {"label": "抽出能源芯", "outcomes": [(0.85, {"energy": 9600}), (0.15, {"energy": 2000})]},
    },
    # —— 赌注类 3 ——
    {
        "id": "enc_well", "flavor": "gamble", "name": "暗捕获井",
        "optA": {"label": "安全封井", "outcomes": [(1.0, {"energy": 7000})]},
        "optB": {"label": "强行重启", "outcomes": [(0.35, {"energy": 22000}), (0.65, {})]},
    },
    {
        "id": "enc_core", "flavor": "gamble", "name": "曲率核心",
        "optA": {"label": "稳妥切割", "outcomes": [(1.0, {"alloy": 4400})]},
        "optB": {"label": "完整起爆", "outcomes": [(0.50, {"alloy": 9600}), (0.25, {"alloy": 2000}), (0.25, {"alloy": -1300})]},
    },
    {
        "id": "enc_wager", "flavor": "gamble", "name": "深空赌局",
        "optA": {"label": "收下开价", "outcomes": [(1.0, {"energy": 4400, "alloy": 400})]},
        "optB": {"label": "接受赌局", "outcomes": [(0.40, {"energy": 12000}), (0.60, {})]},
    },
]


def ev(outcomes):
    return sum(p * sum(RATE[k] * v for k, v in rew.items()) for p, rew in outcomes)


def spread(outcomes):
    vals = [sum(RATE[k] * v for k, v in rew.items()) for _, rew in outcomes]
    return max(vals) - min(vals)


def fmt_res(rew):
    order = ["energy", "alloy", "data", "dark", "unit_assault"]
    zh = {"energy": "能量", "alloy": "合金", "data": "数据", "dark": "暗物质", "unit_assault": "突击兵"}
    parts = []
    for k in order:
        if k in rew:
            parts.append(f"{rew[k]:+d} {zh[k]}" if rew[k] < 0 else f"+{rew[k]} {zh[k]}")
    return " ".join(parts) if parts else "无收获"


def main():
    failures = []
    rows = []
    flavor_count = {}
    for enc in ENCOUNTERS:
        eid, flavor = enc["id"], enc["flavor"]
        flavor_count[flavor] = flavor_count.get(flavor, 0) + 1
        ev_a, ev_b = ev(enc["optA"]["outcomes"]), ev(enc["optB"]["outcomes"])
        gap = abs(ev_a - ev_b) / max(ev_a, ev_b)
        # 断言 1：EV 差
        if gap > EV_GAP_MAX:
            failures.append(f"{eid}: EV 差 {gap:.1%} > {EV_GAP_MAX:.0%}（A={ev_a:.0f} B={ev_b:.0f}）")
        # 断言 2：量级带（两选项 EV 均入带）
        for name, v in (("A", ev_a), ("B", ev_b)):
            if not (BAND_MIN <= v <= BAND_MAX):
                failures.append(f"{eid} 选项{name}: 当量 {v:.0f} 出带 [{BAND_MIN:.0f}, {BAND_MAX:.0f}]")
        # 断言 3：概率归一
        for name, opt in (("A", enc["optA"]), ("B", enc["optB"])):
            s = sum(p for p, _ in opt["outcomes"])
            if abs(s - 1.0) > 1e-9:
                failures.append(f"{eid} 选项{name}: 概率和 {s} != 1")
        # 断言 4：数值形态（非负整数；负合金仅限损失结果且暗物质恒非负个位）
        for name, opt in (("A", enc["optA"]), ("B", enc["optB"])):
            for p, rew in opt["outcomes"]:
                for k, v in rew.items():
                    if not isinstance(v, int):
                        failures.append(f"{eid} 选项{name}: {k} 非整数 {v}")
                    if k == "dark" and not (0 <= v <= 9):
                        failures.append(f"{eid} 选项{name}: 暗物质 {v} 超个位带")
                    if k == "unit_assault" and v <= 0:
                        failures.append(f"{eid} 选项{name}: 发兵量 {v} 非正")
                    if v < 0 and k != "alloy":
                        failures.append(f"{eid} 选项{name}: {k} 负值仅允许合金（损失类）")
        # 断言 5：方差特征
        sp_a, sp_b = spread(enc["optA"]["outcomes"]), spread(enc["optB"]["outcomes"])
        ratio_b = sp_b / ev_b if ev_b else 0
        if flavor == "gamble" and ratio_b < GAMBLE_SPREAD_MIN:
            failures.append(f"{eid}: 赌注类方差不足，跨度/EV {ratio_b:.2f} < {GAMBLE_SPREAD_MIN}")
        if flavor in ("resource", "explore") and ratio_b >= RESOURCE_SPREAD_MAX:
            failures.append(f"{eid}: 资源类方差过大，跨度/EV {ratio_b:.2f} >= {RESOURCE_SPREAD_MAX}")
        rows.append((eid, flavor, enc["optA"]["label"], ev_a, enc["optB"]["label"], ev_b, gap, ratio_b))

    # 风味分布
    expect = {"resource": 4, "military": 2, "explore": 1, "gamble": 3}
    if flavor_count != expect:
        failures.append(f"风味分布 {flavor_count} != 预期 {expect}")
    if len(ENCOUNTERS) != 10:
        failures.append(f"模板数 {len(ENCOUNTERS)} != 10")
    ids = [e["id"] for e in ENCOUNTERS]
    if len(set(ids)) != 10:
        failures.append("模板 id 有重复")

    # ---- 核验表输出 ----
    print(f"{'事件':<10}{'风味':<9}{'选项A':<8}{'EV_A':>7}  {'选项B':<10}{'EV_B':>7}  {'EV差':>6}  {'跨度/EV_B':>8}")
    print("-" * 78)
    for eid, flavor, la, eva, lb, evb, gap, rb in rows:
        print(f"{eid:<10}{flavor:<9}{la:<8}{eva:>7.0f}  {lb:<10}{evb:>7.0f}  {gap:>5.1%}  {rb:>8.2f}")
    print("-" * 78)
    print(f"模板数 10（{flavor_count}）；折算率 {RATE}")
    print(f"量级带 [{BAND_MIN:.0f}, {BAND_MAX:.0f}]；EV 差上限 {EV_GAP_MAX:.0%}")
    if failures:
        print(f"\nFAIL {len(failures)} 项：")
        for f in failures:
            print("  -", f)
        raise SystemExit(1)
    print("\nPASS：全部断言通过")


if __name__ == "__main__":
    main()
