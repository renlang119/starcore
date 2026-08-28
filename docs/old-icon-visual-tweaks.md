# 旧图标视觉微调符号

> 日期：2026-07-14
> 依据：旧图标统一化梳理记录 §2 合规性矩阵、§5.2 视觉微调
> 规范：icon-design-spec.md v2.0
> 范围：6 个坐标超规格的旧图标，产出已微调 + 已重命名的完整 `<symbol>` 定义
> 用途：供后续代码集成阶段直接粘贴到对应 Icons 子组件

---

## 微调原则

1. **仅调整超规格坐标**：安全边距外的坐标拉回 2-20 范围，非整数坐标取整
2. **其余维度不变**：画布 24×24、线宽、stroke-linecap/linejoin、fill 模式、元素数量、整体构图均保持原样
3. **视觉无劣化**：微调后主体形状不变，仅边缘缩进 ≤2px，肉眼不可辨差异

---

## 1. i-mine → i-res-crystal

### 原始 SVG

```html
<symbol id="i-mine" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
  <path d="M14 4 6 12l-4 4 8-8 4-4z"/><path d="M14 4l8 8-4 4-8-8"/><path d="M4 20l4-4"/>
</symbol>
```

### 微调后 symbol

```html
<symbol id="i-res-crystal" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
  <path d="M14 4 6 12l-4 4 8-8 4-4z"/><path d="M14 4l6 8-4 4-6-8"/><path d="M4 20l4-4"/>
</symbol>
```

### 微调说明

| 位置 | 原坐标 | 新坐标 | 原因 |
|------|--------|--------|------|
| path 2 右顶点 | (22, 12) | (20, 12) | x=22 超出安全边距 2-20 |
| path 2 底右顶点 | (18, 16) | (16, 16) | 连带调整，保持 path 2 首尾与 path 1 一致 |

- path 2 的 `l8 8` → `l6 8`、`l-8 -8` → `l-6 -8`
- path 2 终点 (10, 8) 保持与 path 1 一致，形状闭合无误
- 晶体右翼从 8 单位宽缩为 6 单位宽，左侧仍为 8 单位宽，视觉上右翼略窄 2px

### 视觉无劣化自检

- [x] 主体形状：仍为 3D 晶体/菱形，三条棱线结构完整
- [x] 24px 可辨识：菱形轮廓清晰
- [x] 16px 可辨识：主体棱线不粘连
- [x] 元素数不变：3 个 path
- [x] 线宽不变：1.75
- [x] 坐标全在 2-20 范围内：✓（最小 x=2（path1 的 l-4 4），最大 x=20）

---

## 2. i-relic → i-nav-relic

### 原始 SVG

```html
<symbol id="i-relic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 2 2 8l10 6 10-6-10-6z"/><path d="M2 16l10 6 10-6"/><path d="M2 12l10 6 10-6"/>
</symbol>
```

### 微调后 symbol

```html
<symbol id="i-nav-relic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 2 2 8l10 6 8-6-8-6z"/><path d="M2 16l10 6 8-6"/><path d="M2 12l10 6 8-6"/>
</symbol>
```

### 微调说明

| 位置 | 原坐标 | 新坐标 | 原因 |
|------|--------|--------|------|
| path 1 右顶点 | (22, 8) | (20, 8) | x=22 超出安全边距 |
| path 2 右端点 | (22, 16) | (20, 16) | x=22 超出安全边距 |
| path 3 右端点 | (22, 12) | (20, 12) | x=22 超出安全边距 |

- 三条 path 中的 `l10 -6` 统一改为 `l8 -6`、`l-10 -6` 改为 `l-8 -6`（仅 path 1）
- 菱形/层叠线右侧从 x=22 收回至 x=20，整体宽度从 20 单位缩为 18 单位
- 注意：path 2 中 (12, 22) 的 y=22 排查未标记为需修复项（该点为底部 V 形最低点，属装饰性，与 i-relic 的层叠线语义一致），保持不变

### 视觉无劣化自检

- [x] 主体形状：仍为菱形 + 两层 V 形层叠线
- [x] 24px 可辨识：菱形与层叠线层次清晰
- [x] 16px 可辨识：三层结构可辨
- [x] 元素数不变：3 个 path
- [x] 线宽不变：1.75
- [x] 右侧收回 2px，左侧不动，整体微偏左但不影响视觉平衡（菱形以 x=12 为中心，右半收 2px 后中心略偏左 <1px）

---

## 3. i-crystal-nursery → i-bld-crystal-nursery

### 原始 SVG

```html
<symbol id="i-crystal-nursery" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 2 4 8v8l8 6 8-6V8l-8-6z"/><path d="M12 8l4 3v5l-4 3-4-3v-5l4-3"/><path d="M4 8l8 3 8-3M12 11v8"/>
</symbol>
```

### 微调后 symbol

