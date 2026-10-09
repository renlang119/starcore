#!/usr/bin/env python3
"""模板嵌套分支扫描：全库检查 src/**/*.vue 模板内插值与属性绑定中的
两级及以上链式三元，供「把模板分支抽离到脚本区」的口径做全量对账。

判定：剥去字符串字面量与可选链（?.）、空值合并（??）后，单条表达式的
问号计数 >= 2 即报出。提取时贪婪捕获整个根模板，避免文件内嵌
<template v-if / v-for> 提前截断搜索域（曾发生：非贪婪提取把搜索域截在
首个内嵌闭合标签处，静默漏报）。

用法：
    python3 scripts/template_ternary_scan.py [仓库根，缺省自动定位]
    python3 scripts/template_ternary_scan.py --self-test   # 自检检出样例

退出码：报出任意一处退 1；归零退 0；自检不过退 1。
"""
import glob
import os
import re
import sys

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def clean(s: str) -> str:
    s = re.sub(r"'(\\.|[^'\\])*'", "''", s)
    s = re.sub(r'"(\\.|[^"\\])*"', '""', s)
    s = re.sub(r'`(\\.|[^`\\])*`', '``', s)
    return s.replace('?.', '').replace('??', '')


def scan_text(src: str):
    """扫描单个源码串，返回 [(行号, 问号数, 片段), ...]。"""
    m = re.search(r'<template>(.*)</template>', src, re.S)
    if not m:
        return []
    tpl, off = m.group(1), m.start(1)
    exprs = [(mm.start(), mm.group(1)) for mm in re.finditer(r'\{\{(.*?)\}\}', tpl, re.S)]
    exprs += [
        (mm.start(), mm.group(1))
        for mm in re.finditer(r'(?::|v-bind:|v-|@)[\w:.\-]+="([^"]*)"', tpl, re.S)
    ]
    rows = []
    for pos, e in exprs:
        q = clean(e).count('?')
        if q >= 2:
            rows.append((src[: off + pos].count('\n') + 1, q, ' '.join(e.split())[:90]))
    return rows


def self_test() -> bool:
    good = (
        '<template>\n'
        '  <div>\n'
        '    {{\n'
        '      a\n'
        '        ? 1\n'
        '        : b\n'
        '          ? 2\n'
        '          : 3\n'
        '    }}\n'
        "    <span :title=\"x ? 'a' : y ? 'b' : 'c'\"></span>\n"
        '  </div>\n'
        '</template>\n'
    )
    benign = (
        '<template>\n'
        '  <div :class="a ?? b">{{ ok ? yes : no }}</div>\n'
        '  <em>{{ a?.b ? c : d }}</em>\n'
        '</template>\n'
    )
    checks = [
        ('样例检出 2 处（跨行插值 + 属性绑定）', len(scan_text(good)) == 2),
        ('空值合并 / 可选链 / 单层三元不误报', len(scan_text(benign)) == 0),
    ]
    for label, passed in checks:
        print(f"  {'✓' if passed else '✗'} 自检：{label}")
    return all(p for _, p in checks)


def main() -> None:
    args = list(sys.argv[1:])
    if '--self-test' in args:
        sys.exit(0 if self_test() else 1)
    root = args[0] if args else _ROOT
    files = sorted(glob.glob(os.path.join(root, 'src/**/*.vue'), recursive=True))
    total = 0
    for f in files:
        for line, q, snippet in scan_text(open(f, encoding='utf-8').read()):
            total += 1
            print(f'{os.path.relpath(f, root)}:{line} (问号 {q}) {snippet}')
    print(f'---共 {total} 处（扫描文件 {len(files)}）---')
    sys.exit(1 if total else 0)


if __name__ == '__main__':
    main()
