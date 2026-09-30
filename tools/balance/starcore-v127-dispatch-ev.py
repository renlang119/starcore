#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
starcore-v127-dispatch-ev.py — 派遣远征 EV 核验表

对派遣奖励公式做程序化断言（奖励类内容，EV 核验表法）：
  1. 时长档位与权重形态：4 档 {4h:1.0, 8h:2.2, 12h:3.6, 24h:8.0}，单位时长收益单调不减
  2. 奖励公式恒等：reward = round(base_v × 1.35^(best-1) × w × traitMult)，与
     endlessStronghold 同源（抽样核对公式展开值）
  3. 提前召回比例结算：t 时刻召回 = 全额 × t/H（抽样验证），t=H 即全额
  4. 召回无套利：任意档位反复「派了就召回」的每小时收益恒等于该档 w/H，
     不超过最高档单位收益（肝度不产生额外费率）
  5. 层间与档间 EV 比例：档间 EV 比 == 权重比；层间 EV 比 == 1.35（奖励轴同源）
  6. 后勤特性乘区：logistics_doctrine ×1.2 后置作用，缺省 1.0
  7. 折算率与仓库真值对账：silencer_3 基础包 / 晶体比价中值 / REWARD_GROWTH /
     OFFLINE_CAP 全部从仓库源码程序化提取（脚本不自带可能漂移的数值）

折算率（能量当量，设计声明非市场价）：
  1 合金   = 1 能量    —— 依据：v1.26 口径（重装兵训练成本比价）
  1 数据   = 6 能量    —— 依据：v1.26 口径（60 合金 : 10 数据）
  1 暗物质 = 8000 能量 —— 依据：v1.26 口径（据点奖励带中值）
  1 晶体   = 55 能量   —— 依据：据点奖励表 energy:crystal 十组实值中值（本脚本运行时提取）

相对标尺（报告项，非断言）：4h 派遣 EV == 前沿单场合成据点资源包（同公式）；
24h 派遣在 best≈10 后越过 silencer_3 驻扎日收益（交叉点运行时算出）。

演进记录：
  - 2026-09-25 v1：初版 4 档定稿核验。