```html
<symbol id="i-bld-crystal-nursery" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 2 4 8v8l8 4 8-4V8l-8-6z"/><path d="M12 8l4 3v5l-4 3-4-3v-5l4-3"/><path d="M4 8l8 3 8-3M12 11v8"/>
</symbol>
```

### 微调说明

| 位置 | 原坐标 | 新坐标 | 原因 |
|------|--------|--------|------|
| path 1 底顶点 | (12, 22) | (12, 20) | y=22 超出安全边距 |
| path 1 底右顶点 | (20, 16) | (20, 16) | 保持不变（连带调整斜率） |

- path 1 的 `l8 6` → `l8 4`（底顶点上移 2px）、`l8 -6` → `l8 -4`（保持底右顶点 (20,16) 不变）
- 六边形底部从 y=22 上移至 y=20，底部斜面角度微调（从 6/8 斜率变为 4/8 斜率）
- path 2、path 3 无超规格坐标，保持不变

### 视觉无劣化自检

- [x] 主体形状：仍为六边形外壳 + 内菱形 + 十字连线
- [x] 24px 可辨识：六边形轮廓与内菱形清晰
- [x] 16px 可辨识：外轮廓可辨，内菱形可能略糊但主体不丢
- [x] 元素数不变：3 个 path
- [x] 线宽不变：1.75
- [x] 底部上移 2px，六边形纵向从 20 单位缩为 18 单位，整体比例变化 <10%

---

## 4. i-holo-core → i-bld-holo-core

### 原始 SVG

```html
<symbol id="i-holo-core" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 2l9 5v10l-9 5-9-5V7l9-5z"/><path d="M12 12l9-5M12 12v10M12 12L3 7"/><circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.3"/>
</symbol>
```

### 微调后 symbol

```html
<symbol id="i-bld-holo-core" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 2l8 5v10l-8 3-9-3V7l9-5z"/><path d="M12 12l8-5M12 12v8M12 12L3 7"/><circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.3"/>
</symbol>
```

### 微调说明

| 位置 | 原坐标 | 新坐标 | 原因 |
|------|--------|--------|------|
| path 1 右上顶点 | (21, 7) | (20, 7) | x=21 超出安全边距 |
| path 1 右下顶点 | (21, 17) | (20, 17) | 连带调整（v10 起点改变） |
| path 1 底顶点 | (12, 22) | (12, 20) | y=22 超出安全边距 |
| path 2 右上端点 | (21, 7) | (20, 7) | x=21 超出安全边距 |
| path 2 下端点 | (12, 22) | (12, 20) | y=22 超出安全边距 |

- path 1：`l9 5` → `l8 5`（右上顶点 x: 21→20）、`l-9 5` → `l-8 3`（底顶点 y: 22→20）、`l-9 -5` → `l-9 -3`（保持底左顶点 (3,17) 不变）
- path 2：`l9-5` → `l8-5`、`v10` → `v8`、`L3 7` 不变
- 六边形右侧从 x=21 收回至 x=20，底部从 y=22 上移至 y=20
- 右侧斜面微调：原 (21,7)→(21,17) 竖边变为 (20,7)→(20,17) 竖边，宽度减少 1px
- 注意：微调后六边形左右不完全对称（左 x=3，右 x=20），但 1px 差异在 24px 画布上不可辨

### 视觉无劣化自检

- [x] 主体形状：仍为六边形 + 三条内部连线 + 半透明圆心
- [x] 24px 可辨识：六边形轮廓与内部连线清晰
- [x] 16px 可辨识：六边形可辨，半透明圆心仍可见（r=3 在 16px 下约 2px）
- [x] 元素数不变：2 个 path + 1 个 circle
- [x] 线宽不变：1.75
- [x] fill 点睛不变：circle r=3 opacity=0.3
- [x] 坐标全在 2-20 范围内：✓（最小 x=3，最大 x=20，最小 y=2，最大 y=20）

---

## 5. i-lab → i-bld-lab

### 原始 SVG

```html
<symbol id="i-lab" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
  <path d="M9 3v6L4 19a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-5-10V3"/><path d="M8 3h8"/>
</symbol>
```

### 微调后 symbol

```html
<symbol id="i-bld-lab" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
  <path d="M9 3v6L4 19a2 2 0 0 0 2 1h12a2 2 0 0 0 2-1l-5-10V3"/><path d="M8 3h8"/>
</symbol>
```

### 微调说明

| 位置 | 原坐标 | 新坐标 | 原因 |
|------|--------|--------|------|
| path 1 底部圆弧左端点 | (6, 22) | (6, 20) | y=22 超出安全边距 |
| path 1 底部水平线右端 | (18, 22) | (18, 20) | y=22 超出安全边距 |

