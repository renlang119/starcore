# StarCore v0.41 代码评审 — 前端 UI 层复查报告

> **⚠️ 历史时点文档（v0.52 标注）**：本文描述的是 v0.41 时点的代码状态。
> 文中 11 项「确认成立」问题中 9 项已在 v0.42/v0.43 修复，引用的行号已全部漂移，
> 仅作历史脉络保留，**不可作为当前代码的问题清单**。仍与当前一致的结论：
> h1-h6 reset、!important 双防御、导航纯数据、无 i18n、prettier 配置并存。

> 复查人：开发侧
> 复查时间：2026-07-16
> 复查范围：共 16 项
> 复查方法：对照报告原文描述 → 读实际源码逐行验证

---

## 复查统计

| 状态 | 数量 |
|------|------|
| ✅ 确认成立 | 11 |
| ⚠️ 部分成立 / 描述偏差 | 4 |
| ❌ 不成立 | 1 |
| **合计** | **16** |

---

## 逐条复查

### ✅ 确认成立 | TopBar.vue resourceList computed 内突变 reactive

**源码证据**（`src/components/layout/TopBar.vue` L15-37）：

```js
const flashState = reactive<Record<string, boolean>>({})
const prevAmounts = reactive<Record<string, string>>({})

const resourceList = computed(() => {
  // ...
  if (prevAmounts[id] !== undefined && prevAmounts[id] !== amountStr) {
    flashState[id] = true                                    // ← 突变 reactive
    setTimeout(() => { flashState[id] = false }, 300)        // ← 异步突变 reactive
  }
  prevAmounts[id] = amountStr                                // ← 突变 reactive（无条件）
  items.push({ ..., flash: !!flashState[id] })               // ← 同 computed 内读取
})
```

**结论**：computed 内对 `flashState`、`prevAmounts` 两个 reactive 对象既读又写，属于 Vue 反模式。`flashState[id] = true` 会立即将自身标记为 dirty 触发再次求值；`prevAmounts[id] = amountStr` 在每次 tick 无条件写入。虽然 Vue 3 的 `hasChanged` 检查会 dedup 同值写入避免无限循环，但每次资源 tick 仍会引发 2 次额外重算（一次同步、一次 300ms 后），且 `setTimeout` 在 computed 内副作用不易测试。建议改为 `watchEffect` + 普通变量。

---

### ✅ 确认成立 | CSS `-var(--x)` 语法无效（三处全部确认）

**1. `src/style.css` L291-295：**
```css
.page-sub {
  font-size: var(--text-xs);
  color: var(--color-t-secondary);
  margin-top: -var(--space-3);   /* ← 无效语法 */
}
```

**2. `src/views/TechView.vue` L127：**
```css
.page-sub { margin-top: -var(--space-2); }   /* ← 无效语法 */
```

**3. `src/components/ui/UpgradeCountdown.vue` L437-442：**
```css
.detail-row.bottleneck {
  background: rgba(255,182,39,.06);
  margin: 0 -var(--space-2);   /* ← 无效语法 */
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  border-bottom: none;
}
```

**结论**：三处 `-var(--x)` 写法均确认存在，CSS 解析器会静默丢弃这些声明，负 margin 不生效。正确写法应为 `calc(-1 * var(--space-x))`。

---

### ✅ 确认成立 | BuildView.vue `lock_msg` vs `.lock-msg` 命名不一致

**模板**（`src/views/BuildView.vue` L91）：
```html
<span class="lock_msg">需要科技：{{ getTech(b.requires ?? '')?.name ?? b.requires }}</span>
```

**CSS**（同文件 L166）：
```css
.lock-msg { font-size: var(--text-xs); color: var(--color-locked); }  /* P2-7 */
```

**结论**：模板用下划线 `lock_msg`，scoped CSS 用连字符 `lock-msg`，样式不生效。锁定提示文字会回退到默认样式（无 `--color-locked` 灰蓝色、无 `--text-xs` 字号）。

---

### ⚠️ 部分成立 | BattleView.vue `!` 非空断言 — 类型问题真实，但"抛 TypeError"夸大

**源码**（`src/views/BattleView.vue` L15-16）：
```js
const strongholdId = computed(() => route.params.id as string)
const stronghold = computed(() => getStronghold(strongholdId.value)!)
```

**模板防护**（L134）：
```html
<div v-if="stronghold" class="battle-view">
```