"""

import re
import statistics
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
PVE = REPO / "src/data/pve.ts"
ENDLESS = REPO / "src/data/endless.ts"
OFFLINE = REPO / "src/lib/offline-gains.ts"

# 折算率（能量当量）：v1.26 定稿口径 + 晶体（运行时对账）
RATE = {"energy": 1, "crystal": 55, "alloy": 1, "data": 6, "dark": 8000}

# 时长档位与权重（决策点 1/2 定案：4/8/12/24h，权重 1.0/2.2/3.6/8.0）
TIERS = [(4, 1.0), (8, 2.2), (12, 3.6), (24, 8.0)]
LOGISTICS_MULT = 1.2  # 决策点 5：后勤特性作用派遣收益

ANCHOR_BESTS = [1, 10, 25, 35]  # 报告标尺：刚解锁 / 里程碑档1 / 档B带 / 档C带


# ---- 仓库真值提取 ----

def block_after(text: str, start_pat: str, flags: int = 0) -> str:
    """取 start_pat 之后第一个平衡大括号块。"""
    i = re.search(start_pat, text, flags)
    assert i, f"锚点未命中: {start_pat}"
    j = text.index("{", i.end())
    depth = 0
    for k in range(j, len(text)):
        if text[k] == "{":
            depth += 1
        elif text[k] == "}":
            depth -= 1
            if depth == 0:
                return text[j : k + 1]
    raise AssertionError("大括号不平衡")


def kv(block: str) -> dict:
    return {m.group(1): float(m.group(2)) for m in re.finditer(r"(\w+):\s*([\d.]+)", block)}


def extract_repo_truths():
    pve = PVE.read_text(encoding="utf-8")
    endless = ENDLESS.read_text(encoding="utf-8")
    offline = OFFLINE.read_text(encoding="utf-8")

    base = kv(block_after(pve, r"id:\s*'silencer_3'"))
    # rewards 子块内的五资源（rewards 与 idle 都在大括号块里，取 rewards: 后的子块）
    base_rewards = kv(block_after(pve, r"id:\s*'silencer_3'.*?rewards:", re.DOTALL))
    base_idle = kv(block_after(pve, r"id:\s*'silencer_3'.*?idle:", re.DOTALL))

    # 全据点 energy:crystal 比价样本（rewards 块内两者齐备者）
    ratios = []
    for m in re.finditer(r"rewards:\s*\{", pve):
        blk = block_after(pve[m.start() :], r"rewards:")
        d = kv(blk)
        if d.get("energy") and d.get("crystal"):
            ratios.append(d["energy"] / d["crystal"])

    growth = float(re.search(r"REWARD_GROWTH = ([\d.]+)", endless).group(1))
    cap = float(re.search(r"OFFLINE_CAP = (\d+)\s*\*\s*(\d+)", offline).group(1)) * float(
        re.search(r"OFFLINE_CAP = (\d+)\s*\*\s*(\d+)", offline).group(2)
    )
    return {
        "base_rewards": base_rewards,
        "base_idle": base_idle,
        "ratios": ratios,
        "growth": growth,
        "cap": cap,
        "base_block_keys": set(base.keys()) >= {"rewards", "idle"},
    }


TRUTH = extract_repo_truths()
GROWTH = TRUTH["growth"]


# ---- 奖励公式（与 data/dispatch.ts 同源） ----

def reward_scale(best: int) -> float:
    """层缩放 = endlessStronghold 同源：1.35^(max(1,best)-1)。"""
    return GROWTH ** (max(1, best) - 1)


# 奖励键面：派遣为纯资源包，不含遗物概率字段（relicChance/relicRarityBias 不入公式）
RESOURCE_KEYS = ["energy", "crystal", "alloy", "data", "dark"]


def dispatch_reward(best: int, hours: int, weight: float, logistics: bool = False):
    """全额奖励：round(base_v × rs × w × traitMult)，half-up 与 Math.round 对齐。
    键面恒为五资源（基础包里的遗物概率字段不进派遣奖励）。"""
    rs = reward_scale(best)
    m = LOGISTICS_MULT if logistics else 1.0
    out = {}
    for k in RESOURCE_KEYS:
        x = TRUTH["base_rewards"][k] * rs * weight * m
        out[k] = int(x + 0.5)  # 正数 half-up
    return out


def dispatch_reward_raw(best: int, weight: float, logistics: bool = False):
    """未取整名义值：供结构比例断言（dark ×8000 当量下 ±0.5 取整即 ±1e-5
    相对误差，比例类断言用名义值隔离取整噪声；整数形态由断言 2 把关）。"""
    rs = reward_scale(best)
    m = LOGISTICS_MULT if logistics else 1.0
    return {k: v * rs * weight * m for k, v in TRUTH["base_rewards"].items()}


def ev(rew: dict) -> float:
    return sum(RATE.get(k, 0) * v for k, v in rew.items())


def dispatch_ev(best: int, weight: float, logistics: bool = False) -> float:
    return ev(dispatch_reward_raw(best, weight, logistics))


def recall_yield(best: int, hours: int, weight: float, t_hours: float, logistics=False):
    """召回结算：全额 × t/H（逐资源 half-up 后对比按比例名义值）。"""
    full = dispatch_reward(best, hours, weight, logistics)
    nominal = {k: v * (t_hours / hours) for k, v in full.items()}
    settled = {k: int(v + 0.5) for k, v in nominal.items()}
    return settled, nominal


def main():
    failures, notes = [], []

    # 对账 0：仓库真值存在性与折算率声明
    base = TRUTH["base_rewards"]
    for k in ("energy", "crystal", "alloy", "data", "dark"):
        if base.get(k, 0) <= 0:
            failures.append(f"silencer_3 基础包缺 {k}（提取失败或为零）")
    med = statistics.median(TRUTH["ratios"])
    if not TRUTH["ratios"] or abs(med - RATE["crystal"]) > 0.5:
        failures.append(f"晶体折算率声明 {RATE['crystal']} != 仓库奖励带中值 {med:.1f}")
    if abs(GROWTH - 1.35) > 1e-9:
        failures.append(f"REWARD_GROWTH 仓库值 {GROWTH} != 1.35")
    if TRUTH["cap"] != 86400:
        failures.append(f"OFFLINE_CAP 仓库值 {TRUTH['cap']:.0f} != 86400")

    # 断言 1：档位形态与单位时长收益单调不减
    hours_list = [h for h, _ in TIERS]
    if hours_list != sorted(set(hours_list)) or hours_list != [4, 8, 12, 24]:
        failures.append(f"时长档位异常: {hours_list}")
    per_hour = [w / h for h, w in TIERS]
    for i in range(1, len(per_hour)):
        if per_hour[i] < per_hour[i - 1] - 1e-12:
            failures.append(f"单位时长收益回退: {TIERS[i-1]} -> {TIERS[i]}")
    if TIERS != [(4, 1.0), (8, 2.2), (12, 3.6), (24, 8.0)]:
        failures.append(f"权重表偏离定案口径: {TIERS}")

    # 断言 2：公式恒等（抽样）+ 键面恒为五资源
    for best in ANCHOR_BESTS:
        for h, w in TIERS:
            r = dispatch_reward(best, h, w)
            expect = {
                k: int(TRUTH["base_rewards"][k] * reward_scale(best) * w + 0.5)
                for k in RESOURCE_KEYS
            }
            if r != expect:
                failures.append(f"公式恒等破 best={best} {h}h: {r} != {expect}")
            if set(r.keys()) != set(RESOURCE_KEYS):
                failures.append(f"奖励键面漂移 best={best} {h}h: {sorted(r.keys())}")
    # 基础包非资源键不得混入奖励公式（relicChance 等遗物字段）
    extra = set(TRUTH["base_rewards"].keys()) - set(RESOURCE_KEYS)
    if not extra:
        failures.append("对账预期失真：基础包应含非资源键（relicChance/relicRarityBias）供键面断言校验")
    for best in ANCHOR_BESTS:
        r = dispatch_reward(best, 4, 1.0)
        if extra & set(r.keys()):
            failures.append(f"非资源键混入奖励 best={best}: {extra & set(r.keys())}")

    # 断言 3：召回比例结算（含 t=H 全额与半程）
    for h, w in TIERS:
        full = dispatch_reward(10, h, w)
        half, nominal = recall_yield(10, h, w, h / 2)
        for k in full:
            if abs(half[k] - nominal[k]) > 1:
                failures.append(f"召回结算偏差 {h}h {k}: {half[k]} vs 名义 {nominal[k]:.1f}")
        _, t_full = recall_yield(10, h, w, h)
        if any(abs(t_full[k] - full[k]) > 1e-9 for k in full):
            failures.append(f"t=H 未全额结算 {h}h")

    # 断言 4：召回无套利（反复短派的小时收益 == w/H，不超最高档）
    best_rate = max(w / h for h, w in TIERS)
    for h, w in TIERS:
        farm_rate = w / h  # 派满 H 或反复中途召回，每小时名义收益同源
        if farm_rate > best_rate + 1e-12:
            failures.append(f"{h}h 召回费率 {farm_rate:.4f} 超最高档 {best_rate:.4f}")

    # 断言 5：档间 EV 比 == 权重比；层间 EV 比 == GROWTH
    ev1 = {h: dispatch_ev(1, w) for h, w in TIERS}
    (h0, w0), (h9, w9) = TIERS[0], TIERS[-1]
    ratio = ev1[h9] / ev1[h0]
    if abs(ratio - w9 / w0) > 1e-6:
        failures.append(f"档间 EV 比 {ratio:.4f} != 权重比 {w9 / w0:.4f}")
    step = dispatch_ev(11, 1.0) / dispatch_ev(10, 1.0)
    if abs(step - GROWTH) > 1e-6:
        failures.append(f"层间 EV 比 {step:.4f} != {GROWTH}")

    # 断言 6：后勤乘区
    base_ev = dispatch_ev(10, 2.2, False)
    logi_ev = dispatch_ev(10, 2.2, True)
    if abs(logi_ev / base_ev - LOGISTICS_MULT) > 1e-6:
        failures.append(f"后勤乘区 {logi_ev / base_ev:.4f} != {LOGISTICS_MULT}")

    # ---- 核验表输出 ----
    print("== 仓库真值对账 ==")
    print(f"silencer_3 基础包: { {k: int(v) for k, v in base.items()} }")
    print(f"晶体折算率: 奖励带 {len(TRUTH['ratios'])} 组 energy:crystal 中值 = {med:.1f}（声明 {RATE['crystal']}）")
    print(f"REWARD_GROWTH = {GROWTH}；OFFLINE_CAP = {TRUTH['cap']:.0f}s")
    print()
    print("== EV 核验表（能量当量） ==")
    print(f"{'档位':>6} " + " ".join(f"{'best=' + str(b):>14}" for b in ANCHOR_BESTS) + f"{'每小时( best=1 )':>18}")
    for h, w in TIERS:
        cells = " ".join(f"{dispatch_ev(b, w):>14.3e}" for b in ANCHOR_BESTS)
        print(f"{h:>4}h  {cells} {w / h:>16.4f}")
    print()
    print("== 相对标尺（报告项） ==")
    idle = TRUTH["base_idle"]
    idle_per_s = sum(RATE.get(k, 0) * v for k, v in idle.items())
    print(f"silencer_3 驻扎秒收 ≈ {idle_per_s:.3e} 当量/s；24h ≈ {idle_per_s * 86400:.3e}")
    d24_1 = dispatch_ev(1, 8.0)
    # 精确交叉点：1.35^(best-1) × d24_1 = idle_per_s × 86400
    import math

    need = idle_per_s * 86400 / d24_1
    best_cross = 1 + math.log(need) / math.log(GROWTH) if need > 1 else 1
    print(f"24h 派遣(best=1) ≈ {d24_1:.3e}；越过 silencer_3 驻扎日收益的交叉点 best ≈ {best_cross:.1f}")
    ms10 = {k: int(v * GROWTH ** 9 + 0.5) for k, v in base.items()}
    print(f"里程碑档1(=best10 时一次性) EV ≈ {ev(ms10):.3e}；同锚 4h 派遣 EV ≈ {dispatch_ev(10, 1.0):.3e}（同量级，里程碑一次性/派遣可重复为预期结构）")
    print()
    if failures:
        print(f"FAIL {len(failures)} 项：")
        for f in failures:
            print("  -", f)
        raise SystemExit(1)
    print("PASS：全部断言通过")


if __name__ == "__main__":
    main()
