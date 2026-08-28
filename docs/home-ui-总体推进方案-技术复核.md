# 主界面优化总体推进方案 · 技术复查意见

> **复查人**：后端（全栈技术视角）
> **复查日期**：2026-07-16
> **复查对象**：`docs/home-ui-总体推进方案.md`（337 行，32 个任务，P0×8 / P1×8 / P2×10 / P3×6）
> **项目版本**：v0.39（Vue3 + TS + Vite 8 + Pinia 3 + Vitest 3）
> **复查范围**：技术可行性 / 收益评估 / 风险识别 / 补充建议 / 总体结论

---

## 一、技术可行性复查

### 1.1 总体判断

**方案中 32 个任务在当前技术栈下均可落地，无需引入新运行时依赖。** 所有改动可归为三类技术手段：CSS 变量增改、Vue 模板/样式重构、少量 composable 逻辑。下面逐项复查高风险/高关注任务。

### 1.2 逐项可行性分析

#### P0 阶段 — 全部可行，无技术障碍

| 任务 | 可行性 | 实现路径 | 备注 |
|------|--------|---------|------|
| P0-1 Hero 移除环绕资源 | ✅ 极简 | 删除 HomeView.vue `.orbit-1~4` 的 4 个 div + `.orbit` 样式块。`coreResources` computed 可保留（TopBar 已用）或精简 | 零风险 |
| P0-2 SideNav 底部去重 | ✅ 极简 | SideNav.vue 删除 `transcendCount` 相关的 `<div class="stat">` 块 + 对应 computed | 零风险 |
| P0-3/4 表层明度/辅色调整 | ✅ 极简 | 改 `style.css` `:root` 中 6 个 CSS 变量值 | **全局生效**，需跨页面回归（见风险 R1） |
| P0-5 间距 Token | ✅ 可行 | `style.css` `:root` 新增 `--space-1~8`，然后全局替换硬编码值 | **工作量大**：grep 统计全项目约 168 处 `gap/padding/margin` 硬编码值分布在 18 个文件 |
| P0-6 字号 Token | ✅ 可行 | 同上，新增 `--text-xs~display`，替换硬编码 | **工作量大**：约 139 处 `font-size` 硬编码分布在 17 个文件 |
| P0-7 核心数值放大 | ✅ 极简 | HomeView.vue `.core-value` font-size 20px→28px | 依赖 P0-6 先落地 Token |
| P0-8 图标尺寸 Token | ✅ 可行 | 新增 `--icon-xs/sm/md/lg`，替换各 `<svg>` 的 `width/height` 属性 | 需注意：当前图标尺寸有 12/14/16/20/24 五种，收敛为 4 种需逐一确认 |

#### P1 阶段 — 可行，需注意实现细节

**P1-1 Hero 核心区重构** — ✅ 可行，无技术障碍

- 当前 `.core-visual` 是 160px（移动）/ 180px（桌面）的 `position: relative` 容器，内部 3 个 ring + glow + center + 4 个 orbit
- 重构只需调整尺寸/光晕/增加点击事件，DOM 结构变化小
- 点击核心跳转建造页：`@click="router.push('/build')"` 即可，路由已存在
- 光晕渗透：`.core-glow` 当前 `filter: blur(8px)`，调大 blur + 尺寸即可
- **注意点**：删除 orbit 后 `.core-visual` 容器可缩小 padding，需同步调整 Hero section 布局

**P1-2 行动队列合并** — ✅ 可行，但是 P1 中逻辑最复杂的一项

- 当前 `activeEvents`（computed）遍历 buildings + techs + exploration + military 四个 store 输出进行中/可执行事件
- 当前 `suggestions`（computed）遍历同样的数据源输出推荐行动
- **两者数据源高度重叠**：`activeEvents` 的「可升级建筑」与 `suggestions` 的「N 个建筑可升级」本质是同一批数据的不同表达
- 合并方案：保留 `activeEvents` 的逐条事件逻辑作为「进行中」类，`suggestions` 的汇总推荐作为「可执行」类，合并为一个 `<section>` 渲染
- **实现路径**：新建 `actionQueue` computed 返回 `{ type: 'progress' | 'ready', ...payload }[]`，模板内按 type 分组渲染
- **风险点**：跳转路径（`/build` `/tech` `/map` `/army`）必须逐条保留，不能在合并中丢失。建议合并前先写一个跳转路径清单测试

