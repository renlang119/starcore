# 星核纪元 · P0-5 / P0-6 Token 映射表

> **产出方**：设计
> **日期**：2026-07-16
> **方案依据**：主界面 UI 总体推进方案 P0-5 / P0-6 章节（计划文档已退役，git 历史可查）
> **本阶段定位**：只出规范，不改源码。前端拿到本文件后开始落地替换。
> **落地方式**：CSS 自定义属性，集中在 `src/styles/tokens.css` `:root`
> （v0.55 起样式模块化；早期写 `style.css` `:root`，现 `style.css` 仅作 @import 聚合入口）

---

## 一、P0-5 间距 Token 映射表

### 1.1 Token 定义（8 级，4px 基准）

在 `src/styles/tokens.css` `:root` 中定义（早期为 `style.css`）：

```css
/* —— 间距（4px 基准，8 级线性阶梯）—— */
--space-1: 4px;   /* 原子间距：icon-text 紧贴、tag 内微间距 */
--space-2: 8px;   /* 紧凑间距：列表项内 gap、tag 间距 */
--space-3: 12px;  /* 卡片 padding、小列表 gap */
--space-4: 16px;  /* 页面级 gap、标准间距（基准节奏） */
--space-5: 20px;  /* section 间距、宽松间距 */
--space-6: 24px;  /* modal padding、大间距 */
--space-7: 32px;  /* 区块间距、超宽间距 */
--space-8: 40px;  /* 展示型间距（预留） */
```

**设计原则**：
1. **4px 基准**：所有 Token 值均为 4 的整数倍，保证像素对齐与子像素渲染清晰
2. **8 级够用**：覆盖当前项目 2px–24px 全部散落值，并预留 32/40px 供未来大间距场景
3. **线性阶梯**：小间距段（4→8→12）步进 4px，中间距段（12→16→20→24）步进 4px，大间距段（24→32→40）步进 8px，符合视觉感知的对数曲线

### 1.2 现状值 → Token 映射表

> 以下基于全项目 `gap / padding / margin` 硬编码值扫描（18 个文件，约 168 处）。

| 现状散落值 | 出现位置（示例） | → Token 名 | 新值 | 变化 | 说明 |
|:---:|---|:---:|:---:|:---:|---|
| `2px` | UpgradeCountdown `.ts-tag` gap、BottomNav `.tab` gap | `--space-1` | 4px | +2px | 2px 低于 4px 基准，统一上提至 4px，肉眼可辨且不破坏紧凑感 |
| `3px` | CostTag gap、HomeView `.rate-pill` gap | `--space-1` | 4px | +1px | 3px 非基准倍数，归入 `--space-1` |
| `4px` | 多处：RelicView effect-list gap、TechView `.t-effects` gap、AppShell `.brand-row` padding、BottomNav `.more-panel` padding | `--space-1` | 4px | 0 | 直接映射 |
| `6px` | BuildView `.sector-tabs` gap、BattleView `.enemy-list` gap、ArmyView `.u-stats` gap、PrestigeView `.node-effects` gap | `--space-2` | 8px | +2px | 6px 非基准倍数，上提至 8px，视觉差异极小 |
| `8px` | **大量**：各 View 列表 gap、HomeView `.hero` gap、SideNav `.stat-list` gap、TopBar `.resource-pill` gap | `--space-2` | 8px | 0 | 直接映射，当前最高频间距值 |
| `10px` | HomeView `.event-item` gap、`.action-item` gap、TechView `.t-head` gap、ArmyView `.u-head` gap、MapView `.stronghold-item` gap | `--space-3` | 12px | +2px | 10px 非基准倍数，上提至 12px，列表项呼吸感略增 |
| `12px` | **大量**：各 View card padding、HomeView `.action-item` padding、TopBar `.topbar` padding、SideNav nav-item padding | `--space-3` | 12px | 0 | 直接映射 |
| `14px` | style.css `.card` padding、BuildView/TechView/ArmyView `.building-card`/`.tech-card`/`.unit-card` padding | `--space-3` | 12px | **-2px** | **卡片 padding 统一为 12px**（方案 P0-5 迁移建议），14px 降 2px |
| `16px` | AppShell `.content` padding、OfflineReport modal padding、各 View 根容器 gap | `--space-4` | 16px | 0 | 直接映射 |
| `20px` | HomeView `.home` gap、MapView `.map-view` gap、OfflineReport `.gains` margin-bottom | `--space-5` | 20px | 0 | section 级间距保留 |
| `24px` | ModalOverlay padding、App.vue footer gap、AppShell `.content` desktop padding、OfflineReport modal padding | `--space-6` | 24px | 0 | 直接映射 |
| `80px` | AppShell `.content` padding-bottom（底部导航高度+安全距离） | 保留硬编码 | 80px | — | 此值为导航栏高度+安全区，非间距 Token 范畴，保留原值 |