**script 中对 `stronghold.value` 的访问**：
- L75-80 `startBattle()`：传入 `stronghold.value` — 仅由模板内 `v-if="stronghold"` 守护的按钮触发
- L30-42 `garrisonPreview`：用的是 `strongholdId.value`（字符串），**不访问 `stronghold.value`**
- L27 `isGarrisoned`：同样用 `strongholdId.value`

**结论**：
- `!` 非空断言是真实的类型谎言 — `getStronghold` 返回 `StrongholdDef | undefined`，`!` 将其窄化为 `StrongholdDef`，属于类型安全问题。
- **但报告称"无效路由参数会抛 TypeError"被夸大**：模板外层 `v-if="stronghold"` 守护了所有对 `stronghold.xxx` 的属性访问；script 中唯一访问 `stronghold.value` 属性的 `startBattle()` 也只从 v-if 守护的按钮调用。无效路由下 `stronghold.value` 为 `undefined`，v-if 为 false，整个战斗视图不渲染，不会抛 TypeError。
- 风险仅在未来有人在 script 中不经判空直接访问 `stronghold.value.xxx` 时暴露。

---

### ✅ 确认成立 | RelicView.vue 槽位满时 `findIndex` 返回 -1，点击静默失败

**模板**（`src/views/RelicView.vue` L89）：
```html
@click="equip(r, equipped.findIndex(s => s === null))"
```

**RelicView 的 equip 包装**（L14-20）：
```js
function equip(relic: OwnedRelic, slot: number) {
  if (equipped.value[slot] === relic.instanceId) {
    game.relics.unequip(slot)
  } else {
    game.relics.equip(relic.instanceId, slot)
  }
}
```

**store 层防护**（`src/stores/relics.ts` L42-43）：
```js
function equip(instanceId: string, slot: number): boolean {
  if (slot < 0 || slot >= maxSlots.value) return false   // ← -1 被拦截
```

**结论**：槽位全满时 `findIndex(s => s === null)` 返回 -1，`equipped.value[-1]` 为 `undefined`（不等于任何 instanceId），走 `game.relics.equip(relic.instanceId, -1)` 分支，store 层 `slot < 0` 判空后 `return false`。不会抛异常，但 **用户点击遗物卡片无任何反馈**——既不装备也不提示"槽位已满"。属于 UX Bug。

---

### ✅ 确认成立 | ModalOverlay.vue `<script setup>` 与 `<script>` 混用

**源码**（`src/components/ui/ModalOverlay.vue`）：

L2-26 `<script setup lang="ts">`：
```js
import { useFocusTrap } from '@/composables/useFocusTrap'
// ... 使用了 ref、computed 但未在本块导入
const modalRef = ref<HTMLElement | null>(null)
const trapActive = computed(() => props.modelValue)
```

L45-47 独立 `<script lang="ts">`：
```js
import { ref, computed } from 'vue'
```

**结论**：`ref` / `computed` 在 `<script setup>` 中使用却在普通 `<script>` 中导入，依赖 Vue SFC 编译器将 `<script>` 块的导入提升到 `<script setup>` 作用域。功能可工作但属于非标准写法，令代码阅读困惑。应合并为单一 `<script setup>` 块并将 `import { ref, computed } from 'vue'` 移入。

---

### ✅ 确认成立 | SideNav.vue 缺 `aria-current="page"`

**源码**（`src/components/layout/SideNav.vue` L36-46）：
```html
<button
  v-for="n in navItems"
  :key="n.id"
  class="nav-item"
  :class="{ active: activeId === n.id }"
  :title="collapsed ? n.label : undefined"
  @click="nav(n.path)"
>
```

仅有视觉 `.active` class，无 `aria-current="page"` 属性。屏幕阅读器无法识别当前页。

**补充**：`src/components/layout/BottomNav.vue` L62-71 同样缺失 `aria-current`，报告只提到 SideNav，BottomNav 也有同样问题。

---

### ✅ 确认成立 | OfflineReport.vue 多处 `as Record<string, ...>` 断言

**源码**（`src/components/layout/OfflineReport.vue`）：

L17（`gainsList` computed）：
```js
const metaMap = res.allMeta as Record<string, { name: string; color: string }>
```

L26（`garrisonList` computed）：
```js
const metaMap = res.allMeta as Record<string, { name: string; color: string }>
```