**P1-3 桌面端双列布局** — ✅ 可行，但有一个隐藏影响

- 当前 `AppShell.vue` 的 `.content` 设置了 `max-width: 720px; margin: 0 auto`，这是**全局所有页面**的约束
- 方案要求桌面端 `max-width: 720→1040px`，如果直接改 `AppShell.vue`，**会影响 BuildView / TechView / MapView / ArmyView 等所有页面**的桌面端布局
- **建议实现路径**：
  - 方案 A（推荐）：AppShell 的 `.content` max-width 保持 720px 不变，在 HomeView 内部用 scoped 样式对 `.home` 容器单独设置 `max-width: 1040px`
  - 方案 B：AppShell 改为 `max-width: none`，各 View 自行控制内容区宽度——改动面大，不推荐
- 双列 Grid 实现：`grid-template-columns: 1fr` → `@media (min-width:768px) { grid-template-columns: 40% 1fr }` 即可，技术成熟
- **768px 断点**已有 `useBreakpoint` composable + CSS `@media` 双重保障，无 FOUC 风险

**P1-4 字体断裂修复** — ✅ 可行

- 方案 B（PingFang SC Bold + letter-spacing + text-shadow）零新增资源，纯 CSS
- 方案 A（引入中文科幻字体）需子集化 + `font-display: swap`，技术成熟但增加包体积
- 当前已自托管 3 个 woff2 字体（Orbitron + JetBrains Mono×2），字体加载基础设施完备

**P1-5 按钮系统** — ✅ 可行，中等工作量

- 当前按钮散落各 View，有 7+ 种 ad-hoc 类名：`btn-upgrade`（BuildView）、`btn-research`（TechView）、`btn-explore`（MapView）、`btn-battle/btn-garrison/btn-confirm`（BattleView）、`btn-discard`（RelicView）、`event-btn/action-card`（HomeView）
- 方案要求统一为 `.btn-primary/secondary/accent/ghost` 四类
- **实现路径**：在 `style.css` 定义全局按钮基类，各 View 逐步迁移
- **建议补充**：考虑是否抽取 `<Button>` Vue 组件而非纯 CSS class。组件化利于后续维护（props 控制 variant/size/disabled），但改动面比纯 CSS 大。**短期建议纯 CSS class，长期可组件化**

**P1-6/7/8 文明概况/section 背景/标题分级** — ✅ 均可行

- 纯 CSS + 模板微调，无逻辑变更

#### P2 阶段 — 可行，需关注性能

**P2-1 星云+暗角** — ✅ 可行

- `body::after` 增加 `radial-gradient` 层，纯 CSS
- **性能注意**：大尺寸 `radial-gradient` + `blur` 在低端移动设备可能触发重绘开销。建议限制 `pointer-events: none` + `position: fixed` 避免触发 layout

**P2-2 星点闪烁** — ✅ 可行

- 当前 `body::before` 已有 6 个星点的 `radial-gradient`
- 改为 CSS 动画需注意：`background` 属性的 `radial-gradient` 无法直接做 `opacity` 过渡动画（不是独立元素）
- **实现路径**：需将星点拆为独立 `<div>` 元素或用 `@property` 注册自定义属性才能动画化 `opacity`。`@property` 在 Safari 16.4+ 支持，需确认目标浏览器范围
- **替代方案**：用 6 个绝对定位的微小 `<div>` + `@keyframes twinkle`，更兼容但 DOM 多 6 个节点

**P2-3 核心环信息映射** — ✅ 可行

- 3 个 ring 的 `opacity` / `animation-duration` 通过 `:style` 绑定游戏状态即可
- 数据源：`game.research.count / TECHS.length`（科技完成率）、`game.exploration.progress`（探索进度）、`game.resources.getAmount('energy')`（能量等级）
- **注意**：`animation-duration` 通过 inline style 覆盖 CSS 动画速度，需验证 Vue 响应式更新 `animation-duration` 时浏览器是否平滑过渡（部分浏览器会重启动画）

**P2-4 交互反馈游戏化** — ✅ 可行

- `translateY(-2px)` / `scale(.95)` 均为 `transform` 动画，GPU 加速，性能好
- `prefers-reduced-motion` 已有全局降级规则（style.css L101-103），无需额外处理

**P2-5 资源 count-up 动画** — ⚠️ 可行但需谨慎

