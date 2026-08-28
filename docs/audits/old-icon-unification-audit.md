# 旧图标统一化梳理记录

> 梳理日期：2026-07-14  
> 梳理范围：Phase 0~3 完成后，Icons 体系内 39 个原始旧图标  
> 对照规范：`docs/icon-design-spec.md` v1.1（已冻结）  
> 梳理类型：纯梳理，不修改任何代码

---

## 目录

1. [旧图标清点](#旧图标清点)
2. [合规性矩阵](#合规性矩阵)
3. [命名差距分析](#命名差距分析)
4. [引用影响分析](#引用影响分析)
5. [统一方案建议](#统一方案建议)
6. [附录：规范附录A 勘误表](#附录规范附录a-勘误表)

---

## 1. 旧图标清点

从 7 个子组件中识别出原始 39 个旧图标（即非 Phase 1-3 新增的）：

### IconsBase.vue（13 个）

| # | id | 语义 |
|---|-----|------|
| 1 | `i-home` | 主界面/首页 |
| 2 | `i-build` | 建造 |
| 3 | `i-tech` | 科技树 |
| 4 | `i-map` | 探索/星图 |
| 5 | `i-army` | 部队/军事 |
| 6 | `i-restart` | 奇点重启 |
| 7 | `i-core` | 星核/暗物质 |
| 8 | `i-settings` | 设置 |
| 9 | `i-close` | 关闭 |
| 10 | `i-check` | 确认 |
| 11 | `i-arrow-right` | 方向箭头 |
| 12 | `i-sword` | 剑/战斗 |
| 13 | `i-more` | 更多 |

### IconsResource.vue（4 个）

| # | id | 语义 |
|---|-----|------|
| 14 | `i-energy` | 能量 |
| 15 | `i-alloy` | 合金 |
| 16 | `i-mine` | 晶体矿 |
| 17 | `i-data` | 数据流 |

### IconsBuilding.vue（16 个旧图标）

| # | id | 语义 |
|---|-----|------|
| 18 | `i-reactor` | 反应堆 |
| 19 | `i-dyson` | 戴森球 |
| 20 | `i-refinery` | 精炼厂 |
| 21 | `i-lab` | 实验室 |
| 22 | `i-quantum` | 量子 |
| 23 | `i-crystal-nursery` | 晶格培育室 |
| 24 | `i-deep-drill` | 深晶钻探 |
| 25 | `i-silicon-ring` | 硅基星环 |
| 26 | `i-nano-forge` | 纳米锻造 |
| 27 | `i-ion-casting` | 离子铸造 |
| 28 | `i-stellar-forge` | 星际熔炉 |
| 29 | `i-dark-detector` | 暗物质探测 |
| 30 | `i-dark-capture` | 暗物质捕获 |
| 31 | `i-dark-well` | 暗物质井 |
| 32 | `i-neural-hub` | 神经网络 |
| 33 | `i-holo-core` | 全息核心 |

### IconsRelic.vue（2 个旧图标）

| # | id | 语义 |
|---|-----|------|
| 34 | `i-relic` | 遗物（导航兜底） |
| 35 | `i-mystery` | 神秘/欧米伽协议 |

### IconsTech.vue（0 个旧图标）

> 全部为 Phase 1-2 新增。

### IconsStronghold.vue（0 个旧图标）

> 全部为 Phase 3 新增。

### IconsUnit.vue（4 个旧图标）

| # | id | 语义 |
|---|-----|------|
| 36 | `i-assault` | 突击兵 |
| 37 | `i-guard` | 护卫兵 |
| 38 | `i-heavy` | 重装兵 |
| 39 | `i-psionic` | 灵能者（旧版，已被 i-unit-psionic 替代） |

**合计：13 + 4 + 16 + 2 + 0 + 0 + 4 = 39 个旧图标。**

---

## 2. 合规性矩阵

### 2.1 梳理维度

| 维度 | 规范要求 | 来源 |
|------|---------|------|
| 命名格式 | `i-{category}-{name}` | §7.1 |
| 画布 | `viewBox="0 0 24 24"` | §1.1 |
| 主体线宽 | `stroke-width="1.75"`（UI 工具图标 2.0） | §3.1 |
| 辅助线宽 | `stroke-width="1.5"`（虚线轨道等） | §3.1 |
| 端点/连接 | `stroke-linecap="round"` + `stroke-linejoin="round"` | §4.1 |
| 填充模式 | `fill="none"`（点睛除外） | §4.2 |
| 元素数量 | 1-6 个（1 仅限极简） | §2.1 |
| 安全边距 | 关键内容 2-20（装饰环/满幅轮廓可例外） | §1.2 |
| 坐标取整 | 优先整数，仅曲线控制点允许小数 | §1.3 |

### 2.2 总体合规情况

| 维度 | 合规数 | 不合规数 | 说明 |
|------|--------|---------|------|
| 命名格式 | 0 | **39** | 全部使用扁平 `i-{name}`，无类别前缀 |
| 画布 24×24 | 39 | 0 | — |
| 线宽 | 39 | 0 | 35 个 1.75 + 3 个 UI 2.0 + 1 个 fill-only |
| 端点/连接 | 39 | 0 | 全部 round |
| 填充模式 | 39 | 0 | 38 个 fill="none" + 1 个 i-more fill="currentColor"（spec 豁免） |
| 元素数量 | 39 | 0 | 全部在 1-6 范围内 |
| 安全边距 | 32 | **7**（见下） | 7 个图标的主体轮廓超出 2-20 |
| 坐标取整 | 37 | **2** | i-sword、i-stellar-forge 有非曲线小数坐标 |

### 2.3 逐图标合规矩阵

> 标记说明：✅ 合规 | ⚠️ 边界情况 | ❌ 偏差 | — 不适用

#### IconsBase.vue

| # | id | 命名 | 画布 | 线宽 | 风格 | 填充 | 元素数 | 安全边距 | 取整 | 备注 |
|---|-----|------|------|------|------|------|--------|---------|------|------|
| 1 | i-home | ❌ | ✅ | ✅ | ✅ | ✅ | 3✅ | ⚠️ | ✅ | 屋顶右檐 x=21（满幅轮廓） |
| 2 | i-build | ❌ | ✅ | ✅ | ✅ | ✅ | 4✅ | ⚠️ | ✅ | 地面线 x=21（满幅轮廓） |
| 3 | i-tech | ❌ | ✅ | ✅ | ✅ | ✅ | 6✅ | ⚠️ | ✅ | 角节点圆 cx=19 r=2 → x=21 |
| 4 | i-map | ❌ | ✅ | ✅ | ✅ | ✅ | 2✅ | ⚠️ | ✅ | 折叠形 x=21（满幅轮廓） |
| 5 | i-army | ❌ | ✅ | ✅ | ✅ | ✅ | 2✅ | ⚠️ | ✅ | 盾形 x=21（满幅轮廓） |
| 6 | i-restart | ❌ | ✅ | ✅ | ✅ | ✅ | 4✅ | ⚠️ | ✅ | 弧线端点 x=21 |
| 7 | i-core | ❌ | ✅ | ✅ | ✅ | ✅ | 3✅ | ✅ | ✅ | r=11 触及 1-23，spec §1.2 明确豁免 |
| 8 | i-settings | ❌ | ✅ | ✅ | ✅ | ✅ | 2✅ | ⚠️ | ✅ | 齿轮path 含大量小数控制点（弧线，合规）；**无引用** |
| 9 | i-close | ❌ | ✅ | ✅2.0 | ✅ | ✅ | 1✅ | ✅ | ✅ | UI 工具图标；**无引用** |
| 10 | i-check | ❌ | ✅ | ✅2.0 | ✅ | ✅ | 1✅ | ✅ | ✅ | UI 工具图标 |
| 11 | i-arrow-right | ❌ | ✅ | ✅2.0 | ✅ | ✅ | 1✅ | ✅ | ✅ | UI 工具图标 |
| 12 | i-sword | ❌ | ✅ | ✅ | ✅ | ✅ | 2✅ | ⚠️ | ❌ | **14.5/17.5/11.5 为直线端点小数** |
| 13 | i-more | ❌ | ✅ | — | ✅ | ✅fill | 3✅ | ⚠️ | ✅ | cx=19 r=2 → x=21；fill=currentColor 豁免 |

#### IconsResource.vue

| # | id | 命名 | 画布 | 线宽 | 风格 | 填充 | 元素数 | 安全边距 | 取整 | 备注 |
|---|-----|------|------|------|------|------|--------|---------|------|------|
| 14 | i-energy | ❌ | ✅ | ✅ | ✅ | ✅ | 1✅ | ⚠️ | ✅ | 闪电 y=2→22，spec §1.2 明确豁免 |
| 15 | i-alloy | ❌ | ✅ | ✅ | ✅ | ✅ | 2✅ | ⚠️ | ✅ | 六边形 x=21（满幅轮廓） |
| 16 | i-mine | ❌ | ✅ | ✅ | ✅ | ✅ | 3✅ | ⚠️ | ✅ | **菱形顶点 x=22**，超出 2px |
| 17 | i-data | ❌ | ✅ | ✅ | ✅ | ✅ | 2✅ | ⚠️ | ✅ | rect width=18 from x=3 → x=21 |

#### IconsBuilding.vue

| # | id | 命名 | 画布 | 线宽 | 风格 | 填充 | 元素数 | 安全边距 | 取整 | 备注 |
|---|-----|------|------|------|------|------|--------|---------|------|------|
| 18 | i-reactor | ❌ | ✅ | ✅ | ✅ | ✅ | 2✅ | ✅ | ✅ | 辐射线端点 5.6/2.1 为弧线控制点（合规） |
| 19 | i-dyson | ❌ | ✅ | ✅ | ✅ | ✅ | 3✅ | ✅ | ✅ | 椭圆 rx=10 → 2-22，spec §1.2 豁免 |
| 20 | i-refinery | ❌ | ✅ | ✅ | ✅ | ✅ | 1✅ | ✅ | ✅ | 用 `h0` 零长线做点（创意用法，不违规） |
| 21 | i-lab | ❌ | ✅ | ✅ | ✅ | ✅ | 2✅ | ⚠️ | ✅ | **烧瓶底部 y=22** |
| 22 | i-quantum | ❌ | ✅ | ✅ | ✅ | ✅ | 4✅ | ✅ | ✅ | 椭圆 rx=10，spec §1.2 豁免 |
| 23 | i-crystal-nursery | ❌ | ✅ | ✅ | ✅ | ✅ | 3✅ | ⚠️ | ✅ | **六边形底部 y=22** |
| 24 | i-deep-drill | ❌ | ✅ | ✅ | ✅ | ✅ | 4✅ | ✅ | ✅ | — |
| 25 | i-silicon-ring | ❌ | ✅ | ✅ | ✅ | ✅ | 4✅ | ✅ | ✅ | dasharray="1 2" 合规 |
| 26 | i-nano-forge | ❌ | ✅ | ✅ | ✅ | ✅ | 4✅ | ⚠️ | ✅ | fill 点睛 r=1 合规；主体 x=21 |
| 27 | i-ion-casting | ❌ | ✅ | ✅ | ✅ | ✅ | 3✅ | ⚠️ | ✅ | rect width=18 from x=3 → x=21 |
| 28 | i-stellar-forge | ❌ | ✅ | ✅ | ✅ | ✅ | 3✅ | ⚠️ | ❌ | **4.9/2.8/16.3 等为直线端点小数**；辐射线 y=2 |
| 29 | i-dark-detector | ❌ | ✅ | ✅ | ✅ | ✅ | 3✅ | ✅ | ✅ | dasharray="1 2" 合规 |
| 30 | i-dark-capture | ❌ | ✅ | ✅ | ✅ | ✅ | 4✅ | ⚠️ | ✅ | dasharray+fill 点睛合规；**方向标 y=22** |
| 31 | i-dark-well | ❌ | ✅ | ✅ | ✅ | ✅ | 4✅ | ✅ | ✅ | dasharray+fill 点睛 r=2 合规 |
| 32 | i-neural-hub | ❌ | ✅ | ✅ | ✅ | ✅ | 6✅ | ⚠️ | ✅ | 角节点圆 cx=19 r=2 → x=21 |
| 33 | i-holo-core | ❌ | ✅ | ✅ | ✅ | ✅ | 3✅ | ⚠️ | ✅ | fill 点睛 r=3 opacity=0.3 合规；**六边形 x=21 y=22** |

#### IconsRelic.vue

| # | id | 命名 | 画布 | 线宽 | 风格 | 填充 | 元素数 | 安全边距 | 取整 | 备注 |
|---|-----|------|------|------|------|------|--------|---------|------|------|
| 34 | i-relic | ❌ | ✅ | ✅ | ✅ | ✅ | 3✅ | ⚠️ | ✅ | **菱形顶点 x=22**，超出 2px |
| 35 | i-mystery | ❌ | ✅ | ✅ | ✅ | ✅ | 3✅ | ⚠️ | ✅ | r=10 → 2-22（满幅轮廓）；fill 点睛 r=.5 合规 |

#### IconsUnit.vue

| # | id | 命名 | 画布 | 线宽 | 风格 | 填充 | 元素数 | 安全边距 | 取整 | 备注 |
|---|-----|------|------|------|------|------|--------|---------|------|------|
| 36 | i-assault | ❌ | ✅ | ✅ | ✅ | ✅ | 1✅ | ⚠️ | ✅ | **无引用偏差**：spec 附录A 记录 2 元素，实际 1 元素 |
| 37 | i-guard | ❌ | ✅ | ✅ | ✅ | ✅ | 2✅ | ⚠️ | ✅ | **无引用偏差**：spec 附录A 记录 1 元素，实际 2 元素 |
| 38 | i-heavy | ❌ | ✅ | ✅ | ✅ | ✅ | 3✅ | ⚠️ | ✅ | **无引用偏差**：spec 附录A 记录 2 元素，实际 3 元素 |
| 39 | i-psionic | ❌ | ✅ | ✅ | ✅ | ✅ | 3✅ | ⚠️ | ✅ | **无引用偏差**：spec 记录 2 元素+dasharray，实际 3 元素+无 dasharray；**零引用**（已被 i-unit-psionic 替代） |

### 2.4 真实偏差汇总

#### 偏差 1：命名格式（39/39 不合规）

全部 39 个旧图标使用 `i-{name}` 扁平命名，不符合 §7.1 `i-{category}-{name}` 要求。但 §7.3 明确豁免了旧图标，此为规范预留的兼容空间，非"缺陷"。

#### 偏差 2：坐标取整（2 个图标）

| 图标 | 偏差坐标 | 性质 | 严重程度 |
|------|---------|------|---------|
| i-sword | `M14.5 17.5`、`l11.5 11.5` | 直线端点小数（非曲线控制点） | 轻微 |
| i-stellar-forge | `M4.9 4.9l2.8 2.8`、`M16.3 16.3l2.8 2.8` 等 | 直线端点小数（45° 对角线几何需求） | 轻微 |

> **说明**：spec §1.3 用词"优先使用整数"，非"必须"。i-stellar-forge 的小数是 45° 对角线从中心出发的几何必然（整数无法精确表达 45° 线段端点），可视为合理例外。i-sword 的 14.5 则无几何必要性。

#### 偏差 3：安全边距超出（7 个图标有实质超出）

| 图标 | 超出坐标 | 超出量 | 性质 |
|------|---------|--------|------|
| i-mine | x=22（菱形右顶点） | +2px | 主体轮廓关键顶点 |
| i-relic | x=22（菱形右顶点） | +2px | 主体轮廓关键顶点 |
| i-crystal-nursery | y=22（六边形底顶点） | +2px | 主体轮廓关键顶点 |
| i-holo-core | x=21 y=22（六边形顶点） | +1~2px | 主体轮廓关键顶点 |
| i-lab | y=22（烧瓶底部） | +2px | 主体轮廓关键顶点 |
| i-dark-capture | y=22（方向标记线端点） | +2px | 辅助标记 |
| i-stellar-forge | y=2 x=2（辐射线端点） | 边界值 | 主体轮廓 |

> 其余 12 个图标的 x/y=21 属于"满幅视觉张力的主体轮廓"，spec §1.2 允许。但 x/y=22 的 5 个图标已超出"满幅"的常见范围（i-energy 的 y=22 是 spec 明确举例豁免的），建议纳入视觉微调候选。

#### 偏差 4：规范附录A 数据错误（4 个图标）

详见 [附录：规范附录A 勘误表](#附录规范附录a-勘误表)。

---

## 3. 命名差距分析

### 3.1 前置问题：类别体系扩展

spec §7.2 当前仅定义 6 个类别前缀：`relic`、`tech`、`bld`、`branch`、`stronghold`、`unit`。但 39 个旧图标中有 **18 个**不属于这 6 类：

| 需要新类别 | 涉及图标数 | 图标 |
|-----------|-----------|------|
| `nav`（导航） | 7 | i-home, i-build, i-tech, i-map, i-army, i-relic, i-restart |
| `res`（资源） | 5 | i-energy, i-alloy, i-mine, i-data, i-core |
| `ui`（界面工具） | 6 | i-settings, i-close, i-check, i-arrow-right, i-sword, i-more |

> **建议**：若要统一命名，需先在 spec §7.2 扩充 `nav`、`res`、`ui` 三个新类别前缀。

### 3.2 逐图标命名建议

#### 导航图标（7 个）→ `i-nav-*`

| 旧 id | 建议新 id | 理由 | 冲突检查 |
|-------|----------|------|---------|
| i-home | `i-nav-home` | 导航-主页 | ✅ 无冲突 |
| i-build | `i-nav-build` | 导航-建造 | ✅ 无冲突 |
| i-tech | `i-nav-tech` | 导航-科技 | ✅ 无冲突（不与 i-tech-* 混淆，前缀不同） |
| i-map | `i-nav-explore` | 导航-探索（对应探索学分支语义） | ✅ 无冲突 |
| i-army | `i-nav-army` | 导航-部队 | ✅ 无冲突 |
| i-relic | `i-nav-relic` | 导航-遗物 | ✅ 无冲突（不与 i-relic-* 混淆） |
| i-restart | `i-nav-prestige` | 导航-奇点重启 | ✅ 无冲突 |

> **注意**：i-map 同时被 tech.ts 引用为 `explore_basic` 科技图标，i-army 被引用为 `adv_units` 科技图标，i-restart 被引用为 `singularity_theory` 科技图标。重命名后这些科技引用也需同步修改，或考虑为这些科技节点创建独立的 `i-tech-*` 图标。

#### 资源图标（5 个）→ `i-res-*`

| 旧 id | 建议新 id | 理由 | 冲突检查 |
|-------|----------|------|---------|
| i-energy | `i-res-energy` | 资源-能量 | ✅ 无冲突 |
| i-alloy | `i-res-alloy` | 资源-合金 | ✅ 无冲突 |
| i-mine | `i-res-crystal` | 资源-晶体（图标语义为晶体矿，资源类型为 crystal） | ✅ 无冲突 |
| i-data | `i-res-data` | 资源-数据流 | ✅ 无冲突 |
| i-core | `i-res-dark` | 资源-暗物质（当前作为 dark 资源图标使用） | ✅ 无冲突 |

> **注意**：这 5 个图标均为跨场景复用：
> - i-energy → 资源 + 建筑(solar_collector) + 科技分支(energy) + 科技节点(energy_eff_1)
> - i-mine → 资源 + 建筑(crystal_mine) + 科技节点(crystal_eff_1)
> - i-data → 资源 + 建筑(data_center) + 科技节点(data_eff_1)
> - i-core → 资源 + 科技分支(dark) + 科技节点(core_mining, dark_matter_theory)
> - i-alloy → 资源 + 科技节点(alloy_eff_1)
>
> 重命名为 `i-res-*` 后，建筑和科技场景引用同名图标在语义上不够精确，但与当前"一个图标多场景复用"的模式一致，不引入额外复杂度。

#### UI 工具图标（6 个）→ `i-ui-*`

| 旧 id | 建议新 id | 理由 | 冲突检查 |
|-------|----------|------|---------|
| i-settings | `i-ui-settings` | 界面-设置 | ✅ 无冲突（**但当前零引用，建议直接删除**） |
| i-close | `i-ui-close` | 界面-关闭 | ✅ 无冲突（**但当前零引用，建议直接删除**） |
| i-check | `i-ui-check` | 界面-确认 | ✅ 无冲突 |
| i-arrow-right | `i-ui-arrow-right` | 界面-方向 | ✅ 无冲突 |
| i-sword | `i-ui-sword` | 界面-战斗（BattleView 用） | ✅ 无冲突 |
| i-more | `i-ui-more` | 界面-更多 | ✅ 无冲突 |

#### 建筑/概念图标（16 个）→ 按主要用途拆分

**仅用于建筑（10 个）→ `i-bld-*`**

| 旧 id | 建议新 id | 冲突检查 |
|-------|----------|---------|
| i-crystal-nursery | `i-bld-crystal-nursery` | ✅ 无冲突 |
| i-deep-drill | `i-bld-deep-drill` | ✅ 无冲突 |
| i-silicon-ring | `i-bld-silicon-ring` | ✅ 无冲突 |
| i-lab | `i-bld-lab` | ✅ 无冲突 |
| i-dark-detector | `i-bld-dark-detector` | ✅ 无冲突 |
| i-dark-capture | `i-bld-dark-capture` | ✅ 无冲突 |
| i-dark-well | `i-bld-dark-well` | ✅ 无冲突 |
| i-neural-hub | `i-bld-neural-hub` | ✅ 无冲突 |
| i-holo-core | `i-bld-holo-core` | ✅ 无冲突 |
| i-quantum | `i-bld-quantum` | ✅ 无冲突 |

**仅用于科技节点（5 个）→ `i-tech-*`**

| 旧 id | 建议新 id | 当前科技引用 | 冲突检查 |
|-------|----------|------------|---------|
| i-dyson | `i-tech-dyson` | dyson_theory, silicon_ring_theory | ✅ 无冲突 |
| i-refinery | `i-tech-refine` | refine_tech | ✅ 无冲突 |
| i-nano-forge | `i-tech-nano-forge` | nano_forge_tech | ✅ 无冲突 |
| i-ion-casting | `i-tech-ion-casting` | ion_casting | ✅ 无冲突 |
| i-stellar-forge | `i-tech-stellar-forge` | stellar_forge_theory | ✅ 无冲突 |

**建筑+科技双用途（1 个）→ `i-bld-*`**

| 旧 id | 建议新 id | 当前引用 | 冲突检查 |
|-------|----------|---------|---------|
| i-reactor | `i-bld-reactor` | buildings.ts(fusion_reactor) + tech.ts(fusion_tech) | ✅ 无冲突 |

#### 遗物概念图标（2 个）

| 旧 id | 建议新 id | 理由 | 冲突检查 |
|-------|----------|------|---------|
| i-relic | `i-nav-relic` | 主要用途为导航项 + RelicView 兜底 | ✅ 无冲突 |
| i-mystery | `i-relic-omega` | 当前唯一引用为 r_omega 遗物 | ✅ 无冲突 |

#### 兵种图标（3 个活跃 + 1 个废弃）→ `i-unit-*`

| 旧 id | 建议新 id | 冲突检查 |
|-------|----------|---------|
| i-assault | `i-unit-assault` | ✅ 无冲突 |
| i-guard | `i-unit-guard` | ✅ 无冲突 |
| i-heavy | `i-unit-heavy` | ✅ 无冲突 |
| i-psionic | **删除** | 已被 `i-unit-psionic` 完全替代，零引用 |

### 3.3 命名建议汇总

| 操作 | 数量 | 图标 |
|------|------|------|
| 重命名为 `i-nav-*` | 7 | i-home, i-build, i-tech, i-map, i-army, i-relic, i-restart |
| 重命名为 `i-res-*` | 5 | i-energy, i-alloy, i-mine, i-data, i-core |
| 重命名为 `i-ui-*` | 4 | i-check, i-arrow-right, i-sword, i-more |
| 重命名为 `i-bld-*` | 11 | i-reactor, i-crystal-nursery, i-deep-drill, i-silicon-ring, i-lab, i-dark-detector, i-dark-capture, i-dark-well, i-neural-hub, i-holo-core, i-quantum |
| 重命名为 `i-tech-*` | 5 | i-dyson, i-refinery, i-nano-forge, i-ion-casting, i-stellar-forge |
| 重命名为 `i-relic-*` | 1 | i-mystery → i-relic-omega |
| 重命名为 `i-unit-*` | 3 | i-assault, i-guard, i-heavy |
| **直接删除** | 3 | i-settings（零引用）, i-close（零引用）, i-psionic（已被替代） |
| **合计** | 39 | — |

---

## 4. 引用影响分析

### 4.1 零引用图标（可安全删除）

| 图标 | 引用数 | 状态 | 建议 |
|------|--------|------|------|
| `i-settings` | 0 | 定义于 IconsBase.vue，全代码库无引用 | 直接删除 |
| `i-close` | 0 | 定义于 IconsBase.vue，全代码库无引用 | 直接删除 |
| `i-psionic` | 0 | 定义于 IconsUnit.vue，已被 `i-unit-psionic` 替代 | 直接删除 |

### 4.2 低影响图标（1-2 处引用）

| 图标 | 引用数 | 引用位置 |
|------|--------|---------|
| `i-home` | 1 | navigation.ts |
| `i-sword` | 1 | BattleView.vue |
| `i-more` | 1 | BottomNav.vue |
| `i-mystery` | 1 | relics.ts (r_omega) |
| `i-assault` | 1 | units.ts |
| `i-guard` | 1 | units.ts |
| `i-heavy` | 1 | units.ts |
| `i-build` | 2 | navigation.ts, HomeView.vue |
| `i-tech` | 2 | navigation.ts, HomeView.vue |
| `i-relic` | 2 | navigation.ts, RelicView.vue |
| `i-check` | 2 | TechView.vue, MapView.vue |
| `i-arrow-right` | 2 | HomeView.vue, MapView.vue |
| `i-alloy` | 2 | resources.ts, tech.ts |
| `i-reactor` | 2 | buildings.ts, tech.ts |
| `i-dyson` | 2 | tech.ts ×2 |
| `i-quantum` | 2 | buildings.ts, tech.ts |
| `i-dark-detector` | 2 | buildings.ts, tech.ts |
| `i-neural-hub` | 2 | buildings.ts, tech.ts |
| `i-holo-core` | 2 | buildings.ts, tech.ts |
| `i-refinery` | 1 | tech.ts |
| `i-nano-forge` | 1 | tech.ts |
| `i-ion-casting` | 1 | tech.ts |
| `i-stellar-forge` | 1 | tech.ts |
| `i-crystal-nursery` | 1 | buildings.ts |
| `i-deep-drill` | 1 | buildings.ts |
| `i-silicon-ring` | 1 | buildings.ts |
| `i-lab` | 1 | buildings.ts |
| `i-dark-capture` | 1 | tech.ts |
| `i-dark-well` | 1 | tech.ts |
| `i-restart` | 3 | navigation.ts, tech.ts, PrestigeView.vue |

### 4.3 中影响图标（3-4 处引用）

| 图标 | 引用数 | 引用位置 |
|------|--------|---------|
| `i-map` | 3 | navigation.ts, HomeView.vue, tech.ts |
| `i-army` | 3 | navigation.ts, HomeView.vue, tech.ts |
| `i-mine` | 3 | resources.ts, buildings.ts, tech.ts |
| `i-data` | 3 | resources.ts, buildings.ts, tech.ts |
| `i-energy` | 4+1test | resources.ts, buildings.ts, tech.ts ×2, storage.test.ts |
| `i-core` | 4 | resources.ts, tech.ts ×3 |

### 4.4 引用影响矩阵（按影响范围排序）

| 影响等级 | 图标数 | 需改引用处 | 涉及文件 |
|---------|--------|-----------|---------|
| 零影响（直接删除） | 3 | 0 | — |
| 低影响（1-2 处） | 27 | 38 | data/*.ts, views/*.vue, layout/*.vue |
| 中影响（3-4 处） | 6 | 20 | data/*.ts, stores/*.ts, views/*.vue, *.test.ts |
| **合计** | 36 | 58 | 11 个文件 |

### 4.5 涉及修改的文件清单

| 文件 | 需修改引用数 | 涉及旧图标 |
|------|------------|-----------|
| `src/data/navigation.ts` | 7 | i-home, i-build, i-tech, i-map, i-army, i-relic, i-restart |
| `src/data/buildings.ts` | 10 | i-energy, i-reactor, i-mine, i-crystal-nursery, i-deep-drill, i-silicon-ring, i-dark-detector, i-lab, i-data, i-quantum, i-neural-hub, i-holo-core, i-dark-capture, i-dark-well |
| `src/data/tech.ts` | 16 | i-energy, i-reactor, i-core ×3, i-mine, i-alloy, i-data, i-dyson ×2, i-refinery, i-nano-forge, i-ion-casting, i-stellar-forge, i-dark-detector, i-dark-capture, i-dark-well, i-neural-hub, i-holo-core, i-quantum, i-map, i-army, i-restart |
| `src/data/relics.ts` | 1 | i-mystery |
| `src/data/units.ts` | 3 | i-assault, i-guard, i-heavy |
| `src/stores/resources.ts` | 5 | i-energy, i-mine, i-alloy, i-data, i-core |
| `src/views/HomeView.vue` | 5 | i-build, i-tech, i-map, i-army, i-arrow-right |
| `src/views/TechView.vue` | 1 | i-check |
| `src/views/MapView.vue` | 2 | i-check, i-arrow-right |
| `src/views/BattleView.vue` | 1 | i-sword |
| `src/views/RelicView.vue` | 1 | i-relic |
| `src/views/PrestigeView.vue` | 1 | i-restart |
| `src/components/layout/BottomNav.vue` | 1 | i-more |
| `src/lib/storage.test.ts` | 1 | i-energy |
| **合计** | **58** | 11 个源文件 + 1 个测试文件 |

---

## 5. 统一方案建议

### 5.1 总体判断

| 问题 | 建议 |
|------|------|
| 是否全部重命名 | **建议全部重命名**，但分期执行 |
| 是否有可删除项 | **3 个可删除**（i-settings, i-close, i-psionic） |
| 视觉是否需微调 | **5 个需微调**（安全边距超出 2px 的图标） |
| 规范是否需扩展 | **需新增 3 个类别前缀**（nav, res, ui） |
| 规范附录A 是否需修正 | **4 处勘误**（见附录） |

### 5.2 视觉微调建议

以下 5 个图标的安全边距超出 2px 以上，建议在重命名时一并微调：

| 图标 | 当前超出 | 建议调整 |
|------|---------|---------|
| i-mine | 菱形右顶点 x=22 | 缩 2px → 顶点 x=20，对应调整 path |
| i-relic | 菱形右顶点 x=22 | 缩 2px → 顶点 x=20，对应调整 path |
| i-crystal-nursery | 六边形底顶点 y=22 | 缩 2px → 顶点 y=20 |
| i-holo-core | 六边形顶点 x=21 y=22 | 缩 1-2px → x=20 y=20 |
| i-lab | 烧瓶底部 y=22 | 缩 2px → 底部 y=20 |

> i-sword 的 14.5 小数坐标建议取整为 14 或 15，同时检查视觉一致性。
> i-stellar-forge 的 4.9/2.8 小数为 45° 对角线几何需求，**建议保留**，但在规范中补充"45° 对角线端点允许小数"的例外说明。

### 5.3 分期执行建议

#### Phase A：清理废弃图标（零风险）

**范围**：删除 3 个零引用图标  
**修改文件**：IconsBase.vue（删 i-settings, i-close）、IconsUnit.vue（删 i-psionic）  
**引用修改**：0 处  
**验证**：vue-tsc + vite build

| 操作 | 图标 |
|------|------|
| 删除 | i-settings, i-close, i-psionic |

#### Phase B：UI 工具 + 兵种图标重命名（低风险）

**范围**：7 个图标重命名  
**修改文件**：IconsBase.vue, IconsUnit.vue + 5 个引用文件  
**引用修改**：约 10 处

| 图标 | 新名 | 引用文件 |
|------|------|---------|
| i-check → i-ui-check | TechView.vue, MapView.vue |
| i-arrow-right → i-ui-arrow-right | HomeView.vue, MapView.vue |
| i-sword → i-ui-sword | BattleView.vue |
| i-more → i-ui-more | BottomNav.vue |
| i-assault → i-unit-assault | units.ts |
| i-guard → i-unit-guard | units.ts |
| i-heavy → i-unit-heavy | units.ts |

#### Phase C：遗物概念图标重命名（低风险）

**范围**：2 个图标重命名  
**修改文件**：IconsRelic.vue, navigation.ts, relics.ts, RelicView.vue  
**引用修改**：3 处

| 图标 | 新名 | 引用文件 |
|------|------|---------|
| i-mystery → i-relic-omega | relics.ts |
| i-relic → i-nav-relic | navigation.ts, RelicView.vue |

#### Phase D：科技概念图标重命名（中风险）

**范围**：5 个仅用于科技节点的图标  
**修改文件**：IconsBuilding.vue, tech.ts  
**引用修改**：6 处

| 图标 | 新名 |
|------|------|
| i-dyson → i-tech-dyson |
| i-refinery → i-tech-refine |
| i-nano-forge → i-tech-nano-forge |
| i-ion-casting → i-tech-ion-casting |
| i-stellar-forge → i-tech-stellar-forge |

#### Phase E：建筑图标重命名（中风险）

**范围**：11 个建筑图标  
**修改文件**：IconsBuilding.vue, buildings.ts, tech.ts  
**引用修改**：约 20 处

| 图标 | 新名 |
|------|------|
| i-reactor → i-bld-reactor |
| i-crystal-nursery → i-bld-crystal-nursery |
| i-deep-drill → i-bld-deep-drill |
| i-silicon-ring → i-bld-silicon-ring |
| i-lab → i-bld-lab |
| i-dark-detector → i-bld-dark-detector |
| i-dark-capture → i-bld-dark-capture |
| i-dark-well → i-bld-dark-well |
| i-neural-hub → i-bld-neural-hub |
| i-holo-core → i-bld-holo-core |
| i-quantum → i-bld-quantum |

> 同时执行 5 个图标的视觉微调（见 §5.2）。

#### Phase F：资源图标重命名（高风险）

**范围**：5 个跨场景复用的资源图标  
**修改文件**：IconsResource.vue, IconsBase.vue(i-core), resources.ts, buildings.ts, tech.ts, storage.test.ts  
**引用修改**：约 20 处

| 图标 | 新名 |
|------|------|
| i-energy → i-res-energy |
| i-alloy → i-res-alloy |
| i-mine → i-res-crystal |
| i-data → i-res-data |
| i-core → i-res-dark |

> ⚠️ 这 5 个图标跨 3-4 个文件被引用，且涉及 stores/resources.ts（核心 store），建议单独一个 PR 完成并完整测试。

#### Phase G：导航图标重命名（中风险）

**范围**：5 个导航图标（i-home, i-build, i-tech, i-map, i-army 已在 Phase C/D/E 处理了 i-relic 和 i-restart）  
**修改文件**：IconsBase.vue, navigation.ts, HomeView.vue, tech.ts  
**引用修改**：约 10 处

| 图标 | 新名 |
|------|------|
| i-home → i-nav-home |
| i-build → i-nav-build |
| i-tech → i-nav-tech |
| i-map → i-nav-explore |
| i-army → i-nav-army |

> ⚠️ i-map 和 i-army 同时被 tech.ts 引用为科技节点图标，重命名后需确认科技节点是否仍用导航图标表示，或应为其创建独立 i-tech-* 图标。

#### Phase H：规范更新

- spec §7.2 新增 `nav`、`res`、`ui` 三个类别前缀
- spec §7.3 删除"现有 39 个图标的 id 不做重命名"条款
- spec §1.3 补充"45° 对角线端点允许小数"例外
- spec 附录A 修正 4 处数据错误（见附录）
- spec 版本升至 v2.0

### 5.4 执行优先级

```
Phase A（零风险，立即执行）
    ↓
Phase B（低风险，UI+兵种）
    ↓
Phase C（低风险，遗物概念）
    ↓
Phase D（中风险，科技概念）
    ↓
Phase E（中风险，建筑，含视觉微调）
    ↓
Phase F（高风险，资源，单独 PR）
    ↓
Phase G（中风险，导航）
    ↓
Phase H（规范更新）
```

### 5.5 不建议的操作

1. **不建议为跨场景复用的图标创建多个独立副本**（如为 i-energy 同时创建 i-res-energy + i-bld-solar + i-tech-energy-eff-1）。当前 88 个图标已满足需求，拆分会导致图标数膨胀至 100+，增加维护负担。
2. **不建议仅清理不重命名**。仅删除 3 个废弃图标而不重命名剩余 36 个，会留下"半统一"状态，新开发者无法通过命名区分新旧图标。
3. **不建议在重命名同时做视觉重设计**。命名统一和视觉优化是两个正交问题，混在同一 PR 中会增加 review 难度和回滚风险。视觉微调仅限安全边距超出的 5 个图标，不涉及重设计。

---

## 6. 附录：规范附录A 勘误表

梳理过程中发现 spec v1.1 附录A 存在 4 处与实际 SVG 代码不符的数据错误（v1.1 架构审核未覆盖）：

| # | 图标 | 附录A 记录 | 实际 SVG | 差异类型 |
|---|------|-----------|---------|---------|
| 1 | i-assault | 元素数 2 | **1**（1 个 path） | 元素计数错误 |
| 2 | i-guard | 元素数 1 | **2**（2 个 path：盾形 + 勾） | 元素计数错误 |
| 3 | i-heavy | 元素数 2 | **3**（1 rect + 2 path） | 元素计数错误 |
| 4 | i-psionic | 元素数 2 + dasharray | **3**（1 circle + 2 path）+ **无 dasharray** | 元素计数 + 特殊属性双重错误 |

### 勘误详情

**i-assault**：附录A 记录"2 元素，菱形+线"，实际 SVG 为单个 `<path>` 元素（1 条复杂 path 描绘整个人形），无第二个元素。

**i-guard**：附录A 记录"1 元素，盾形"，实际 SVG 为 2 个 `<path>` 元素（盾形轮廓 + 内部勾），非 1 个。

**i-heavy**：附录A 记录"2 元素，矩形+线"，实际 SVG 为 3 个元素（1 `<rect>` 外框 + 1 `<path>` 内框 + 1 `<path>` 十二向延伸线），非 2 个。

**i-psionic**：附录A 记录"2 元素，圆+弧线，dasharray"，实际 SVG 为 3 个元素（1 `<circle>` 中心 + 2 `<path>` 四向线 + 四角对角线），且**无任何 dasharray 属性**。spec §4.3 虚线模式表中"i-psionic 使用 `2 3`"的记录也是错误的。

> **建议**：在 Phase H 规范更新时一并修正这 4 处错误，spec 版本升至 v2.0。

---

## 附录：梳理数据来源

| 数据源 | 路径 | 用途 |
|--------|------|------|
| 图标规范 | `docs/icon-design-spec.md` v1.1 | 合规判定依据 |
| IconsBase.vue | `src/components/ui/icons/IconsBase.vue` | 13 个旧图标 SVG 源码 |
| IconsResource.vue | `src/components/ui/icons/IconsResource.vue` | 4 个旧图标 SVG 源码 |
| IconsBuilding.vue | `src/components/ui/icons/IconsBuilding.vue` | 16 个旧图标 + 6 个 Phase 2 新图标 |
| IconsRelic.vue | `src/components/ui/icons/IconsRelic.vue` | 2 个旧图标 + 17 个 Phase 1 新图标 |
| IconsTech.vue | `src/components/ui/icons/IconsTech.vue` | 21 个 Phase 1-2 新图标 |
| IconsStronghold.vue | `src/components/ui/icons/IconsStronghold.vue` | 4 个 Phase 3 新图标 |
| IconsUnit.vue | `src/components/ui/icons/IconsUnit.vue` | 4 个旧图标 + 1 个 Phase 3 新图标 |
| navigation.ts | `src/data/navigation.ts` | 导航项图标引用 |
| buildings.ts | `src/data/buildings.ts` | 建筑图标引用 |
| tech.ts | `src/data/tech.ts` | 科技 + 分支图标引用 |
| relics.ts | `src/data/relics.ts` | 遗物图标引用 |
| units.ts | `src/data/units.ts` | 兵种图标引用 |
| resources.ts | `src/stores/resources.ts` | 资源图标引用 |
| explore.ts | `src/data/explore.ts` | 探索节点（无图标字段） |
| pve.ts | `src/data/pve.ts` | 据点图标引用（全部为 Phase 3 新图标） |
| Views × 6 | `src/views/*.vue` | 界面中的图标引用 |
| Layout × 1 | `src/components/layout/BottomNav.vue` | 底栏图标引用 |

---

*报告完毕。纯梳理，未修改任何代码。*