**补充**：`src/views/BattleView.vue` L33、L60 也有完全相同的断言模式。报告只提了 OfflineReport，实际 BattleView 也存在。根因是 `resources.allMeta` 的类型定义不够精确，迫使每个使用方都做断言。应在 `resources` store 层修正 `allMeta` 的类型。

---

### ✅ 确认成立 | 多处 `as any`（TopBar / HomeView / OfflineReport 等）

**grep 结果（仅生产代码，排除 .test.ts）**：

| 文件 | 行号 | 代码 |
|------|------|------|
| `TopBar.vue` | L18 | `fmt(res.getAmount(id as any))` |
| `TopBar.vue` | L32 | `fmtRate(res.getRate(id as any))` |
| `TopBar.vue` | L43 | `res.getRate(id as any).gt(0)` |
| `OfflineReport.vue` | L19 | `fmt(v as any)` |
| `OfflineReport.vue` | L28 | `fmt(v as any)` |
| `BattleView.vue` | L69 | `getUnit(k as any)?.name` |
| `BattleView.vue` | L94 | `game.resources.gain(k as any, v as number)` |
| `relics.ts` | L123 | `const legacy = r as any` |

**注意**：报告提到 "HomeView"，但 HomeView.vue 中实际**没有** `as any`（grep 未命中）。报告中"TopBar/HomeView/OfflineReport 等"的列举中 HomeView 不准确，应改为 "TopBar/BattleView/OfflineReport/relics"。

---

### ⚠️ 部分成立 | navigation.ts 可改 JSON 配置

**源码**（`src/data/navigation.ts` L14-22）：
```ts
export const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: '主界面', icon: 'i-nav-home', path: '/', tier: 'primary' },
  // ... 7 条纯数据
]
```

**结论**：数据本身确实是纯数据（无函数、无计算），技术上可改为 `.json`。但：
- 当前 TS 文件提供了 `NavItem` 接口类型安全，消费方 `SideNav.vue` / `BottomNav.vue` 能获得 IDE 类型提示和编译期检查
- JSON 不支持注释、不支持 TypeScript 类型
- 改为 JSON 后失去类型约束，消费方需要手动断言类型

属于风格偏好，非缺陷。建议保留 TS。

---

### ✅ 确认成立 | 各 View 硬编码中文字符串无 i18n

**证据**（抽样）：
- `TechView.vue` L44: `"科技树"`、L45: `"研究新技术解锁建筑、兵种和系统"`、L59: `"全部"`、L118: `"研究"`
- `BuildView.vue` L38: `"建造"`、L94: `"已满级"`、L91: `"需要科技："`
- `RelicView.vue` L53: `"遗物"`、L54: `"装备遗物获得永久增益"`、L64: `"空槽位"`
- `HomeView.vue` L319: `"星核能量"`、L329: `"行动队列"`、L398: `"文明概况"`
- `BattleView.vue` L136: `"返回星图"`、L150: `"敌方部署"`、L166: `"选择编队"`、L191: `"出征"`

全项目无 `vue-i18n` 或任何国际化库引入。所有 UI 文案硬编码。若游戏定位为中文-only，可接受；若有出海计划，建议提前抽字符串表。

---

### ✅ 确认成立 | style.css `h1-h6` 重置标题语义

**源码**（`src/style.css` L131）：
```css
h1, h2, h3, h4, h5, h6 { font-size: inherit; font-weight: inherit; }
```

**结论**：确认存在。所有标题元素的 `font-size` 和 `font-weight` 被重置为 `inherit`，视觉上失去层级语义。这是 Tailwind preflight 风格的设计选择（项目注释 L1 说明"Tailwind 已移除"，但 reset 保留了），本身不是 bug，但要求每个 `<h1>`-`<h6>` 都显式设置字号字重。报告中"重置标题语义"的描述准确。

---

### ✅ 确认成立 | AppShell.vue 星空用 6 个静态 `<span>` 硬编码

**源码**（`src/components/layout/AppShell.vue` L35-42）：
```html
<div class="star-field" aria-hidden="true">
  <span class="star s1"></span>
  <span class="star s2"></span>
  <span class="star s3"></span>
  <span class="star s4"></span>
  <span class="star s5"></span>
  <span class="star s6"></span>
</div>
```

对应 CSS（`src/style.css` L184-189）为每个 `.s1`-`.s6` 单独定义 top/left/background/animation。

**结论**：确认 6 个硬编码 `<span>`。可改为 `v-for="i in 6"` + 配置数组生成，或用 CSS 伪元素 + box-shadow 技巧生成多个星点。属可维护性改进，非功能 bug。