- 资源数值每秒 tick 更新（`TICK_INTERVAL = 1000ms`），count-up 动画如果 0.3s 则每秒都在动画
- **风险**：如果 5 个资源同时 count-up，每秒触发 5 个动画，低端设备可能掉帧
- **建议**：count-up 仅在值变化幅度超过阈值时触发（如 >10% 变化），或用 `requestAnimationFrame` 节流
- **数据准确性**：count-up 只是视觉过渡，底层 `resources.amount` 仍是精确值，不影响存档/计算

**P2-8 SideNav 可折叠** — ✅ 可行

- 当前 SideNav 宽度固定 200px，折叠为 48px 仅图标
- 状态记忆：`localStorage.setItem('sidenav-collapsed', 'true')`，读取在 `onMounted` 中
- 项目是纯客户端 SPA（`useBreakpoint.ts` 注释已确认无 SSR），localStorage 安全
- **注意**：折叠后 `nav-item` 的 `<span>` 文字需 `v-if` 或 `opacity:0` 隐藏，不能仅靠 `width` 裁剪（会溢出）

**P2-9 视觉动线引导** — ✅ 可行，纯 CSS

**P2-10 TopBar pill 优化** — ✅ 可行

- 产出率字号 10→11px + 渐变遮罩 `mask-image: linear-gradient(...)` 即可

#### P3 阶段 — 均可行，无技术障碍

P3 的 6 个任务（BottomNav 面板位置、快速操作入口、加载空状态、三段式断点、路由跃迁特效、资源粒子动画）均为常规 CSS/模板工作，无技术障碍。

---

## 二、收益评估

### 2.1 高收益 · 低风险（建议优先做）

| 任务 | 收益 | 理由 |
|------|------|------|
| P0-1 Hero 去资源冗余 | ⭐⭐⭐ | 同屏信息去重，零风险 |
| P0-2 SideNav 去重 | ⭐⭐⭐ | 转生次数全局唯一，零风险 |
| P0-3/4 明度/辅色调整 | ⭐⭐⭐ | 改 6 个变量值即提升全局层次感，投入极小 |
| P0-7 核心数值放大 | ⭐⭐⭐ | 一行 font-size 改动，视觉焦点立即突出 |
| P1-1 Hero 重构 | ⭐⭐⭐ | 首屏冲击力质变，改动可控 |
| P1-3 双列布局 | ⭐⭐⭐ | 桌面端空间利用率从 ~50% → ~85%，用户感知最强 |

### 2.2 高收益 · 中等风险（值得做，需测试）

| 任务 | 收益 | 风险 | 理由 |
|------|------|------|------|
| P0-5/6 间距/字号 Token | ⭐⭐⭐ | 中 | 一次性根治字号失控问题，但 139+168 处硬编码替换工作量不小，且漏替换会导致不一致 |
| P1-2 行动队列合并 | ⭐⭐ | 中 | 消除信息冗余 + 简化交互路径，但跳转逻辑需逐条验证 |
| P1-5 按钮系统 | ⭐⭐ | 低-中 | 统一视觉规范，7+ 种 ad-hoc 按钮收敛为 4 类，但迁移面广 |
| P2-3 核心环映射 | ⭐⭐ | 低 | 装饰即信息，沉浸感提升明显，但逻辑需调试 |

### 2.3 中收益 · 低风险（有空就做）

| 任务 | 收益 | 理由 |
|------|------|------|
| P0-8 图标尺寸 Token | ⭐ | 收敛 5→4 种，一致性提升但用户感知弱 |
| P1-7/8 section 背景/标题分级 | ⭐ | 层次感微调，锦上添花 |
| P2-2 星点闪烁 | ⭐ | 氛围微调，不改变核心体验 |
| P2-10 TopBar pill 优化 | ⭐ | 窄屏体验微调 |

### 2.4 收益有限或需重新评估

| 任务 | 理由 |
|------|------|
| P2-5 资源 count-up | 每秒 tick + 5 资源同时动画，性能开销 vs 视觉收益比不高。建议降级为「值变化时短暂高亮」而非完整 count-up |
| P2-9 视觉动线引导 | 向下渐隐光柱在桌面端双列布局后视觉动线已改变，需在 P1-3 落地后重新评估是否还需要 |
| P3-6 资源粒子动画 | 与 count-up 类似的性能问题，且粒子动画在低端设备可能卡顿 |

### 2.5 投入产出比总览

