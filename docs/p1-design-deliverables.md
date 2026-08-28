# 星核纪元 · P1 阶段设计交付物

> **产出方**：设计
> **日期**：2026-07-16
> **方案依据**：`docs/home-ui-总体推进方案.md` P1-1 ~ P1-6
> **本阶段定位**：只出设计稿/规范，不改源码。前端拿到本文件后按参数落地。
> **Token 体系**：沿用 P0 已建立的 `--space-1~8`、`--text-xs~display`、`--icon-xs~lg`、`--color-*`、`--radius-*`、`--ease-out`

---

## 目录

1. [P1-1 Hero 核心区重构视觉稿](#p1-1-hero-核心区重构视觉稿)
2. [P1-2 行动队列合并视觉稿](#p1-2-行动队列合并视觉稿)
3. [P1-3 桌面端双列布局稿](#p1-3-桌面端双列布局稿)
4. [P1-4 中英字体断裂修复方案决策](#p1-4-中英字体断裂修复方案决策)
5. [P1-5 按钮系统规范](#p1-5-按钮系统规范)
6. [P1-6 文明概况视觉层次规范](#p1-6-文明概况视觉层次规范)

---

## P1-1 Hero 核心区重构视觉稿

### 1.1 设计目标

将 Hero 核心区从「160px 小贴图」升级为「200/240px 沉浸式能量体」，实现：
- 尺寸放大 → 首屏视觉焦点确立
- 光晕渗透 → 核心与背景融为一体，而非贴纸
- 交互化 → 点击核心跳转建造页
- 产出率规范化 → 14px + "/s" 后缀

### 1.2 移动端版（< 768px）

```
┌──────────────────────────────────────┐
│              TopBar                  │
├──────────────────────────────────────┤
│                                      │
│         ┌─────────────────┐          │
│         │   ░░░░░░░░░░░   │ ← 外层光晕渗透 (240px)
│         │  ░ ┌─────────┐ ░│          │   opacity 0→0.15 渐变
│         │  ░ │  ◯ r3   │ ░│          │
│         │  ░ │ ◯ r2    │ ░│          │ ← 核心环系 (200px)
│         │  ░ │◯ r1     │ ░│          │
│         │  ░ │  1,234  │ ░│          │ ← 核心数值 (text-2xl)
│         │  ░ │ 星核能量 │ ░│          │ ← 核心标签 (text-xs)
│         │  ░ └─────────┘ ░│          │
│         │   ░░░░░░░░░░░   │          │
│         └─────────────────┘          │
│           +12.5 /s ← 产出率           │ ← 14px, --color-core
│                                      │
├──────────────────────────────────────┤
```

#### 详细参数

| 元素 | 参数 | 值 |
|------|------|-----|
| `.core-visual` 尺寸 | width / height | `200px × 200px` |
| `.core-visual` padding | 上下留白 | `var(--space-6) 0 var(--space-4)`（24px / 16px）|
| `.core-ring.r1` | width/height | `100%`（200px），border `1px solid var(--color-core)`，opacity `.3` |
| `.core-ring.r2` | width/height | `75%`（150px），border `1px dashed var(--color-core)`，opacity `.5` |
| `.core-ring.r3` | width/height | `50%`（100px），border `1px solid var(--color-core)`，opacity `.7` |
| `.core-glow` 基础尺寸 | width/height | `80px × 80px`（原 64px → 80px）|
| `.core-glow` filter | blur | `blur(16px)`（原 8px → 16px）|
| `.core-glow` background | radial-gradient | `radial-gradient(circle, rgba(0,229,255,.6) 0%, rgba(0,107,122,.3) 60%, transparent 100%)` |
| `.core-glow` 动画 | corePulse | `3s ease-in-out infinite`（保持现有）|
| `.core-visual::after`（新增）| 外层渗透光晕 | 见下方 CSS |
| `.core-value` 字号 | font-size | `var(--text-2xl)`（31px）|
| `.core-value` 字重 | font-weight | `900` |
| `.core-value` 颜色 | color | `var(--color-t-primary)` |
| `.core-value` 文字阴影 | text-shadow | `0 0 16px rgba(0,229,255,.5)`（原 12px → 16px）|
| `.core-value` 字体 | font-family | `var(--font-display)`（Orbitron 数字）|
| `.core-label` 字号 | font-size | `var(--text-xs)`（12px）|
| `.core-label` 颜色 | color | `var(--color-t-secondary)` |
| `.core-label` 间距 | margin-top | `var(--space-1)`（4px）|
| `.rate-display` 字号 | font-size | `var(--text-sm)`（14px）|
| `.rate-display` 颜色 | color | `var(--color-core)` |
| `.rate-display` 字重 | font-weight | `500` |
| `.rate-display` 内容格式 | — | `+12.5 /s`（数字 + 空格 + `/s`）|
| `.hero` 点击交互 | cursor / @click | `cursor: pointer` → `router.push('/build')` |

#### 外层渗透光晕 CSS（新增）

```css
.core-visual::after {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  width: 240px;
  height: 240px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgba(0, 229, 255, 0.15) 0%,
    rgba(0, 229, 255, 0.06) 40%,
    transparent 70%
  );
  filter: blur(8px);
  pointer-events: none;
  z-index: 0;
  animation: corePulse 3s ease-in-out infinite;
}
```

#### 核心可点击交互

```css
.core-visual {
  cursor: pointer;
  transition: transform .2s var(--ease-out);
}
.core-visual:hover {
  transform: scale(1.02);
}
.core-visual:active {
  transform: scale(0.98);
}
```

```vue
<!-- HomeView.vue 模板改动示意（前端落地时参考） -->
<div class="core-visual" @click="router.push('/build')" role="button" tabindex="0"
     @keydown.enter="router.push('/build')">
  <!-- 现有 ring/glow/center 结构不变 -->
</div>
```

### 1.3 桌面端版（≥ 768px）

```
┌──────────────────────────────────────────────────────────────┐
│  SideNav  │                  TopBar                          │
│           ├──────────────────────────────────────────────────┤
│           │                                                  │
│           │           ┌──────────────────────┐               │
│           │           │    ░░░░░░░░░░░░░░░   │ ← 外层光晕 (288px)│
│           │           │   ░ ┌────────────┐ ░ │               │
│           │           │   ░ │  ◯ r3     │ ░ │               │
│           │           │   ░ │ ◯ r2      │ ░ │ ← 核心环系 (240px)│
│           │           │   ░ │◯ r1       │ ░ │               │
│           │           │   ░ │  12,345   │ ░ │ ← text-display(39px)│
│           │           │   ░ │ 星核能量   │ ░ │               │
│           │           │   ░ └────────────┘ ░ │               │
│           │           │    ░░░░░░░░░░░░░░░   │               │
│           │           └──────────────────────┘               │
│           │              +125.3 /s ← 产出率                   │
│           │                                                  │
└──────────────────────────────────────────────────────────────┘
```

#### 桌面端差异参数

| 元素 | 移动端 | 桌面端 | 说明 |
|------|--------|--------|------|
| `.core-visual` 尺寸 | 200px | **240px** | 桌面空间充裕，放大 20% |
| `.core-visual::after` 渗透光晕 | 240px | **288px** | 等比放大 1.2× |
| `.core-glow` 基础尺寸 | 80px | **96px** | 等比放大 1.2× |
| `.core-value` 字号 | `--text-2xl`(31px) | **`--text-display`(39px)** | 桌面端核心数值升至 display 级 |
| `.core-value` 文字阴影 | 0 0 16px | **0 0 24px** | 桌面端光晕加强 |
| `.rate-display` 字号 | `--text-sm`(14px) | `--text-sm`(14px) | 保持 14px 不变 |
| `.hero` padding | `--space-6 0 --space-4` | `--space-8 0 --space-6` | 桌面端上下留白加大 |

#### 响应式 CSS

```css
@media (min-width: 768px) {
  .core-visual { width: 240px; height: 240px; }
  .core-visual::after { width: 288px; height: 288px; }
  .core-glow { width: 96px; height: 96px; }
  .core-value { font-size: var(--text-display); text-shadow: 0 0 24px rgba(0,229,255,.5); }
  .hero { padding: var(--space-8) 0 var(--space-6); }
}
```

### 1.4 产出率格式规范

| 场景 | 显示格式 | 示例 |
|------|---------|------|
| 正产出 | `+{value} /s` | `+12.5 /s` |
| 零产出 | `0 /s` | `0 /s` |
| 负产出 | `{value} /s` | `-3.2 /s`（红色 `--color-alert`） |

```css
.rate-display {
  font-size: var(--text-sm);      /* 14px */
  font-family: var(--font-mono);
  color: var(--color-core);
  font-weight: 500;
  letter-spacing: 0.5px;
}
.rate-display.negative {
  color: var(--color-alert);
}
```

### 1.5 无障碍

- `.core-visual` 添加 `role="button"` + `tabindex="0"` + `aria-label="星核核心，点击进入建造页面"`
- `@keydown.enter` 支持键盘跳转
- `prefers-reduced-motion: reduce` 时，禁用 `corePulse` 和 `scale` 变换（已由全局规则覆盖）

### 1.6 验收清单

| 验收项 | 标准 |
|--------|------|
| 核心尺寸 | 移动端 200px / 桌面端 240px |
| 光晕渗透 | `::after` 伪元素 240/288px，opacity 渐变可见 |
| 光晕 blur | `.core-glow` filter blur(16px) |
| 点击跳转 | 点击核心区域跳转 `/build` |
| 键盘可达 | Tab 聚焦 + Enter 跳转 |
| 产出率格式 | 14px + ` /s` 后缀 |
| 核心数值字号 | 移动端 31px / 桌面端 39px |
| Token 引用 | 全部使用 P0 Token，零硬编码 |

---

## P1-2 行动队列合并视觉稿

### 2.1 设计目标

将 HomeView 现有的「活跃事件」（`activeEvents`）和「推荐行动」（`suggestions`）两个独立 section 合并为单一「行动队列」模块，内部按状态分为两类视觉语言：

- **进行中** — 有进度条 + 脉冲 box-shadow，暗示「正在发生」
- **可执行** — 图标色块 + hover 上浮，暗示「可以去做」

### 2.2 数据结构映射

前端现有数据源（HomeView.vue `activeEvents` / `suggestions` computed）合并为统一队列：

```typescript
// 合并后的行动队列数据结构（前端落地参考）
interface ActionItem {
  id: string
  label: string
  detail: string
  path: string
  color: string         // 主题色
  icon: string          // symbol id
  status: 'in-progress' | 'actionable'  // 两类视觉语言
  progress?: number     // 0~1，仅 in-progress 有
}
```

**数据映射规则**：

| 来源 | 原状态 | 新 status | 判定条件 |
|------|--------|-----------|---------|
| `activeEvents` 中 `progress < 1` | 探索中/训练中 | `in-progress` | 有进度条 |
| `activeEvents` 中 `progress >= 1` | 可升级/可研究 | `actionable` | 资源已够 |
| `suggestions` 全部 | 推荐行动 | `actionable` | 情境推荐 |

**排序规则**：`in-progress` 优先 → `actionable` 按优先级（建筑 > 科技 > 探索 > 军事）

### 2.3 视觉稿 — 移动端

```
┌──────────────────────────────────────┐
│  ▎行动队列                    ← section-title │
├──────────────────────────────────────┤
│                                      │
│  ┌──────────────────────────────────┐│ ← in-progress 卡片
│  │ ▎⚡ 聚变反应堆升级    Lv.3→4  → ││   border-left 3px + 脉冲
│  │  ████████████░░░░ 67%            ││   进度条
│  └──────────────────────────────────┘│   ↓ box-shadow 呼吸
│                                      │
│  ┌──────────────────────────────────┐│ ← actionable 卡片
│  │ ┌──┐                             ││   图标色块
│  │ │⚙️│ 2个建筑可升级    立即升级 → ││   hover 上浮
│  │ └──┘ 资源充足                    ││   无进度条
│  └──────────────────────────────────┘│
│                                      │
│  ┌──────────────────────────────────┐│
│  │ ┌──┐                             ││
│  │ │🔬│ 3项科技可研究    解锁新 →  ││
│  │ └──┘ 技术                         ││
│  └──────────────────────────────────┘│
│                                      │
│  ┌──────────────────────────────────┐│
│  │ ┌──┐                             ││
│  │ │🗺️│ 2个星域待探索    开拓新 →  ││
│  │ └──┘ 星域                         ││
│  └──────────────────────────────────┘│
│                                      │
└──────────────────────────────────────┘
```

### 2.4 两类视觉语言参数

#### 进行中（in-progress）

```css
.action-item.in-progress {
  /* 卡片基础 */
  background: var(--color-surface);
  border: 1px solid var(--color-border-line);
  border-left: 3px solid var(--c);           /* 主题色左条 */
  border-radius: var(--radius-md);           /* 10px */
  padding: var(--space-3) var(--space-3);   /* 12px */
  position: relative;
  overflow: hidden;

  /* 脉冲呼吸 — 暗示"进行中" */
  box-shadow: 0 0 0 0 color-mix(in srgb, var(--c) 30%, transparent);
  animation: actionPulse 2s ease-in-out infinite;
}

@keyframes actionPulse {
  0%, 100% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--c) 20%, transparent);
  }
  50% {
    box-shadow: 0 0 12px 2px color-mix(in srgb, var(--c) 15%, transparent);
  }
}

/* 进度条 */
.action-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--color-elevated);
}
.action-progress-bar {
  height: 100%;
  background: var(--c);
  border-radius: 0 2px 2px 0;
  transition: width .5s var(--ease-out);
  box-shadow: 0 0 4px var(--c);             /* 进度条微光 */
}

/* 内容布局 */
.action-item.in-progress .action-btn {
  display: flex;
  align-items: center;
  gap: var(--space-3);                      /* 12px */
  width: 100%;
}
.action-item.in-progress .action-icon {
  color: var(--c);
  flex-shrink: 0;
  /* 图标尺寸 var(--icon-md) = 18px */
}
.action-item.in-progress .action-info {
  flex: 1;
  text-align: left;
  min-width: 0;
}
.action-item.in-progress .action-label {
  font-size: var(--text-sm);               /* 14px */
  font-weight: 600;
  color: var(--color-t-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.action-item.in-progress .action-detail {
  font-size: var(--text-xs);               /* 12px */
  color: var(--color-t-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.action-item.in-progress .action-arrow {
  color: var(--color-t-tertiary);
  flex-shrink: 0;
  /* 图标尺寸 var(--icon-sm) = 14px */
}
```

#### 可执行（actionable）

```css
.action-item.actionable {
  /* 卡片基础 — 与 in-progress 的视觉区分：无左色条，有图标色块 */
  background: var(--color-surface);
  border: 1px solid var(--color-border-line);
  border-radius: var(--radius-md);           /* 10px */
  padding: var(--space-3) var(--space-3);   /* 12px */
  transition: all .2s var(--ease-out);
}

/* hover 上浮 — 暗示"可点击操作" */
.action-item.actionable:hover {
  transform: translateY(-2px);
  background: var(--color-hover);
  border-color: var(--color-border-glow);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3),
              0 0 0 1px color-mix(in srgb, var(--c) 20%, transparent);
}

.action-item.actionable:active {
  transform: translateY(0) scale(0.98);
}

/* 内容布局 */
.action-item.actionable .action-btn {
  display: flex;
  align-items: center;
  gap: var(--space-3);                      /* 12px */
  width: 100%;
}

/* 图标色块 — 与 in-progress 的关键视觉区分 */
.action-item.actionable .action-icon-block {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);          /* 10px */
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--c) 15%, transparent);
  color: var(--c);
  flex-shrink: 0;
  /* 图标尺寸 var(--icon-lg) = 24px */
}

.action-item.actionable .action-info {
  flex: 1;
  text-align: left;
}
.action-item.actionable .action-label {
  font-size: var(--text-sm);               /* 14px */
  font-weight: 600;
  color: var(--color-t-primary);
}
.action-item.actionable .action-desc {
  font-size: var(--text-xs);               /* 12px */
  color: var(--color-t-secondary);
  margin-top: var(--space-1);              /* 4px */
}
.action-item.actionable .action-arrow {
  color: var(--color-t-tertiary);
  flex-shrink: 0;
  opacity: 0;
  transition: opacity .2s var(--ease-out), transform .2s var(--ease-out);
  /* 图标尺寸 var(--icon-md) = 18px */
}
.action-item.actionable:hover .action-arrow {
  opacity: 1;
  transform: translateX(2px);
}
```

### 2.5 两类视觉语言对比表

| 维度 | 进行中 (in-progress) | 可执行 (actionable) |
|------|----------------------|---------------------|
| **左色条** | ✅ 3px solid `var(--c)` | ❌ 无 |
| **图标呈现** | 纯色图标（继承 `var(--c)`） | 色块底 + 图标（40×40 圆角块） |
| **图标尺寸** | `var(--icon-md)` 18px | `var(--icon-lg)` 24px |
| **进度条** | ✅ 底部 2px + 微光 | ❌ 无 |
| **脉冲动画** | ✅ `actionPulse` 2s 呼吸 | ❌ 无 |
| **hover 效果** | 底色微变 | translateY(-2px) + 阴影 + 边框发光 |
| **arrow 图标** | 始终可见 | hover 时才出现（默认 opacity:0） |
| **副信息** | detail（进度百分比/等级） | desc（描述文案） |
| **背景微染** | 无（纯 surface） | 无（纯 surface，hover 时 hover 色） |
| **语义暗示** | "正在发生，等待完成" | "可以去做，点击行动" |

### 2.6 section 标题

```css
.action-queue-title {
  font-size: var(--text-sm);               /* 14px */
  font-weight: 600;
  color: var(--color-t-primary);
  margin-bottom: var(--space-3);           /* 12px */
  padding-left: var(--space-2);            /* 8px */
  border-left: 2px solid var(--color-core);
}
```

### 2.7 桌面端适配

桌面端（≥768px）行动队列在双列布局中占右侧 60%，列表项保持单列纵向排列（不改为多列），最大高度约束以避免过长：

```css
@media (min-width: 768px) {
  .action-queue {
    max-height: none;    /* 桌面端不限高，内容自然撑开 */
  }
  .action-list {
    gap: var(--space-3);  /* 卡片间距从 8px → 12px */
  }
}
```

### 2.8 空状态

当行动队列为空时（无进行中、无可执行）：

```css
.action-empty {
  padding: var(--space-6) var(--space-4);
  text-align: center;
  color: var(--color-t-tertiary);
  font-size: var(--text-sm);
}
```

```html
<div class="action-empty">
  星核静默中，等待你的指令…
</div>
```

### 2.9 验收清单

| 验收项 | 标准 |
|--------|------|
| 模块合并 | activeEvents + suggestions 合并为单一 section |
| 视觉区分 | in-progress 有左色条+进度条+脉冲；actionable 有色块+hover上浮 |
| 图标差异 | in-progress 用纯色 18px；actionable 用 40×40 色块 + 24px |
| arrow 差异 | in-progress 始终显示；actionable hover 显示 |
| 空状态 | 有空状态文案 |
| Token 引用 | 全部使用 P0 Token |
| 排序 | in-progress 优先于 actionable |

---

## P1-3 桌面端双列布局稿

### 3.1 设计目标

将桌面端内容区从「720px 单列」升级为「1040px 双列」，充分利用横向空间：

- Hero（左 40%）+ 行动队列（右 60%）并排
- 文明概况 6 列横排
- 行动区在桌面端保持单列（因已与 Hero 并排）

### 3.2 布局结构图

#### 桌面端（≥ 768px）

```
┌────────┬──────────────────────────────────────────────────────┐
│        │                    TopBar                             │
│        ├──────────────────────────────────────────────────────┤
│        │                                                      │
│ SideNav│  ┌──────────┐  ┌──────────────────────────────┐     │
│        │  │          │  │  ▎行动队列                   │     │
│ 200px  │  │  Hero    │  │  ┌──────────────────────┐    │     │
│        │  │  核心区  │  │  │ ⚡ 聚变堆升级 67%  → │    │     │
│        │  │  240px   │  │  └──────────────────────┘    │     │
│        │  │          │  │  ┌──────────────────────┐    │     │
│        │  │ +125/s   │  │  │ ⚙️ 2建筑可升级    →  │    │     │
│        │  │          │  │  └──────────────────────┘    │     │
│        │  └──────────┘  │  ┌──────────────────────┐    │     │
│        │                │  │ 🔬 3科技可研究    →  │    │     │
│        │                │  └──────────────────────┘    │     │
│        │                └──────────────────────────────┘     │
│        │                                                      │
│        │  ┌─────────────────────────────────────────────────┐│
│        │  │  ▎文明概况                                      ││
│        │  │  ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐                ││
│        │  │  │建 │ │科 │ │部 │ │遗 │ │时 │ │转 │  ← 6列横排  ││
│        │  │  │筑 │ │技 │ │队 │ │物 │ │长 │ │生 │            ││
│        │  │  │8/12│ │5/8│ │45│ │2/3│ │2h │ │ 1│            ││
│        │  │  └──┘ └──┘ └──┘ └──┘ └──┘ └──┘                ││
│        │  └─────────────────────────────────────────────────┘│
│        │                                                      │
└────────┴──────────────────────────────────────────────────────┘
     200px                    1040px max-width
```

#### 移动端（< 768px）— 退化为单列

```
┌──────────────────────────────────────┐
│              TopBar                  │
├──────────────────────────────────────┤
│                                      │
│         Hero 核心区 (200px)          │
│           +12.5 /s                   │
│                                      │
│  ▎行动队列                           │
│  ┌──────────────────────────────────┐│
│  │ in-progress / actionable items   ││
│  └──────────────────────────────────┘│
│                                      │
│  ▎文明概况 (2列)                     │
│  ┌──────┐ ┌──────┐                  │
│  │ 建筑 │ │ 科技 │                  │
│  └──────┘ └──────┘                  │
│  ┌──────┐ ┌──────┐                  │
│  │ 部队 │ │ 遗物 │                  │
│  └──────┘ └──────┘                  │
│                                      │
├──────────────────────────────────────┤
│           BottomNav                  │
└──────────────────────────────────────┘
```

### 3.3 内容区 max-width 调整

```css
/* AppShell.vue .content 修改 */
.content {
  flex: 1;
  padding: var(--space-4);
  padding-bottom: 80px;       /* 移动端底部导航高度 */
  max-width: 720px;           /* 移动端保持 720px */
  margin: 0 auto;
  width: 100%;
}

@media (min-width: 768px) {
  .content {
    padding: var(--space-6);
    padding-bottom: var(--space-6);
    max-width: 1040px;        /* 桌面端 720→1040px */
  }
}
```

### 3.4 HomeView 双列布局 CSS

```css
/* 移动端：单列（默认） */
.home {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);                /* 20px */
}

/* 桌面端：双列 */
@media (min-width: 768px) {
  .home {
    gap: var(--space-6);              /* 24px */
  }

  /* Hero + 行动队列并排 */
  .home-top-row {
    display: grid;
    grid-template-columns: 40% 60%;   /* Hero 40% + 行动队列 60% */
    gap: var(--space-6);              /* 24px */
    align-items: start;
  }

  /* Hero 左列 */
  .home-top-row .hero {
    position: sticky;
    top: var(--space-6);             /* 粘性定位，滚动时保持可见 */
  }

  /* 行动队列右列 */
  .home-top-row .action-queue {
    min-height: 0;
  }
}
```

### 3.5 文明概况 6 列横排

```css
/* 移动端：2 列 */
.overview-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-2);               /* 8px */
}

/* 桌面端：6 列横排 */
@media (min-width: 768px) {
  .overview-grid {
    grid-template-columns: repeat(6, 1fr);
    gap: var(--space-3);             /* 12px */
  }
}
```

### 3.6 断点表现标注

| 断点 | 布局策略 | content max-width | Home 布局 | 文明概况 | SideNav/BottomNav |
|------|---------|-------------------|-----------|---------|-------------------|
| **< 768px** | 移动端单列 | 720px | 纵向堆叠 | 2 列 | BottomNav |
| **768px** | 平板/桌面双列起点 | 1040px | Hero(40%) + 队列(60%) 并排 | 6 列横排 | SideNav |
| **1024px** | 桌面标准 | 1040px | 同上，空间更宽裕 | 6 列横排 | SideNav |
| **1440px+** | 大屏 | 1040px（居中，两侧留白） | 同上 | 6 列横排 | SideNav |

#### 断点过渡说明

- **767px → 768px**（关键断点）：单列突变为双列，BottomNav 消失 SideNav 出现，Hero 从 200px 跳至 240px，文明概况从 2 列跳至 6 列
- **768px → 1024px**：布局不变，双列间距从 24px 自然呼吸，Hero 粘性定位
- **1024px → 1440px**：布局不变，content 居中后两侧留白逐渐增大
- **> 1440px**：content 两侧大留白，可考虑 P2 阶段增加星云装饰区填充（非 P1 范围）

### 3.7 HomeView 模板结构调整（前端参考）

```vue
<template>
  <div class="home">
    <!-- 上部行：Hero + 行动队列并排（桌面）/ 堆叠（移动） -->
    <div class="home-top-row">
      <section class="hero" aria-label="星核核心">
        <!-- Hero 核心视觉（P1-1） -->
      </section>
      <section class="action-queue" aria-labelledby="action-queue-title">
        <h3 id="action-queue-title" class="action-queue-title">行动队列</h3>
        <!-- 行动队列（P1-2） -->
      </section>
    </div>

    <!-- 文明概况（全宽） -->
    <section class="overview" aria-labelledby="overview-title">
      <h3 id="overview-title" class="section-title">文明概况</h3>
      <!-- 6 列横排（P1-6） -->
    </section>
  </div>
</template>
```

### 3.8 验收清单

| 验收项 | 标准 |
|--------|------|
| content max-width | 移动端 720px / 桌面端 1040px |
| 双列布局 | ≥768px 时 Hero(40%) + 队列(60%) 并排 |
| < 768px 退化 | 单列纵向堆叠 |
| 文明概况列数 | 移动端 2 列 / 桌面端 6 列 |
| Hero 粘性 | 桌面端 Hero 随滚动 sticky |
| 断点无闪烁 | 768px 断点切换无布局抖动 |

---

## P1-4 中英字体断裂修复方案决策

### 4.1 问题回顾

当前 `--font-display: "Orbitron", "PingFang SC", ...`，导致：
- 品牌名「星核纪元」用 PingFang SC 渲染（人文圆体）
- 数字「1,234」和英文「StarCore」用 Orbitron 渲染（几何科幻体）
- 两者气质冲突，品牌名丧失科幻调性

### 4.2 两个方案对比

#### 方案 A：引入中文科幻字体

**方案内容**：引入「仓耳渔阳体」或「阿里巴巴普惠体 Bold」等中文几何/科幻风格字体，通过 `@font-face` 自托管。

| 维度 | 评估 |
|------|------|
| **视觉效果** | ★★★★★ 最佳，中文标题获得真正的科幻几何感 |
| **包体积** | ❌ 中文字体子集化后仍约 200KB-500KB（仅常用 3500 字），首屏加载显著增加 |
| **FOUT 风险** | ❌ 高。中文字体文件大，`font-display: swap` 期间会先显示 PingFang SC 再跳换为科幻字体，产生明显闪烁 |
| **子集化复杂度** | ❌ 需要维护字体子集构建流程，按用字量裁剪。品牌名仅 4 字，但正文若也用则需全字符集 |
| **授权风险** | ⚠️ 仓耳渔阳体需商业授权；阿里巴巴普惠体免费但风格偏「科技圆润」非「硬科幻」 |
| **维护成本** | ❌ 高。新增文案时需确认字体覆盖，或维护动态子集 |

#### 方案 B：PingFang SC Bold + letter-spacing + text-shadow（推荐 ✅）

**方案内容**：品牌名「星核纪元」使用 PingFang SC Bold（系统内置，零加载），通过排版处理而非换字体来靠近科幻感。

```css
.brand-name {
  font-family: "PingFang SC", "HarmonyOS Sans SC", system-ui, sans-serif;
  font-weight: 700;                    /* Bold */
  letter-spacing: 4px;                 /* 字间距拉开，营造几何感 */
  text-shadow: 0 0 12px rgba(0, 229, 255, 0.4);  /* 青色发光 */
  /* font-size / color 保持现有 Token */
}
```

| 维度 | 评估 |
|------|------|
| **视觉效果** | ★★★★☆ 良好。字间距 + 发光显著提升科幻感，虽不如方案 A 但远胜现状 |
| **包体积** | ✅ 零增加。PingFang SC 是 macOS/iOS 系统字体，HarmonyOS Sans SC 是华为系统字体，无需加载 |
| **FOUT 风险** | ✅ 零。系统字体即时渲染，无闪烁 |
| **子集化** | ✅ 不需要 |
| **授权风险** | ✅ 零。系统字体，各平台自带 |
| **维护成本** | ✅ 零。改一行 CSS 即可 |
| **跨平台一致性** | ⚠️ 中等。macOS/iOS 用 PingFang SC，Android 用 HarmonyOS Sans SC 或 Noto Sans SC，Windows 用 Microsoft YaHei UI。各平台 Bold 字重和字间距渲染略有差异，但 letter-spacing + text-shadow 效果一致 |

### 4.3 决策

> **选择方案 B。**

### 4.4 决策理由

1. **性价比压倒性优势**：方案 B 以零包体积、零 FOUT 风险、零维护成本的代价，获得 80% 的视觉提升；方案 A 虽视觉更优，但 200KB+ 字体包对一个放置类游戏的首屏性能是不可接受的代价。

2. **品牌名仅 4 字**：「星核纪元」四个字引入整个中文字体库，投入产出比极低。letter-spacing 4px 已能让这四个字产生「科幻铭牌」的几何排列感。

3. **FOUT 体验致命**：放置游戏的核心体验是「打开即玩」，首屏字体跳换会严重破坏沉浸感。方案 B 的系统字体方案确保首帧即最终态。

4. **与 P0 策略一致**：项目已选择 Orbitron 拉丁字体自托管（拉丁字符集小，~30KB），中文走系统字体是同一策略的延续——「拉丁用定制字体，中文走系统字体 + 排版增强」。

5. **后续可升级**：若 P2/P3 阶段决定引入中文科幻字体，方案 B 的 letter-spacing + text-shadow 参数可无缝叠加到新字体上，不产生沉没成本。

### 4.5 落地参数

```css
/* style.css :root 中 --font-display 保持不变 */
--font-display: "Orbitron", "PingFang SC", "HarmonyOS Sans SC", system-ui, sans-serif;

/* 品牌名专用样式 — 适用于 TopBar 和 SideNav 的 .brand-name */
.brand-name {
  font-family: "PingFang SC", "HarmonyOS Sans SC", "Microsoft YaHei UI", system-ui, sans-serif;
  font-weight: 700;
  letter-spacing: 4px;
  text-shadow: 0 0 12px rgba(0, 229, 255, 0.4);
  /* padding-left 补偿 letter-spacing 导致的左偏移 */
  padding-left: 4px;
}
```

**作用范围**：仅 `.brand-name` 类（TopBar 品牌名 + SideNav 品牌名）。其他中文文本（section title、卡片标签等）保持现有 `--font-body`，不加 letter-spacing（会影响正文可读性）。

**数字和英文**：核心数值 `.core-value`、产出率 `.rate-display` 等继续使用 `var(--font-display)` / `var(--font-mono)`，Orbitron 和 JetBrains Mono 渲染拉丁字符无断裂问题。

### 4.6 验收清单

| 验收项 | 标准 |
|--------|------|
| 品牌名字体 | PingFang SC Bold（非 Orbitron fallback） |
| letter-spacing | 4px |
| text-shadow | 0 0 12px rgba(0,229,255,.4) |
| FOUT | 首帧即最终态，无字体跳换 |
| 包体积 | 零增加 |
| 作用范围 | 仅 .brand-name，不影响正文 |

---

## P1-5 按钮系统规范

### 5.1 设计目标

统一全站按钮为 4 类语义型，消除现有按钮 padding/font-size/color 各自为政的问题。

### 5.2 四类按钮定义

#### .btn-primary（主操作）

```css
.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);                  /* 8px */
  padding: var(--space-3) var(--space-4);  /* 12px 16px */
  background: var(--color-core);        /* #00E5FF */
  color: var(--color-on-core);          /* #05070D */
  font-size: var(--text-sm);            /* 14px */
  font-weight: 600;
  border-radius: var(--radius-md);      /* 10px */
  transition: all .15s var(--ease-out);
  cursor: pointer;
}
.btn-primary:hover {
  background: var(--color-core-dim);    /* #00B8CC */
  box-shadow: 0 0 16px rgba(0, 229, 255, 0.3);
}
.btn-primary:active {
  transform: scale(0.97);
}
.btn-primary:disabled {
  background: var(--color-elevated);
  color: var(--color-t-tertiary);
  cursor: not-allowed;
  opacity: 0.6;
}
```

#### .btn-secondary（次操作）

```css
.btn-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);  /* 12px 16px */
  background: var(--color-elevated);    /* #182238 */
  color: var(--color-t-primary);        /* #E8EDF5 */
  font-size: var(--text-sm);            /* 14px */
  font-weight: 500;
  border: 1px solid var(--color-border-line);
  border-radius: var(--radius-md);
  transition: all .15s var(--ease-out);
  cursor: pointer;
}
.btn-secondary:hover {
  background: var(--color-hover);
  border-color: var(--color-border-glow);
}
.btn-secondary:active {
  transform: scale(0.97);
}
.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

#### .btn-accent（分类强调操作）

```css
.btn-accent {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);  /* 12px 16px */
  background: var(--accent, var(--color-core));  /* 通过 --accent CSS 变量注入主题色 */
  color: var(--color-on-core);
  font-size: var(--text-sm);            /* 14px */
  font-weight: 600;
  border-radius: var(--radius-md);
  transition: all .15s var(--ease-out);
  cursor: pointer;
}
.btn-accent:hover {
  filter: brightness(1.1);
  box-shadow: 0 0 16px color-mix(in srgb, var(--accent, var(--color-core)) 30%, transparent);
}
.btn-accent:active {
  transform: scale(0.97);
}
.btn-accent:disabled {
  background: var(--color-elevated);
  color: var(--color-t-tertiary);
  cursor: not-allowed;
  opacity: 0.6;
}
```

**用法**：通过 `--accent` 变量注入分类色：
```html
<button class="btn-accent" style="--accent: var(--color-plasma)">研究</button>
<button class="btn-accent" style="--accent: var(--color-quantum)">探索</button>
<button class="btn-accent" style="--accent: var(--color-alert)">战斗</button>
<button class="btn-accent" style="--accent: var(--color-amber)">转生</button>
```

#### .btn-ghost（幽灵按钮）

```css
.btn-ghost {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);  /* 12px 16px */
  background: transparent;
  color: var(--color-t-secondary);
  font-size: var(--text-sm);            /* 14px */
  font-weight: 500;
  border-radius: var(--radius-md);
  transition: all .15s var(--ease-out);
  cursor: pointer;
}
.btn-ghost:hover {
  background: var(--color-hover);
  color: var(--color-t-primary);
}
.btn-ghost:active {
  transform: scale(0.97);
}
.btn-ghost:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
```

### 5.3 四类按钮参数汇总

| 类型 | background | color | padding | font-size | font-weight | border | 用途 |
|------|-----------|-------|---------|-----------|------------|--------|------|
| `.btn-primary` | `--color-core` | `--color-on-core` | `12px 16px` | `14px` | 600 | 无 | 主操作（升级/确认） |
| `.btn-secondary` | `--color-elevated` | `--color-t-primary` | `12px 16px` | `14px` | 500 | `1px --color-border-line` | 次操作（取消/返回） |
| `.btn-accent` | `var(--accent)` | `--color-on-core` | `12px 16px` | `14px` | 600 | 无 | 分类强调（研究/探索/战斗） |
| `.btn-ghost` | `transparent` | `--color-t-secondary` | `12px 16px` | `14px` | 500 | 无 | 幽灵按钮（次要操作） |

### 5.4 尺寸变体

```css
/* 紧凑型 — 用于卡片内、空间受限场景 */
.btn-primary.sm, .btn-secondary.sm, .btn-accent.sm, .btn-ghost.sm {
  padding: var(--space-2) var(--space-3);   /* 8px 12px */
  font-size: var(--text-xs);                /* 12px */
}

/* 全宽型 — 用于模态框确认、表单提交 */
.btn-primary.block, .btn-secondary.block, .btn-accent.block, .btn-ghost.block {
  width: 100%;
}
```

### 5.5 现有按钮迁移映射表

| 视图 | 现有 class | 现有参数 | 迁移至 | 变更说明 |
|------|-----------|---------|--------|---------|
| **BuildView** | `.btn-upgrade` | bg: core, color: on-core, padding: 10px, font: 13px, radius-md | `.btn-primary` | padding 10→12px, font 13→14px |
| **TechView** | `.btn-research` | bg: plasma, color: #fff, padding: 10px, font: 13px, radius-md | `.btn-accent` (`--accent: --color-plasma`) | color #fff→on-core, padding/font 统一 |
| **MapView** | `.btn-explore` | bg: quantum, color: on-core, padding: 8px, font: 12px, radius-md | `.btn-accent.sm` (`--accent: --color-quantum`) | 保留紧凑尺寸，参数对齐 |
| **BattleView** | `.btn-battle` | bg: alert, color: #fff, padding: 12px, font: 14px, flex:2 | `.btn-accent` (`--accent: --color-alert`) | color #fff→on-core |
| **BattleView** | `.btn-garrison` | bg: elevated, color: t-primary, padding: 12px, font: 14px | `.btn-secondary` | 直接替换 |
| **BattleView** | `.btn-garrison.active` | bg: quantum, color: on-core | `.btn-accent` (`--accent: --color-quantum`) | 激活态用 accent |
| **BattleView** | `.btn-confirm` | bg: core, color: on-core, padding: 12px, radius-md | `.btn-primary.block` | 添加 .block 全宽 |
| **BattleView** | `.btn-back` | bg: elevated, color: t-secondary, border: 1px, flex:1 | `.btn-secondary` | 直接替换 |
| **BattleView** | `.btn-stay` | flex:2（继承 .btn-confirm 样式） | `.btn-primary.block` | 保留 flex 布局 |
| **BattleView** | `.btn-garrison-ok` | bg: quantum, color: on-core, flex:2 | `.btn-accent` (`--accent: --color-quantum`) | — |
| **OfflineReport** | `.btn-confirm` | bg: core, color: on-core, padding: 12px, font: 14px, radius-md | `.btn-primary.block` | 添加 .block 全宽 |
| **PrestigeView** | `.btn-transcend` | bg: gradient(amber→#ff8c00), color: void, padding: 16px, font: 16px | `.btn-accent` (`--accent: --color-amber`) + 自定义 gradient | 保留 gradient 作为特例，标注「转生专属」 |
| **PrestigeView** | `.btn-purchase` | bg: amber, color: void, padding: 8px, font: 12px, radius-sm | `.btn-accent.sm` (`--accent: --color-amber`) | radius-sm→md（统一） |
| **PrestigeView** | `.btn-save` | bg: elevated, color: t-primary, padding: 12px, font: 12px | `.btn-secondary.sm` | — |
| **PrestigeView** | `.btn-save.danger` | color: alert | `.btn-ghost` + `style="color: var(--color-alert)"` | 危险操作用 ghost + alert 色 |
| **PrestigeView** | `.btn-cancel` | bg: elevated, color: t-secondary, padding: 12px, radius-md | `.btn-secondary` | 直接替换 |
| **PrestigeView** | `.btn-confirm-transcend` | bg: amber, color: void, padding: 12px, radius-md | `.btn-accent` (`--accent: --color-amber`) | — |
| **PrestigeView** | `.btn-confirm-reset` | bg: alert, color: #fff, padding: 12px, radius-md | `.btn-accent` (`--accent: --color-alert`) | color #fff→on-core |
| **RelicView** | `.btn-discard` | bg: transparent, border: 1px alert, color: t-secondary, font: 12px | `.btn-ghost` + `.sm` + `style="color: var(--color-alert)"` | 保留 pending 态特殊样式 |

### 5.6 迁移统计

| 迁移目标 | 涉及按钮数 | 视图 |
|---------|-----------|------|
| `.btn-primary` / `.btn-primary.block` / `.btn-primary.sm` | 5 | BuildView, BattleView(×3), OfflineReport |
| `.btn-secondary` / `.btn-secondary.sm` | 5 | BattleView(×2), PrestigeView(×3) |
| `.btn-accent` / `.btn-accent.sm` | 7 | TechView, MapView, BattleView(×3), PrestigeView(×2) |
| `.btn-ghost` / `.btn-ghost.sm` | 2 | PrestigeView, RelicView |
| **特例保留** | 1 | PrestigeView `.btn-transcend`（gradient 特例） |

### 5.7 特例说明

**`.btn-transcend`（转生按钮）**：作为全游戏最重要的仪式性操作，保留 `linear-gradient(135deg, var(--color-amber), #ff8c00)` 渐变背景作为特例，但 padding/font-size/radius 对齐 `.btn-accent` 参数。迁移后标注：

```css
.btn-transcend {
  /* 基于 .btn-accent，覆盖 background 为 gradient */
  composes: btn-accent;  /* 概念上继承，实际 CSS 不支持 composes，前端用 class="btn-accent btn-transcend" */
  --accent: var(--color-amber);
  background: linear-gradient(135deg, var(--color-amber), #ff8c00);
  font-size: var(--text-base);  /* 16px，比标准 14px 大一号，突出仪式感 */
  padding: var(--space-4);      /* 16px，比标准 12px 大 */
}
```

### 5.8 全局按钮样式放置位置

建议将 `.btn-primary` / `.btn-secondary` / `.btn-accent` / `.btn-ghost` 定义在全局 `style.css` 中（非 scoped），所有视图可直接引用。现有各视图 `<style scoped>` 中的按钮样式在迁移后删除。

### 5.9 验收清单

| 验收项 | 标准 |
|--------|------|
| 四类按钮定义 | style.css 中全局定义 |
| padding 统一 | 所有按钮 12px 16px（.sm 变体 8px 12px） |
| font-size 统一 | 所有按钮 14px（.sm 变体 12px） |
| color 统一 | 主/accent 用 --color-on-core，次用 --color-t-primary，ghost 用 --color-t-secondary |
| #fff 魔法值消除 | 全部替换为 --color-on-core |
| 现有按钮迁移 | 19 个按钮全部映射到新系统 |
| disabled 规范 | opacity 0.5-0.6 + cursor not-allowed + 去除阴影 |

---

## P1-6 文明概况视觉层次规范

### 6.1 设计目标

将文明概况从「标签+数值平铺」升级为有视觉层次的指标卡片：

- 关键指标（建筑/科技）左侧色条 + 数值着色
- 科技数值用 plasma 色 / 部队数值用 alert 色
- 每项增加图标
- 桌面端 6 列横排 / 移动端 2 列

### 6.2 指标项定义

| 指标 | key | 图标 | 数值颜色 | 左色条颜色 | 说明 |
|------|-----|------|---------|-----------|------|
| 已解锁建筑 | buildings | `i-nav-build` | `--color-core` (#00E5FF) | `--color-core` | 主指标，青色 |
| 已完成科技 | tech | `i-nav-tech` | `--color-plasma` (#A78BFA) | `--color-plasma` | 主指标，紫色 |
| 部队总数 | army | `i-nav-army` | `--color-alert` (#F43F5E) | `--color-alert` | 军事指标，红色 |
| 已装备遗物 | relics | `i-nav-relic` | `--color-amber` (#FFB627) | `--color-amber` | 稀有指标，琥珀 |
| 游戏时长 | playtime | `i-ui-more`¹ | `--color-t-primary` | `--color-t-tertiary` | 中性指标，无强调 |
| 转生次数 | transcends | `i-nav-prestige` | `--color-amber` | `--color-amber` | 仅转生后显示 |

> ¹ 游戏时长暂用 `i-ui-more`（时钟图标暂无），建议后续新增 `i-ui-clock` 图标

### 6.3 卡片视觉结构

```
桌面端单卡（6 列中一格）：
┌─────────────┐
│ ▎ ⚡ 8/12   │  ← 左色条 + 图标 + 数值
│   建筑      │  ← 标签（下方）
└─────────────┘

移动端单卡（2 列中一格）：
┌──────────────────────┐
│ ▎ ⚡  建筑     8/12  │  ← 左色条 + 图标 + 标签 + 数值
└──────────────────────┘
```

### 6.4 卡片参数

#### 桌面端（6 列横排）

```css
@media (min-width: 768px) {
  .ov-item {
    background: var(--color-surface);
    border: 1px solid var(--color-border-line);
    border-left: 3px solid var(--ov-color, var(--color-core));  /* 左色条 */
    border-radius: var(--radius-md);     /* 10px */
    padding: var(--space-3);             /* 12px */
    display: flex;
    flex-direction: column;
    gap: var(--space-1);                 /* 4px */
    align-items: flex-start;
    transition: all .15s var(--ease-out);
  }
  .ov-item:hover {
    background: var(--color-hover);
    border-color: var(--color-border-glow);
  }

  .ov-top {
    display: flex;
    align-items: center;
    gap: var(--space-2);                 /* 8px */
  }
  .ov-icon {
    color: var(--ov-color, var(--color-core));
    flex-shrink: 0;
    /* 图标尺寸 var(--icon-sm) = 14px */
  }
  .ov-value {
    font-size: var(--text-base);         /* 16px（桌面端放大） */
    font-family: var(--font-mono);
    font-weight: 600;
    color: var(--ov-color, var(--color-t-primary));  /* 数值着色 */
  }
  .ov-label {
    font-size: var(--text-xs);           /* 12px */
    color: var(--color-t-secondary);
  }
}
```

#### 移动端（2 列）

```css
/* 默认（移动端） */
.ov-item {
  background: var(--color-surface);
  border: 1px solid var(--color-border-line);
  border-left: 3px solid var(--ov-color, var(--color-core));
  border-radius: var(--radius-md);
  padding: var(--space-3);
  display: flex;
  align-items: center;
  gap: var(--space-2);
  transition: all .15s var(--ease-out);
}
.ov-item:hover {
  background: var(--color-hover);
}
.ov-icon {
  color: var(--ov-color, var(--color-core));
  flex-shrink: 0;
  /* 图标尺寸 var(--icon-sm) = 14px */
}
.ov-label {
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
  flex: 1;
}
.ov-value {
  font-size: var(--text-sm);             /* 14px（移动端） */
  font-family: var(--font-mono);
  font-weight: 600;
  color: var(--ov-color, var(--color-t-primary));
}
```

### 6.5 数值着色规则

| 指标类型 | 数值颜色 Token | 色值 | 语义 |
|---------|---------------|------|------|
| 建筑 | `--color-core` | #00E5FF | 建造系统主色（青） |
| 科技 | `--color-plasma` | #A78BFA | 科技系统主色（紫） |
| 部队 | `--color-alert` | #F43F5E | 军事/战斗（红，警示性军事感） |
| 遗物 | `--color-amber` | #FFB627 | 稀有/珍贵（琥珀金） |
| 时长 | `--color-t-primary` | #E8EDF5 | 中性，不强调 |
| 转生 | `--color-amber` | #FFB627 | 稀有/特殊成就 |

### 6.6 左色条颜色规则

左色条颜色与数值颜色一致（`--ov-color`），通过 CSS 变量注入：

```html
<li class="ov-item" style="--ov-color: var(--color-core)">
  <svg class="ov-icon" style="width: var(--icon-sm); height: var(--icon-sm)"><use href="#i-nav-build" /></svg>
  <span class="ov-label">建筑</span>
  <span class="ov-value font-mono">8/12</span>
</li>
```

### 6.7 完整指标列表 HTML 结构（前端参考）

```html
<ul class="overview-grid">
  <!-- 建筑 -->
  <li class="ov-item" style="--ov-color: var(--color-core)">
    <div class="ov-top">
      <svg class="ov-icon" style="width: var(--icon-sm); height: var(--icon-sm)"><use href="#i-nav-build" /></svg>
      <span class="ov-value font-mono">{{ buildingsUnlocked }}/{{ BUILDINGS.length }}</span>
    </div>
    <span class="ov-label">建筑</span>
  </li>

  <!-- 科技 -->
  <li class="ov-item" style="--ov-color: var(--color-plasma)">
    <div class="ov-top">
      <svg class="ov-icon" style="width: var(--icon-sm); height: var(--icon-sm)"><use href="#i-nav-tech" /></svg>
      <span class="ov-value font-mono">{{ techCompleted }}/{{ TECHS.length }}</span>
    </div>
    <span class="ov-label">科技</span>
  </li>

  <!-- 部队 -->
  <li class="ov-item" style="--ov-color: var(--color-alert)">
    <div class="ov-top">
      <svg class="ov-icon" style="width: var(--icon-sm); height: var(--icon-sm)"><use href="#i-nav-army" /></svg>
      <span class="ov-value font-mono">{{ totalUnits }}</span>
    </div>
    <span class="ov-label">部队</span>
  </li>

  <!-- 遗物 -->
  <li class="ov-item" style="--ov-color: var(--color-amber)">
    <div class="ov-top">
      <svg class="ov-icon" style="width: var(--icon-sm); height: var(--icon-sm)"><use href="#i-nav-relic" /></svg>
      <span class="ov-value font-mono">{{ relicsEquipped }}/{{ game.relics.maxSlots }}</span>
    </div>
    <span class="ov-label">遗物</span>
  </li>

  <!-- 游戏时长 -->
  <li class="ov-item" style="--ov-color: var(--color-t-primary)">
    <div class="ov-top">
      <svg class="ov-icon" style="width: var(--icon-sm); height: var(--icon-sm)"><use href="#i-ui-more" /></svg>
      <span class="ov-value font-mono">{{ playTime }}</span>
    </div>
    <span class="ov-label">时长</span>
  </li>

  <!-- 转生次数（条件显示） -->
  <li v-if="game.transcend.totalTranscends > 0" class="ov-item" style="--ov-color: var(--color-amber)">
    <div class="ov-top">
      <svg class="ov-icon" style="width: var(--icon-sm); height: var(--icon-sm)"><use href="#i-nav-prestige" /></svg>
      <span class="ov-value font-mono">{{ game.transcend.totalTranscends }}</span>
    </div>
    <span class="ov-label">转生</span>
  </li>
</ul>
```

### 6.8 移动端 ↔ 桌面端布局差异

| 维度 | 移动端（2 列） | 桌面端（6 列） |
|------|---------------|---------------|
| 网格列数 | `repeat(2, 1fr)` | `repeat(6, 1fr)` |
| 卡片内布局 | 水平：图标 + 标签 + 数值 | 垂直：上行(图标+数值) + 下行(标签) |
| 数值字号 | `--text-sm` (14px) | `--text-base` (16px) |
| 标签字号 | `--text-xs` (12px) | `--text-xs` (12px) |
| 图标尺寸 | `--icon-sm` (14px) | `--icon-sm` (14px) |
| 左色条 | 3px | 3px |
| gap | `--space-2` (8px) | `--space-3` (12px) |

### 6.9 验收清单

| 验收项 | 标准 |
|--------|------|
| 左色条 | 关键指标（建筑/科技/部队/遗物/转生）有 3px 左色条 |
| 数值着色 | 科技=plasma / 部队=alert / 建筑=core / 遗物&转生=amber |
| 图标 | 每项有对应图标 |
| 桌面端 6 列 | ≥768px 时 grid-template-columns: repeat(6, 1fr) |
| 移动端 2 列 | <768px 时 grid-template-columns: repeat(2, 1fr) |
| 卡片 hover | 背景 hover 色 + 边框 glow |
| Token 引用 | 全部使用 P0 Token + --ov-color 变量 |

---

## 附录：P1 交付物 Token 使用核对

所有 P1 交付物均引用 P0 已建立的 Token 体系，零新增 Token：

| Token 类别 | 使用到的 Token | 新增 |
|------------|---------------|------|
| 间距 | `--space-1` ~ `--space-8` 全部 | 无 |
| 字号 | `--text-xs` ~ `--text-display` 全部 | 无 |
| 图标 | `--icon-xs` ~ `--icon-lg` | 无 |
| 颜色 | `--color-void/surface/elevated/hover/border-line/border-glow/core/core-dim/amber/quantum/alert/plasma/t-primary/t-secondary/t-tertiary/on-core` | 无 |
| 圆角 | `--radius-sm/md/lg/pill` | 无 |
| 字体 | `--font-display/body/mono` | 无 |
| 动效 | `--ease-out` | 无 |
| CSS 变量（组件级） | `--c`（行动队列主题色）、`--ov-color`（概况指标色）、`--accent`（按钮强调色） | 无（均为组件内 CSS 变量，非全局 Token） |

---

> **交付状态**：P1 全部 6 项设计交付物已完成，含具体设计参数（色值/字号/间距/尺寸数值），沿用 P0 Token 体系。待最终确认后进入实施。本阶段未改动任何源码。
