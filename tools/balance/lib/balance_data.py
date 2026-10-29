"""balance_data.py：数值核验脚本公共数据底座。

六枚核验脚本统一经此读取 tools/balance/data/balance-data.json（由
export-data.mjs 生成，生成命令 corepack pnpm balance:export），
不再各自解析 TS 源码。

四个入口：

- load()：载入（进程内缓存）数值快照，schema 不符即抛错
- table(name)：取顶层数据域（units/traits/tech/pve/endless/encounters/
  dispatch/relics/achievements/buildings/offline/explore/weeklyBoss/
  transcend），缺域即抛错
- require(cond, msg)：断言式守卫（数据完整性/口径检查，防漂移静默）
- approx(a, b)：浮点容差相等（round 误差边界判断）

用法（脚本侧）：

    import os, sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from lib import balance_data as bd

    UNITS = {u['id']: u for u in bd.table('units')}
    bd.require('silencer_3' in SOME, '模板据点缺失: silencer_3')
"""

import json
import os

_HERE = os.path.dirname(os.path.abspath(__file__))
_JSON_PATH = os.path.join(_HERE, '..', 'data', 'balance-data.json')

_EXPECTED_SCHEMA = 2

_DATA = None


def load():
    """载入数值快照 JSON（缓存）；schema 不符即抛错。"""
    global _DATA
    if _DATA is None:
        with open(_JSON_PATH, encoding='utf-8') as f:
            data = json.load(f)
        schema = data.get('schema')
        if schema != _EXPECTED_SCHEMA:
            raise ValueError(
                f'balance-data.json schema {schema!r} != 预期 {_EXPECTED_SCHEMA!r}，'
                f'请核对导出器与脚本底座的版本配套')
        _DATA = data
    return _DATA


def table(name):
    """取顶层数据域；缺域即抛错（列出可用域辅助排障）。"""
    data = load()
    if name not in data:
        raise KeyError(f'balance-data.json 无域 {name!r}（可用: {sorted(data)}）')
    return data[name]


def require(cond, msg):
    """断言式守卫：cond 为假即抛 AssertionError，防数据漂移静默通过。"""
    if not cond:
        raise AssertionError(f'balance 数据断言失败: {msg}')


def approx(a, b, tol=1e-9):
    """浮点容差相等（默认 1e-9；round 边界场景可放宽）。"""
    return abs(a - b) <= tol