```
高收益 ────────────────────────────────────────
  │  P0-1/2/3/4/7  P1-1/3
  │  ← 低风险，建议立即推进
  │
  │  P0-5/6  P1-2/5
  │  ← 中风险，值得做但需测试
  │
  │  P2-1/3/4
  │  ← 氛围升级，P2 阶段推进
  │
低收益 ────────────────────────────────────────
  │  P2-5/9  P3-x
  │  ← 收益有限或需重新评估
  │
  └───────────────────────────────────────────
     低风险                          高风险
```

---

## 三、风险识别

### R1. CSS 变量全局生效（高风险）

**涉及任务**：P0-3/4/5/6

`style.css` 中 `:root` 的 CSS 变量被所有页面共用。改 `--color-surface` / `--color-elevated` / `--color-border-line` 会影响 BuildView、TechView、MapView、ArmyView、RelicView、PrestigeView、BattleView 全部 7 个 View + 4 个布局组件。

**缓解措施**：
1. 改动后在所有 7 个 View + 桌面/移动两个断点截图对比
2. 分批迁移：先改 HomeView 验证视觉，再全量推送
3. 当前项目无视觉回归测试（只有 Vitest 单元测试 67 个，全测逻辑不测 UI），建议至少手动截图回归

### R2. 行动队列合并的跳转路径丢失（中风险）

**涉及任务**：P1-2

`activeEvents` 有 4 种跳转路径（`/build` `/tech` `/map` `/army`），`suggestions` 有 4 种跳转路径（相同）。合并后如果数据结构设计不当，可能丢失某些跳转。

**缓解措施**：
1. 合并前梳理完整跳转路径清单（当前共 8 种事件类型 → 4 种路径）
2. 合并后逐条点击验证
3. 回归测试 Build/Tech/Explore/Army 四个路由的入口可达性

### R3. AppShell `.content` max-width 改动影响全局（中风险）

**涉及任务**：P1-3

方案描述「内容区 max-width 720→1040px」如果改在 `AppShell.vue`，会影响所有页面。

**缓解措施**：
- **建议在 HomeView scoped 样式内覆盖**，不动 AppShell 的全局约束
- 具体写法：`.home { max-width: 1040px; margin: 0 auto; }` 覆盖父级 `.content` 的 `max-width: 720px`

### R4. Token 迁移遗漏导致不一致（中风险）

**涉及任务**：P0-5/6/8

全项目约 139 处 `font-size` + 168 处 `gap/padding/margin` 硬编码值，分布在 17-18 个文件。手动替换容易遗漏。

**缓解措施**：
1. 迁移后用 `rg "font-size:\s*\d+px"` / `rg "gap:\s*\d+px"` 等全局搜索确认零残留
2. 引入 Stylelint + `declaration-property-value-allowed-list` 规则禁止硬编码（当前项目只有 ESLint + Prettier，无 Stylelint）
3. 分文件迁移，迁一个验一个

### R5. 性能风险：多动画叠加（中风险）

**涉及任务**：P2-1/2/3/4/5

P2 阶段引入星云层、星点闪烁、核心环映射、交互反馈、count-up 共 5 类动画同时运行。在低端移动设备上可能掉帧。

**缓解措施**：
1. 所有动画遵守 `prefers-reduced-motion` 降级（已有全局规则）
2. 动画属性优先用 `transform` / `opacity`（GPU 加速），避免 `top/left/width/height`
3. 建议设立性能预算：低端设备（如 iPhone SE2）首屏 LCP < 2s，动画 FPS ≥ 45
4. count-up 动画建议降级或限频（见 2.4 节）

### R6. SideNav 折叠状态与 useBreakpoint 的交互（低风险）

**涉及任务**：P2-8

当前 SideNav 通过 `AppShell` 的 `v-if="isDesktop"` 控制 mount/unmount。折叠状态（`collapsed`）存在 localStorage，但移动端 SideNav 不 mount，读取时机需注意。

**缓解措施**：
- 在 SideNav 的 `onMounted` 中读取 localStorage，此时一定是桌面端（移动端不 mount）
- 切换断点（窗口缩放）时 SideNav 会 unmount → remount，折叠状态自动从 localStorage 恢复

### R7. 存档兼容性（无风险）

**涉及任务**：全部

UI 改动不涉及存档数据结构。`save-migrate.ts` 当前 `SAVE_VERSION = 5`，UI 优化无需升版本号。`storage.ts` 的 `SaveData` 接口不涉及任何 UI 相关字段。