### 1.3 迁移建议

#### 1.3.1 全局统一规则（方案 P0-5 要求）

| 场景 | 当前值 | 统一 Token | 新值 | 影响范围 |
|---|:---:|:---:|:---:|---|
| **页面根容器 gap** | 16px / 20px 混用 | `--space-4` | 16px | HomeView、MapView 的 20px 需降为 16px，与其余 View 统一 |
| **卡片 padding** | 12px / 14px 混用 | `--space-3` | 12px | style.css `.card`、各 View 的 building/tech/unit/relic/stronghold card |
| **列表项 gap** | 6px / 8px / 10px 混用 | `--space-2` | 8px | 各 View 的 list gap 统一为 8px |
| **section 内标题 margin-bottom** | 6px / 8px / 10px 混用 | `--space-2` | 8px | `.section-title`、`.b-head`、`.t-head` 等 |
| **modal / 大容器 padding** | 16px / 24px 混用 | `--space-4`（移动）/ `--space-6`（桌面） | 16px / 24px | ModalOverlay 移动端 16px、桌面端 24px（已有响应式区分） |

#### 1.3.2 逐文件迁移清单

| 文件 | 硬编码处数 | 主要涉及 Token | 优先级 |
|---|:---:|---|:---:|
| `src/style.css` | ~5 处 | `--space-2/3/4` | 🔴 最高（全局工具类） |
| `src/views/HomeView.vue` | ~15 处 | `--space-1/2/3/4/5` | 🔴 最高（首屏） |
| `src/views/BuildView.vue` | ~12 处 | `--space-2/3/4` | 🟡 高 |
| `src/views/TechView.vue` | ~10 处 | `--space-2/3/4` | 🟡 高 |
| `src/views/MapView.vue` | ~12 处 | `--space-2/3/4/5` | 🟡 高 |
| `src/views/ArmyView.vue` | ~18 处 | `--space-1/2/3/4` | 🟡 高 |
| `src/views/BattleView.vue` | ~20 处 | `--space-1/2/3/4/6` | 🟡 高 |
| `src/views/PrestigeView.vue` | ~18 处 | `--space-2/3/4/6` | 🟡 高 |
| `src/views/RelicView.vue` | ~14 处 | `--space-1/2/3/4/5` | 🟡 高 |
| `src/components/layout/AppShell.vue` | ~6 处 | `--space-2/4/6` | 🟡 高 |
| `src/components/layout/TopBar.vue` | ~5 处 | `--space-1/2/3` | 🟢 中 |
| `src/components/layout/SideNav.vue` | ~7 处 | `--space-1/2/3` | 🟢 中 |
| `src/components/layout/BottomNav.vue` | ~8 处 | `--space-1/2/3` | 🟢 中 |
| `src/components/layout/OfflineReport.vue` | ~10 处 | `--space-2/3/4/5` | 🟢 中 |
| `src/components/ui/UpgradeCountdown.vue` | ~15 处 | `--space-1/2/3` | 🟢 中 |
| `src/components/ui/ModalOverlay.vue` | ~1 处 | `--space-6` | 🟢 中 |
| `src/components/ui/CostTag.vue` | ~1 处 | `--space-1` | 🟢 低 |
| `src/App.vue` | ~1 处 | `--space-6` | 🟢 低 |

