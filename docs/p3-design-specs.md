# 星核纪元 · P3 锦上添花设计规范（P3-2/3/4/5/6）

> **产出方**：设计
> **日期**：2026-07-16
> **方案依据**：`docs/home-ui-总体推进方案.md` P3 阶段
> **本阶段定位**：只出规范，不改源码。前端拿到本文件后按参数落地。
> **Token 体系**：沿用 P0/P1/P2 已建立的 `--space-*`、`--text-*`、`--icon-*`、`--color-*`、`--radius-*`、`--ease-out`、`--elevation-*`。**零新增全局 Token。**

---

## 目录

1. [P3-2 HomeView 快速操作入口](#p3-2-homeview-快速操作入口)
2. [P3-3 加载与空状态优化](#p3-3-加载与空状态优化)
3. [P3-4 四档响应断点](#p3-4-四档响应断点)
4. [P3-5 路由切换"空间跃迁"光效](#p3-5-路由切换空间跃迁光效)
5. [P3-6 资源产出粒子动画](#p3-6-资源产出粒子动画)

---

## P3-2 HomeView 快速操作入口

### 2.1 设计目标

在 Hero 核心区下方增加一行紧凑的快速操作按钮，让玩家首屏即可一键跳转到核心功能页（建造/科技/探索/部队），无需依赖底部导航或侧边导航。

**设计原则**：
- 视觉重量低于 Hero 核心和行动队列，作为"辅助快捷通道"存在
- 按钮样式沿用 P1-5 按钮系统，不新增按钮类型
- 4 个按钮等宽排列，图标 + 文字组合，色彩与各系统主色对应

### 2.2 布局位置

```
┌─────────────────────────────────────────┐
│              Hero 核心区                 │
│           (能量值 + 产出率)              │
├─────────────────────────────────────────┤
│  [⚡建造]  [🔬科技]  [🧭探索]  [⚔️部队]  │  ← 快速操作入口（新增）
├─────────────────────────────────────────┤
│            行动队列模块                  │
│         (进行中 / 可执行)                │
├─────────────────────────────────────────┤
│            文明概况                       │
└─────────────────────────────────────────┘
```

**DOM 位置**：在 `.home-top-row` 内部，Hero `section.hero` 之后、`.action-queue` 之前。桌面端时跟随 Hero 在左列；移动端时在 Hero 和行动队列之间。

> **选择放在 `.home-top-row` 内部而非独立行的原因**：快速操作入口与 Hero 是"视觉一体"的——它们都是面向当前时刻的快捷动作。独立成行会与下方行动队列产生功能重叠感。

### 2.3 按钮定义

| 序号 | 标签 | 图标 | 跳转路径 | 主色 | 图标 ID |
|------|------|------|---------|------|---------|
| 1 | 建造 | 🔨 | `/build` | `--color-core` (#00E5FF) | `i-nav-build` |
| 2 | 科技 | 🧬 | `/tech` | `--color-plasma` (#A78BFA) | `i-nav-tech` |
| 3 | 探索 | 🧭 | `/map` | `--color-quantum` (#2EE6A0) | `i-nav-explore` |
| 4 | 部队 | ⚔️ | `/army` | `--color-alert` (#F43F5E) | `i-nav-army` |

> 图标均已在 `IconsBase.vue` 中定义，无需新增。颜色取自 P1-6 文明概况中各系统的主色映射，保持一致性。

### 2.4 按钮样式规范

基于 P1-5 按钮系统 `.btn-secondary.sm` 扩展，通过 `--c` 变量注入系统主色：

```css
.quick-actions {
  display: flex;
  gap: var(--space-2);
  padding: 0 0 var(--space-3);
}

.quick-action-btn {
  /* 沿用 btn-secondary.sm 基础 */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  flex: 1;
  padding: var(--space-2) var(--space-1);
  background: var(--color-surface);
  border: 1px solid var(--color-border-line);
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--color-t-secondary);
  transition: all 0.15s var(--ease-out);
  cursor: pointer;
}

/* hover：边框亮 + 背景微亮 + 主题色图标发光 */
.quick-action-btn:hover {
  background: var(--color-hover);
  border-color: var(--color-border-glow);
  color: var(--color-t-primary);
}

.quick-action-btn:active {
  transform: scale(0.95);  /* P2-4 按钮统一 active */
}

/* 图标颜色 = 系统主色 */
.quick-action-btn .qa-icon {
  color: var(--c);
  flex-shrink: 0;
  filter: drop-shadow(0 0 4px color-mix(in srgb, var(--c) 30%, transparent));
}

/* hover 时图标发光增强 */
.quick-action-btn:hover .qa-icon {
  filter: drop-shadow(0 0 6px color-mix(in srgb, var(--c) 50%, transparent));
}
```

### 2.5 参数明细

| 参数 | 值 | 说明 |
|------|------|------|
| 容器布局 | `flex; gap: var(--space-2)` | 水平等宽排列 |
| 容器 padding-bottom | `var(--space-3)` (12px) | 与下方行动队列留间距 |
| 按钮 flex | `1` | 4 个按钮等宽 |
| 按钮 padding | `var(--space-2) var(--space-1)` | 紧凑型，纵向 8px / 横向 4px |
| 按钮 font-size | `var(--text-xs)` (12px) | 与 .btn-secondary.sm 一致 |
| 按钮 font-weight | `500` | 中等粗细 |
| 按钮 color | `var(--color-t-secondary)` (#8B96A8) | 默认次要色 |
| 按钮 background | `var(--color-surface)` (#0E1424) | 表层底色 |
| 按钮 border | `1px solid var(--color-border-line)` | 标准边框 |
| 按钮 border-radius | `var(--radius-md)` (10px) | 中圆角 |
| 图标尺寸 | `var(--icon-sm)` (14px) | 紧凑型图标 |
| 图标颜色 | `var(--c)`（各系统主色） | 通过 inline style 注入 |
| 图标 glow | `drop-shadow(0 0 4px ...)` | 30% 透明度主色发光 |
| 图标-文字 gap | `var(--space-1)` (4px) | 紧凑间距 |
| hover 背景 | `var(--color-hover)` (#1A2236) | 微亮 |
| hover 边框 | `var(--color-border-glow)` (#2A3A55) | 变亮 |
| hover 文字 | `var(--color-t-primary)` (#E8EDF5) | 变亮 |
| active 缩放 | `scale(0.95)` | P2-4 统一 |
| transition | `0.15s var(--ease-out)` | 统一缓动 |

### 2.6 桌面端差异

```css
@media (min-width: 768px) {
  .quick-actions {
    gap: var(--space-3);          /* 间距加大 8→12 */
    padding-bottom: var(--space-4); /* 底部间距加大 12→16 */
  }
  .quick-action-btn {
    padding: var(--space-2) var(--space-2); /* 横向 padding 加大 */
    font-size: var(--text-sm);   /* 字号 12→14 */
  }
  .quick-action-btn .qa-icon {
    width: var(--icon-md);       /* 图标 14→18 */
    height: var(--icon-md);
  }
}
```

| 参数 | 移动端 | 桌面端 | 说明 |
|------|--------|--------|------|
| gap | `--space-2` (8px) | `--space-3` (12px) | 间距加大 |
| padding-bottom | `--space-3` (12px) | `--space-4` (16px) | 底部间距加大 |
| 按钮 font-size | `--text-xs` (12px) | `--text-sm` (14px) | 字号提升 |
| 图标尺寸 | `--icon-sm` (14px) | `--icon-md` (18px) | 图标加大 |
| 按钮 padding-x | `--space-1` (4px) | `--space-2` (8px) | 横向加大 |

### 2.7 前端实现参考

```vue
<!-- HomeView.vue 模板中，在 .hero 和 .action-queue 之间插入 -->
<div class="quick-actions" role="navigation" aria-label="快速操作">
  <button
    v-for="action in quickActions"
    :key="action.id"
    class="quick-action-btn"
    :style="{ '--c': action.color }"
    @click="router.push(action.path)"
  >
    <svg class="qa-icon" style="width: var(--icon-sm); height: var(--icon-sm)" aria-hidden="true">
      <use :href="'#' + action.icon" />
    </svg>
    <span>{{ action.label }}</span>
  </button>
</div>
```

```ts
// 数据定义
const quickActions = [
  { id: 'build', label: '建造', icon: 'i-nav-build', path: '/build', color: 'var(--color-core)' },
  { id: 'tech', label: '科技', icon: 'i-nav-tech', path: '/tech', color: 'var(--color-plasma)' },
  { id: 'explore', label: '探索', icon: 'i-nav-explore', path: '/map', color: 'var(--color-quantum)' },
  { id: 'army', label: '部队', icon: 'i-nav-army', path: '/army', color: 'var(--color-alert)' },
]
```

### 2.8 验收清单

| 验收项 | 标准 |
|--------|------|
| 位置 | Hero 下方、行动队列上方，在 `.home-top-row` 内部 |
| 按钮数量 | 4 个（建造/科技/探索/部队） |
| 等宽 | flex:1，4 个按钮等宽 |
| 图标 | 使用已有 `i-nav-*` 图标，无新增 |
| 按钮样式 | 基于 .btn-secondary.sm，padding/font-size 一致 |
| 系统主色 | 图标颜色 = 各系统主色，有 drop-shadow 发光 |
| hover | 背景+边框+文字变亮，图标发光增强 |
| active | scale(0.95)，P2-4 统一 |
| 桌面端 | gap/字号/图标加大，padding 加宽 |
| Token 引用 | 全部使用 `--space-*`、`--text-*`、`--icon-*`、`--color-*`、`--radius-*` |
| 无障碍 | role="navigation" + aria-label，按钮有 focus-visible |

---

## P3-3 加载与空状态优化

### 3.1 设计目标

为各页面的空状态（无数据/无内容）提供引导文案，并为新玩家首次进入各页面时提供 onboarding 气泡提示，降低理解门槛。

**两部分**：
1. **空状态文案规范**：各页面在无数据时显示的引导文案
2. **新手 onboarding 气泡**：首次进入页面时的功能引导气泡

### 3.2 空状态文案规范

#### 3.2.1 统一视觉样式

空状态使用已有的 `.empty-msg` 工具类（`style.css` 已定义）作为基础，扩展图标 + 引导按钮：

```css
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-6) var(--space-4);
  text-align: center;
}

.empty-state .es-icon {
  width: var(--icon-lg);
  height: var(--icon-lg);
  color: var(--color-t-tertiary);
  opacity: 0.5;
}

.empty-state .es-text {
  font-size: var(--text-sm);
  color: var(--color-t-secondary);
  line-height: 1.6;
}

.empty-state .es-hint {
  font-size: var(--text-xs);
  color: var(--color-t-tertiary);
}

.empty-state .es-action {
  margin-top: var(--space-2);
}
```

| 参数 | 值 | 说明 |
|------|------|------|
| 布局 | flex column center | 居中堆叠 |
| padding | `var(--space-6) var(--space-4)` (24/16) | 宽松留白 |
| gap | `var(--space-3)` (12px) | 元素间距 |
| 图标尺寸 | `var(--icon-lg)` (24px) | 大图标 |
| 图标颜色 | `var(--color-t-tertiary)` opacity 0.5 | 弱化 |
| 主文案 font-size | `var(--text-sm)` (14px) | 标准正文 |
| 主文案颜色 | `var(--color-t-secondary)` (#8B96A8) | 次要文本 |
| 提示文案 font-size | `var(--text-xs)` (12px) | 小字 |
| 提示文案颜色 | `var(--color-t-tertiary)` (#6B7589) | 弱化 |
| 引导按钮 | `.btn-secondary.sm` | P1-5 按钮系统 |

#### 3.2.2 各页面空状态文案

| 页面 | 触发条件 | 图标 | 主文案 | 提示文案 | 引导按钮 |
|------|---------|------|--------|---------|---------|
| HomeView 行动队列 | 无进行中/可执行项 | `i-nav-home` | 星核静默中，等待你的指令 | 升级建筑或研究科技来推进文明 | — （已有兜底入口） |
| BuildView | 无可建造建筑（全部锁定/满级） | `i-nav-build` | 暂无可建造的建筑 | 研究科技可解锁更多建筑类型 | [前往科技] → `/tech` |
| TechView | 无可研究科技（全部完成/锁定） | `i-nav-tech` | 所有已知科技已研究完成 | 探索新星域可能发现未知科技 | [前往探索] → `/map` |
| MapView | 无可探索节点（全部完成/锁定） | `i-nav-explore` | 已知星域已全部探索完毕 | 提升科技等级可解锁更远星域 | [前往科技] → `/tech` |
| ArmyView | 无部队且未解锁训练 | `i-nav-army` | 尚未组建部队 | 研究「军事基础」科技后可训练部队 | [前往科技] → `/tech` |
| ArmyView 已解锁但无部队 | 已解锁军事但无训练中/已训练部队 | `i-nav-army` | 部队尚未组建 | 训练你的第一支星际防卫军 | [训练部队] → 留在当前页 |
| RelicView | 无遗物装备且无可用槽位 | `i-nav-relic` | 尚未发现遗物 | 探索深层星域有机会获得遗物 | [前往探索] → `/map` |

#### 3.2.3 加载状态样式

页面数据加载中时（异步组件/初始数据），显示骨架屏而非空白：

```css
.skeleton-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border-line);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  position: relative;
  overflow: hidden;
}

/* shimmer 已在 style.css 中定义 @keyframes shimmer */
.skeleton-line {
  height: 12px;
  border-radius: var(--radius-sm);
  background: linear-gradient(
    90deg,
    var(--color-elevated) 0%,
    var(--color-hover) 50%,
    var(--color-elevated) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}

.skeleton-line.short { width: 60%; }
.skeleton-line.medium { width: 80%; }
.skeleton-line + .skeleton-line { margin-top: var(--space-2); }
```

| 参数 | 值 | 说明 |
|------|------|------|
| 骨架背景 | `--color-surface` + `--color-border-line` | 与卡片一致 |
| shimmer 线高 | 12px | 模拟文字行高 |
| shimmer 颜色 | `--color-elevated` → `--color-hover` → `--color-elevated` | 微妙明暗变化 |
| shimmer 周期 | 1.5s | 不急不缓 |
| shimmer 缓动 | `ease-in-out` | 已有 keyframes |
| 行宽变体 | short 60% / medium 80% | 模拟不同内容宽度 |
| 行间距 | `var(--space-2)` (8px) | 紧凑 |

### 3.3 新手 Onboarding 气泡规范

#### 3.3.1 气泡视觉样式

```css
.onboard-bubble {
  position: absolute;
  background: var(--color-elevated);
  border: 1px solid var(--color-core);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  max-width: 240px;
  box-shadow: var(--elevation-2),
              0 0 16px rgba(0, 229, 255, 0.15);
  z-index: 100;
  animation: floatUp 0.3s var(--ease-out);
}

.onboard-bubble .ob-title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-core);
  margin-bottom: var(--space-1);
}

.onboard-bubble .ob-body {
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
  line-height: 1.5;
}

.onboard-bubble .ob-close {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  width: var(--icon-sm);
  height: var(--icon-sm);
  color: var(--color-t-tertiary);
  cursor: pointer;
  transition: color 0.15s var(--ease-out);
}

.onboard-bubble .ob-close:hover {
  color: var(--color-t-primary);
}

/* 气泡箭头 — 默认指向上方目标 */
.onboard-bubble::after {
  content: "";
  position: absolute;
  top: -6px;
  left: 50%;
  transform: translateX(-50%) rotate(45deg);
  width: 10px;
  height: 10px;
  background: var(--color-elevated);
  border-top: 1px solid var(--color-core);
  border-left: 1px solid var(--color-core);
}

/* 箭头方向变体 */
.onboard-bubble.arrow-down::after {
  top: auto;
  bottom: -6px;
  border-top: none;
  border-left: none;
  border-bottom: 1px solid var(--color-core);
  border-right: 1px solid var(--color-core);
}

.onboard-bubble.arrow-left::after {
  top: 50%;
  left: -6px;
  transform: translateY(-50%) rotate(45deg);
  border-top: none;
  border-left: none;
  border-bottom: 1px solid var(--color-core);
  border-right: 1px solid var(--color-core);
}
```

#### 3.3.2 参数明细

| 参数 | 值 | 说明 |
|------|------|------|
| 背景 | `var(--color-elevated)` (#182238) | 凸起层底色 |
| 边框 | `1px solid var(--color-core)` (#00E5FF) | 主色描边 |
| 圆角 | `var(--radius-md)` (10px) | 中圆角 |
| padding | `var(--space-3)` (12px) | 标准内边距 |
| 最大宽度 | 240px | 避免过宽 |
| 阴影 | `--elevation-2` + 16px 青色发光 | 浮层感 + 科技感 |
| z-index | 100 | 高于内容、低于模态(200) |
| 入场动画 | `floatUp 0.3s var(--ease-out)` | 已有 keyframes |
| 标题字号 | `var(--text-sm)` (14px) font-weight 600 | — |
| 标题颜色 | `var(--color-core)` | 主色 |
| 正文字号 | `var(--text-xs)` (12px) | 小字 |
| 正文颜色 | `var(--color-t-secondary)` | 次要文本 |
| 正文行高 | 1.5 | 可读性 |
| 关闭按钮 | `var(--icon-sm)` (14px) | 右上角 |
| 箭头尺寸 | 10px × 10px 旋转 45° | CSS 三角形替代 |

#### 3.3.3 各页面 Onboarding 内容

| 页面 | 指向目标 | 箭头方向 | 标题 | 正文 |
|------|---------|---------|------|------|
| HomeView | `.core-visual` (星核核心) | `arrow-down`（气泡在核心下方） | 星核核心 | 这是你的文明核心。点击核心可快速进入建造页面，升级建筑提升能量产能。 |
| HomeView | `.quick-actions` (快速操作) | `arrow-down` | 快速操作 | 这里可以一键跳转到建造、科技、探索、部队页面。 |
| HomeView | `.action-queue` (行动队列) | `arrow-down` | 行动队列 | 当前可执行的操作会显示在这里，点击即可前往处理。 |
| BuildView | 第一个建筑卡片 | `arrow-left`（气泡在卡片右侧） | 建造系统 | 升级建筑可以提升资源产能。资源不足时按钮会变暗。 |
| TechView | 科技树面板 | `arrow-down` | 科技树 | 研究科技可以解锁新建筑、新单位和新探索区域。 |
| MapView | 第一个可探索节点 | `arrow-left` | 探索系统 | 点击星域节点开始探索，探索完成可获得资源和发现。 |
| ArmyView | 训练面板 | `arrow-down` | 部队系统 | 训练部队用于防御和战斗。需要先研究「军事基础」科技。 |

#### 3.3.4 触发逻辑

```ts
// composable: useOnboarding.ts
const ONBOARDING_KEY = 'starcore_onboarding'

interface OnboardingState {
  home_core: boolean
  home_quick: boolean
  home_queue: boolean
  build: boolean
  tech: boolean
  map: boolean
  army: boolean
}

function getOnboardingState(): OnboardingState {
  try {
    const raw = localStorage.getItem(ONBOARDING_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function shouldShowBubble(stepId: string): boolean {
  const state = getOnboardingState()
  return !state[stepId]
}

function dismissBubble(stepId: string) {
  const state = getOnboardingState()
  state[stepId] = true
  localStorage.setItem(ONBOARDING_KEY, JSON.stringify(state))
}
```

| 规则 | 说明 |
|------|------|
| 存储方式 | localStorage，key = `starcore_onboarding` |
| 数据结构 | JSON 对象，每个 step 一个 boolean |
| 显示条件 | `state[stepId] !== true`（未 dismiss 过） |
| dismiss 触发 | ① 点击关闭按钮 ② 点击气泡外部 ③ 路由切换离开当前页 ④ 10 秒超时自动 dismiss |
| dismiss 后 | 永久不再显示该 step（除非清 localStorage） |
| 多气泡顺序 | 同一页面多个气泡按顺序显示（前一个 dismiss 后才显示下一个） |
| 超时 | 10 秒后自动 dismiss |
| 转生后 | 不重置 onboarding 状态（已学过不再打扰） |

#### 3.3.5 dismiss 行为详细

```ts
// 气泡显示时
function showBubble(stepId: string) {
  visible.value = true
  // 10s 超时自动关闭
  timeoutId = setTimeout(() => dismiss(stepId), 10_000)
  // 监听外部点击
  document.addEventListener('click', onOutsideClick)
  // 监听路由变化
  const stopWatch = watch(() => route.path, () => dismiss(stepId))
}

// dismiss 时
function dismiss(stepId: string) {
  dismissBubble(stepId)  // 写入 localStorage
  visible.value = false
  clearTimeout(timeoutId)
  document.removeEventListener('click', onOutsideClick)
  stopWatch()
}
```

| dismiss 方式 | 立即关闭 | 写入 localStorage | 说明 |
|-------------|:---:|:---:|------|
| 点击关闭按钮 (×) | ✅ | ✅ | 主动关闭 |
| 点击气泡外部 | ✅ | ✅ | 被动关闭 |
| 路由切换 | ✅ | ✅ | 离开页面即关闭 |
| 10 秒超时 | ✅ | ✅ | 避免遗忘 |
| 页面刷新 | — | ✅（已写入） | 刷新后不再显示 |

### 3.3.6 `prefers-reduced-motion` 降级

```css
@media (prefers-reduced-motion: reduce) {
  .onboard-bubble {
    animation: none;  /* 无入场动画，直接显示 */
  }
  .skeleton-line {
    animation: none;  /* 无 shimmer，静态灰色条 */
    background: var(--color-elevated);
  }
}
```

### 3.4 验收清单

| 验收项 | 标准 |
|--------|------|
| 空状态文案 | 7 种空状态场景均有文案，含图标+主文案+提示+引导按钮 |
| 空状态样式 | 使用 `.empty-state` 类，全部 Token 引用 |
| 骨架屏 | shimmer 动画，使用已有 `@keyframes shimmer` |
| 气泡样式 | elevated 底 + core 边框 + elevation-2 阴影 + 青色发光 |
| 气泡箭头 | 支持 up/down/left 三方向，CSS 旋转 45° 实现 |
| 气泡内容 | 7 个 onboarding step 有标题+正文 |
| 触发逻辑 | localStorage 持久化，首次显示，dismiss 后不再出现 |
| dismiss 方式 | 4 种：关闭按钮/外部点击/路由切换/10s 超时 |
| 多气泡顺序 | 同页多气泡按顺序显示 |
| reduced-motion | 气泡无入场动画，骨架屏无 shimmer |
| Token 引用 | 全部使用已有 Token，零新增 |
| 无障碍 | 气泡有 aria-label，关闭按钮有 aria-label="关闭" |

---

## P3-4 四档响应断点

### 4.1 设计目标

将现有单一 768px 断点扩展为四档响应式体系，覆盖移动/平板/桌面/宽屏四类设备，精细化利用不同屏幕空间。

**四档断点**：

| 档位 | 名称 | 宽度范围 | 定位 |
|------|------|---------|------|
| S | Mobile | <768px | 单手操作，竖屏为主 |
| M | Tablet | 768px – 1023px | 横屏平板，小笔记本 |
| L | Desktop | 1024px – 1439px | 标准桌面显示器 |
| XL | Wide | ≥1440px | 大屏/外接显示器 |

> **768px 保持不变**：与现有 `useBreakpoint.ts` 的 `MOBILE_BREAKPOINT = 768` 一致，不影响 SideNav/BottomNav 的切换逻辑。新增 1024/1440 两档仅影响布局参数，不影响导航切换。

### 4.2 各档布局参数

#### 4.2.1 内容区容器

| 参数 | S (<768) | M (768–1023) | L (1024–1439) | XL (≥1440) |
|------|----------|-------------|--------------|------------|
| `.content` max-width | 720px | 1040px | 1280px | 1440px |
| `.content` padding | `var(--space-4)` (16) | `var(--space-6)` (24) | `var(--space-6)` (24) | `var(--space-7)` (32) |
| `.content` padding-bottom | 80px (BottomNav) | `var(--space-6)` (24) | `var(--space-6)` (24) | `var(--space-6)` (24) |

#### 4.2.2 HomeView 双列布局

| 参数 | S (<768) | M (768–1023) | L (1024–1439) | XL (≥1440) |
|------|----------|-------------|--------------|------------|
| `.home-top-row` 布局 | 单列堆叠 | grid 40% / 60% | grid 38% / 62% | grid 33% / 67% |
| `.home-top-row` gap | `var(--space-5)` (20) | `var(--space-6)` (24) | `var(--space-6)` (24) | `var(--space-7)` (32) |
| `.home` gap | `var(--space-5)` (20) | `var(--space-6)` (24) | `var(--space-6)` (24) | `var(--space-7)` (32) |
| Hero sticky | 否 | 是，top `--space-6` | 是，top `--space-6` | 是，top `--space-7` |

#### 4.2.3 Hero 核心区

| 参数 | S (<768) | M (768–1023) | L (1024–1439) | XL (≥1440) |
|------|----------|-------------|--------------|------------|
| `.core-visual` 尺寸 | 200×200px | 240×240px | 240×240px | 260×260px |
| `.core-visual::after` 光晕 | 240×240px | 288×288px | 288×288px | 312×312px |
| `.core-glow` 尺寸 | 80×80px | 96×96px | 96×96px | 104×104px |
| `.core-value` 字号 | `--text-2xl` (31) | `--text-display` (39) | `--text-display` (39) | `--text-display` (39) |
| Hero padding-top | `var(--space-6)` (24) | `var(--space-8)` (40) | `var(--space-8)` (40) | `var(--space-8)` (40) |

#### 4.2.4 文明概况列数

| 参数 | S (<768) | M (768–1023) | L (1024–1439) | XL (≥1440) |
|------|----------|-------------|--------------|------------|
| `.overview-grid` 列数 | 2 列 | 6 列 | 6 列 | 6 列 |
| `.overview-grid` gap | `var(--space-2)` (8) | `var(--space-3)` (12) | `var(--space-3)` (12) | `var(--space-4)` (16) |
| `.ov-item` 布局 | 横排（图标+值左，label 右） | 纵排（图标+值上，label 下） | 纵排 | 纵排 |
| `.ov-value` 字号 | `--text-sm` (14) | `--text-base` (16) | `--text-base` (16) | `--text-lg` (20) |

#### 4.2.5 行动队列

| 参数 | S (<768) | M (768–1023) | L (1024–1439) | XL (≥1440) |
|------|----------|-------------|--------------|------------|
| `.action-list` 列数 | 1 列 | 1 列 | 1 列 | 1 列（保持单列） |
| `.action-list` gap | `var(--space-2)` (8) | `var(--space-3)` (12) | `var(--space-3)` (12) | `var(--space-3)` (12) |
| `.action-queue` padding | `var(--space-4)` (16) | `var(--space-4)` (16) | `var(--space-5)` (20) | `var(--space-5)` (20) |

> 行动队列始终保持单列。原因：行动项需要足够的横向空间展示"图标+标题+描述+箭头"，多列会导致每列过窄。即使在宽屏下，单列行动队列 + 宽行动项更易扫描。

#### 4.2.6 快速操作入口（P3-2）

| 参数 | S (<768) | M (768–1023) | L (1024–1439) | XL (≥1440) |
|------|----------|-------------|--------------|------------|
| 按钮 gap | `var(--space-2)` (8) | `var(--space-3)` (12) | `var(--space-3)` (12) | `var(--space-4)` (16) |
| 按钮字号 | `--text-xs` (12) | `--text-sm` (14) | `--text-sm` (14) | `--text-sm` (14) |
| 图标尺寸 | `--icon-sm` (14) | `--icon-md` (18) | `--icon-md` (18) | `--icon-md` (18) |

### 4.3 CSS 实现规范

```css
/* ====== 基准：移动端 S (<768px) ====== */
/* AppShell .content */
.content {
  padding: var(--space-4);
  padding-bottom: 80px;
  max-width: 720px;
  margin: 0 auto;
  width: 100%;
}

/* HomeView */
.home { gap: var(--space-5); }
.home-top-row { flex-direction: column; gap: var(--space-5); }
.core-visual { width: 200px; height: 200px; }
.core-visual::after { width: 240px; height: 240px; }
.core-glow { width: 80px; height: 80px; }
.core-value { font-size: var(--text-2xl); }
.hero { padding: var(--space-6) 0 var(--space-4); }
.overview-grid { grid-template-columns: repeat(2, 1fr); gap: var(--space-2); }

/* ====== M: Tablet (768–1023) ====== */
@media (min-width: 768px) {
  .content { padding: var(--space-6); padding-bottom: var(--space-6); max-width: 1040px; }
  .home { gap: var(--space-6); }
  .home-top-row { display: grid; grid-template-columns: 40% 60%; gap: var(--space-6); align-items: start; }
  .home-top-row .hero { position: sticky; top: var(--space-6); }
  .core-visual { width: 240px; height: 240px; }
  .core-visual::after { width: 288px; height: 288px; }
  .core-glow { width: 96px; height: 96px; }
  .core-value { font-size: var(--text-display); }
  .hero { padding: var(--space-8) 0 var(--space-6); }
  .overview-grid { grid-template-columns: repeat(6, 1fr); gap: var(--space-3); }
  .ov-item { flex-direction: column; align-items: flex-start; gap: var(--space-1); }
  .ov-top { flex-direction: row; align-items: center; gap: var(--space-2); }
  .ov-value { font-size: var(--text-base); }
}

/* ====== L: Desktop (1024–1439) ====== */
@media (min-width: 1024px) {
  .content { max-width: 1280px; }
  .home-top-row { grid-template-columns: 38% 62%; }
  .action-queue { padding: var(--space-5); }
}

/* ====== XL: Wide (≥1440) ====== */
@media (min-width: 1440px) {
  .content { max-width: 1440px; padding: var(--space-7); padding-bottom: var(--space-6); }
  .home { gap: var(--space-7); }
  .home-top-row { grid-template-columns: 33% 67%; gap: var(--space-7); }
  .home-top-row .hero { top: var(--space-7); }
  .core-visual { width: 260px; height: 260px; }
  .core-visual::after { width: 312px; height: 312px; }
  .core-glow { width: 104px; height: 104px; }
  .overview-grid { gap: var(--space-4); }
  .ov-value { font-size: var(--text-lg); }
  .action-queue { padding: var(--space-5); }
}
```

### 4.4 useBreakpoint 扩展建议

现有 `useBreakpoint.ts` 仅返回 `isDesktop`（≥768px）。P3-4 建议扩展为四档，供组件按需使用：

```ts
// useBreakpoint.ts 扩展（不破坏现有 isDesktop）
export type Breakpoint = 'S' | 'M' | 'L' | 'XL'

export function useBreakpoint() {
  const isDesktop = ref(true)
  const breakpoint = ref<Breakpoint>('S')

  function update() {
    const w = window.innerWidth
    isDesktop.value = w >= 768
    if (w < 768) breakpoint.value = 'S'
    else if (w < 1024) breakpoint.value = 'M'
    else if (w < 1440) breakpoint.value = 'L'
    else breakpoint.value = 'XL'
  }

  // ... 其余逻辑不变

  return { isDesktop, breakpoint }
}
```

> **注意**：`isDesktop` 保持不变，SideNav/BottomNav 切换逻辑不受影响。`breakpoint` 为新增返回值，组件可选使用。CSS 媒体查询为主，JS 断点仅为需要 JS 逻辑判断的场景准备（如动态计算列数）。

### 4.5 响应式行为约束

| 约束 | 说明 |
|------|------|
| 无 FOUC | 断点切换不闪烁。CSS 媒体查询即时生效；JS 断点在 setup 阶段初始求值（已有模式） |
| 移动端优先 | 基准样式为 S 档，M/L/XL 逐级覆盖 |
| 导航切换仅在 768px | SideNav/BottomNav 切换不随 1024/1440 变化 |
| 渐进增强 | 从 S→M→L→XL，每档仅调整尺寸/间距/列数，不改变 DOM 结构 |
| 文字不缩放过大 | 最大字号 `--text-display` (39px)，XL 档不再放大字号，仅放大间距和核心视觉 |

### 4.6 验收清单

| 验收项 | 标准 |
|--------|------|
| 四档断点 | S(<768) / M(768-1023) / L(1024-1439) / XL(≥1440) |
| content max-width | 720 → 1040 → 1280 → 1440 |
| HomeView 双列比 | 40/60 → 38/62 → 33/67（S 档单列） |
| 文明概况列数 | S:2 → M/L/XL:6 |
| 核心视觉尺寸 | 200 → 240 → 240 → 260 |
| 核心数值字号 | 2xl → display → display → display |
| 间距递增 | space-5 → space-6 → space-6 → space-7 |
| 导航切换 | 仅 768px 切换 SideNav/BottomNav |
| useBreakpoint | 扩展返回 breakpoint，不破坏 isDesktop |
| 无 FOUC | 断点切换无闪烁 |
| Token 引用 | 全部使用 `--space-*`、`--text-*`，零硬编码 |

---

## P3-5 路由切换"空间跃迁"光效

### 5.1 设计目标

将当前路由切换的简单 opacity fade 替换为"空间跃迁"光效——模拟星际跃迁时的白光闪过 + 微缩放过渡，增强页面切换的沉浸感和科技氛围。

**现状**：AppShell.vue 中 `<transition name="fade" mode="out-in">`，仅 opacity 0↔1，0.2s。

**目标**：opacity + scale + 白光 overlay 三重过渡。

### 5.2 动效设计

#### 5.2.1 动画时序

```
时间轴（out-in 模式，总时长 ~0.5s）：

  0ms        200ms       350ms       500ms
  │          │           │           │
  ├──────────┤           │           │
  │  旧页离场  │           │           │
  │ scale(1→0.96)        │           │
  │ opacity(1→0)         │           │
  │          ├───────────┤           │
  │          │  光效闪过   │           │
  │          │  overlay   │           │
  │          │  opacity   │           │
  │          │  (0→0.6→0) │           │
  │          │           ├───────────┤
  │          │           │  新页入场  │
  │          │           │  scale    │
  │          │           │  (1.04→1) │
  │          │           │  opacity  │
  │          │           │  (0→1)    │
  │          │           │           │
```

#### 5.2.2 旧页离场（leave）

```css
.warp-leave-active {
  transition: opacity 0.2s var(--ease-out),
              transform 0.2s var(--ease-out);
  transform-origin: center center;
}
.warp-leave-to {
  opacity: 0;
  transform: scale(0.96);
}
```

| 参数 | 值 | 说明 |
|------|------|------|
| duration | 0.2s | 快速离场 |
| opacity | 1 → 0 | 渐隐 |
| transform | scale(1) → scale(0.96) | 微缩 4% |
| transform-origin | center center | 从中心缩放 |
| easing | `var(--ease-out)` | 快速开始、缓慢结束 |

#### 5.2.3 新页入场（enter）

```css
.warp-enter-active {
  transition: opacity 0.3s var(--ease-out),
              transform 0.3s var(--ease-out);
  transform-origin: center center;
}
.warp-enter-from {
  opacity: 0;
  transform: scale(1.04);
}
```

| 参数 | 值 | 说明 |
|------|------|------|
| duration | 0.3s | 略慢于离场，有"展开"感 |
| opacity | 0 → 1 | 渐显 |
| transform | scale(1.04) → scale(1) | 从放大 4% 回落 |
| transform-origin | center center | 从中心展开 |
| easing | `var(--ease-out)` | — |

#### 5.2.4 白光 overlay 闪过

在 AppShell 中新增一个 overlay div，在路由切换时触发白光闪过：

```css
.warp-overlay {
  position: fixed;
  inset: 0;
  z-index: 300;  /* 高于模态(200) */
  pointer-events: none;
  background: radial-gradient(
    circle at center,
    rgba(255, 255, 255, 0.15) 0%,
    rgba(0, 229, 255, 0.08) 30%,
    transparent 70%
  );
  opacity: 0;
}

.warp-overlay.active {
  animation: warpFlash 0.35s var(--ease-out);
}

@keyframes warpFlash {
  0% { opacity: 0; }
  30% { opacity: 0.6; }  /* 峰值 60% 透明度 */
  100% { opacity: 0; }
}
```

| 参数 | 值 | 说明 |
|------|------|------|
| overlay 位置 | fixed inset 0 | 全屏覆盖 |
| z-index | 300 | 高于一切，但 pointer-events: none 不挡交互 |
| 背景渐变 | 中心白色 15% → 青色 8% → 透明 | 模拟跃迁光波 |
| 峰值 opacity | 0.6 | 不完全遮挡，透出底层 |
| 闪过时长 | 0.35s | 比离场(0.2s)+入场(0.3s)略短，在中间触发 |
| easing | `var(--ease-out)` | — |

### 5.3 触发机制

```vue
<!-- AppShell.vue -->
<template>
  <div class="app-shell">
    <!-- ... -->
    <main class="content">
      <router-view v-slot="{ Component }">
        <transition
          name="warp"
          mode="out-in"
          @before-leave="onWarpStart"
          @after-enter="onWarpEnd"
        >
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
    <!-- 空间跃迁光效 overlay -->
    <div ref="warpOverlay" class="warp-overlay" aria-hidden="true"></div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const warpOverlay = ref<HTMLElement | null>(null)

function onWarpStart() {
  // 触发光效
  if (warpOverlay.value) {
    warpOverlay.value.classList.remove('active')
    // 强制 reflow 以重启动画
    void warpOverlay.value.offsetWidth
    warpOverlay.value.classList.add('active')
  }
}

function onWarpEnd() {
  if (warpOverlay.value) {
    warpOverlay.value.classList.remove('active')
  }
}
</script>
```

| 事件 | 时机 | 动作 |
|------|------|------|
| `@before-leave` | 旧页开始离场时 | 添加 `.active` 触发 warpFlash 动画 |
| `@after-enter` | 新页入场完成时 | 移除 `.active`（兜底，动画已结束） |

### 5.4 CSS 汇总

```css
/* ====== 路由切换"空间跃迁"光效 ====== */
/* 替换原有 .fade-* 类 */

/* 旧页离场 */
.warp-leave-active {
  transition: opacity 0.2s var(--ease-out),
              transform 0.2s var(--ease-out);
  transform-origin: center center;
}
.warp-leave-to {
  opacity: 0;
  transform: scale(0.96);
}

/* 新页入场 */
.warp-enter-active {
  transition: opacity 0.3s var(--ease-out),
              transform 0.3s var(--ease-out);
  transform-origin: center center;
}
.warp-enter-from {
  opacity: 0;
  transform: scale(1.04);
}

/* 白光 overlay */
.warp-overlay {
  position: fixed;
  inset: 0;
  z-index: 300;
  pointer-events: none;
  background: radial-gradient(
    circle at center,
    rgba(255, 255, 255, 0.15) 0%,
    rgba(0, 229, 255, 0.08) 30%,
    transparent 70%
  );
  opacity: 0;
}

@keyframes warpFlash {
  0% { opacity: 0; }
  30% { opacity: 0.6; }
  100% { opacity: 0; }
}

.warp-overlay.active {
  animation: warpFlash 0.35s var(--ease-out);
}
```

### 5.5 `prefers-reduced-motion` 降级

```css
@media (prefers-reduced-motion: reduce) {
  /* 降级为简单 opacity fade（恢复原行为） */
  .warp-leave-active {
    transition: opacity 0.15s var(--ease-out);
    transform: none;
  }
  .warp-leave-to {
    opacity: 0;
    transform: none;
  }
  .warp-enter-active {
    transition: opacity 0.15s var(--ease-out);
    transform: none;
  }
  .warp-enter-from {
    opacity: 0;
    transform: none;
  }
  /* 光效 overlay 完全禁用 */
  .warp-overlay { display: none; }
}
```

| 降级项 | 原效果 | 降级后 |
|--------|--------|--------|
| 旧页离场 | opacity + scale(0.96) | 仅 opacity，0.15s |
| 新页入场 | opacity + scale(1.04) | 仅 opacity，0.15s |
| 白光 overlay | warpFlash 0.35s | display: none |

> **注意**：全局规则 `@media (prefers-reduced-motion: reduce) { *: { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }` 会使所有 transition/animation 降到 0.01ms。上面的降级 CSS 是显式声明，确保即使 `!important` 全局规则生效后，transition 的属性仍正确（只做 opacity，不做 transform），避免 reduced-motion 用户看到任何位移。

### 5.6 性能考量

| 考量 | 措施 |
|------|------|
| transform/opacity 均为 GPU 加速属性 | 不触发 layout/paint，仅 composite |
| overlay 使用 radial-gradient | 静态背景，不每帧重绘 |
| overlay pointer-events: none | 不拦截交互 |
| 动画时长总计 0.5s | 不拖沓，用户可接受 |
| `out-in` 模式 | 旧页完全离开后新页才入场，无重叠渲染负担 |

### 5.7 验收清单

| 验收项 | 标准 |
|--------|------|
| transition name | `fade` → `warp` |
| 旧页离场 | opacity 1→0 + scale 1→0.96，0.2s |
| 新页入场 | opacity 0→1 + scale 1.04→1，0.3s |
| 白光 overlay | radial-gradient 中心白→青→透明，峰值 0.6，0.35s |
| overlay z-index | 300，pointer-events: none |
| 触发时机 | `@before-leave` 添加 .active |
| 缓动 | 全部 `var(--ease-out)` |
| reduced-motion | 降级为纯 opacity fade 0.15s，overlay 隐藏 |
| 性能 | 仅 transform+opacity，GPU 加速 |
| Token 引用 | 缓动用 `--ease-out`，颜色用 rgba 字面量（光效特殊场景） |

---

## P3-6 资源产出粒子动画

### 6.1 设计目标

当 TopBar 资源 pill 的产出率 `rate > 0` 时，在 pill 旁边显示向上流动的光点粒子，直观传达"资源正在增长"的动态感。

**设计约束**：
- 性能优先：5 种资源 × 粒子数量需严格控制，避免每秒大量 DOM 操作
- 视觉克制：粒子是"锦上添花"，不喧宾夺主
- 遵循 `prefers-reduced-motion`

### 6.2 粒子视觉参数

#### 6.2.1 单粒子样式

```css
.res-particle {
  position: absolute;
  width: 2px;
  height: 2px;
  border-radius: 50%;
  background: var(--c, var(--color-core));
  box-shadow: 0 0 4px var(--c, var(--color-core));
  pointer-events: none;
  animation: particleRise var(--duration, 1s) var(--ease-out) forwards;
}

@keyframes particleRise {
  0% {
    opacity: 0;
    transform: translateY(0) scale(0.5);
  }
  20% {
    opacity: 0.8;
    transform: translateY(-4px) scale(1);
  }
  80% {
    opacity: 0.6;
    transform: translateY(-20px) scale(0.8);
  }
  100% {
    opacity: 0;
    transform: translateY(-28px) scale(0.3);
  }
}
```

#### 6.2.2 参数明细

| 参数 | 值 | 说明 |
|------|------|------|
| 粒子尺寸 | 2px × 2px | 极小光点 |
| 形状 | border-radius: 50% (圆形) | — |
| 颜色 | `var(--c)` = 资源主色 | 与资源 pill 图标同色 |
| 发光 | `box-shadow: 0 0 4px var(--c)` | 微弱光晕 |
| 初始透明度 | 0 | 从不可见开始 |
| 峰值透明度 | 0.8（20% 时） | 快速显现 |
| 消散透明度 | 0（100% 时） | 渐隐消失 |
| 移动距离 | 0 → -28px（向上 28px） | 从 pill 底部向上飘 28px |
| 缩放 | 0.5 → 1 → 0.8 → 0.3 | 先放大再缩小消散 |
| 生命周期 | 0.8s – 1.2s（随机） | `--duration` 随机分配 |
| 缓动 | `var(--ease-out)` | — |
| animation-fill-mode | `forwards` | 结束后保持终态（opacity:0） |

#### 6.2.3 粒子颜色映射

| 资源 | --c 值 | rgba |
|------|--------|------|
| energy | `--color-core` (#00E5FF) | rgba(0, 229, 255, …) |
| alloy | `--color-amber` (#FFB627) | rgba(255, 182, 39, …) |
| crystal | `--color-plasma` (#A78BFA) | rgba(167, 139, 250, …) |
| data | `--color-quantum` (#2EE6A0) | rgba(46, 230, 160, …) |
| dark | `--color-t-primary` (#E8EDF5) | rgba(232, 237, 245, …) |

> 颜色直接取自 `TopBar.vue` 中 `resourceList` 的 `r.color`，通过 `--c` 注入。

### 6.3 粒子生成策略

#### 6.3.1 数量控制

| 参数 | 值 | 说明 |
|------|------|------|
| 每资源最大并发粒子 | 3 | 同时最多 3 个粒子在动画中 |
| 生成间隔 | 400ms | 每 0.4s 生成 1 个粒子 |
| 全局最大粒子数 | 15 | 5 资源 × 3 = 15，硬上限 |
| rate = 0 时 | 不生成 | 无产出无粒子 |
| rate < 0 时 | 不生成 | 负产出不显示粒子（已有红色文字警示） |

#### 6.3.2 生成逻辑

```ts
// composable: useResourceParticles.ts
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useGameStore } from '@/stores/game'

const PARTICLE_INTERVAL = 400  // ms
const MAX_PARTICLES_PER_RES = 3

export function useResourceParticles() {
  const game = useGameStore()
  const particles = ref<Array<{ id: number; resId: string; color: string; duration: number; offset: number }>>([])
  let particleId = 0
  let intervalId: number | null = null
  let isVisible = true

  function spawnParticle() {
    if (!isVisible) return

    for (const [resId, meta] of Object.entries(game.resources.allMeta)) {
      const rate = game.resources.getRate(resId as any)
      if (rate.lte(0)) continue  // 仅 rate > 0 时生成

      // 检查该资源当前粒子数
      const currentCount = particles.value.filter(p => p.resId === resId).length
      if (currentCount >= MAX_PARTICLES_PER_RES) continue

      const id = ++particleId
      const duration = 800 + Math.random() * 400  // 0.8s ~ 1.2s 随机
      const offset = Math.random() * 16 - 8  // 水平随机偏移 -8~8px

      particles.value.push({
        id,
        resId,
        color: meta.color,
        duration,
        offset,
      })

      // 动画结束后移除
      setTimeout(() => {
        particles.value = particles.value.filter(p => p.id !== id)
      }, duration)
    }
  }

  onMounted(() => {
    intervalId = window.setInterval(spawnParticle, PARTICLE_INTERVAL)
    document.addEventListener('visibilitychange', onVisibilityChange)
  })

  onUnmounted(() => {
    if (intervalId) clearInterval(intervalId)
    document.removeEventListener('visibilitychange', onVisibilityChange)
  })

  function onVisibilityChange() {
    isVisible = document.visibilityState === 'visible'
    if (!isVisible) {
      // 页面不可见时清空粒子，避免积压
      particles.value = []
    }
  }

  return { particles }
}
```

#### 6.3.3 性能优化措施

| 措施 | 说明 |
|------|------|
| CSS 动画而非 JS 动画 | 粒子使用 `@keyframes` + CSS animation，浏览器自动 GPU 合成 |
| 仅 transform + opacity | 不触发 layout/paint |
| setInterval 400ms | 低频生成，不每帧操作 DOM |
| 最大 15 粒子 | 硬上限，5 资源 × 3 |
| visibilitychange 暂停 | 切 tab 时清空粒子，不积压 |
| setTimeout 自动清理 | 每个粒子动画结束后自动从数组移除 |
| `will-change: transform, opacity` | 建议添加，提示浏览器预先合成 |

### 6.4 TopBar 集成方案

#### 6.4.1 DOM 结构

```vue
<!-- TopBar.vue 模板中，res-pill 内部新增粒子容器 -->
<li
  v-for="r in resourceList"
  :key="r.id"
  class="res-pill"
  :class="{ flash: r.flash, 'has-rate': parseFloat(r.rate) > 0 }"
  :style="{ '--c': r.color }"
>
  <svg class="r-icon" style="width: var(--icon-sm); height: var(--icon-sm)" aria-hidden="true">
    <use :href="'#' + r.icon" />
  </svg>
  <span class="r-amount font-mono">{{ r.amount }}</span>
  <span class="r-rate font-mono" :style="{ color: r.color }">{{ r.rate }}</span>
  <!-- 粒子容器 -->
  <div class="r-particles" aria-hidden="true">
    <span
      v-for="p in particles.filter(p => p.resId === r.id)"
      :key="p.id"
      class="res-particle"
      :style="{
        '--c': p.color,
        '--duration': p.duration + 'ms',
        left: `calc(50% + ${p.offset}px)`,
        bottom: '0',
      }"
    ></span>
  </div>
</li>
```

#### 6.4.2 粒子容器样式

```css
.res-pill {
  /* 现有样式保持 */
  position: relative;  /* 新增：为粒子定位 */
  overflow: visible;   /* 新增：允许粒子溢出 pill 边界 */
}

.r-particles {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: visible;
}

.res-particle {
  position: absolute;
  bottom: 0;
  left: 50%;
  width: 2px;
  height: 2px;
  border-radius: 50%;
  background: var(--c, var(--color-core));
  box-shadow: 0 0 4px var(--c, var(--color-core));
  pointer-events: none;
  will-change: transform, opacity;
  animation: particleRise var(--duration, 1s) var(--ease-out) forwards;
}
```

> **注意**：`overflow: visible` 允许粒子从 pill 底部向上飘出。如果 pill 在 TopBar 中有 `overflow: hidden`（如 pill 在可滚动 strip 中），则需要将粒子容器放在 pill 外部或提高 z-index。当前 `.res-strip` 有 `overflow-x: auto`，但 `overflow-y` 未设置（默认 visible），粒子向上飘出不会被裁切。

### 6.5 降级方案

#### 6.5.1 `prefers-reduced-motion` 降级

```css
@media (prefers-reduced-motion: reduce) {
  .res-particle {
    animation: none;
    display: none;  /* 完全隐藏粒子 */
  }
  .r-particles {
    display: none;
  }
}
```

| 降级项 | 原效果 | 降级后 |
|--------|--------|--------|
| 粒子动画 | particleRise 0.8-1.2s | display: none，无粒子 |
| 粒子容器 | 渲染粒子 | display: none |

#### 6.5.2 低性能设备降级

建议前端通过 `navigator.hardwareConcurrency` 或帧率检测实现自适应降级：

```ts
// 低性能检测（建议阈值）
const isLowPerf = navigator.hardwareConcurrency <= 4
// 或检测设备内存
const isLowMem = (navigator as any).deviceMemory <= 4

// 降级策略
const PARTICLE_INTERVAL = isLowPerf ? 800 : 400  // 间隔翻倍
const MAX_PARTICLES_PER_RES = isLowPerf ? 1 : 3  // 数量减至 1
```

| 设备等级 | 生成间隔 | 每资源最大粒子 | 全局上限 |
|---------|---------|--------------|---------|
| 标准 | 400ms | 3 | 15 |
| 低性能 | 800ms | 1 | 5 |

#### 6.5.3 标签页不可见降级

```ts
// 已在生成逻辑中处理
function onVisibilityChange() {
  isVisible = document.visibilityState === 'visible'
  if (!isVisible) {
    particles.value = []  // 清空所有粒子
  }
}
```

### 6.6 粒子动画与现有资源高亮的关系

| 特性 | P2-5 资源变化高亮 | P3-6 资源产出粒子 |
|------|------------------|------------------|
| 触发条件 | 资源数值变化（fmt 后字符串不同） | rate > 0（持续产出） |
| 视觉表现 | 数值文字 0.3s 变绿 + 发光 | 向上飘移的光点粒子 |
| 持续时间 | 0.3s 一次性 | 持续生成，rate>0 期间不断 |
| 语义 | "数值跳变了" | "资源在持续增长" |
| 关系 | 互不冲突，可同时存在 | 互不冲突 |

> P2-5 的 flash 是"数值变化时的瞬时高亮"，P3-6 的粒子是"持续产出时的动态氛围"。两者互补：flash 让用户感知到数值跳变，粒子让用户感知到资源在持续流动。

### 6.7 验收清单

| 验收项 | 标准 |
|--------|------|
| 触发条件 | rate > 0 时生成粒子，rate ≤ 0 时不生成 |
| 粒子尺寸 | 2px × 2px 圆形 |
| 粒子颜色 | 各资源主色，通过 `--c` 注入 |
| 粒子发光 | `box-shadow: 0 0 4px var(--c)` |
| 移动方向 | 向上 28px（0 → -28px） |
| 生命周期 | 0.8s – 1.2s 随机 |
| 缩放 | 0.5 → 1 → 0.8 → 0.3 |
| 透明度 | 0 → 0.8 → 0.6 → 0 |
| 生成间隔 | 400ms（标准）/ 800ms（低性能） |
| 每资源上限 | 3（标准）/ 1（低性能） |
| 全局上限 | 15（标准）/ 5（低性能） |
| visibilitychange | 不可见时清空粒子 |
| reduced-motion | display: none，无粒子 |
| 性能 | CSS animation + transform/opacity + will-change |
| Token 引用 | 颜色用 `--c`（资源主色），缓动用 `--ease-out` |
| 无障碍 | aria-hidden="true"，纯装饰 |

---

## 附录：P3 规范 Token 使用核对

### 新增全局 Token

| Token 名 | 值 | 用途 | 对应任务 |
|---|---|---|:---:|
| — | — | — | — |

> **零新增全局 Token。** 所有规范均沿用 P0/P1/P2 已建立的 Token 体系。

### 新增 keyframes

| 名称 | 用途 | 对应任务 | 文件位置 |
|---|---|---|---|
| `warpFlash` | 路由跃迁白光闪过 | P3-5 | style.css |
| `particleRise` | 资源粒子向上飘移 | P3-6 | style.css |

### 沿用已有 Token

| Token 类别 | 使用到的 Token |
|---|---|
| 颜色 | `--color-core`、`--color-core-dim`、`--color-plasma`、`--color-quantum`、`--color-alert`、`--color-amber`、`--color-t-primary`、`--color-t-secondary`、`--color-t-tertiary`、`--color-surface`、`--color-elevated`、`--color-hover`、`--color-border-line`、`--color-border-glow`、`--color-on-core` |
| 间距 | `--space-1` ~ `--space-8` |
| 字号 | `--text-xs`、`--text-sm`、`--text-base`、`--text-lg`、`--text-xl`、`--text-2xl`、`--text-display` |
| 图标 | `--icon-sm`、`--icon-md`、`--icon-lg` |
| 圆角 | `--radius-sm`、`--radius-md`、`--radius-lg`、`--radius-pill` |
| Elevation | `--elevation-1`、`--elevation-2` |
| 缓动 | `--ease-out` |
| 字体 | `--font-display`、`--font-mono` |

### 沿用已有 keyframes

| 名称 | 用途 | 沿用于 |
|---|---|---|
| `shimmer` | 骨架屏加载动画 | style.css 已有 |
| `floatUp` | onboarding 气泡入场 | style.css 已有 |

### 沿用已有图标

| 图标 ID | 用途 |
|---|---|
| `i-nav-build` | 快速操作-建造、空状态图标 |
| `i-nav-tech` | 快速操作-科技、空状态图标 |
| `i-nav-explore` | 快速操作-探索、空状态图标 |
| `i-nav-army` | 快速操作-部队、空状态图标 |
| `i-nav-home` | HomeView 空状态图标 |
| `i-nav-relic` | RelicView 空状态图标 |

### 沿用已有按钮系统

| 按钮类 | 用途 |
|---|---|
| `.btn-secondary.sm` | 空状态引导按钮、快速操作按钮基础 |

---

> **交付状态**：P3-2/3/4/5/6 五项规范已完成，待前端落地。本阶段未改动任何源码。