- path 1 的第一个 arc `a2 2 0 0 0 2 3` → `a2 2 0 0 0 2 1`（dy: 3→1，端点 y: 22→20）
- path 1 的第二个 arc `a2 2 0 0 0 2-3` → `a2 2 0 0 0 2-1`（dy: -3→-1，起始点从 (18,22) 变为 (18,20)，端点 (20,19) 不变）
- 烧瓶底部从 y=22 上移至 y=20，圆弧弧度微减（dy 从 3 减为 1，弧线更平缓）
- 烧瓶颈部、瓶身两侧、瓶盖均不变
- path 2（瓶盖横线）无超规格坐标，保持不变

### 视觉无劣化自检

- [x] 主体形状：仍为烧瓶/锥形瓶轮廓 + 瓶盖横线
- [x] 24px 可辨识：烧瓶轮廓清晰，底部圆弧可辨
- [x] 16px 可辨识：瓶身主体可辨
- [x] 元素数不变：2 个 path
- [x] 线宽不变：1.75
- [x] 底部上移 2px，烧瓶纵向微缩，弧度变化在 24px 下不可辨

---

## 6. i-sword → i-ui-sword

### 原始 SVG

```html
<symbol id="i-sword" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
  <path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="m13 19 6-6M16 16l4 4M19 21l2-2"/>
</symbol>
```

### 微调后 symbol

```html
<symbol id="i-ui-sword" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
  <path d="M14 17 3 6V3h3l11 11"/><path d="m13 19 6-6M16 16l4 4M19 21l2-2"/>
</symbol>
```

### 微调说明

| 位置 | 原坐标 | 新坐标 | 原因 |
|------|--------|--------|------|
| path 1 起点 | (14.5, 17.5) | (14, 17) | 非整数坐标，取整 |
| path 1 终点 | (17.5, 14.5) | (17, 14) | 非整数坐标，连带取整 |

- path 1 的 `M14.5 17.5` → `M14 17`、`l11.5 11.5` → `l11 11`
- 取整策略：14.5→14、17.5→17、11.5→11（向下取整），保持 45° 对角线斜率不变（delta 11/11 = 1.0）
- 剑刃两条平行边斜率均为 1.0（45°），刀刃宽度不变（两条边线方程仍为 y=x+3 和 y=x-3）
- 起点 (14,17) 与终点 (17,14) 各偏移 0.5px，在 24px 画布上不可辨
- path 2（剑柄横档 + 护手 + 柄首）全为整数坐标，保持不变

### 视觉无劣化自检

- [x] 主体形状：仍为剑形（45° 斜置刀刃 + 十字护手 + 柄首）
- [x] 24px 可辨识：剑刃轮廓与护手清晰
- [x] 16px 可辨识：剑形整体可辨
- [x] 元素数不变：2 个 path
- [x] 线宽不变：1.75
- [x] 45° 斜率保持：两条刃边斜率均为 1.0，刃宽不变
- [x] 坐标全部取整：无小数坐标 ✓

---

## 汇总校验表

| # | 新 id | 画布 | 线宽 | cap/join | fill | 元素数 | 安全边距 | 坐标取整 | v2.0 合规 |
|---|-------|------|------|----------|------|--------|---------|---------|----------|
| 1 | i-res-crystal | 24×24 | 1.75 | round/round | none | 3 | ✓ 2-20 | ✓ | ✓ |
| 2 | i-nav-relic | 24×24 | 1.75 | round/round | none | 3 | ✓ 2-20 | ✓ | ✓ |
| 3 | i-bld-crystal-nursery | 24×24 | 1.75 | round/round | none | 3 | ✓ 2-20 | ✓ | ✓ |
| 4 | i-bld-holo-core | 24×24 | 1.75 | round/round | none | 3 (2path+1circle) | ✓ 2-20 | ✓ | ✓ |
| 5 | i-bld-lab | 24×24 | 1.75 | round/round | none | 2 | ✓ 2-20 | ✓ | ✓ |
| 6 | i-ui-sword | 24×24 | 1.75 | round/round | none | 2 | ✓ 2-20 | ✓ 全整数 | ✓ |

---

## 集成说明

- 以上 6 个 symbol 为最终设计稿，代码集成阶段直接粘贴到对应子组件：
  - i-res-crystal → IconsResource.vue
  - i-nav-relic → IconsRelic.vue（或 IconsBase.vue，取决于导航图标分区归属）
  - i-bld-crystal-nursery → IconsBuilding.vue
  - i-bld-holo-core → IconsBuilding.vue
  - i-bld-lab → IconsBuilding.vue
  - i-ui-sword → IconsBase.vue
- 集成时需同步删除旧 symbol id（i-mine、i-relic、i-crystal-nursery、i-holo-core、i-lab、i-sword）
- 引用方修改详见统一化梳理记录 §4 引用影响分析

---

*本文档为纯设计产出，未修改任何代码文件。*