#### 1.3.3 特殊保留项

以下值**不纳入 Token 替换**，保留硬编码并加注释说明原因：

| 值 | 位置 | 保留原因 |
|:---:|---|---|
| `80px` | AppShell `.content` padding-bottom | 底部导航高度 + safe-area，非间距语义 |
| `1px` | 各处 border-width、padding `1px` | 边框/微修饰，非间距语义 |
| `2px` | outline-offset、border-radius `3px` | 非间距属性，不纳入间距 Token |
| `180px / 160px` | ~~UpgradeCountdown modal-log max-height~~ | 已废止：v0.5x 折叠动画改为 `max-height: 500px`（组件迁入 `src/components/build/`） |
| `32px / 36px / 100px` | log-round width、q-name width 等 | 固定宽度，非间距 |

#### 1.3.4 迁移后验证

```bash
# 迁移完成后执行，确认零残留（排除注释行）
rg "(\bgap|padding|margin[a-z-]*)\s*:\s*\d+px" src/ --glob="*.{vue,css}" -n
# 预期：仅剩特殊保留项（80px、1px 等）
```

---

## 二、P0-6 字号 Token 映射表

### 2.1 Token 定义（7 级，1:1.250 模数）

在 `src/styles/tokens.css` `:root` 中定义（早期为 `style.css`）：

```css
/* —— 字号（1:1.250 模数，Major Third，base 16px）—— */
--text-xs:      12px;  /* 辅助文本：标签、徽章、时间戳、描述性小字 */
--text-sm:      14px;  /* 次要文本：正文补充、卡片描述、列表次行 */
--text-base:    16px;  /* 正文基准：按钮文字、主要正文 */
--text-lg:      20px;  /* 强调文本：区块标题、关键数值、page-title */
--text-xl:      25px;  /* 大标题：页面标题（预留） */
--text-2xl:     31px;  /* 核心数值：Hero 能量值（P0-7 目标 28px→≈31px） */
--text-display: 39px;  /* 展示标题：Hero 展示型大字（预留） */
```

**模数推导**（base = 16px，ratio = 1.250）：

| 步进 | 计算 | 理论值 | 取值 | 偏差 |
|:---:|---|:---:|:---:|---|
| -2 | 16 ÷ 1.250² | 10.24px | **12px** | ↑1.76px，**主动上提**：消除 9/10/11px 过小字号，保证深色背景可读性 |
| -1 | 16 ÷ 1.250 | 12.80px | **14px** | ↑1.20px，**微调**：对齐项目现有 body 14px，保证迁移平滑 |
| 0 | 16 | 16.00px | **16px** | 0，精确 |
| +1 | 16 × 1.250 | 20.00px | **20px** | 0，精确 |
| +2 | 16 × 1.250² | 25.00px | **25px** | 0，精确 |
| +3 | 16 × 1.250³ | 31.25px | **31px** | -0.25px，四舍五入 |
| +4 | 16 × 1.250⁴ | 39.06px | **39px** | -0.06px，四舍五入 |

**设计决策说明**：
1. **--text-xs 设为 12px 而非 10px**：方案 §2.2 明确指出 10/11px 在深色背景偏小、可读性差。将最小字号上提至 12px，一次根治。原 9/10/11px 全部映射至 `--text-xs`（12px）。
2. **--text-sm 设为 14px 而非 13px**：项目 body 当前为 14px，13px 作为次级文本与 14px 仅差 1px，视觉区分度不足。统一 13/14px → `--text-sm`（14px），保留 12px（--text-xs）与 14px（--text-sm）的 2px 视觉差。
3. **--text-2xl 设为 31px**：P0-7 要求核心数值放大至 28px，但 28px 不在 1.250 模数上。选择最近的模数值 31px（31.25 取整），比 28px 稥大 3px，视觉冲击力更强，符合"核心数值成为全页视觉焦点"的目标。
4. **--text-display 预留 39px**：当前项目无使用场景，为 P1-1 Hero 重构预留。