**结论**：存档兼容性零风险。

### R8. 现有测试覆盖不足（中风险）

当前 67 个 Vitest 测试全部针对 stores/lib 逻辑层，**没有任何组件渲染测试**（`HomeView.test.ts` 不存在）。UI 重构后逻辑层测试不会报错，但视觉/交互回归完全依赖人工。

**缓解措施**：
1. P1-2 合并行动队列后，建议补充 `HomeView.test.ts` 验证跳转路径完整性
2. 关键交互（Hero 点击跳转、行动队列点击）考虑用 `@vue/test-utils` 补充组件测试

---

## 四、补充建议

### S1. 设计 Token 的落地方式需明确

方案提到「设计出 Token 映射表」，但未明确 Token 的最终交付格式。建议明确：

- **CSS 变量**（推荐）：直接在 `style.css` `:root` 定义，零运行时开销，符合项目现有模式
- TS 常量：不推荐，CSS 变量已足够
- JSON 设计文件 + 脚本生成 CSS：对当前项目规模过度设计

**建议**：设计交付一张 Markdown 表格（现状值 → Token 名 → 新值），前端直接写入 `style.css` 即可。

### S2. 组件抽象边界

方案提到按钮系统（P1-5）但未明确抽象边界。建议：

- **短期**：纯 CSS class（`.btn-primary` 等），各 View 迁移 class 名
- **长期**（P3 之后）：如果按钮变体增多（size、icon-only、loading 态），再抽取 `<AppButton>` 组件

同理，行动队列（P1-2）合并后是否抽取 `<ActionQueue>` 组件？建议：
- **短期**：在 HomeView 内部合并为一个 `<section>`，不抽组件
- **长期**：如果其他页面也需要行动队列，再抽组件

### S3. 可访问性（a11y）

方案中未提及 a11y。项目当前已有基础（`aria-label`、`aria-hidden`、`focus-visible`、`prefers-reduced-motion`），建议补充：

1. **Hero 点击核心跳转**：需加 `role="button"` + `tabindex="0"` + 键盘 `Enter/Space` 处理（当前是 `<div>` 不是 `<button>`）
2. **行动队列合并后**：`<button>` 已自带 a11y，保持用 `<button>` 而非 `<div @click>`
3. **SideNav 折叠**：折叠状态需 `aria-expanded` 标记
4. **count-up 动画**：数字变化对屏幕阅读器应读最终值，`aria-live="off"` 避免每秒朗读
5. **颜色对比度**：P0-3 明度调整后需重新验证 WCAG AA 对比度（当前 `--color-t-tertiary` 注释已标注 4.5:1）

### S4. 性能预算

方案未提及性能预算。建议在 P2 阶段开始前设立：

| 指标 | 目标 | 理由 |
|------|------|------|
| 首屏 LCP | < 2s（桌面）/ < 2.5s（移动） | Core Web Vitals 良好 |
| 动画 FPS | ≥ 45fps（低端设备） | 流畅体验下限 |
| 首屏 JS bundle | < 当前基线 + 5KB | UI 改动不应增重 |
| CSS 体积 | < 当前基线 + 3KB | Token + 动画新增样式 |

当前 `dist/assets/index-*.css` 和 `HomeView-*.css` 可作为基线对比。

### S5. 渐进式灰度策略

方案未提及灰度。考虑到这是单机游戏（非 SaaS），传统灰度不适用。但建议：

1. **分阶段部署**：每个 P 阶段完成后部署一次，不混合多阶段改动
2. **版本号递增**：P0 完成发 v0.40，P1 完成发 v0.41，便于问题定位
3. **update.log 记录**：每阶段部署后在 `update.log` 记录改动摘要，便于回溯

### S6. 回滚预案

方案未提及回滚。建议：

1. 每阶段开始前确保 git 有干净 tag（如 `v0.39-pre-ui`）
2. 每阶段完成发版前打 tag（如 `v0.40-p0`）
3. 如发现问题，`git checkout` 到上一 tag + `npm run build` + 重新部署即可
4. **注意**：项目当前不是 git 仓库（前端同学在 /tmp/bak028 找文件说明无 git 历史），建议在 P0 开始前先 `git init` + 首次 commit，建立版本基线

### S7. P0 与 P1 之间的过渡态

方案中 P0-1 删除 Hero 环绕资源后，P1-1 才重构 Hero 核心区。两个任务之间有一个「Hero 只有能量中心 + 产出率，但尺寸还是 160px」的过渡态。