---

### ⚠️ 部分成立 | SideNav `!important` 与 `v-if` 双重防御冗余

**JS 层**（`AppShell.vue`）：
```html
<SideNav v-if="isDesktop" />        <!-- L45 -->
<BottomNav v-if="!isDesktop" />     <!-- L58 -->
```

**CSS 层**（`style.css` L447-452）：
```css
@media (max-width: 767px) {
  .side-nav { display: none !important; }
}
@media (min-width: 768px) {
  .bottom-nav { display: none !important; }
}
```

**style.css L443-446 注释**：
```
/* 导航栏响应式安全网 (defense-in-depth)
   组件已通过 Tailwind 响应式类（hidden md:flex / flex md:hidden）
   从 CSS 层面控制 display 属性。此处 !important 作为最终兜底 */
```

**结论**：
- `!important` 规则确实与 `v-if` 条件渲染功能重复——`v-if` 为 false 时组件根本不渲染，CSS 规则无作用对象。
- 注释中提到的"Tailwind 响应式类"已过时（L1 明确写"Tailwind 已移除"），注释应更新。
- 但该冗余是**有意识的防御性设计**（注释明确写了 "defense-in-depth"），且对纯客户端 SPA 而言 `v-if` 足够可靠。是否移除属风格偏好。建议至少更新过时注释。

---

### ❌ 不成立 | `.prettierrc.json` 与 `.prettierignore` 可合并

**`.prettierrc.json`**（9 行）：
```json
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "es5",
  "printWidth": 100,
  "tabWidth": 2,
  "vueIndentScriptAndStyle": false,
  "endOfLine": "lf"
}
```

**`.prettierignore`**（6 行）：
```
dist
node_modules
verify-screenshots
*.png
pnpm-lock.yaml
package-lock.json
```

**结论**：**不成立**。Prettier 的配置文件（`.prettierrc.*`）和忽略文件（`.prettierignore`）是两种不同用途的文件——前者定义格式化规则，后者定义哪些文件不被格式化。Prettier **不支持**在配置文件中内联 ignore 模式（无 `ignore` 字段）。两个文件必须分开存在。强行合并只能把 `.prettierrc.json` 挪到 `package.json` 的 `prettier` 字段下，但 `.prettierignore` 仍需独立存在，并未真正减少文件数。

---

### ⚠️ 部分成立 | index.html 缺 meta description / OG 标签

**源码**（`index.html` L7-8）：
```html
<meta name="description" content="星核纪元 — 科幻挂机放置网页游戏。采集星核能量，建造戴森球扇区，研究科技，训练部队，探索仙女座，揭开沉默者的真相。" />
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; ..." />
```

**结论**：
- **`meta description` 已存在**（L7），报告称"缺 meta description"与实际不符。
- **OG 标签确实缺失**——无 `og:title` / `og:description` / `og:image` / `og:url` 等。
- **Twitter Card 标签也缺失**。
- 另有 `theme-color`（L6）和 CSP（L8），整体 meta 已不算简陋。

报告描述部分错误：description 存在，仅 OG/Twitter 标签缺失。

---

## 重大偏差汇总

| 编号 | 偏差类型 | 说明 |
|------|---------|------|
| — | 描述夸大 | 报告称"无效路由参数会抛 TypeError"，实际模板 `v-if="stronghold"` 已守护所有属性访问，不会抛异常。`!` 类型谎言真实但运行时无风险。 |
| — | 列举不准 | 报告提到"HomeView"有 `as any`，实际 HomeView.vue 中无任何 `as any`。应为 TopBar/BattleView/OfflineReport/relics.ts。 |
| — | 事实错误 | 报告称"缺 meta description"，实际 `index.html` L7 已有完整的 description meta 标签。仅 OG/Twitter 标签缺失。 |
| — | 不可行 | 报告称两文件"可合并"，但 Prettier 不支持在配置文件中内联 ignore 模式，两文件必须分开。 |

---

## 复查结论

- **16 项中 11 项确认成立**
- **4 项部分成立/有偏差**（描述夸大, 风格偏好, 有意防御, description 已存在）
- **1 项不成立**（不可合并）
- **4 处报告与实际源码不符的重大偏差**（见上表）
- 建议优先修复 **CSS 语法错误**（浏览器静默忽略）、**样式不生效**、**UX 静默失败**，这三项对用户感知最直接。