### 2.2 现状值 → Token 映射表

> 以下基于全项目 `font-size` 硬编码值扫描（17 个文件，约 139 处）。

| 现状值 | 出现位置（示例） | → Token 名 | 新值 | 变化 | 说明 |
|:---:|---|:---:|:---:|:---:|---|
| `9px` | RelicView `.rarity-badge` | `--text-xs` | 12px | +3px | 9px 远低于可读性下限，上提至 12px |
| `10px` | HomeView `.core-label`、TopBar `.rate`、TechView `.t-eff`、ArmyView `.p-label`、PrestigeView `.node-eff`、BottomNav `.tab .label`、UpgradeCountdown 多处 | `--text-xs` | 12px | +2px | **核心迁移目标**：全项目 10px 硬编码约 30+ 处，全部映射至 `--text-xs` |
| `11px` | style.css `.stat`、RelicView `.r-desc`、BuildView `.b-prod`、MapView `.n-locked`、TechView `.t-req`、BattleView `.f-tab`、PrestigeView `.neg-label` 等 | `--text-xs` | 12px | +1px | 11px 统一上提至 12px |
| `12px` | style.css `.page-sub`/`.empty-msg`、BuildView `.b-level`/`.b-desc`、HomeView `.rate-display`、MapView `.n-desc`、各处正文描述 | `--text-xs` | 12px | 0 | 直接映射（当前高频小字号） |
| `13px` | style.css `.section-title`、BuildView `.sector-tab`、MapView `.layer-header`、BattleView `.back-btn`/`.e-name`、ArmyView `.f-tab`、SideNav `.nav-item` | `--text-sm` | 14px | +1px | 13px 微提至 14px，与 body 统一 |
| `14px` | style.css `body`、HomeView `.section-title`/`.a-label`、MapView `.n-name`、TechView `.t-name`、App.vue footer、TopBar `.resource-name`、OfflineReport `.btn-confirm` | `--text-sm` | 14px | 0 | 直接映射（当前 body 基准） |
| `15px` | BuildView `.b-name`、PrestigeView `.btn-transcend` | `--text-base` | 16px | +1px | 15px 非模数值，上提至 16px |
| `16px` | SideNav `.brand-name`、ArmyView `.p-value`、OfflineReport `.g-amount` | `--text-base` | 16px | 0 | 直接映射 |
| `18px` | BattleView `.s-name`/`.result-title`、OfflineReport `.title`、PrestigeView `.confirm-title`/`.preview-value` | `--text-lg` | 20px | +2px | 18px 非模数值，上提至 20px |
| `20px` | style.css `.page-title`、HomeView `.core-value`（移动端） | `--text-lg` | 20px | 0 | 直接映射 |
| `22px` | HomeView `.core-value`（桌面端 `@media`） | `--text-xl` | 25px | +3px | 22px 非模数值，上提至 25px |
| `24px` | BattleView `.result-title` | `--text-xl` | 25px | +1px | 24px 接近 25px，微调 |
| `28px` | PrestigeView `.neg-value` | `--text-2xl` | 31px | +3px | 28px 非模数值，映射至最近的 `--text-2xl`（31px） |
| `28px` | HomeView `.core-value`（**P0-7 目标值**） | `--text-2xl` | 31px | +3px | P0-7 原目标 28px → Token 化后取模数值 31px，视觉差异极小 |

### 2.3 迁移建议

#### 2.3.1 语义用途对照表