**建议**：P0-1 和 P0-7（核心数值放大）一起做，过渡态不会显得空。或者 P0-1 等 P1-1 一起做，避免中间态。但 P0-1 是零风险，单独做也无妨——只是视觉上 Hero 会暂时显得「空一些」，不影响功能。

### S8. Stylelint 引入建议

当前项目有 ESLint（代码规范）+ Prettier（格式化），但无 Stylelint（CSS 规范）。Token 化后如果想防止硬编码回潮，建议引入：

```json
// .stylelintrc.json 示例
{
  "rules": {
    "declaration-property-value-allowed-list": {
      "font-size": ["var(--text-*)", "inherit", "1em", "100%"],
      "gap": ["var(--space-*)", "0", "normal"]
    }
  }
}
```

这是可选项，P0 阶段可暂不引入，P1 之后再考虑。

### S9. 补充一个方案遗漏的技术细节

P2-2 星点闪烁动画：当前 `body::before` 的 6 个星点是用 `radial-gradient` 画的，无法直接对单个星点做 `opacity` 动画（它们不是独立 DOM 元素）。实现闪烁有两种路径：

- **方案 A**：`@property --opacity` 注册自定义属性 + `background` 引用该变量。Safari 16.4+ 支持，兼容性需确认
- **方案 B**：改为 6 个绝对定位的 `<div>` 星点元素 + 各自 `@keyframes twinkle`。DOM 多 6 个节点但兼容性好

**建议方案 B**，兼容性优先。

---

## 五、总体结论

### 5.1 是否建议按方案推进

**✅ 建议按方案推进，无阻塞性技术问题。**

方案在当前 Vue3 + TS + Pinia 架构下完全可落地，无需引入新运行时依赖，不涉及存档兼容性问题，不触碰游戏逻辑层。32 个任务的技术手段均为 CSS 变量 / 模板重构 / 少量 composable，成熟可靠。

### 5.2 推进前需确认的前置事项

| 序号 | 事项 | 紧迫度 |
|------|------|--------|
| 1 | **P0 开始前 `git init` + 首次 commit**，建立版本基线（当前项目非 git 仓库） | 🔴 必须做 |
| 2 | P0-3/4 CSS 变量改动后全页面截图回归（7 个 View × 2 断点 = 14 张截图） | 🟡 强烈建议 |
| 3 | P1-2 合并行动队列前，梳理 8 种事件 → 4 种路径的映射清单 | 🟡 强烈建议 |
| 4 | P1-3 双列布局在 HomeView scoped 样式内覆盖 max-width，不动 AppShell | 🟡 强烈建议 |
| 5 | P2-5 count-up 动画降级为「值变化时短暂高亮」 | 🟢 建议考虑 |
| 6 | P2 阶段开始前设立性能预算（见 S4） | 🟢 建议考虑 |

### 5.3 风险矩阵总结

| 风险等级 | 风险项 | 缓解措施充分性 |
|---------|--------|--------------|
| 🔴 高 | R1 CSS 变量全局生效 | 方案已提到分批迁移 + 截图对比，✅ 充分 |
| 🟡 中 | R2 跳转路径丢失 | 方案已提到逐条验证，✅ 充分 |
| 🟡 中 | R3 AppShell max-width 全局影响 | **方案未提及**，本复查补充（建议 S3），⚠️ 需注意 |
| 🟡 中 | R4 Token 迁移遗漏 | 方案已提到全局搜索 + Stylelint，✅ 充分 |
| 🟡 中 | R5 多动画性能 | 方案已提到 prefers-reduced-motion + 时长控制，✅ 基本充分 |
| 🟡 中 | R8 测试覆盖不足 | **方案未提及**，本复查补充（S3 + R8），⚠️ 需注意 |
| 🟢 低 | R6 SideNav 折叠状态 | 方案已提到 localStorage，✅ 充分 |
| ✅ 无 | R7 存档兼容 | 不涉及，零风险 |

### 5.4 一句话总结

> 方案技术可行、分阶段合理、风险已基本识别且缓解措施到位。**唯一阻塞项是项目当前非 git 仓库**，建议 P0 开始前先 `git init` 建立版本基线。其余补充建议（AppShell 不动、count-up 降级、a11y 补充、性能预算）为优化项，不阻塞推进。

---

> **复查状态**：已完成，未修改原方案文件，未改动任何源码。