| Token | 值 | 语义用途 | 当前对应值 | 典型使用场景 |
|:---:|:---:|---|:---:|---|
| `--text-xs` | 12px | 辅助信息 | 9/10/11/12px | 标签、徽章、时间戳、产出率、描述小字、导航 label |
| `--text-sm` | 14px | 次要文本 | 13/14px | 卡片描述、列表次行、正文补充、body 基准 |
| `--text-base` | 16px | 正文/按钮 | 15/16px | 按钮文字、品牌名、power 数值 |
| `--text-lg` | 20px | 强调标题 | 18/20px | page-title、section 大标题、modal 标题 |
| `--text-xl` | 25px | 大标题 | 22/24px | 页面大标题（预留，当前少用） |
| `--text-2xl` | 31px | 核心数值 | 28px | Hero 核心能量值、转生负熵值 |
| `--text-display` | 39px | 展示标题 | —（预留） | P1-1 Hero 重构展示型大字 |

#### 2.3.2 逐文件迁移清单

| 文件 | 硬编码处数 | 主要涉及 Token | 优先级 |
|---|:---:|---|:---:|
| `src/style.css` | ~6 处 | `--text-xs/sm/lg` | 🔴 最高（全局工具类） |
| `src/views/HomeView.vue` | ~10 处 | `--text-xs/sm/lg/2xl` | 🔴 最高（首屏 + P0-7） |
| `src/views/BattleView.vue` | ~16 处 | `--text-xs/sm/base/lg/xl` | 🟡 高 |
| `src/views/ArmyView.vue` | ~14 处 | `--text-xs/sm/base` | 🟡 高 |
| `src/views/PrestigeView.vue` | ~14 处 | `--text-xs/sm/base/lg/2xl` | 🟡 高 |
| `src/views/RelicView.vue` | ~8 处 | `--text-xs/sm/base` | 🟡 高 |
| `src/views/BuildView.vue` | ~8 处 | `--text-xs/sm/base` | 🟡 高 |
| `src/views/TechView.vue` | ~7 处 | `--text-xs/sm/base` | 🟡 高 |
| `src/views/MapView.vue` | ~10 处 | `--text-xs/sm` | 🟡 高 |
| `src/components/layout/TopBar.vue` | ~4 处 | `--text-xs/sm` | 🟢 中 |
| `src/components/layout/SideNav.vue` | ~3 处 | `--text-sm/base` | 🟢 中 |
| `src/components/layout/BottomNav.vue` | ~2 处 | `--text-xs/sm` | 🟢 中 |
| `src/components/layout/OfflineReport.vue` | ~7 处 | `--text-xs/sm/base/lg` | 🟢 中 |
| `src/components/ui/UpgradeCountdown.vue` | ~8 处 | `--text-xs/sm` | 🟢 中 |
| `src/components/ui/CostTag.vue` | ~1 处 | `--text-xs` | 🟢 低 |
| `src/App.vue` | ~1 处 | `--text-sm` | 🟢 低 |

#### 2.3.3 特殊处理项

| 场景 | 处理方式 | 原因 |
|---|---|---|
| `body { font-size: 14px }` | 改为 `font-size: var(--text-sm)` | body 当前 14px 对应 `--text-sm`，非 `--text-base`。后续如需全局放大 body，改 Token 值即可 |
| HomeView `.core-value` 移动端 20px / 桌面端 22px | 移动端 → `--text-lg`（20px），桌面端 → `--text-xl`（25px）。**P0-7 完成后**：移动端 → `--text-2xl`（31px），桌面端 → `--text-2xl`（31px），去掉媒体查询差异 | P0-7 要求核心数值放大为全页焦点，统一用 `--text-2xl`，移动/桌面一致 |
| PrestigeView `.neg-value` 28px | → `--text-2xl`（31px） | 与 HomeView 核心数值共用同一 Token，保持"核心数值"语义一致 |
| `font-size: 100%` / `font-size: inherit` | 保留，不替换 | 语义正确，非硬编码 |
| `@media (min-width: 768px)` 内的字号覆盖 | 替换为对应 Token 的桌面值 | 如 HomeView `.core-value` 桌面 22px → `--text-xl`（25px）或 P0-7 后 `--text-2xl` |

#### 2.3.4 迁移后验证

```bash
# 迁移完成后执行，确认零残留
rg "font-size\s*:\s*\d+px" src/ --glob="*.{vue,css}" -n
# 预期：零结果

# 确认 10px 硬编码完全消除
rg "font-size\s*:\s*10px" src/ --glob="*.{vue,css}" -n
# 预期：零结果（P0-6 验收标准）
```

> **口径修正（v0.52 回写）**：上述「零结果」预期有一个已知豁免——
> P1-8 要求主标题 `17px`，落地为 `src/styles/utilities.css` `.section-title { font-size: 17px }`，
> 是全项目唯一刻意保留的硬编码字号（Token 表无 17px 档位）。P0-6 验收以此豁免为准，
> 即：除 `.section-title` 外零硬编码。
>
> **当前缺口（v0.63 核对）**：`src/views/RelicView.vue` `.material-tag { font-size: 10px }`
> 系 v0.61 新增组件带入的豁免外残留，待修复。
>
> **缺口销项（v0.83 核对）**：`.material-tag` 现为 `font-size: var(--text-xs)`，
> 上述缺口已修复，本条仅留档。

#### 2.3.5 Stylelint 防回潮（建议 P1 阶段引入）

```jsonc
// .stylelintrc.json（片段）
{
  "rules": {
    "declaration-property-value-allowed-list": {
      "font-size": ["/var\\(--text-/", "inherit", "1em", "100%"],
      "gap": ["/var\\(--space-/", "0", "normal"],
      "padding": ["/var\\(--space-/", "0"],
      "margin": ["/var\\(--space-/", "0", "auto"]
    }
  }
}
```

> P0 阶段可不引入 Stylelint，P1 之后视情况添加，防止硬编码回潮。

---

## 三、Token CSS 落地参考

前端拿到本文件后，在 `src/styles/tokens.css` `:root` 中添加以下代码块（放在现有 `--radius` 和 `--ease-out` 之间）：

```css
  /* —— 间距（4px 基准，8 级线性阶梯）—— */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-7: 32px;
  --space-8: 40px;

  /* —— 字号（1:1.250 模数，Major Third，base 16px）—— */
  --text-xs:      12px;
  --text-sm:      14px;
  --text-base:    16px;
  --text-lg:      20px;
  --text-xl:      25px;
  --text-2xl:     31px;
  --text-display: 39px;
```

---

## 四、验收标准

| 验收项 | P0-5 间距 | P0-6 字号 |
|---|---|---|
| Token 已定义 | `:root` 中 `--space-1~8` | `:root` 中 `--text-xs~display` |
| 硬编码消除 | `rg "(\bgap\|padding\|margin[a-z-]*)\s*:\s*\d+px"` 仅剩特殊保留项 | `rg "font-size\s*:\s*\d+px"` 零结果 |
| 10px 消除 | — | 全项目无 `font-size: 10px` 硬编码 |
| 统一规则 | 页面 gap = `--space-4`、卡片 padding = `--space-3` | body = `--text-sm`、核心数值 = `--text-2xl` |
| 跨页面一致 | 同类组件间距视觉一致 | 同类文本字号视觉一致 |
| 回归无异常 | 7 个 View × 2 断点截图对比无布局破坏 | 7 个 View × 2 断点截图对比无文字溢出/留白 |

---

## 五、补充登记（v0.52）

**颜色 Token 遗漏补登**：`--color-core-deep: #006b7a`（`src/styles/tokens.css` :root 定义，
用于 App/SideNav 背景渐变的深青色端点）。该 Token 为全局颜色体系成员，
此前未在本文档登记，现补记。

**组件级注入变量口径**：`--accent`（按钮分类强调色）、`--ov-color`（文明概况指标色）
等属**组件级 CSS 变量**——由使用方在元素上内联注入（如 `style="--accent: var(--color-alert)"`），
不进 `:root` 全局 Token 表；文档检索全局 Token 时不应期待它们出现。

---

> **交付状态**：规范已落地（v0.63 已按当前实现回写核对，含模块化落地位置与豁免口径更新）。
