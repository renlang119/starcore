# 星核纪元 · 版本更新日志

> 项目：星核纪元（StarCore）— 科幻放置/挂机网页游戏
> 技术栈：Vue 3.5 + Vite 8 + Pinia 4 + TypeScript 6 + decimal.js 10 + localforage 1.10
> 版本号规则：以修复发版为粒度，初始 v0.01，每次 +0.01
> 当前版本：v0.50

---

## v0.50 — UI: 粒子随机生命周期

**变更性质：UI（粒子生命周期口径对齐设计规范）**
**开发时间：2026-09-05**

### 概述

资源产出粒子的生命周期原为固定 0.8s，与体验增强设计规范 §P3-6 的「0.8–1.2s
随机 + `--duration` 变量注入」设计不符。本版本按设计补齐。纯前端动效，无存
档/数据影响

### 变更明细

- 粒子生成时随机分配生命周期 800–1200ms（`useResourceParticles`）
- TopBar 模板经 `--duration` 内联变量注入，CSS 动画时长改为
  `var(--duration, 1s)`；移除定时器与动画时长保持同步

### 验证

- vitest run 11 文件 81/81 通过（新增粒子测试 3 例：时长区间 / 到期移除时
  序 / 无产出不生成）
- vue-tsc -b 零错误 + vite build 通过；lint:check / format:check 零输出
- Playwright 回归：双端八路由无错误、移动端无溢出

---

## v0.49 — UI: 行动队列口径统一

**变更性质：UI（行动队列口径对齐）**
**开发时间：2026-09-05**

### 概述

首页行动队列的实现与 行动队列方案文档「最终建议」存在三处偏离。经逐项评
估，按「实现小改 + 文档回写」统一口径：去掉信息重复的训练汇总卡，截断规则
改为不丢进度信息的形式，文档标注最终落地口径。纯 UI 展示逻辑调整，无存档结
构变化

### 变更明细

- 移除训练汇总卡：训练中已有逐条进度（如「训练 突击兵 ×10 — 45%」），「N
  支部队训练中· 查看进度」卡片信息重复，按 行动队列方案文档建议移除
- 截断规则调整：原「一律砍到 8 条」改为「进行中全保留（天然上限 7 = 4 探索 +
  3 训练槽），可执行补足至总数 ≤6」，进行中条目承载实时进度，截断会丢信
  息
- 可训练引导条件微调：仅无训练任务时显示「训练部队」入口
- 文档回写：行动队列方案文档 §5 顶部标注最终落地口径（无 category/count 字
  段、截断规则、一条建议项已移除），原始建议保留作历史脉络

### 验证

- vitest run 10 文件 78/78 通过（新增 HomeView 行动队列测试 5 例：兜底入口
  / 训练中无汇总卡 / 训练引导条件 / 截断 5+1 / 进行中 ≥6 时可执行归零）
- vue-tsc -b 零错误 + vite build 通过；lint:check / format:check 零输出
- Playwright 回归：行动队列专项 + 双端八路由无错误、移动端无溢出

---

## v0.48 — 功能: 训练并行槽位

**变更性质：功能（训练并行槽位）**
**开发时间：2026-09-05**

### 概述

训练队列原为无限制并行（所有任务同时倒计时，训练时间约束形同虚设）。本版本
为训练引入并行槽位限制：基础 1 槽，通过军事学新科技逐级扩展，上限 3 槽。已
在队列中的任务不受槽位限制影响（旧存档超槽任务照常跑完），仅限制新任务入
队。

### 变更明细

- 新增科技（军事学分支）：「集群操练 I」（tier 3，前置军事基础）与
  「集群操练 II」（tier 4，前置集群操练 I），效果各为训练并行槽 +1
- TechEffect 新增 `training_slot` 效果类型（非乘数累加型）；research store
  补充 `getValue()` 实现以接入统一效果系统的累加通道
- military store：新增 `maxTrainingSlots`（基础 1、封顶 3，上限由 game
  store 经效果系统聚合后注入，store 间不直接互引）；`startTraining` 在槽位
  已满时拒绝入队
- ArmyView：「训练中」标题显示槽位占用（如 1/2）；槽满时训练按钮禁用并给出
  扩展提示（指向下一级集群操练科技）
- 顺带修复：ArmyView「部队尚未组建」空状态原以分支渲染遮挡单位卡片，且其引
  导按钮无跳转/无事件处理（死按钮），导致新玩家解锁军事后无法训练首个兵
  种；现改为卡片之上的轻提示，训练入口始终可用
- 兼容性：
  - 存档结构无变化（槽位为科技派生计算值），无需迁移；旧存档中超槽任务继续
    完成
  - 科技白名单自动覆盖新科技 id（validateSaveData 以 TECHS 数组为准）

### 验证

- vitest run 9 文件 73/73 通过（新增 military store 槽位测试 6 例：满槽拒
  绝且不扣费 / 扩容 / 封顶 3 / 完成释放 / 旧档超槽兼容 / 科技数据契约）
- vue-tsc -b 零错误 + vite build 通过；lint:check / format:check 零输出
- Playwright 回归：preview + 线上双端八路由无 404/无 console error、移动端
  无溢出

---

## v0.47 — 工程化: 依赖升级与构建/测试工具链现代化

**变更性质：工程化（依赖升级与工具链现代化）**
**开发时间：2026-09-05**

### 概述

安全检查发现 dev 工具链 14 个已知漏洞（5 moderate + 9 high，均不进生产
bundle），通过跨大版本升级根除；顺带将全部依赖升至锁定大版本内最新稳定版。
升级后 pnpm audit 漏洞清零。

### 变更明细

- 跨大版本：
  - eslint 9 → 10.10.0（连带 @eslint/js 10）
  - vitest 3 → 5.0.0（连带 @vitest/coverage-v8 5）
  - jsdom 29 → 30.0.1（消除 undici 信息泄露/CRLF 注入链）
  - @vue/test-utils 2.4 → 2.5.0
  - pinia 3 → 4.0.3（新增 @vue/devtools-api 8 peer）
  - vue-router 4 → 6 内大版本 5.3.1
- 锁定大版本内更新：
  - vue 3.5.39 → 3.5.42、vite 8.1 → 8.2.2、vue-tsc 3.3.11、tailwindcss
    4.3.3、prettier 3.9.6、typescript-eslint 8.69.0、eslint-plugin-vue
    10.10.0、@types/node 24.x 最新
- 传递依赖加固（pnpm overrides）：
  - brace-expansion ≥5.0.9（DoS）、nanoid ≥3.3.18（死循环）、postcss
    ≥8.5.23（不完整修复）
- 评估后暂缓：
  - typescript 7：typescript-eslint 8.69 peer 上限 <6.1.0，生态未跟进，待
    其发版后升级
- 兼容性：
  - eslint 10 flat config 无需迁移，现有 eslint.config.js 直接兼容
  - vitest 5 配置格式无变化，8 文件 67 用例全部通过
  - pinia 4 API 向后兼容，9 个 store 无需改动
  - vue-router 5 路由定义与守卫 API 兼容，8 路由 + 测试 stub 均正常

### 验证

- pnpm audit 漏洞清零（14 → 0）
- vue-tsc -b 零错误 + vite build 通过（产物体积无实质变化）
- vitest run 8 文件 67/67 通过；lint:check / format:check 零输出
- Playwright 双端（preview + 线上）回归：八路由无 404/无 console error、移
  动端 375px 无溢出、五页空状态专项 24/24 通过

---

## v0.46 — 功能: 页面空状态补齐

**变更性质：功能（页面空状态补缺）**
**开发时间：2026-09-05**

### 概述

设计规范中承诺的七页空状态中四页未实现（Build/Tech/Map/Army），内容耗尽后
页面无引导，新玩家在对应场景下无路可走。本版按 体验增强设计规范 §3.2 规范
补齐。

### 变更明细

- 新增 `src/components/ui/EmptyState.vue` 通用空状态组件：图标 + 主文案 +
  提示文案 + 可选引导按钮（支持路由跳转），样式复用全局 `.empty-state` 体
  系，全部 Token 引用，符合 §3.2.1 视觉规范
- BuildView：当前扇区全部建筑满级时显示「暂无可建造的建筑」→ 引导前往科技
- TechView：当前筛选分支下全部科技完成时显示「所有已知科技已研究完成」→ 引
  导前往探索
- MapView：全部探索节点完成时显示「已知星域已全部探索完毕」→ 引导前往科技
- ArmyView：双空态，军事科技未解锁时「尚未组建部队」→ 引导前往科技；已解锁
  但无部队时「部队尚未组建」→ 引导训练（留在当前页）
- RelicView：原单行文字空态升级为标准 EmptyState（图标 + 文案 + 引导按钮 →
  探索）
- 与文档口径的差异：
  - 建筑数据当前未配置 `maxLevel` 字段，「全部满级」触发条件数据上暂不成
    立；逻辑已就位，数据配置 maxLevel 后自动生效
  - BuildView 锁定扇区保留锁定卡（预告信息价值 > 空态引导），不按文档
    「全部锁定」触发空态

### 验证

- `vue-tsc -b` 零错误 + `vite build` 通过 + `vitest run` 8 文件 67/67 通过 +
  `lint:check` 零输出
- Playwright 专项回归 24/24 通过：五页空态渲染、空态文案、引导按钮跳转、存
  档注入模拟（全科技完成 / 全节点完成 / 军事解锁无部队 / 锁定扇区）、八路
  由无 console error
- 移动端 375px 无横向溢出回归通过

---

## v0.45 — 工程化: eslint 修复、Prettier 统一与部署脚本重写

**变更性质：工程化（工具链基线补齐 + 部署脚本重写）**
**开发时间：2026-09-05**

### 概述

工程基线补齐：eslint 因缺失依赖无法运行、存量源文件未统一格式、部署脚本指
向失效主机、favicon 未声明四类问题一并修复，部署流程重写为「构建 → rsync
同步 → 线上验证」的本地方案。

### 变更明细

- eslint 因缺失依赖无法运行：`eslint.config.js` 引用 `globals` 包提供浏览
  器/ES 标准全局变量声明，但 `package.json` 未声明该依赖，`pnpm lint` 直接
  因模块解析失败（ERR_MODULE_NOT_FOUND）退出，lint 流程形同虚设。
  devDependencies 补充 `globals@17.12.0`。
- 52 个源文件格式不统一：项目配置了 Prettier 但从未对存量代码执行格式化，
  `pnpm format:check` 报 52 个文件格式不符（全部视图 + 大部分组件
  /store/lib/测试/样式）。对 `src/` 全量执行一次 `pnpm format`（纯格式重
  排，零语义变更）。
- 部署脚本指向失效主机，完全失效：`deploy.py` 目标主机与构建产物路径均为早
  已弃用的旧环境，当前环境执行必然失败。项目部署拓扑已变更为「单机构建 →
  单机 nginx 静态站点」。
  - 删除失效的 `deploy.py`（paramiko SSH 远程部署，含配套的
    `start-dev.sh`）及过时评估文档 `docs/deploy-ssh-keypair-evaluation.md`
  - 新增 `deploy.sh` 部署脚本：构建 → `rsync --delete` 同步 `dist/` 到
    nginx 站点目录 → 修正权限 → 线上验证（HTTP 状态 + bundle 版本串核对）
  - 同步方式从覆盖复制升级为 `rsync --delete`：站点内已从产物移除的旧文件
    会被清除（本次即清除了 v0.44 已删但站点残留的 `icons.svg`），并排除
    `.well-known/` 防误删证书续期目录
- favicon 未声明，控制台 404（发版回归发现）：`index.html` 未声明
  `<link rel="icon">`，浏览器回退请求 `/favicon.ico`。dev/preview 服务器无
  该文件返回 404 并产生控制台错误；线上 nginx SPA fallback 将其回退到
  index.html，返回 200 但内容并非图标（浏览器静默忽略）。`index.html` 补
  `<link rel="icon" type="image/svg+xml" href="/favicon.svg">`
  （`public/favicon.svg` 既有文件，og:image/twitter:image 已在引用）。

### 验证

- `pnpm lint:check` 正常运行，结果 0 errors / 23 warnings（均为存量告警：
  测试文件多组件声明、属性顺序等，不阻断，留待后续处理）。
- `pnpm format:check` 全部通过；`vue-tsc -b` 零错误；`vite build` 产物体积
  无实质变化；`vitest run` 8 文件 67/67 通过。
- `./deploy.sh` 全流程通过，线上返回 200 且 bundle 版本串为 v0.45；preview
  与线上 Playwright 回归（八路由遍历、控制台无 404/error、移动端 375px 无
  溢出）全部通过。

---

## v0.44 — 修复: 移动端横向滚动、产出率显示与死代码清理

**变更性质：修复（移动端横向滚动 + 显示修正 + 死代码清理）**
**开发时间：2026-09-05**

### 概述

移动端页面可横向滚动 55px 与 Hero 产出率后缀重复两处缺陷修复，并清理一批零
引用死代码与冗余资源文件。

### 变更明细

- 移动端页面可横向滚动 55px：HomeView hero 区 `.core-visual::after` 光晕
  （240px，绝对定位 `left:50%` + `translate(-50%,-50%)` 居中）。浏览器计算
  viewport 可滚动溢出区时按该伪元素 transform 前的布局位置（100px 起向右
  240px）计入，溢出约 55px。`body { overflow-x: hidden }` 无法拦截，body
  只禁自身滚动，溢出仍传播到 viewport 层级，实测 `window.scrollTo(150,0)`
  后 `scrollX=55`。
  - `src/style.css` html 元素加 `overflow-x: hidden; overflow-x: clip;`
    （clip 优先，不创建滚动容器、不影响 sticky/fixed；不支持 clip 的旧内核
    回退 hidden）
  - `src/components/layout/TopBar.vue` `.res-strip` 补 `min-width: 0`
    （flex 项默认 min-width:auto 不收缩，导致资源胶囊不能正确进入内部滚
    动）
- Hero 产出率显示「+0.5/s /s」后缀重复：`src/lib/format.ts` 的 `fmtRate()`
  返回值已含 `/s` 后缀，`src/views/HomeView.vue` 模板又拼接 ` /s`。移除模
  板中多余的 ` /s`。TopBar.vue 的 `fmtRate` 用法本身正确，未涉及。
- 死代码与冗余文件清理：
  - 删除 `public/icons.svg`（Vite 模板遗留的 6 个社交图标，全项目零引用；
    实际图标体系为 7 个 SFC 内联 symbol，85 个 id 契约完整）
  - 删除 `src/assets/hero.png`（零引用；hero 为 CSS 类名非图片）及空目录
    `src/assets/`
  - 删除 `src/style.css` 死 keyframes ×5：`pulseNode`/`ringPulse`/`blink`/
    `flashSuccess`/`shakeError`（全项目零引用），连带删除仅被骨架类使用的
    `shimmer` 与死类 `.skeleton`/`.skeleton-line`
  - `src/router/index.ts` 移除路由 `meta.title`/`meta.tab` 死字段（全项目
    无消费方）
  - `.gitignore` 删除重复的注释行

### 验证

- Playwright 四档视口（1280/375/360/320）`scrollX=0` 且
  `documentElement.scrollWidth === innerWidth`；截图确认光晕视觉完整未裁
  切；桌面端无回归。
- `vue-tsc -b` 零错误 + `vite build` 通过
- `vitest run`：8 文件 67/67 通过
- Playwright 回归：四档视口无横向滚动、Hero 产出率格式正确、八条路由无
  404、首屏渲染正常

---

## v0.01 — 功能: 初始项目搭建

**变更性质：功能（设计文档 + UI 原型 + 完整代码初始搭建）**

### 概述

完成项目从设计文档到可运行代码的初始搭建：编写 4 版游戏设定与架构文档、2
份 UI 原型，并基于 Vite 初始化脚手架，实现数据层、状态管理层、视图层与工具
库的完整骨架。

### 变更明细

- 设计文档：
  - 游戏设定与架构文档 V1.0：世界观设定（公元 2387 年殖民舰抵达仙女座戴森
    球）、五层宇宙观（星核层/恒星系层/星团层/星臂层/星系层/深空层）、核心
    主题「文明与熵的永恒博弈」、五层即时满足到永恒成长设计理念
  - 游戏设定与架构文档 V2.0：单机优先/多人预留修订版，明确当前阶段纯前端无
    后端
  - 游戏设定与架构文档 V3.0：新增造兵/部队系统、PVE 战斗系统、PVP 定位明
    确、移动端适配说明
  - 游戏设定与架构文档 V4.0：取消离线收益自然衰减机制，离线效率固定为 100%
  - 技术选型方案 V1：Vue 3 + TypeScript + Pinia + Tailwind CSS 4 +
    decimal.js + Vite + localforage + Vue Router 4，纯前端 + Nginx 静态托
    管，Ubuntu 22.04 部署方案
- UI 原型：`shared/ui-design/flow.html`（游戏流程原型）、
  `shared/ui-design/prototype.html`（UI 界面原型）
- 数据层（`src/data/`）：`buildings.ts`（能量/晶体/合金/数据/暗物质 5 类生
  产建筑，成本递增公式）、`tech.ts`（科技树定义，效果类型 production_mult
  / cost_mult / unlock / combat_mult / explore_mult / prestige_mult /
  offline_bonus）、`units.ts`（突击兵/护卫兵/重装兵/灵能兵 4 种，含训练时
  间、攻防属性、克制关系）、`relics.ts`（稀有度池、rollRelic 随机抽取、遗
  物效果）、`pve.ts`（多级据点，含防守兵力、克制配置）、`explore.ts`（4 个
  节点：轨道/内层/外层/深空，含奖励配置）
- 状态管理层（`src/stores/`）：`game.ts`（中央 store 门面模式，持有 8 个子
  store 引用，负责 tick 循环、存档/读档、离线收益计算、转生协调、全局乘数
  计算）、`resources.ts`（5 种资源：能量/晶体/合金/数据/暗物质，
  amounts/totals/rates）、`buildings.ts`（等级、成本计算、产出计算）、
  `research.ts`（完成列表、可用性判断、科技成本乘数）、`military.ts`（兵种
  拥有量、训练队列、编队系统）、`combat.ts`（PVE 战斗结算、克制判断、战斗
  日志）、`exploration.ts`（探索进度、奖励发放）、`relics.ts`（拥有/装备/
  遗物扩展槽位）、`transcend.ts`（负熵积累、转生树、奇点重启）
- 视图层（`src/views/`）：`HomeView.vue`（主界面：资源产出面板、建筑概
  览）、`BuildView.vue`、`TechView.vue`、`MapView.vue`、`ArmyView.vue`（兵
  营训练 + 编队管理）、`BattleView.vue`（PVE 据点战斗）、`RelicView.vue`、
  `PrestigeView.vue`（奇点重启页面）
- 布局组件（`src/components/layout/`）：`AppShell.vue`（应用外壳：导航切
  换、内容区域、extra-nav 浮动栏）、`SideNav.vue`（桌面端侧边导航 7 项：主
  界面/建造/科技树/探索/部队/遗物/奇点重启）、`BottomNav.vue`（移动端底部
  导航）、`TopBar.vue`（顶部状态栏，资源 pill 展示）、`OfflineReport.vue`
  （离线收益报告弹窗）
- UI 组件（`src/components/ui/`）：`Icons.vue`（SVG 图标集）
- 工具库（`src/lib/`）：`decimal.ts`（decimal.js 封装：D 构造器、ser/deser
  序列化、加减乘除运算）、`format.ts`（数值格式化
  fmt/fmtInt/fmtTime/fmtRate/pct）、`storage.ts`（存档系统：IndexedDB 主存
  储 + localStorage 备份，XOR 流密码混淆）
- 路由与入口：`main.ts`、`App.vue`、`router/index.ts`（Vue Router 配置）、
  `style.css`（全局样式：Tailwind CSS 4 + 科幻主题变量）、`version.ts`（版
  本信息）
- 配置文件：`package.json` / `tsconfig.json` / `tsconfig.node.json` /
  `vite.config.ts` / `index.html`

---

## v0.02 — 修复: 页面底色与移动端双导航栏修复

**变更性质：修复（CSS @layer 兼容性 + 双导航栏同时显示）**
**开发时间：2026-07-08**

### 概述

修复两个渲染问题：重启后页面底色变白（`@layer theme` 内的主题变量定义被忽
略）、移动端双导航栏同时显示（Vue scoped CSS 未分层，优先级高于 Tailwind
`@layer utilities`，响应式类完全失效）。

### 变更明细

- 问题 1：重启后页面底色变成白色。根因：CSS 使用 Tailwind CSS v4 的
  Cascade Layers（@layer）语法，所有主题变量定义在 `@layer theme` 内部，不
  支持 @layer 的浏览器或优先级冲突时 `:root` 变量定义被忽略，导致 body 背
  景色回退为默认白色。修复：在 `@layer` 块前添加独立的 `:root` 变量定义，
  body 样式添加 fallback 值，部署验证通过
- 问题 2：移动端双导航栏同时显示。根因：Vue 组件的 scoped CSS
  （`.side-nav { display: flex }`、`.bottom-nav { display: flex }`）是
  unlayered 的，优先级高于 Tailwind 工具类（`.hidden`、`.md:flex`、
  `.md:hidden`）所在的 `@layer utilities` 层，导致两个导航栏在所有屏幕尺寸
  下始终可见。修复：在 CSS 文件末尾追加 `@media` 媒体查询 + `!important`
  覆盖规则（`max-width:767px` 下 `display: none !important` 隐藏
  side-nav、显示 extra-nav；`min-width:768px` 隐藏 bottom-nav 和
  extra-nav、content 底部内边距 24px），同时写了 Vue scoped 属性选择器和通
  用选择器双保险；移动端内容区 `padding-bottom: 80px` 保证不被 64px 高底部
  导航遮挡
- 改动文件：服务器端 CSS 产物

### 验证

- Playwright 渲染验证：桌面端 1280x800 与移动端 375x812 均正常
- body 背景 rgb(5,7,13)，单导航显示，控制台无错误

---

## v0.03 — 修复: 导航显隐改为 v-if 结构控制

**变更性质：修复（导航显隐从 CSS 覆盖改为组件结构控制）**

### 概述

v0.02 的 CSS `!important` 覆盖方案虽有效但脆弱，依赖 CSS 优先级而非组件结
构；`useBreakpoint` composable 已编写但未使用，代码评审指出应改用 `v-if`
结构性控制。本次从组件结构层面用 `v-if` 控制导航显隐，替代纯 CSS class 方
案。

### 变更明细

- `src/composables/useBreakpoint.ts`（已有，本次开始实际引用）：基于
  `window.matchMedia('(min-width: 768px)')` 检测断点，导出 `isDesktop` ref
- `src/components/layout/AppShell.vue`：导入 `useBreakpoint` 并取
  `isDesktop`；`<SideNav v-if="isDesktop" />`（替代
  `class="hidden md:flex"`）；`<BottomNav v-if="!isDesktop" />`（替代
  `class="md:hidden"`）；
  `<div v-if="showBattleBack && !isDesktop" class="extra-nav flex">`

### 验证

- Playwright 桌面端 1280x800：SideNav 可见、BottomNav 不存在于 DOM
- Playwright 移动端 390x844：BottomNav 可见、SideNav 不存在于 DOM、内容占
  满宽度不被遮挡
- 保存 4 张截图

---

## v0.04 — 修复: 移动端底部导航补齐

**变更性质：修复（移动端导航缺失遗物/奇点重启入口）**

### 概述

移动端底部导航仅有 5 项（主界面/建造/科技/探索/部队），缺失「遗物」和
「奇点重启」两个入口；原 `AppShell.vue` 的 `extra-nav` 浮动栏仅在玩家已处
于 `/relic`、`/prestige`、`/battle/*` 路由时才显示，无法从其他页面直接进
入。本次采用「5 主标签 + 更多菜单」模式补齐。

### 变更明细

- `src/components/layout/BottomNav.vue`（重写）：新增 `secondaryTabs` 数组
  （遗物、奇点重启）；新增「更多」按钮，点击切换 `expanded` 状态；面板向上
  弹出（`aria-expanded` 无障碍属性）；路由变化后面板自动收起；点击面板外部
  （main.content 区域）面板收起；面板右对齐，在底部导航上方 8px
- `src/components/layout/AppShell.vue`（简化）：简化 `extra-nav` 逻辑（仅
  保留战斗返回按钮）
- `src/components/ui/Icons.vue`：新增 `i-more` 图标

### 验证

- 移动端 390x844：5 主标签 + 更多按钮等宽分布、面板展开/收起、路由跳转、
  active 高亮、点击外部收起均通过
- 桌面端 1280x800：侧边导航 7 项不受影响
- 保存 3 张截图

---

## v0.05 — 修复: 6 个高危问题修复

**变更性质：修复（6 个高危 Bug）**
**开发时间：2026-07-09**

### 概述

修复 6 个高危问题：PVE 战斗克制系统完全失效、转生节点「遗物扩展」不生效、
标签页后台进度丢失、rollRelic 可能返回 undefined、beforeunload 异步存档无
法完成、SaveData 全字段 any。

### 变更明细

- Bug 1：PVE 战斗克制系统完全失效。`combat.ts` 中克制判断使用
  `tgt.unitId.includes(...)`，但 `unitId` 是字符串不是数组，导致克制判断永
  远为 false，战斗克制系统完全无效。修复：`data/pve.ts` 修正据点防守兵种的
  `countered_by` 字段配置；`combat.ts` 修正克制判断逻辑为
  `tgt.counteredBy?.includes(...)`
- Bug 2：转生节点 t_slot「遗物扩展」不生效。转生树中的遗物扩展槽位节点解锁
  后，遗物装备槽位数量未增加。修复：`relics.ts` 修正槽位计算逻辑，从转生树
  读取 `relic_slot` 效果；`RelicView.vue` 修正槽位展示
- Bug 3：标签页后台时进度严重丢失。浏览器标签页切到后台时 `setInterval` 被
  节流，tick 频率大幅降低，游戏进度严重滞后。修复：`game.ts` 的 `tick()`
  增加 `dt > 60` 检测，检测到后台返回时调用 `computeOfflineGains(dt)` 补算
  离线收益，然后将 `dt` 重置为 1
- Bug 4：rollRelic 可能返回 undefined 导致崩溃。`data/relics.ts` 的
  `rollRelic` 在遗物池为空或概率边界条件下可能返回 `undefined`，调用方直接
  访问属性导致运行时崩溃。修复：增加空池守卫和兜底返回逻辑
- Bug 5：beforeunload 异步存档无法完成。`beforeunload` 事件中调用异步存档
  函数（localforage 基于 Promise），浏览器可能在 Promise resolve 前就关闭
  页面，导致存档未写入。修复：`storage.ts` 新增 `writeSaveSync()` 同步存档
  函数（使用 `localStorage.setItem` 作为同步备份）；`game.ts` 在
  `beforeunload` 中先调用同步存档再尝试异步存档；`App.vue` 注册
  `beforeunload` 事件监听
- Bug 6：any 类型泛滥，SaveData 全字段 any。`lib/storage.ts` 的 `SaveData`
  接口所有字段均为 `any` 类型，类型系统形同虚设，存档数据结构变更后无法在
  编译期发现问题。修复：为 `SaveData` 及所有子对象定义完整的 TypeScript 类
  型接口，全部 8 个子 store 的 hydrate 函数改为类型安全
- 涉及文件（共 14 个）：`src/data/pve.ts`（Bug 1）、`src/stores/combat.ts`
  （Bug 1、6）、`src/stores/relics.ts`（Bug 2、6）、
  `src/views/RelicView.vue`（Bug 2）、`src/stores/game.ts`（Bug 3、5、
  6）、`src/data/relics.ts`（Bug 4）、`src/lib/storage.ts`（Bug 5、6）、
  `src/App.vue`（Bug 5）、`src/stores/resources.ts`、
  `src/stores/buildings.ts`、`src/stores/research.ts`、
  `src/stores/military.ts`、`src/stores/exploration.ts`、
  `src/stores/transcend.ts`（Bug 6）

### 验证

- npm run build：通过，0 TS 编译错误，0 运行时报错
- 产物 217.58 KB（gzip 79.71 KB）

---

## v0.06 — 修复: 21 个中危问题修复

**变更性质：修复（21 个中危问题：17 完全修复 + 3 部分修复 + 1 设计意图）**
**开发时间：2026-07-09**

### 概述

修复 21 个中危问题，覆盖代码规范、逻辑隐患、安全、性能、架构五类；整体解决
率 18/21（85.7%）= 17 完全修复 + 1 确认为设计意图，其余 3 项部分修复与 4
项遗留转入后续瘦身处理。

### 变更明细

- 修复总览：代码规范 3/3；逻辑隐患 8 条（6 修复 + 1 部分修复 + 1 设计意
  图）；安全 2/2；性能 4/4；架构 4 条（2 修复 + 2 部分修复）
- 代码规范类（3 条，全部修复）：
  - 多处未使用的导入：清理 `src/stores/combat.ts`、
    `src/stores/military.ts`、`src/stores/exploration.ts`、
    `src/views/PrestigeView.vue`、`src/components/layout/AppShell.vue` 中
    的未使用导入（`D`、`ser`、`deser` 等），改为仅保留实际使用的
    `import type { Decimal }`
  - useBreakpoint 死代码：`AppShell.vue` 中通过 `v-if="isDesktop"` /
    `v-if="!isDesktop"` 控制导航显隐（与 v0.03 修复一致，本次确认并文档
    化）
  - 命名不一致：`src/stores/transcend.ts` 的 `TranscendEffect.type` 从
    `string` 改为字面量联合类型，与 `TechEffect`、`RelicEffect` 保持一致
- 逻辑隐患类（8 条）：
  - 存档无版本迁移机制：`src/stores/game.ts` 新增 `migrateSave` 函数并在
    `hydrateAll` 中调用，建立版本迁移链框架（当前版本 v1，预留 v1→v2 扩展
    点）
  - crystal 资源产出展示遗漏 + 探索奖励死字段：`src/views/HomeView.vue`
    stats 增加晶体产出展示；`src/data/explore.ts` 4 个探索节点 rewards 补
    充实际 crystal 奖励数据
  - 训练队列并行/串行行为不明确：`src/stores/military.ts` 的 applyTick 区
    域添加注释，文档化「队列内并行、单任务内串行」的设计意图
  - importSave 无数据完整性校验：`src/lib/storage.ts` 新增
    `validateSaveData` 函数，对存档各子对象（resources/buildings/research/
    military/combat/exploration/relics/transcend）的字段类型和结构做深度校
    验；`importSave` 调用校验，失败返回
    `{ ok: false, reason: 'corrupted' }`
  - 战斗 Math.random 不可复现：`src/stores/combat.ts` 引入种子化 PRNG
    （mulberry32），以编队组成 + 据点 id 为种子，同一编队打同一据点结果可
    复现，消除 SL 大法
  - canAfford + spendCost 非原子（部分修复）：`src/stores/game.ts` 封装原
    子操作 `tryUpgradeBuilding` 和 `tryResearch`；
    `src/views/BuildView.vue` 已改用 `game.tryUpgradeBuilding`，TechView
    和 ArmyView 保留旧模式（实际安全，JS 单线程 + spendCost 内含检查），标
    记为遗留项
  - 探索进度条与 tick 不同步：`src/stores/exploration.ts` 的
    `ExploreProgress` 新增 `endTime` 字段，`startExplore` 时基于当前
    exploreMult 锁定 endTime，之后 exploreMult 变化不影响本次探索；
    `applyTick` 和 `getProgress` 均使用锁定的 endTime，旧存档无 endTime 时
    回退到动态计算
  - 转生后 totals 重置影响负熵计算（设计意图，非 Bug）：确认转生后
    `resources.reset(true)` 重置 totals 是放置类游戏标准循环设计，
    `doTranscend` 添加设计意图注释文档化此决策
- 安全类（2 条，全部修复）：
  - importSave 缺少数据校验：同「importSave 无数据完整性校验」，通过
    `validateSaveData` 对导入存档做结构校验
  - localStorage 存档备份无防篡改：`src/lib/storage.ts` 的 `writeSave`/
    `writeSaveSync` 写入时添加 FNV-1a 校验和（格式
    `{ d: json, c: checksum }`），`_parseBackup` 读取时验证校验和，
    `_checksum` 实现 FNV-1a 哈希；兼容旧格式（无校验和的明文 JSON）
- 性能类（4 条，全部修复）：
  - 每 tick 全量重算所有乘数：`src/stores/game.ts` 将乘数计算改为
    `computed`（productionMults / atkMult / defMult / exploreMult /
    prestigeMult / offlineMult），仅在响应式依赖变化时重算；函数包装器保持
    外部调用接口不变
  - 每 tick 全量遍历建筑计算产出：`src/stores/game.ts` 新增
    `totalProduction` computed，依赖 `productionMults` 和
    `buildings.levels`，仅当建筑等级或乘数变化时重算，tick 中使用缓存值
  - 战斗日志无长度限制：`src/stores/combat.ts` 限制日志条数为 30 条（保留
    首条遭遇消息与末尾 29 条最近战斗情况）
  - fmt 函数每次创建 Decimal 实例：`src/lib/format.ts` 预计算 `D_POWERS`
    （1000 的幂次 Decimal 数组），并为 `number` 类型添加快速路径（< 1000
    直接处理，完全避免创建 Decimal 实例）
- 架构类（4 条）：
  - game.ts 上帝 store 职责过重（部分修复）：效果系统已提取为独立模块
    `src/lib/effect-system.ts`，乘数计算改为 computed，原子操作和迁移框架
    已封装；game.ts 仍约 400 行，视图仍通过 game 中转访问子 store，标记为
    遗留项（渐进式重构）
  - 效果系统重复实现：新增 `src/lib/effect-system.ts`（`EffectSystem` 类 +
    `EffectSource` 接口），`game.ts` 创建实例并注册
    research/relics/transcend 三个 source，全局乘数计算统一委托给
    EffectSystem
  - data/ 定义模式不统一：5 个数据文件的查找函数统一改为 Map 查找
    （O(1)），返回类型统一为 `T | undefined`（`src/data/buildings.ts` 的
    `BUILDING_MAP` + `getBuilding`、`src/data/tech.ts` 的 `TECH_MAP` +
    `getTech`、`src/data/units.ts` 的 `UNIT_MAP` + `getUnit`、
    `src/data/pve.ts` 的 `STRONGHOLD_MAP` + `getStronghold`、
    `src/data/explore.ts` 的 `NODE_MAP` + `getNode`）
  - 视图层重复 UI 模式（部分修复）：`src/components/ui/CostTag.vue` 组件已
    创建（接收 cost props，自动判断 enough/not-enough 状态），但各视图仍使
    用内联标记，标记为遗留项（v0.12 瘦身中完成采用）
- 遗留项：修复中引入新的未使用导入（newRelicInstanceId、UNITS、
  calcDamage、TechEffect、lt/mul/div、CostTag，不影响运行，v0.12 清理）；
  TechView 和 ArmyView 仍使用手动 canAfford+spendCost（实际安全，v0.12
  TechView 改用原子操作）；game.ts 仍约 400 行，视图仍通过 game 中转（不影
  响功能，架构耦合偏高）；CostTag 组件已创建但未被视图使用（v0.12 正式采
  用）

### 验证

- npm run build：通过
- vue-tsc：零错误零警告
- 108 模块转换，gzip 总体积约 107 KB

---

## v0.07 — 修复: 部队训练离线不推进

**变更性质：修复（离线/后台返回时训练队列不推进）**

### 概述

玩家反馈昨晚开始训练的部队进度条才走了约三分之一。根因是 `game.ts` 的
`computeOfflineGains()` 在离线/后台返回时只补算资源产出、驻扎挂机收益和随
机事件，完全没有推进训练队列：页面关闭过夜（`init()` →
`computeOfflineGains()`）时训练进度完全冻结；标签页后台时 `tick()` 检测
`dt > 60` 走 `computeOfflineGains(dt)` 后 `dt = 1`，训练每次只得 1 秒推进
（浏览器后台 `setInterval` 被节流，偶尔触发 tick 时 `dt > 60`），与「一晚
才走三分之一」的反馈吻合。

### 变更明细

- `src/stores/military.ts`（`applyTick`）：返回值从 `void` 改为返回
  `TrainingTask[]`（已完成的训练任务列表），离线补算时调用 `applyTick` 推
  进训练队列并获取完成的任务
- `src/stores/game.ts`（`computeOfflineGains`）：新增训练队列推进逻辑，调
  用 `military.applyTick(offlineDuration)` 推进训练；离线时长受 24h cap 约
  束（86400 秒）；收集完成的训练任务在离线报告中展示
- `src/components/layout/OfflineReport.vue`：新增训练完成展示区域
- 影响范围：无回归风险（applyTick 返回值变更向后兼容）；存档兼容（无
  SaveData 结构变更，无需版本迁移）；UI 增强（离线报告弹窗新增训练完成展
  示）

### 验证

- 离线 5min 训练 10min：remaining 从 600s 推进到 300s
- 再离线 5min 训练完成：remaining 归零，120 个突击兵入账
- 在线持续 tick：3 次 tick（dt=1）后 remaining 从 60s 到 57s
- 多任务并行：任务 A(50s) + B(80s) 推进 50s，A 完成入账，B 剩 30s
- 离线超 24h：30h 离线受 cap 约束，只推进 24h（86400s）
- npm run build：通过，108 模块转换，0 错误，built in 806ms

---

## v0.08 — 修复: 10 个低危问题修复与测试/规范工具链搭建

**变更性质：修复（10 个低危问题：6 条修复 + 2 条无需修复 + 2 条工程化）**
**开发时间：2026-07-09**

### 概述

修复 6 条代码级低危问题，确认 2 条无需修复，并完成 Vitest 单元测试与
ESLint/Prettier 规范两项工程化建设。

### 变更明细

- 代码级修复（6 条）：
  - 脚手架残留文件清理：删除 Vite 脚手架默认生成的无引用死文件
    `src/components/HelloWorld.vue`、`src/assets/vue.svg`、
    `src/assets/vite.svg`
  - getUnit 非空断言修复：`getUnit` 使用 `!` 非空断言，找不到时实际返回
    undefined，类型系统无法预警；改为 `Map` 查找 + `UnitDef | undefined`
    返回类型，所有调用方增加 undefined 守卫（`src/data/units.ts` 新增
    `UNIT_MAP`，`getUnit` 返回 `UnitDef | undefined`；
    `src/stores/military.ts` 4 处调用增加 `if (!u) continue` /
    `if (!def || count <= 0) return false` 守卫；`src/stores/combat.ts` 2
    处调用增加 `if (!def) continue` 守卫，克制判断改为
    `if (defRef && tgt.counteredBy?.includes(...))`；
    `src/views/ArmyView.vue` 的 `getUnitCost`/`getUnitPower` 增加
    `if (!def) return {}` / `if (!def) return { atk:0, def:0, hp:0 }` 守
    卫；`src/views/BattleView.vue` 编队详情用 `def?.name ?? uid`，损失展示
    用 `getUnit(k)?.name ?? k`）
  - buildingCost 大数精度修复（`src/data/buildings.ts`）：`buildingCost`
    使用 `Math.pow`/`Math.ceil`，高等级时（如 500 级，1.15^500 约 3.6e31）
    超出 Number.MAX_SAFE_INTEGER，返回 Infinity 或精度丢失；改用
    decimal.js（`Math.pow(def.costGrowth, currentLevel)` →
    `D(def.costGrowth).pow(currentLevel)`，`Math.ceil(base * factor)` →
    `D(base).times(factor).ceil().toNumber()`）
  - fmt 极大数精度修复：`fmt` 中 `d.log(10).toNumber()` 在极大数时（如
    1e300）超出 JS 安全整数范围，`Math.floor` 返回不精确值，后缀字母 tier
    计算错误；改用 `toDecimalPlaces(0, Decimal.ROUND_DOWN)` 在 Decimal 域
    内取整（`src/lib/format.ts`：`Math.floor(d.log(10).toNumber())` 改为
    `abs.log(10).toDecimalPlaces(0, Decimal.ROUND_DOWN).toNumber()`）
  - 添加 CSP 配置：`index.html` 新增 Content-Security-Policy meta 标签，白
    名单策略 default-src 'self'、script-src 'self'、style-src 'self'
    'unsafe-inline'、img-src 'self' data:、font-src 'self'、connect-src
    'self'、object-src 'none'、base-uri 'self'
  - Decimal.set 全局配置改用 clone：`Decimal.set({...})` 直接修改全局
    decimal.js 配置，可能影响第三方库；改为 `Decimal.clone()` 创建独立构造
    器（`src/lib/decimal.ts`：`const Decimal = _Decimal.clone()` 然后
    `Decimal.set({...})`，导出的 Decimal/D/add/sub/mul 等全部基于 clone 后
    的构造器）
- 确认无需修复（2 条）：
  - 存档「加密」实为混淆：纯前端单机游戏，存档混淆的目的是防肉眼可读和简单
    atob 解码，非真正防篡改；玩家修改自己的存档不影响其他玩家，当前方案可
    接受
  - TopBar 每帧重渲染：仅 5 个资源 pill，重渲染成本极低；实测 dev server
    下 TopBar 更新流畅，无卡顿
- 工程化建设（2 条）：
  - 引入 Vitest 单元测试：安装 `vitest` + `@vitest/coverage-v8`；新增
    `vitest.config.ts`（environment=node，include=`src/**/*.test.ts`，配置
    `@` 路径别名）；`package.json` 新增 `test`、`test:watch` scripts；4 个
    测试文件 41 个用例全部通过
    - `src/lib/format.test.ts`（16 用例）：fmt 零/小数/千位后缀/负数
      /Decimal 输入/极大数/fixed 参数；fmtInt 千分位；fmtTime 秒/分/时/天/
      非法值；pct 百分比；fmtRate 正负速率
    - `src/lib/decimal.test.ts`（13 用例）：ser/deser 序列化往返精度；
      deser 处理 null/undefined；D 处理 null/undefined；加减乘除；比较运
      算；大数精度保留；ROUND_DOWN 行为
    - `src/stores/combat.test.ts`（6 用例）：空编队战败；大兵力 vs 一级据
      点胜利；小兵力 vs 四级据点失败；仅胜利有奖励；atkMult/defMult 影响战
      局；serialize/hydrate 往返
    - `src/lib/storage.test.ts`（6 用例）：exportSave 生成 SCE- 前缀；合法
      数据往返；拒绝空串；拒绝非 SCE 串；拒绝篡改密文；拒绝损坏 JSON
  - 添加 ESLint + Prettier 配置：ESLint（`eslint.config.js` flat config）
    继承 @eslint/js recommended + typescript-eslint recommended +
    eslint-plugin-vue flat/recommended + eslint-config-prettier，项目特定
    规则 no-explicit-any off、no-unused-vars warn（argsIgnorePattern
    `^_`）、no-namespace off、vue/multi-word-component-names off、
    vue/html-self-closing off；Prettier（`.prettierrc.json`）semi: false、
    singleQuote: true、trailingComma: 'es5'、printWidth: 100、tabWidth:
    2、endOfLine: 'lf'；`package.json` 新增 `lint`、`lint:check`、
    `format`、`format:check` scripts

### 验证

- vue-tsc：零错误
- Vite 构建：成功（20 个产物文件）
- Vitest：41/41 通过
- ESLint/Prettier 配置加载正常

---

## v0.09 — 修复: 训练 +10 按钮计数修正

**变更性质：修复（+10 按钮 off-by-one）**

### 概述

部队训练面板的「+10」按钮存在 off-by-one 错误，点击后训练数量增加的不是 10
而是错误的数值（多 1 或少 1），导致玩家设定训练数量时出现偏差。

### 变更明细

- `src/views/ArmyView.vue`：修正 +10 按钮的点击事件处理逻辑，确保
  `trainCount` 精确增加 10（`trainCount[u.id] += 10`）

---

## v0.10 — 修复: 训练数量默认值与下限修正

**变更性质：修复（训练数量默认 1→0、下限 clamp、0 时禁用按钮）**

### 概述

训练数量 `trainCount` 默认值为 1，玩家进入兵营页面时每个兵种默认显示训练 1
个，容易误触开始训练不需要的兵种；-10/-1 按钮在数量已为 0 时可能减到负数；
训练按钮在数量为 0 时仍可点击。

### 变更明细

- `src/views/ArmyView.vue`：
  - `trainCount` 默认值从 1 改为 0（`Record<UnitId, number>`），四种兵种均
    初始为 0
  - 初始值：`{ assault: 0, guard: 0, heavy: 0, psionic: 0 }`
  - -10/-1 按钮 clamp 下限 0：
    `trainCount[u.id] = Math.max(0, trainCount[u.id] - 10)` /
    `Math.max(0, trainCount[u.id] - 1)`
  - 训练按钮在 `trainCount[u.id] === 0` 或资源不足时禁用：
    `!game.resources.canAfford(getUnitCost(u.id, trainCount[u.id]))`

---

## v0.11 — 功能: 编组批量编入/撤回快捷按钮

**变更性质：功能（编队兵种行新增 6 个快捷操作按钮）**

### 概述

编队管理界面中，每个兵种只能通过点击 +1 按钮逐个编入编队，大批量操作需点击
多次，撤回操作同理。本次为编队中每个兵种行增加 6 个快捷按钮：-10 / -1 / +1
/ +10 / 全入 / 全撤。

### 变更明细

- `src/views/ArmyView.vue`：编队兵种行新增 6 个快捷操作按钮
  - `-10`：从编队中撤回 10 个该兵种；`-1`：撤回 1 个
  - `+1`：向编队编入 1 个；`+10`：编入 10 个
  - `全入`：将所有已拥有的该兵种编入编队（`assignAll` 函数，disabled 条件
    `getOwned(u.id) <= 0`）
  - `全撤`：将该兵种从编队全部撤回（`removeAll` 函数，disabled 条件
    `f.units[u.id] <= 0`）
  - 按钮样式：`.fu-btn`（min-width 36px，height 28px）、`.fu-btn-wide`
    （min-width 42px，用于全入/全撤）、`.fu-btn-remove`（撤回类按钮使用
    alert 色彩）
- `src/stores/military.ts`：新增/调整 `assignAll(formationId, unitId)` 和
  `removeAll(formationId, unitId)` 函数；`removeAll` 中使用
  `Math.max(0, ...)` 确保编队兵种数量不为负

---

## v0.12 — 重构: 代码瘦身（前三优先级）

**变更性质：重构（源码精简，净减约 75 行 + 类型安全提升）**
**开发时间：2026-07-09**

### 概述

对全部 42 个源码文件（5,730 行）进行只读评估，识别出四个优先级的精简项，本
次执行前三个优先级：死导入/死代码清理、组件与样式收敛、导航数据提取与类型
修复。功能与内容未减少，仅代码更整洁。

### 变更明细

- 死导入清理（净减 3 行）：删除 `src/stores/exploration.ts` 的
  `import type { TechEffect } from '@/data/tech'`、
  `src/stores/military.ts` 的 `calcDamage` 导入与
  `import type { TechEffect }`、`src/stores/combat.ts` 的
  `newRelicInstanceId` 导入
- 死代码删除（净减 20 行，保守方案，ripgrep 确认无外部调用）：
  `src/data/units.ts` 的 `calcDamage()` 函数（9 行，仅
  `src/stores/military.ts` 导入但未调用）、`src/stores/research.ts` 的
  `canComplete()` 函数（8 行）及 return 中导出、`src/data/relics.ts` 的
  `newRelicInstanceId()` 函数（3 行，仅 `src/stores/combat.ts` 导入但未调
  用）
- CostTag 组件正式采用（净减约 30 行）：v0.06 创建了 `CostTag.vue` 组件但
  各视图仍使用内联标记，本次在 `src/views/BuildView.vue`、
  `src/views/TechView.vue`、`src/views/ArmyView.vue`、
  `src/views/MapView.vue` 4 个视图中替换内联 `<span class="cost-tag">` 为
  `<CostTag :cost="...">`，并删除各自的 `.cost-tag` CSS（BuildView 3
  条）；TechView 同时删除不再使用的 `fmt` import
- Modal Overlay CSS 提取（净减约 8 行）：`src/style.css` 新增全局
  `.modal-overlay` 基础样式（bg rgba(5,7,13,0.85)、blur 8px、position
  fixed、z-index 200）+ `.modal-overlay.lighter` 修饰类（bg
  rgba(5,7,13,0.7)、blur 4px）；`src/views/BattleView.vue` /
  `src/views/PrestigeView.vue` 删除 scoped 定义（各 1 行）、
  `src/components/layout/OfflineReport.vue` 删除 scoped 定义（6 行）并给模
  板添加 `lighter` 修饰类
- `src/views/TechView.vue` 改用原子操作（净减约 4 行）：`tryResearch()` 从
  5 行三步逻辑（getAdjustedCost + canAfford + spendCost + complete）简化为
  `game.tryResearch(id)` 一行调用
- 导航项数据提取（净减约 10 行）：新建 `src/data/navigation.ts` 导出
  `NAV_ITEMS` 数组（7 项，含 `tier: 'primary' | 'secondary'` 字段）；
  `src/components/layout/SideNav.vue` 删除 inline `navItems` 数组（9 行）
  改为导入；`src/components/layout/BottomNav.vue` 删除 inline
  `primaryTabs` + `secondaryTabs` 数组（18 行）改为
  `NAV_ITEMS.filter(n => n.tier === 'primary'/'secondary')` 筛选。SideNav
  原有 7 项完全保留，BottomNav 原有 5 primary + 2 secondary 筛选结果相同；
  BottomNav 的 tech 标签「科技」统一为「科技树」（与 SideNav 一致）
- any 类型修复（0 行变化，类型安全提升）：`src/stores/military.ts` 的
  `formations` 相关 `any` 改为具体类型
- 约束：未拆分 game.ts、未重构 combat.ts、未动 data/ 目录数据文件（评估中
  「不建议做」的部分）；第四优先级未做（收益较小）
- 精简效果汇总：合计净减约 75 行（一优先级 23 行 = 死导入 3 + 死代码 20；
  二优先级约 42 行 = CostTag 30 + Modal CSS 8 + TechView 4；三优先级约 10
  行 + any 类型修复 0 行）

### 验证

- vue-tsc：零错误
- Vite 构建：21 chunks
- Vitest：41/41 通过

---

## v0.13 — 修复: 探索进度条刷新、建筑 0 级产出与离线误弹窗

**变更性质：修复（探索进度条刷新 + 建筑 0 级产出显示 + 离线误弹窗阈值）**
**开发时间：2026-07-10**

### 概述

修复探索星图进度条不自动推进、建筑 0 级产出标签导致升级按钮位移、离线收益
误弹窗三个问题。

### 变更明细

- 修复：探索星图进度条自动刷新 + 点击反馈（`src/views/MapView.vue`）。进度
  条使用 `Date.now()` 计算百分比，属非响应式数据，时间推移不触发 Vue 重渲
  染，只能手动刷新页面才能看到最新进度；点击探索按钮后也无即时反馈。修复：
  新增响应式 `ref now`，`setInterval` 每秒更新并驱动进度条自动推进；
  `watch` 控制定时器启停（有探索中的节点才启动，避免空转）；`onUnmounted`
  清理定时器防内存泄漏；点击探索后 toast 提示「探索已开始」+ 按钮按压动
  画。
- 修复：建筑 0 级显示产出，升级按钮不再位移（`src/views/BuildView.vue`）。
  产出标签使用 `v-if="getLevel(b.id) > 0"`，建筑等级为 0 时不渲染，升级到
  1 级后产出标签突然出现把升级按钮挤下去，连续点击升级时按钮位置突变导致用
  户点空。修复：条件改为 `v-if="b.produces"`，只要建筑有产出定义就显示，0
  级即可见，按钮位置保持稳定，消除位移导致的误触。
- 修复：离线收益误弹窗（`src/stores/game.ts`）。`tick` 中 `dt > 60` 秒即触
  发离线收益报告弹窗，浏览器对不活跃标签页的 `setInterval` 会节流，系统休
  眠唤醒后 `dt` 也可能突然超过 60 秒，导致频繁误弹窗（显示「约1分钟」）。
  修复：新增常量 `OFFLINE_REPORT_THRESHOLD = 300`（5 分钟），离线时长 < 5
  分钟时静默补算资源产出和训练队列进度但不弹窗，>= 5 分钟才弹出离线收益报
  告；补算逻辑不受影响，仅控制弹窗触发阈值。
- 涉及文件：
  - `src/views/MapView.vue`：探索进度条自动刷新 + 点击反馈
  - `src/views/BuildView.vue`：建筑 0 级显示产出，升级按钮不再位移
  - `src/stores/game.ts`：离线收益误弹窗阈值从 60s 提高到 300s

### 验证

- 本地验证：通过

---

## v0.14 — 功能: 建筑升级倒计时预估

**变更性质：功能（资源不足时显示预估升级倒计时）**
**开发时间：2026-07-10**

### 概述

在建筑升级界面（BuildView）中，当玩家当前资源不足以立即升级某建筑时，显示
预估倒计时，告诉玩家大约还需多久才能攒够资源升级。倒计时基于木桶原理（取最
慢资源为准），并标注瓶颈资源名称；鼠标悬停时展开各资源的详细进度信息。

### 变更明细

- 木桶原理：取所有可产出资源中缺口/速率比最大的资源为瓶颈，倒计时以瓶颈为
  准
- 渐进式披露：默认视图简洁（倒计时文字 + 色点），hover/点击展开完整明细面
  板
- 5 种显示情况：A. 资源全满 → 不渲染；B. 仅可产出瓶颈 → 倒计时文字；C. 混
  合瓶颈 → 倒计时 + 「需手动获取」；D. 仅手动瓶颈 → 「需手动获取」；E. 空
  成本 → 不渲染（防御性）
- rate=0 资源特殊标注：琥珀色高亮 + 虚线边框，提示玩家无法通过建筑自动产出
- 色点标记：瓶颈资源用对应资源主题色标记，一眼可辨
- 预估声明：明细面板底部标注「实际时间受科技、遗物等加成影响」，避免误导
- 涉及文件：
  - `src/lib/format.ts`：新增 `fmtCountdown(seconds, bottleneckName?)` 函
    数，秒 → 倒计时格式化（「约5h23m后（晶体）」），支持 <1m / m / h+m /
    d+h / d 多级粒度，非法值返回空串
  - `src/lib/format.test.ts`：新增 `fmtCountdown` 测试用例 6 组（分钟、小
    时、天、带瓶颈名、边界值），总测试数 41 → 47
  - `src/components/ui/UpgradeCountdown.vue`：新建，倒计时组件（computed
    计算资源缺口/速率/瓶颈，hover/click 展开明细面板，色点标记，rate=0 特
    殊样式，transition 动画）
  - `src/views/BuildView.vue`：集成 UpgradeCountdown 组件，在每个可升级建
    筑卡片的升级按钮上方插入 `<UpgradeCountdown :building-id="b.id" />`，
    仅在资源不足且建筑可升级时显示

### 验证

- vue-tsc 类型检查：零错误
- vite build：成功（114 modules, 894ms）
- Vitest：47/47 通过（含新增 6 组 fmtCountdown 测试）
- Playwright 功能验证：10/10 通过
- 情况A 资源全满不渲染：通过
- 情况B 仅可产出瓶颈：通过（显示「约<1m后（能量）」）
- 情况C 混合瓶颈：通过（显示「约1m后（能量）| 需手动获取（晶体）」）
- 情况D 仅手动瓶颈：通过（显示「需手动获取（能量）」）
- 情况E 空成本防御：通过（代码路径确认）
- hover 展开明细面板：通过（显示资源明细标题 + 各资源进度行 + 预估声明）
- 色点标记：通过（颜色匹配资源主题色，如能量 #00E5FF）
- rate=0 资源标注：通过（琥珀色高亮 + 虚线边框）
- 扇区风格兼容：通过（能量/合金/研究 3 扇区布局对齐无冲突）
- 控制台无报错：通过

---

## v0.15 — UI: 升级倒计时文案调整

**变更性质：UI（倒计时主界面文案精简与格式统一）**
**开发时间：2026-07-10**

### 概述

建筑升级倒计时组件（UpgradeCountdown.vue）主界面文案优化：去掉括号资源名，
格式统一为「约X小时Y分钟后可升级」，明细面板保持不变。

### 变更明细

- 去掉括号资源名：「需手动获取（资源名）」改为「需手动获取」，不再在主界面
  显示括号中的瓶颈资源名称
- 格式统一为「约X小时Y分钟后可升级」：倒计时行文案保持中文粒度格式（<1分钟
  / X分钟 / X小时Y分钟 / X天Y小时），与「约…后可升级」句式组合
- 明细面板不变：hover/点击展开的资源明细面板保持原有格式和内容
- 涉及文件：`src/components/ui/UpgradeCountdown.vue`（移除情况 C/D 中
  `（{{ manualResName }}）` 括号资源名显示，移除已无引用的 `manualResName`
  computed）、`package.json`（版本号 0.14 → 0.15）

---

## v0.16 — UI: 明细面板时间格式统一

**变更性质：UI（明细面板 ETA 统一为中文时间格式）**
**开发时间：2026-07-10**

### 概述

v0.15 只改了倒计时主行的时间格式（`2h30m` → `2小时30分钟`），明细面板中各
资源的 ETA 仍使用 `fmtCountdown` 的紧凑格式（`约5h23m后`）。本次将明细面板
的 ETA 显示也统一为中文格式，与主行完全一致。

### 变更明细

- 提取 `fmtDuration` 函数：将 `timePart` computed 中的中文时间格式化逻辑提
  取为独立函数（`<1分钟` / `X分钟` / `X小时Y分钟` / `X天Y小时` / `X天`）
- 明细面板 ETA 统一：`fmtEta` 函数从调用 `fmtCountdown`（返回
  `约5h23m后`）改为调用 `fmtDuration`（返回 `5小时23分钟`），与主行格式一
  致
- 移除未使用导入：组件不再导入 `fmtCountdown`
- 涉及文件：`src/components/ui/UpgradeCountdown.vue`（提取 `fmtDuration`
  函数；`timePart` 和 `fmtEta` 统一使用该函数；移除 `fmtCountdown` 导
  入）、`package.json`（版本号 0.15 → 0.16）

---

## v0.17 — 修复: 遗物科技成本减免修复与据点驻扎挂机增强

**变更性质：修复（遗物科技成本减免失效修复 + 据点驻扎挂机增强）**
**开发时间：2026-07-10**

### 概述

遗物「量子核心」的 -10% 科技成本减免（cost_mult）在研究时未生效，同时修复
转生树 `all` target 聚合缺失；另对据点挂机驻扎补收益提示弹窗、离线收益弹窗
拆分两个体验增强，并核查 8 个据点的驻扎收益计算。

### 变更明细

- 修复：遗物科技成本减免 cost_mult 未生效。遗物「量子核心」提供 -10% 科技
  成本减免（cost_mult 效果），但实际研究时未生效，科技消耗的全额成本未应用
  减免；根因是 `game.ts` 中 `tryResearch` 和 `TechView` 计算科技成本时未走
  effectSystem 聚合，遗物的 `cost_mult` 效果未被纳入计算。修复后 `game.ts`
  新增 `techCostMult` computed，通过 effectSystem 聚合所有来源（遗物/科技/
  转生）的 `cost_mult` 效果，`tryResearch` 改用聚合值计算实际成本；
  `TechView.vue` 成本展示同步改用聚合值，确保 UI 显示与实际消耗一致。
  - 涉及文件：`src/stores/game.ts`、`src/views/TechView.vue`
- 修复：`transcend.getMult` 补充 'all' target 兼容。`transcend.getMult` 未
  处理 `target: 'all'` 的情况，转生树中以 `all` 为 target 的效果无法正确聚
  合；补充 `'all'` target 兼容处理，确保全局效果正确聚合到各乘数通道。
  - 涉及文件：`src/stores/transcend.ts`
- 优化：据点挂机驻扎收益提示弹窗。点击「挂机驻扎」按钮后不再直接驻扎，先弹
  出收益提示弹窗，展示当前每秒产量 + 每小时换算产量，玩家确认后才执行驻
  扎，避免误操作。
- 优化：离线收益弹窗拆分。离线收益弹窗拆分为「建筑产出」和「据点驻扎收益」
  两个独立分区，各分区独立展示对应收益明细，清晰可辨。
- 核查：据点驻扎收益（8 个据点）。在线 tick 每秒正确结算；离线按离线时长正
  确补算；驻扎收益为固定被动收益，不享受 `production_mult` 乘数加成（设计
  意图确认）。
- 涉及文件：
  - `src/stores/game.ts`：新增 techCostMult computed，tryResearch 改用聚合
    值
  - `src/views/TechView.vue`：科技成本展示改用聚合值
  - `src/stores/transcend.ts`：getMult 补充 'all' target 兼容
  - 挂机驻扎相关组件/视图：驻扎收益提示弹窗
  - 离线报告相关组件：离线收益弹窗拆分分区

### 验证

- vue-tsc：零错误
- vite build：成功
- Playwright：31 项全通过
- Vitest：47 项全通过

---

## v0.18 — 重构: 建造界面扇区扩展（3→5）

**变更性质：重构（建造界面扇区 3→5，每种资源独立扇区）**
**开发时间：2026-07-11**

### 概述

建造界面扇区从 3 个扩展为 5 个，使每种资源对应独立扇区。改动仅涉及建造界面
分组展示，不涉及任何游戏逻辑、产出计算或存档结构；sector 是运行时分组标
签，不存入存档，现有存档完全兼容，无需迁移。

### 变更明细

- 扇区调整（3→5）：
  - 能量扇区（energy，不变）
  - 晶体扇区（crystal，新增，晶体矿场从合金移出）
  - 合金扇区（alloy，精炼厂保留；原归属 alloy + crystal + dark）
  - 数据扇区（data，数据中心 + 量子实验室，从研究更名）
  - 暗物质扇区（dark，新增，暗物质实验室从合金移出）
- 涉及文件：
  - `src/data/buildings.ts`：SectorId 从 `'energy'|'alloy'|'research'` 扩
    展为 `'energy'|'crystal'|'alloy'|'data'|'dark'`；SECTORS 定义从 3 条扩
    展为 5 条；各建筑 sector 字段重新归属
  - `src/views/BuildView.vue`：扇区 tab 样式改为 flex-wrap 换行布局，移动
    端每行 3 个 tab，桌面端撑满一行

### 验证

- vue-tsc：零错误
- Vitest：47/47 通过

---

## v0.19 — 重构: 科技树分支扩展（7→8）

**变更性质：重构（科技树分支 7→8，新增晶脉学分支）**
**开发时间：2026-07-11**

### 概述

科技树分支从 7 个扩展为 8 个，新增「晶脉学」分支承接晶体工艺类科技，材料学
仅保留合金相关科技。branch 是运行时分组标签，科技存档按 id 存储完成列表，
现有存档完全兼容。

### 变更明细

- 分支调整（7→8）：
  - 能量学（energy，不变）
  - 晶脉学（crystal，新增，晶体工艺从材料学移出）
  - 材料学（alloy，仅保留合金相关科技；原归属 alloy + crystal）
  - 计算学（data，不变）
  - 军事学（military，不变）
  - 探索学（exploration，不变）
  - 暗物质学（dark，不变）
  - 奇点学（singularity，不变）
- 分支排列顺序：能量学 → 晶脉学 → 材料学 → 计算学 → 军事学 → 探索学 → 暗物
  质学 → 奇点学
- 涉及文件：`src/data/tech.ts` 的 TechBranch 新增 `'crystallography'`；
  TECH_BRANCHES 新增晶脉学分支定义；`crystal_eff_1`（晶体工艺）从
  materials 移至 crystallography

### 验证

- vue-tsc：零错误
- Vitest：47/47 通过
- vite build：成功

---

## v0.20 — 功能: 晶体扇区建筑与晶脉学科技扩展

**变更性质：功能（晶体扇区建筑 1→4、晶脉学科技 1→5）**
**开发时间：2026-07-11**

### 概述

晶体扇区从 1 座建筑扩展为 4 座，晶脉学科技分支从 1 项扩展为 5 项，补上晶体
产能的前中期阶梯。新建筑在旧存档中不存在，hydrate 时自动为 0 级，无需补
偿；科技完成列表按 id 存储，新科技 id 不在旧列表中自然未完成，向后兼容。

### 变更明细

- 晶体扇区建筑（1→4）：
  - 晶体矿场（已有）：产出 0.3/s，costGrowth 1.14，无前置科技
  - 晶格培育室（新增）：产出 0.6/s，costGrowth 1.18，前置 crystal_growth
  - 深晶钻探站（新增）：产出 2.0/s，costGrowth 1.22，前置
    deep_crystal_mining
  - 硅基星环（新增）：产出 7.0/s，costGrowth 1.25，前置
    silicon_ring_theory
- 晶脉学科技分支（1→5）：
  - T1 晶格培育：解锁晶格培育室，成本 data:60, energy:400
  - T2 晶体工艺（已有）：晶体产出 ×1.3，成本 data:100, energy:500
  - T3 深晶开采：解锁深晶钻探站，成本 data:500, energy:4000, crystal:200
  - T4 晶体工艺 II：晶体产出 ×1.4，成本 data:1500, energy:18000,
    crystal:500
  - T5 硅基星环理论：解锁硅基星环，成本 data:6000, energy:100000,
    crystal:3000, alloy:1500
- 其他改动：戴森云移除 maxLevel: 50（挂机游戏不应设等级上限）；存档版本 v1
  →v2 迁移；新增 3 个 SVG 图标（i-crystal-nursery、i-deep-drill、
  i-silicon-ring）
- 涉及文件：
  - `src/data/buildings.ts`：新增 3 个 BuildingDef + 戴森云移除 maxLevel
  - `src/data/tech.ts`：新增 4 个晶脉学科技节点
  - `src/stores/game.ts`：SAVE_VERSION 1→2，migrateSave v1→v2
  - `src/components/ui/Icons.vue`：新增 3 个 SVG symbol
  - `package.json`：version 0.19→0.20

### 验证

- simulate-production.py 模拟 24h 对比（贪婪策略）：晶体产出率增长 7.7x，
  稀缺度从 180:1 降至 36:1；合金累计产出 +16.4%，基本不受影响；暗物质/数据
  流基本不变
- vue-tsc：零错误
- vite build：成功
- 线上部署：200 OK

---

## v0.21-24 — 修复: 代码评审修复与 TypeScript 严格度提升

**变更性质：修复（代码评审问题修复与严格模式收口）**
**开发时间：2026-07-12**

### 概述

共修复 6 个评审问题，含复查阶段修复的 2 个逻辑缺陷。
同时启用 TypeScript 严格模式的两项未使用检查，清理 20 处未使用导入/变量，
构建与测试全绿。

### 变更明细

- 优先修复：
  - 移除冗余 computed 包装函数：`game.ts` 暴露了 7 个 `computeXxx()` 函
    数，每个仅返回对应 `computed.value`，属 Options API 遗留风格。移除包装
    函数，直接暴露 computed 属性（`atkMult`、`defMult` 等），5 个调用方改
    为直接属性访问。
    - 涉及文件：`src/stores/game.ts`、`src/views/BattleView.vue`、
      `src/views/ArmyView.vue`、`src/views/MapView.vue`、
      `src/views/TechView.vue`
  - 明确存档加密安全边界：在 `storage.ts` 加密模块头部添加完整安全边界声
    明，明确「防君子不防小人」的混淆定位、纯前端单机游戏的固有约束、足以/
    不足以防御的场景。
    - 涉及文件：`src/lib/storage.ts`
- 常规修复：
  - 驻扎收益改为 computed 缓存：`combat.ts` 新增 `garrisonProduction`
    computed，仅在 `garrisoned` 变化时重算合并产出，替代原每 tick 遍历所有
    驻扎据点；`game.ts` 的 tick 改为直接读取该 computed。
    - 涉及文件：`src/stores/combat.ts`、`src/stores/game.ts`
  - 编组全入/全撤确认弹窗：操作数量 >100 时弹出确认弹窗（≤100 保持原行
    为），防误操作。
    - 涉及文件：`src/views/ArmyView.vue`
  - 战斗奖励发放推迟到确认时：`startBattle` 不再立即发放奖励，新增
    `grantRewards()` 在 `confirmResult()` 或 `stayHere()` 时调用，使用
    `rewardsGranted` 标志位防重入。
    - 涉及文件：`src/views/BattleView.vue`
  - TypeScript 严格度提升：启用 `noUnusedLocals: true` /
    `noUnusedParameters: true`，清理 20 处未使用导入/变量（涉及 15 个文
    件）；附带修复 lint 错误：`combat.ts` `let dmg` → `const dmg`、
    `storage.ts` `catch (e)` → `catch`。
    - 涉及文件：`tsconfig.app.json` + 15 个源码文件
- 复查修复：
  - 确认弹窗死循环：`confirmBulkAction` 调用 `assignAll` 再次触发 >100 检
    查又弹窗，无限递归。提取 `doAssignAll`/`doRemoveAll` 核心函数，确认弹
    窗直接调用核心。
  - 奖励重复发放：遮罩层点击 + 按钮点击或新战斗复用旧 `battleResult` 导致
    奖励发放两次，新增 `rewardsGranted` ref 标志位防重入。
- 涉及文件（共 20 个）：
  - `tsconfig.app.json`：启用 noUnusedLocals / noUnusedParameters
  - `src/stores/game.ts`：移除 computed 包装函数；驻扎收益改读
    garrisonProduction；严格模式清理
  - `src/stores/combat.ts`：新增 garrisonProduction computed；let →
    const；严格模式清理
  - `src/stores/buildings.ts`、`src/stores/military.ts`、
    `src/stores/relics.ts`、`src/stores/research.ts`、
    `src/stores/resources.ts`、`src/stores/exploration.ts`：严格模式清理
  - `src/lib/storage.ts`：加密模块安全边界声明；catch 无参化；严格模式清理
  - `src/data/tech.ts`：严格模式清理
  - `src/views/BattleView.vue`：直接属性访问；奖励发放改 grantRewards；严
    格模式清理
  - `src/views/ArmyView.vue`：直接属性访问；全入/全撤确认弹窗；严格模式清
    理
  - `src/views/MapView.vue`、`src/views/TechView.vue`：直接属性访问；严格
    模式清理
  - `src/views/HomeView.vue`、`src/views/PrestigeView.vue`、
    `src/components/ui/UpgradeCountdown.vue`：严格模式清理
- 留作中期的问题：
  - Store 间隐式依赖（relics→transcend）：Pinia 标准模式，解耦收益有限
  - 语义化 HTML 不足：大量模板改动，单独迭代
  - 模态弹窗焦点陷阱：需引入 focus-trap 库，单独迭代

### 验证

- vue-tsc -b（含 noUnusedLocals/Parameters）：零错误
- vite build：成功
- vitest：54/54 全部通过
- eslint：0 errors, 0 warnings

---

## v0.25-29 — 修复: 三项核查修复（快捷操作宽度 / 槽位响应式 / hydrate 顺序）

**变更性质：修复（三项核查修复）**
**开发时间：2026-07-12**

### 概述

三项独立缺陷修复：快捷操作按钮宽度、遗物槽位响应式追踪、读档 hydrate 执行
顺序（第 5 槽位遗物被截断）。

### 变更明细

- 快捷操作按钮宽度修复（UI）：v0.27 将 HomeView 快捷操作从 `<div>` 改为
  `<ul><li>` 语义化结构后，`.action-card` 按钮不再是 flex 容器的直接子元
  素，flex stretch 不再生效，导致建筑项按钮过宽。`src/views/HomeView.vue`
  — `.action-card` CSS 增加 `width: 100%`，让按钮撑满 `<li>` 宽度。
- 遗物槽位 slotProvider 响应式修复（逻辑）：`relics.ts` 中 `slotProvider`
  为普通 `let` 变量，`setRelicSlotProvider` 替换函数时不触发 Vue 响应式更
  新，`maxSlots` computed 永久缓存为 4，转生树购买 `t_slot`（+1 遗物槽）后
  槽位数不增加。`src/stores/relics.ts` — `slotProvider` 从 `let` 改为
  `shallowRef`，`setRelicSlotProvider` 改用 `.value` 赋值，`maxSlots`
  computed 改用 `slotProvider.value()` 读取。替换 provider 函数时触发响应
  式重算，`maxSlots` 正确反映转生树加成。
- hydrateAll 执行顺序调整（隐患）：`game.ts` 的 `hydrateAll` 中
  `relics.hydrate` 在 `transcend.hydrate` 之前执行。`relics.hydrate` 读取
  `maxSlots` 时转生树尚未恢复，`t_slot` 节点的 `relic_slot` 效果未生效，
  `maxSlots` 仍为 4，导致第 5 槽位的遗物 ID 在对齐时被截断丢失。
  `src/stores/game.ts` — `hydrateAll` 中 `transcend.hydrate` 移到
  `relics.hydrate` 之前执行，确保转生树节点先恢复，`maxSlots` 正确为 5，第
  5 槽位遗物 ID 不被截断。
- 改动文件清单：
  - `src/views/HomeView.vue`：.action-card 增加 width: 100%
  - `src/stores/relics.ts`：slotProvider 改为 shallowRef 恢复响应式追踪
  - `src/stores/game.ts`：hydrateAll 中 transcend.hydrate 移到
    relics.hydrate 之前

### 验证

- vue-tsc -b：零错误
- npm run build：构建通过
- npx vitest run：8 文件 67 用例全部通过

---

## v0.30 — 数值: 数值问题修复（6 项）

**变更性质：数值（平衡性修复 6 项）**
**开发时间：2026-07-12**

### 概述

数值平衡修复 6 项：4 处建筑产出与兵种防御数值修正，并为晶体/暗物质两条资源
线补齐专属遗物与转生天赋加成路径。

### 变更明细

- neural_hub 数据产出 1.5→3.0：
  - 涉及文件：`src/data/buildings.ts`
  - 字段：`neural_hub.produces.data` 从 1.5 改为 3.0
  - 原因：T3 neural_hub 产出与 T2 quantum_lab 完全相同（均为 1.5
    data/s），解锁成本巨大但产出零提升，仅为纯前置节点。修复后 T2→T3 倍率
    ×2，使其成为有意义的升级
- nano_forge 合金产出 0.18→0.30：
  - 涉及文件：`src/data/buildings.ts`
  - 字段：`nano_forge.produces.alloy` 从 0.18 改为 0.30
  - 原因：T2 nano_forge 较 T1 refinery 产出仅 ×1.2，成本却增长 6.7 倍，性
    价比严重偏低。修复后 T1→T2 倍率 ×2.0，回本周期合理化
- 重装兵防御 18→12：
  - 涉及文件：`src/data/units.ts`
  - 字段：`heavy.defense` 从 18 改为 12
  - 原因：重装兵攻击最高（20）、防御最高（18）、血量最高（200），全面碾压
    其他兵种，克制机制 ×1.5 不足以平衡。护卫兵克制重装兵时 8×1.5=12 vs 防
    御 18 仍无法造成伤害。修复后护卫兵克制重装兵可有效破防（12 vs 12），克
    制机制重新生效
- crystal_nursery 晶体产出 0.6→0.9：
  - 涉及文件：`src/data/buildings.ts`
  - 字段：`crystal_nursery.produces.crystal` 从 0.6 改为 0.9
  - 原因：T2 crystal_nursery 较 T1 crystal_mine 仅 ×2.0 产出，成本增长 8.3
    倍，性价比偏低。修复后 T1→T2 倍率 ×3.0，与能量扇区（×8）、合金扇区
    （×2.0）等其他扇区 T2 增幅更接近
- 新增晶体/暗物质专属遗物 5 件：
  - 涉及文件：`src/data/relics.ts`
  - 改动：在 RELIC_POOL 中新增 5 件遗物
  - 普通 r_crystal_1「晶体碎屑」：晶体产出 +5%（target: 'crystal', value:
    1.05, icon: i-mine）
  - 普通 r_dark_1「暗物质微粒」：暗物质产出 +5%（target: 'dark', value:
    1.05, icon: i-dark-detector）
  - 稀有 r_crystal_2「纯晶棱镜」：晶体产出 +15%（target: 'crystal', value:
    1.15, icon: i-mine）
  - 稀有 r_dark_2「暗物质凝聚体」：暗物质产出 +15%（target: 'dark', value:
    1.15, icon: i-dark-detector）
  - 史诗 r_dark_3「暗物质奇点」：暗物质产出 +40%（target: 'dark', value:
    1.4, icon: i-dark-well）
  - 原因：晶体和暗物质无专属产出遗物，在遗物系统中完全缺乏加成路径，加剧跨
    扇区不平衡。新增后两资源拥有与能量/合金/数据对等的遗物加成层级
- 转生天赋树新增晶体觉醒/暗物质觉醒节点：
  - 涉及文件：`src/stores/transcend.ts`
  - 改动：在 DEFAULT_NODES 中新增 2 个节点
  - t_crystal_1「晶体觉醒」：cost 2，effects: [{type: 'production_mult',
    target: 'crystal', value: 1.5, label: '晶体产出 ×1.5' }]
  - t_dark_1「暗物质觉醒」：cost 5，effects: [{type: 'production_mult',
    target: 'dark', value: 1.5, label: '暗物质产出 ×1.5' }]
  - 原因：转生天赋树无晶体/暗物质产出节点，两资源在所有加成系统中均被遗
    漏。新增后晶体和暗物质获得转生加成路径。PrestigeView 天赋树为数据驱动
    （v-for node in tree），新增节点自动渲染，无需改视图
- 改动文件清单：
  - `src/data/buildings.ts`：crystal_nursery 产出 0.6→0.9
  - `src/data/relics.ts`：新增 5 件晶体/暗物质专属遗物
  - `src/stores/transcend.ts`：新增 t_crystal_1 / t_dark_1 天赋节点

### 验证

- vue-tsc -b：零错误
- npm run build：构建通过（117 modules, 842ms）
- npx vitest run：8 文件 67 用例全部通过

---

## v0.31 — 数值: 转生阈值降低与暗物质产出提升

**变更性质：数值（平衡性调整）**
**开发时间：2026-07-12**

### 概述

转生阈值从 1e6 降至 3e5、暗物质 T3 建筑产出提升、转生条件提示文本同步改为
千分位格式，降低首次转生门槛。

### 变更明细

- 暗物质扇区 T3 dark_capture_station 产出 0.04→0.06：
  `dark_capture_station.produces.dark` 从 0.04 改为 0.06
  - 涉及文件：`src/data/buildings.ts`
  - 原因：T3 dark_capture_station 较 T2 dark_matter_detector 产出仅 ×2
    （0.02→0.04），成本增长巨大，T2→T3 倍率偏低。修复后 T2→T3 倍率 ×3
    （0.02→0.06），与暗物质扇区高阶建筑增幅更合理
- 转生阈值 1e6→3e5：
  - 涉及文件：`src/stores/transcend.ts`
  - 改动：`previewNegEntropy` 函数中两处 1e6 → 3e5
  - 阈值判断：`totalEnergy.lt(1e6)` → `totalEnergy.lt(3e5)`
  - 负熵公式除数：`totalEnergy.div(1e6)` → `totalEnergy.div(3e5)`
  - 原因：首转生时长由 4-8h 缩短至 1.5-3h，让玩家更快体验转生循环，降低前
    期流失率。经评估确认 3e5 为合理阈值
  - 同步更新：`src/stores/game.ts` 注释中的 1e6 → 3e5；
    `src/views/PrestigeView.test.ts` 注释中的 1e6 → 3e5
- 转生提示展示优化：1.00e6 → 300,000：转生条件提示文本从 "需达到 1,000,000
  总能量产出才能转生" 改为 "需达到 300,000 总能量产出才能转生"。阈值改为
  3e5 后，展示文本同步更新为 300,000（千分位格式），与实际阈值保持一致，更
  易读
  - 涉及文件：`src/views/PrestigeView.vue`
- 改动文件清单：
  - `src/data/buildings.ts`：dark_capture_station 产出 0.04→0.06
  - `src/stores/transcend.ts`：转生阈值 1e6→3e5（阈值判断 + 负熵公式除数）
  - `src/views/PrestigeView.vue`：转生提示文本 1,000,000→300,000
  - `src/stores/game.ts`：注释 1e6→3e5
  - `src/views/PrestigeView.test.ts`：注释 1e6→3e5
  - `package.json`：version 0.30→0.31

### 验证

- vue-tsc -b：零错误
- npm run build：构建通过
- npx vitest run：8 文件 67 用例全部通过

---

## v0.32 — 数值: costGrowth 趋势反转与奖励修正

**变更性质：数值（平衡性修复）**
**开发时间：2026-07-12**

### 概述

全扇区 costGrowth 趋势反转（T1→T4 从递增改为递减），并修复突击兵克制缺失、
深空 data/crystal 奖励偏低、dark_matter_theory 代码区段错位三处问题。

### 变更明细

- 全扇区 costGrowth 趋势反转（T1→T4 从递增改为递减）：原配置中高 Tier 建筑
  costGrowth 更高（T1 1.12-1.15 → T4 1.22-1.25），导致高 Tier 建筑升级成本
  增长过快，高等级后性价比急剧下降，Lv 30 交叉后高 Tier 被低 Tier 反超。反
  转全扇区 costGrowth 趋势，高 Tier 建筑升级成本增长更平缓，确保高 Tier 建
  筑在后期保持性价比优势。5 个扇区 × 4 个 Tier = 20 个 costGrowth 值统一改
  为：
  - 涉及文件：`src/data/buildings.ts`
  - T1：1.12-1.15 → 1.18
  - T2：1.15-1.20 → 1.15
  - T3：1.18-1.22 → 1.13
  - T4：1.22-1.25 → 1.10
  - 能量：solar_collector T1 1.12 → 1.18、fusion_reactor T2 1.15 → 1.15
    （无变化）、core_extractor T3 1.18 → 1.13、dyson_swarm T4 1.22 → 1.10
  - 晶体：crystal_mine T1 1.14 → 1.18、crystal_nursery T2 1.18 → 1.15、
    deep_crystal_drill T3 1.22 → 1.13、silicon_ring T4 1.25 → 1.10
  - 合金：refinery T1 1.15 → 1.18、nano_forge T2 1.18 → 1.15、
    ion_casting_plant T3 1.22 → 1.13、stellar_forge T4 1.25 → 1.10
  - 暗物质：dark_detector T1 1.14 → 1.18、dark_matter_lab T2 1.20 → 1.15、
    dark_capture_station T3 1.22 → 1.13、dark_singularity_well T4 1.25 →
    1.10
  - 数据：data_center T1 1.15 → 1.18、quantum_lab T2 1.18 → 1.15、
    neural_hub T3 1.22 → 1.13、holographic_core T4 1.25 → 1.10
- 突击兵 counters 补全 psionic：`assault.counters` 从 `['guard']` 改为
  `['guard', 'psionic']`。灵能者描述写"被突击兵克制"，但 assault.counters
  不含 psionic，代码与描述不一致。修复后突击兵正确克制灵能者
  - 涉及文件：`src/data/units.ts`
- 深空探索 data 奖励 5000→10000：`node_deep.rewards.data` 从 5000 改为
  10000。深空节点 data 奖励(5000) = data 成本(5000)，净收益为零。修复后恢
  复 2x 比例（与内层 50→100、外层 500→1000 一致），净收益 +5000
  - 涉及文件：`src/data/explore.ts`
- dark_matter_theory 代码注释区段修正：`dark_matter_theory`（branch:
  'dark'）的定义被放在了材料学（refine_tech）区段内，暗物质学区段仅留一行
  跨分支注释 `// dark_matter_theory 已在材料学中定义（跨分支）`。将
  `dark_matter_theory` 条目从材料学区段移至暗物质学区段（`dark_detection`
  之后），删除跨分支注释。材料学区段减少 1 条、暗物质学区段增加 1 条，
  TECHS 数组内容不变，仅物理位置调整
  - 涉及文件：`src/data/tech.ts`
- 深空探索 crystal 奖励 500→1000：`node_deep.rewards.crystal` 从 500 改为
  1000。深空/外层晶体增幅仅 ×2.5（500/200），其他资源增幅为 ×5~10（energy
  ×10、alloy ×5、data ×10、dark ×10）。修复后晶体增幅 ×5（1000/200），与合
  金增幅一致（最低基准）。energy ×10、crystal ×5（修复前 ×2.5）、alloy
  ×5、data ×10、dark ×10
  - 涉及文件：`src/data/explore.ts`
- 改动文件清单：
  - `src/data/buildings.ts`：20 个 costGrowth 值趋势反转
  - `src/data/units.ts`：assault.counters 补全 psionic
  - `src/data/explore.ts`：深空 data 奖励 5000→10000；深空 crystal 奖励
    500→1000
  - `src/data/tech.ts`：dark_matter_theory 从材料学区段移至暗物质学区段

### 验证

- vue-tsc -b：零错误
- npm run build：构建通过
- npx vitest run：8 文件 67 用例全部通过

---

## v0.33 — 数值: 数值问题修复（6 项）

**变更性质：数值（平衡性修复 6 项）**
**开发时间：2026-07-13**

### 概述

数值平衡专项 6 项修复：3 项科技前置跨分支依赖修正、跨扇区 T4 产出量级拉
齐、首次转生保底负熵、天赋树总消耗下调。

### 变更明细

- alloy_eff_2 前置改为 ion_casting：`alloy_eff_2.requires` 从
  `['dark_matter_theory']` 改为 `['ion_casting']`。alloy_eff_2（材料学
  T4）强制依赖 dark_matter_theory（暗物质学 T2），形成材料学↔暗物质学跨分
  支回路依赖。改为依赖同分支的 ion_casting（材料学 T3），消除跨分支硬瓶颈
  - 涉及文件：`src/data/tech.ts`
- data_eff_2 前置改为 neural_arch + holographic_computing 清理冗余前置：
  `data_eff_2.requires` 从 `['research_speed']` 改为 `['neural_arch']`。
  data_eff_2（计算学 T4）原依赖 research_speed（计算学 T3 侧支），无法形成
  自然递进。改为依赖 neural_arch（计算学 T3 主线），形成 quantum_tech→
  data_eff_1→neural_arch→data_eff_2 自然递进链。改后 holographic_computing
  原前置 `neural_arch` 变为冗余（已通过 data_eff_2 间接依赖），清理掉
  - 涉及文件：`src/data/tech.ts`
  - `holographic_computing.requires` 从 `['data_eff_2', 'neural_arch']` 改
    为 `['data_eff_2']`
- crystal_eff_1 前置改为 crystal_growth + deep_crystal_mining 清理冗余前
  置：`crystal_eff_1.requires` 从 `['refine_tech']` 改为
  `['crystal_growth']`。crystal_eff_1（晶脉学 T2）原依赖 refine_tech（材料
  学 T1），跨分支依赖。改为依赖同分支的 crystal_growth（晶脉学 T1），让晶
  脉学形成独立分支（仍经 crystal_growth 间接依赖 refine_tech，但不再直接跨
  分支）。改后 deep_crystal_mining 原前置 `crystal_growth` 变为冗余（已通
  过 crystal_eff_1 间接依赖），清理掉
  - 涉及文件：`src/data/tech.ts`
  - `deep_crystal_mining.requires` 从
    `['crystal_growth', 'crystal_eff_1']` 改为 `['crystal_eff_1']`
- 跨扇区 T4 产出量级差异修复：能量 T4 dyson_swarm 产出 300（T4/T1=600x），
  其余扇区 T4/T1 仅 8-23x，能量扇区与其他扇区后期差距悬殊。提升非能量扇区
  T4 建筑产出，缩小各扇区 T4/T1 倍率差距。修复后各扇区 T4/T1 倍率从 600x
  vs 8-23x 缩小到 600x vs 33-50x
  - 涉及文件：`src/data/buildings.ts`
  - silicon_ring（晶体 T4）：7.0 → 15.0，T4/T1 23x → 50x
  - stellar_forge（合金 T4）：1.2 → 5.0，T4/T1 8x → 33x
  - holographic_core（数据 T4）：4.0 → 10.0，T4/T1 20x → 50x
  - dark_singularity_well（暗物质 T4）：0.10 → 0.25，T4/T1 20x → 50x
- 首次转生保底 +1 负熵：首次转生仅获 1 负熵，体验断崖，无法购买任何 cost-2
  天赋节点（t_data_1/t_crystal_1/t_starting），只能购买单个 cost-1 节点，
  首次转生体验差。在 `previewNegEntropy` 函数中，当
  `totalTranscends === 0` 时额外 +1 负熵（首转保底 2 负熵），可同时购买
  t_energy_1 + t_alloy_1（两个 cost-1 节点）或单个 cost-2 节点。
  `previewNegEntropy` 中计算 base 值后判断 `totalTranscends.value === 0`，
  是则 `base.plus(1)`。`transcend` 函数接收 previewNegEntropy 的返回值，无
  需额外修改
  - 涉及文件：`src/stores/transcend.ts`
- 天赋树总消耗降低：天赋树总消耗 44 负熵过高，完整点满需多轮转生，进度感
  差。降低两个高消耗节点成本。总消耗从 44 降至 40（-9%）
  - 涉及文件：`src/stores/transcend.ts`
  - t_offline（时间之主）：cost 8 → 6
  - t_prestige_boost（负熵循环）：cost 10 → 8
- 改动文件清单：
  - `src/data/tech.ts`：alloy_eff_2 前置改为 ion_casting；data_eff_2 前置
    改为 neural_arch + holographic_computing 清理冗余前置；crystal_eff_1
    前置改为 crystal_growth + deep_crystal_mining 清理冗余前置
  - `src/data/buildings.ts`：4 个 T4 建筑产出提升（silicon_ring 7→15、
    stellar_forge 1.2→5、holographic_core 4→10、dark_singularity_well 0.1→
    0.25）
  - `src/stores/transcend.ts`：previewNegEntropy 首转保底 +1 负熵；
    t_offline cost 8→6、t_prestige_boost cost 10→8

### 验证

- vue-tsc -b：零错误
- npm run build：构建通过（947ms）
- npx vitest run：8 文件 67 用例全部通过

---

## v0.34 — 重构: 图标独立化 Phase 1（遗物/建筑图标去重）

**变更性质：重构（图标独立化 Phase 1）**
**开发时间：2026-07-13**

### 概述

新增 22 个 SVG 图标（17 遗物 `i-relic-*` + 5 科技 `i-tech-*`），依据已冻结
规范 `icon-design-spec.md v1.1` 设计，经架构 6 维度审核通过。遗物背包 20
个遗物不再全复用通用图标（仅 `r_omega` 保留 `i-mystery`）；军事分支
`military_basic`/`weapon_upg`/`armor_upg` 去除同 `i-army` 重复
（`adv_units` 保留 `i-army`）；晶体分支 `crystal_growth`/
`deep_crystal_mining` 去除同 `i-mine` 重复（`crystal_eff_1` 保留
`i-mine`，`crystal_eff_2` 的 `i-alloy` 交叉问题留待 Phase 2）。`icon` 为运
行时渲染字段，旧存档完全兼容，无需迁移。

### 变更明细

- 新增图标（22 个：17 遗物 + 5 建筑）：
  - `i-relic-energy-1`：r_energy_1（能量碎片）
  - `i-relic-energy-2`：r_energy_2（星核晶簇）
  - `i-relic-energy-3`：r_energy_3（戴森碎片）
  - `i-relic-crystal-1`：r_crystal_1（晶体碎屑）
  - `i-relic-crystal-2`：r_crystal_2（纯晶棱镜）
  - `i-relic-alloy-1`：r_alloy_1（合金碎屑）
  - `i-relic-alloy-2`：r_alloy_2（纳米合金）
  - `i-relic-data-1`：r_data_1（数据碎片）
  - `i-relic-data-3`：r_data_3（量子核心）
  - `i-relic-dark-1`：r_dark_1（暗物质微粒）
  - `i-relic-dark-2`：r_dark_2（暗物质凝聚体）
  - `i-relic-dark-3`：r_dark_3（暗物质奇点）
  - `i-relic-combat-1`：r_combat_1（战术手册）、r_combat_2（强化装甲板）
  - `i-relic-combat-2`：r_combat_3（灵能增幅器）
  - `i-relic-explore`：r_explore_1（星图残页）
  - `i-relic-singularity`：r_offline_1（时间胶囊）、r_prestige_1（奇点印
    记）
  - `i-relic-silence`：r_silence（沉默者之眼）
  - `i-tech-mil-basic`：military_basic（军事基础）
  - `i-tech-weapon`：weapon_upg（武器升级）
  - `i-tech-armor`：armor_upg（护甲升级）
  - `i-tech-crystal-grow`：crystal_growth（晶格培育）
  - `i-tech-deep-mine`：deep_crystal_mining（深晶开采）
- 改动文件清单：
  - `src/components/ui/Icons.vue`：+22 个 `<symbol>` 定义（17 遗物 + 5 科
    技）
  - `src/data/relics.ts`：19 个遗物的 `icon` 字段更新为独立 `i-relic-*`
    （仅 `r_omega` 保留 `i-mystery`）
  - `src/data/tech.ts`：5 个科技的 `icon` 字段更新：`military_basic`/
    `weapon_upg`/`armor_upg` 从 `i-army` 改为独立图标；`crystal_growth`/
    `deep_crystal_mining` 从 `i-mine` 改为独立图标
  - `package.json`：版本号 `0.33` → `0.34`

### 验证

- vue-tsc -b：零错误
- npm run build：构建通过
- npx vitest run：8 文件 67 用例全部通过

---

## v0.35 — 重构: 图标独立化 Phase 2（科技/分支/建筑图标去重）

**变更性质：重构（图标独立化 Phase 2）**
**开发时间：2026-07-13**

### 概述

新增 22 个 SVG 图标（10 科技 `i-tech-*` + 6 分支 `i-branch-*` + 6 建筑
`i-bld-*`），依据已冻结规范 `icon-design-spec.md v1.1` 设计，经架构 6 维度
审核通过。Icons.vue symbol 数从 61 增至 83。Phase 2 完成全部剩余图标去重工
作。`icon` 为运行时渲染字段，旧存档完全兼容，无需迁移。

### 变更明细

- 奇点科技去重：`prestige_boost`/`offline_enhance` 脱离 `i-restart`
- 探索科技去重：`explore_range_1`/`explore_range_2` 脱离 `i-map`
- 剩余科技去重：`energy_eff_2`/`alloy_eff_2`/`crystal_eff_2`/
  `research_speed`/`data_eff_2`/`dark_eff_1` 脱离资源图标
- 6 个科技分支独立化：military/exploration/crystallography/materials/
  computing/singularity 脱离资源图标
- 6 个建筑跨类别独立化：`core_extractor`/`dyson_swarm`/`refinery`/
  `nano_forge`/`ion_casting_plant`/`stellar_forge` 脱离解锁科技图标
- 新增图标（22 个：10 科技 + 6 分支 + 6 建筑）：
  - `i-tech-prestige-boost`：prestige_boost（奇点增益）
  - `i-tech-offline-enhance`：offline_enhance（离线增强）
  - `i-tech-explore-range-1`：explore_range_1（探索范围 I）
  - `i-tech-explore-range-2`：explore_range_2（探索范围 II）
  - `i-tech-energy-eff-2`：energy_eff_2（能量效率 II）
  - `i-tech-alloy-eff-2`：alloy_eff_2（合金效率 II）
  - `i-tech-crystal-eff-2`：crystal_eff_2（晶体效率 II）
  - `i-tech-research-speed`：research_speed（研究加速）
  - `i-tech-data-eff-2`：data_eff_2（数据效率 II）
  - `i-tech-dark-eff-1`：dark_eff_1（暗物质效率 I）
  - `i-branch-military`：military（军事学）
  - `i-branch-exploration`：exploration（探索学）
  - `i-branch-crystallography`：crystallography（晶脉学）
  - `i-branch-materials`：materials（材料学）
  - `i-branch-computing`：computing（计算学）
  - `i-branch-singularity`：singularity（奇点学）
  - `i-bld-core-extractor`：core_extractor（核心抽取器）
  - `i-bld-dyson-swarm`：dyson_swarm（戴森云）
  - `i-bld-refinery`：refinery（精炼厂）
  - `i-bld-nano-forge`：nano_forge（纳米锻造厂）
  - `i-bld-ion-casting`：ion_casting_plant（离子铸造站）
  - `i-bld-stellar-forge`：stellar_forge（星际熔炉）
- 改动文件清单：
  - `src/components/ui/Icons.vue`：+22 个 `<symbol>` 定义（10 科技 + 6 分
    支 + 6 建筑），symbol 数 61→83
  - `src/data/tech.ts`：10 个科技的 `icon` 字段更新为独立 `i-tech-*`；6 个
    分支的 `icon` 字段更新为独立 `i-branch-*`
  - `src/data/buildings.ts`：6 个建筑的 `icon` 字段更新为独立 `i-bld-*`
  - `package.json`：版本号 `0.34` → `0.35`

### 验证

- vue-tsc -b：零错误
- npm run build：构建通过
- npx vitest run：8 文件 67 用例全部通过

---

## v0.36 — 重构: 图标独立化 Phase 3（据点/兵种去重 + Icons facade 拆分）

**变更性质：重构（图标独立化 Phase 3 + facade 拆分）**
**开发时间：2026-07-13**

### 概述

新增 5 个 SVG symbol（83→88），完成图标独立化 Phase 3 收尾工作。同时对
Icons.vue 进行 facade 工程重构，将单体大组件拆分为 7 个子组件，运行时行为
不变，8 个 view 引用零改动。`icon` 为运行时渲染字段，旧存档完全兼容，无需
迁移。

### 变更明细

- 新增图标（5 个 symbol，83→88）：
  - `i-stronghold-raider`：掠夺者据点（原复用 i-army）
  - `i-stronghold-beast`：异兽据点（原复用 i-core）
  - `i-stronghold-ruin`：废墟据点（原复用 i-mystery）
  - `i-stronghold-silencer`：静默者据点（原复用 i-core）
  - `i-unit-psionic`：灵能兵（原复用 i-psionic）
- 据点类型独立化：4 种据点类型 + 8 个据点实例共 12 处 icon 引用脱离
  `i-army`/`i-core`/`i-relic`/`i-mystery`，改用独立的 `i-stronghold-*` 图
  标。保留说明：`i-relic` symbol 保留，仍被导航与 RelicView 兑底引用；
  `i-mystery` symbol 保留，仍被 r_omega 遗物占用
  - 涉及文件：`src/data/pve.ts`
- 兵种图标分离：psionic 兵种的 icon 从 `i-psionic` 改为独立的
  `i-unit-psionic`。旧 `i-psionic` symbol 保留于 IconsUnit.vue（无悬空引用
  风险）。
  - 涉及文件：`src/data/units.ts`
- 工程重构（Icons facade 拆分）：将原 Icons.vue 单体大组件拆分为 7 个子组
  件 + 1 个 index.ts barrel 导出。`Icons.vue` 重构为 facade 薄外壳：组合 7
  子组件，对外接口不变。8 个 view（HomeView/BuildView/TechView/MapView/
  ArmyView/BattleView/RelicView/PrestigeView）及布局组件的 `import Icons`
  引用零改动，运行时渲染行为与重构前完全一致。
  - 新建目录：`src/components/ui/icons/`
  - 子组件与 symbol 数：`IconsBase.vue` 13（基础 UI 图标（导航/操
    作/通用））、`IconsResource.vue` 4（资源图标）、`IconsBuilding.vue` 22
    （建筑图标）、`IconsTech.vue` 21（科技 + 分支图标）、`IconsRelic.vue`
    19（遗物图标）、`IconsStronghold.vue` 4（据点类型图标（Phase 3 新
    增））、`IconsUnit.vue` 5（兵种图标（含 Phase 3 新增
    i-unit-psionic））、`index.ts` —（barrel 导出 7 子组件）、合计 88
- 改动文件清单：
  - `package.json`：版本号 `0.35` → `0.36`
  - `src/components/ui/Icons.vue`：重构为 facade 薄外壳，组合 7 子组件
  - `src/components/ui/icons/`：新建目录 — 7 子组件（IconsBase/Resource/
    Building/Tech/Relic/Stronghold/Unit）+ index.ts
  - `src/data/pve.ts`：4 类型 + 8 实例共 12 处 icon 引用改为
    `i-stronghold-*`
  - `src/data/units.ts`：psionic icon 改为 `i-unit-psionic`

### 验证

- symbol 分布校验：IconsBase 13、IconsResource 4、IconsBuilding 22、
  IconsTech 21、IconsRelic 19、IconsStronghold 4、IconsUnit 5、合计 88
- vue-tsc -b：零错误
- npm run build：构建通过
- npx vitest run：8 文件 67 用例全部通过
- symbol 总数校验：88 全唯一无悬空引用

---

## v0.37 — 重构: 旧图标统一化（39 个规范对齐 + 3 个零引用删除）

**变更性质：重构（旧图标统一化）**
**开发时间：2026-07-14**

### 概述

对 Icons 体系内 39 个原始旧图标（Phase 0~3 完成后遗留的非独立化图标）按规
范 `docs/icon-design-spec.md` v2.0 进行统一化处理：36 个重命名为
`i-{category}-{name}` 格式（新增 nav/res/ui 三个类别前缀），6 个视觉微调
（安全边距拉回 2-20 / 坐标取整），删除 3 个零引用图标
（i-settings/i-close/i-psionic），规范从 v1.1 升级至 v2.0。`icon` 为运行时
渲染字段，旧存档完全兼容，无需迁移。

### 变更明细

- 图标重命名（36 个，新增 nav/res/ui 类别前缀）：
  - 导航类 → `i-nav-*`（7 个）：i-home→i-nav-home、i-build→i-nav-build、
    i-tech→i-nav-tech、i-map→i-nav-explore、i-army→i-nav-army、i-relic→
    i-nav-relic、i-restart→i-nav-prestige
  - 资源类 → `i-res-*`（5 个）：i-energy→i-res-energy、i-mine→
    i-res-crystal、i-alloy→i-res-alloy、i-data→i-res-data、i-core→
    i-res-dark
  - UI 交互类 → `i-ui-*`（4 个）：i-arrow-right→i-ui-arrow-right、i-check→
    i-ui-check、i-sword→i-ui-sword、i-more→i-ui-more
  - 建筑类 → `i-bld-*`（16 个）：i-reactor→i-bld-reactor、
    i-crystal-nursery→i-bld-crystal-nursery、i-deep-drill→
    i-bld-deep-drill、i-silicon-ring→i-bld-silicon-ring、i-dark-detector→
    i-bld-dark-detector、i-lab→i-bld-lab、i-quantum→i-bld-quantum、
    i-neural-hub→i-bld-neural-hub、i-holo-core→i-bld-holo-core、
    i-dark-capture→i-bld-dark-capture、i-dark-well→i-bld-dark-well、
    i-dyson→i-bld-dyson、i-refinery→i-bld-refinery、i-nano-forge→
    i-bld-nano-forge、i-ion-casting→i-bld-ion-casting、i-stellar-forge→
    i-bld-stellar-forge
  - 兵种类 → `i-unit-*`（3 个）：i-assault→i-unit-assault、i-guard→
    i-unit-guard、i-heavy→i-unit-heavy
  - 保留原名（2 个）：i-mystery（r_omega 遗物专用，无重命名必要）
- 视觉微调（6 个图标）：
  - 按统一化梳理的合规矩阵，6 个坐标超规格的旧图标进行微调（仅调整超规格
    坐标，其余维度不变）：
  - i-mine → i-res-crystal：安全边距拉回 2-20
  - i-relic → i-nav-relic：安全边距拉回 2-20
  - i-crystal-nursery → i-bld-crystal-nursery：安全边距拉回 2-20
  - i-holo-core → i-bld-holo-core：安全边距拉回 2-20
  - i-lab → i-bld-lab：安全边距拉回 2-20
  - i-sword → i-ui-sword：坐标取整
- 零引用图标删除：i-settings、i-close、i-psionic 经全仓库引用扫描确认为零
  引用，直接删除 symbol 定义。
- 规范升级 v1.1 → v2.0（`docs/icon-design-spec.md`）：
  - 补充 nav/res/ui 三个类别前缀定义
  - 删除旧图标豁免条款（统一化后无旧图标）
  - 补充 45° 对角线坐标例外说明
  - 附录 A 勘误 4 处
- 引用影响：
  - symbol 总数：88 → 85（删 3）
  - 影响 12 个文件 58 处引用（11 源文件 + 1 测试文件）
  - `src/data/navigation.ts`：7 处引用
  - `src/data/buildings.ts`：10 处引用
  - `src/data/tech.ts`：16 处引用
  - `src/data/relics.ts`：1 处引用
  - `src/data/units.ts`：3 处引用
  - `src/stores/resources.ts`：5 处引用
  - `src/views/HomeView.vue`：5 处引用
  - `src/views/TechView.vue`：1 处引用
  - `src/views/MapView.vue`：2 处引用
  - `src/views/BattleView.vue`：1 处引用
  - `src/views/RelicView.vue`：1 处引用
  - `src/views/PrestigeView.vue`：1 处引用
  - `src/components/layout/BottomNav.vue`：1 处引用
  - `src/lib/storage.test.ts`：1 处引用
  - 合计 58 处引用
- 改动文件清单：
  - `package.json`：版本号 `0.36` → `0.37`
  - `src/components/ui/icons/IconsBase.vue`：11 symbol 重命名 +
    i-settings/i-close 删除 + i-sword 视觉微调
  - `src/components/ui/icons/IconsResource.vue`：4 symbol 重命名 + i-mine
    视觉微调
  - `src/components/ui/icons/IconsBuilding.vue`：15 symbol 重命名 + 4 视觉
    微调（crystal-nursery/holo-core/lab）
  - `src/components/ui/icons/IconsRelic.vue`：1 symbol 重命名 + i-relic 视
    觉微调
  - `src/components/ui/icons/IconsUnit.vue`：3 symbol 重命名 + i-psionic
    删除
  - `src/data/navigation.ts`：7 处引用更新
  - `src/data/buildings.ts`：10 处引用更新
  - `src/data/tech.ts`：16 处引用更新
  - `src/data/relics.ts`：1 处引用更新
  - `src/data/units.ts`：3 处引用更新
  - `src/stores/resources.ts`：5 处引用更新
  - `src/views/HomeView.vue`：5 处引用更新
  - `src/views/TechView.vue`：1 处引用更新
  - `src/views/MapView.vue`：2 处引用更新
  - `src/views/BattleView.vue`：1 处引用更新
  - `src/views/RelicView.vue`：1 处引用更新
  - `src/views/PrestigeView.vue`：1 处引用更新
  - `src/components/layout/BottomNav.vue`：1 处引用更新
  - `src/lib/storage.test.ts`：1 处引用更新
  - `docs/icon-design-spec.md`：规范 v1.1 → v2.0
  - `docs/audits/old-icon-unification-audit.md`：统一化梳理记录（新增）
  - `docs/old-icon-visual-tweaks.md`：视觉微调符号文档（新增）

### 验证

- symbol 分布：IconsBase 11、IconsResource 4、IconsBuilding 22、IconsTech
  21、IconsRelic 19、IconsStronghold 4、IconsUnit 4，合计 85
- vue-tsc -b：零错误
- npm run build：构建通过（132 modules, 842ms）
- npx vitest run：8 文件 67 用例全部通过
- symbol 总数校验：85 全唯一无悬空引用

---

## v0.38 — 重构: 代码瘦身工程

**变更性质：重构（代码瘦身，功能不变）**
**开发时间：2026-07-15**

### 概述

6 项代码瘦身改动，目标为保持功能不变前提下让代码更整洁简洁。按风险递增顺序
执行，每步独立验证。总体成果：JS gzip -3.7%、CSS gzip -35%、遗物存档体积
-71%、运行时依赖 -1、开发依赖 -1。

### 变更明细

- 移除 dayjs（零引用依赖清理）：
  - 涉及文件：`package.json`
  - 改动：移除 `dayjs` 依赖（项目源码中无任何 import 引用）
  - 影响：运行时依赖 6→5
- 移除 Tailwind CSS：
  - 涉及文件：`package.json`、`vite.config.ts`、`src/style.css`、
    `src/components/layout/SideNav.vue`、
    `src/components/layout/BottomNav.vue`、
    `src/components/layout/TopBar.vue`、
    `src/components/layout/AppShell.vue`
  - 移除 `@tailwindcss/vite` 插件和依赖
  - `style.css` 中 `@theme` 块转换为 `:root` CSS 变量定义
  - 补全 Preflight Reset 规则（h1-h6/img/svg/video/canvas/a/select/
    border:0 solid 等）
  - 导航组件中 Tailwind 响应式类（`hidden`/`md:flex`/`md:hidden`）改为
    `useBreakpoint` + `v-if` 原生 CSS
  - CSS gzip: 5.2→3.3KB（-36%）
- 提取跨视图重复 CSS 为全局工具类：
  - 涉及文件：`src/style.css`、各视图 Vue 文件
  - 提取 9 个全局工具类到 `style.css`：`.page-title`、`.page-sub`、
    `.section-title`、`.card`、`.stat`、`.time-tag`、`.empty-msg`、
    `.glow-core`、`.font-display`/`.font-mono`
  - 各视图中匹配的重复 CSS 声明改为使用全局类
  - 保留各视图的变体覆盖（如不同颜色的 `.page-title`）
  - CSS gzip ~3.4KB
- 遗物存档精简：
  - 涉及文件：`src/data/relics.ts`、`src/lib/storage.ts`、
    `src/stores/relics.ts`、`src/stores/game.ts`、
    `src/lib/save-migrate.ts`
  - `RelicSaveData.owned` 从完整字段（9 字段：id/name/desc/rarity/icon/
    effects/source/instanceId/obtainedAt）精简为 3 字段
    （id/instanceId/obtainedAt）
  - `src/data/relics.ts` 新增 `getRelicById()` 函数
  - `src/stores/relics.ts` serialize 只写 3 字段；hydrate 从 RELIC_POOL 按
    id 补全完整字段，旧格式完整字段降级兼容（id 在 RELIC_POOL 中找不到时保
    留旧数据）
  - SAVE_VERSION 3→4，`save-migrate.ts` 新增 v3→v4 迁移条目（hydrate 自动
    兼容，无需显式转换）
  - 遗物存档体积 ~280B/条 → ~80B/条（-71%）
- 加密模块精简：
  - 涉及文件：`src/lib/storage.ts`、`src/stores/game.ts`、
    `src/lib/save-migrate.ts`、`src/lib/storage.test.ts`
  - 移除 XOR 流密码 + CBC 反馈 + 密钥片段混淆 + xorshift32 PRNG（~130 行）
  - 替换为 Base64 编码（~40 行），导出前缀 SCE- → SCB-
  - 保留 FNV-1a 校验和（localStorage 备份防篡改）
  - 导入时兼容旧 SCE- 前缀（尝试 Base64 解码，旧 XOR 密文无法解码为合法
    JSON 会返回 invalid）
  - `validateSaveData` / `_isObject` / `_isRecord` 校验函数保留
  - SAVE_VERSION 4→5，`save-migrate.ts` 新增 v4→v5 迁移条目（存档结构无变
    化，仅导出格式变更）
  - storage.ts 367→259 行（-29%）
  - 测试更新：前缀 SCE- → SCB-、版本 3 → 5、RelicSaveData 精简格式
- Modal 组件提取：
  - 涉及文件：`src/components/ui/ModalOverlay.vue`（新建）、
    `src/views/ArmyView.vue`、`src/views/BattleView.vue`、
    `src/views/PrestigeView.vue`
  - 新增 `ModalOverlay.vue` 组件：封装 `<transition name="fade">` +
    `.modal-overlay` + `.modal` 容器 + `useFocusTrap` + `role="dialog"` +
    `aria-modal`
  - Props：`modelValue`(v-model 双绑)、`ariaLabel`、`modalClass`(如
    victory/defeat)
  - Events：`update:modelValue`、`overlayClick`(点击遮罩)
  - Slot：默认 slot 传入弹窗内容
  - ArmyView：1 个弹窗改为 ModalOverlay
  - BattleView：2 个弹窗各用独立 ModalOverlay 实例（解决原共用 modalRef 问
    题）
  - PrestigeView：2 个弹窗各用独立 ModalOverlay 实例
  - 各视图移除 `import { useFocusTrap }` 和
    `const modalRef = ref<HTMLElement | null>(null)` 等样板代码
  - 各视图 scoped CSS 中 `.modal` 基础定义移除（由 ModalOverlay scoped CSS
    承担）
- 构建产物对比：
  - JS gzip：84.5 KB → 81.4 KB，-3.7%
  - CSS gzip：5.2 KB → 3.4 KB，-35%
  - 运行时依赖：6 → 5，-1 (dayjs)
  - 开发依赖：11 → 10，-1 (@tailwindcss/vite)
  - storage.ts 行数：367 → 259，-29%
  - 遗物存档体积/条：~280B → ~80B，-71%
- 改动文件清单：
  - `package.json`：版本号 0.37→0.38；移除 dayjs + @tailwindcss/vite
  - `vite.config.ts`：移除 @tailwindcss/vite 插件
  - `src/style.css`：@theme→:root；补全 Preflight Reset；新增全局工具类
  - `src/data/relics.ts`：新增 getRelicById()
  - `src/lib/storage.ts`：加密精简(XOR→Base64)；RelicSaveData 精简
  - `src/stores/relics.ts`：serialize/hydrate 精简 + 旧格式降级
  - `src/stores/game.ts`：SAVE_VERSION 3→5
  - `src/lib/save-migrate.ts`：v3→v4→v5 迁移条目
  - `src/lib/storage.test.ts`：测试更新(前缀/版本/存档格式)
  - `src/components/ui/ModalOverlay.vue`：新建
  - `src/views/ArmyView.vue`：ModalOverlay + CSS 去重
  - `src/views/BattleView.vue`：ModalOverlay + CSS 去重
  - `src/views/PrestigeView.vue`：ModalOverlay + CSS 去重
  - `src/components/layout/SideNav.vue`：移除 Tailwind class
  - `src/components/layout/BottomNav.vue`：移除 Tailwind class
  - `src/components/layout/TopBar.vue`：移除 Tailwind class
  - `src/components/layout/AppShell.vue`：移除 Tailwind class
- 兼容性：
  - SAVE_VERSION 3→5（跨版本迁移链完整）
  - v3→v4：遗物存档精简，hydrate 自动补全 + 旧格式降级
  - v4→v5：导出格式变更（SCE-→SCB-），线上存档（IndexedDB/localStorage）不
    受影响
  - 旧 SCE- 导出码无法再导入（XOR 密钥已移除），返回 invalid

### 验证

- vite build：构建通过
- npx vitest run：8 文件 67 用例全部通过

---

## v0.39 — UI: 主界面优化

**变更性质：UI（主界面优化）**
**开发时间：2026-07-15**

### 概述

主界面（HomeView）重构，消除信息冗余、提升首屏信息密度、新增活跃事件反馈和
动态推荐。无数据结构变更，旧存档完全兼容，无需迁移。

### 变更明细

- 移除重复产出统计区：
  - 删除 `stats-grid` 区块（5 资源产出速率卡片），消除与 TopBar 的信息三重
    冗余（TopBar 已展示 5 资源数量+速率，stats-grid 再次展示同样数据）
  - hero 区核心视觉改为展示全部 5 种资源：中心显示能量数值+产出速率，4 个
    资源节点（晶体/合金/数据/暗物质）以药丸标签环绕核心外侧，各带图标+数值
- 快捷操作改为情境推荐：原静态快捷操作（建造/研究/探索/部队）与底部导航完
  全重复，改为动态情境推荐；推荐内容实时计算：可升级建筑数量、可研究科技数
  量、待探索星域数、训练中队列；无推荐时回退为默认 2 条（建造/研究）
- 核心视觉缩小 + 文明概况上移：核心视觉从 200×200px 缩小至 160×160px（桌面
  端 180px），首屏空间释放；文明概况区块从页面底部移至活跃事件之后，进度数
  据优先可见
- 新增活跃事件条：实时显示当前活跃事件：可升级建筑、可研究科技、探索进度、
  训练进度；进行中事件显示进度条（底部 2px 彩色条，百分比驱动）；可操作事
  件点击跳转对应页面；最多显示 4 条，优先显示进行中的事件
- 核心光晕动态缩放：核心光晕大小随能量值对数缩放（48px~120px）；低能量时小
  光晕，高能量时光晕增大变亮，提供视觉正反馈
- 改动文件清单：
  - `src/views/HomeView.vue`：全面重构：移除 stats-grid、hero 区 5 资源环
    绕、新增活跃事件条、文明概况上移、快捷操作改情境推荐、核心光晕动态缩放
  - `package.json`：版本号 0.38→0.39

### 验证

- vue-tsc -b：零错误
- vite build：构建通过
- npx vitest run：8 文件 67 用例全部通过

---

## v0.40 — UI: 主界面焕新（基础规范建设 + 核心区重构）

**变更性质：UI（主界面焕新 16 项）**
**开发时间：2026-07-16**

### 概述

主界面（HomeView）全面焕新，合并基础规范建设（8 项）与核心区重构（8 项）两
个阶段共 16 项改动，整体定调从「深色 SaaS 工具」转向「沉浸式星际指挥台」。
覆盖四个维度：信息架构去冗余、视觉规范体系化、Hero 核心区重构、桌面端双列
布局。无数据结构变更，旧存档完全兼容，无需迁移。

### 变更明细

- 基础规范建设（8 项）：
  - Hero 去环绕资源节点：移除 Hero 区 4 个资源节点环绕展示（晶体/合金/数
    据/暗物质），资源展示统一交由 TopBar 承担，消除同屏信息重复；Hero 聚焦
    核心能量值与产出率
  - SideNav 去转生次数：侧边栏底部移除转生次数显示（文明概况中已包含），仅
    保留负熵
  - 表层明度梯度拉大：surface / elevated / border-line 三层明度差加大，深
    色界面下卡片与背景层次关系更清晰，嵌套层级肉眼可辨
  - 辅色饱和度对齐：
    - 辅色 quantum 从 `#34D399` 调整为 `#2EE6A0`，与其余辅色并排时视觉重量
      更均匀，消除"偏灰"感
    - 同步更新 buildings.ts / explore.ts / tech.ts / resources.ts 中
      crystal 相关键色的 color 字段
  - 间距 Token 化（225 处）：建立 8 级间距变量（`--space-1` 至
    `--space-8`，4px 基准）；全项目 225 处硬编码间距统一引用 Token，卡片
    padding、模块 gap 不再各自为政
  - 字号 Token 化（156 处）：建立 7 级字号变量（`--text-xs` 至
    `--text-display`，1:1.250 模数关系）；全项目 156 处硬编码字号统一引用
    Token，彻底消除 10px 以下过小字号，最小字号提升至 12px
  - 核心数值放大：核心能量值字号提升至 31px，大于页面标题（20px），成为全
    页绝对视觉焦点
  - 图标尺寸 Token 化：6 种散落图标尺寸收敛为 4 级
    （`--icon-xs/sm/md/lg`），全项目图标视觉比例统一
- 核心区重构（8 项）：
  - Hero 核心区重构放大：
    - 核心能量球放大至 200px（移动端）/ 240px（桌面端），视觉冲击力显著提
      升
    - 伪元素光晕渗透至 240px / 288px，核心光芒扩散到周围背景，营造能量场包
      裹感
    - 核心可点击，跳转建造页（支持键盘 Enter），从纯展示元素变为首屏操作入
      口
    - 产出率标注 14px 字号并带 `/s` 后缀，负值红色高亮
  - 行动队列合并：「活跃事件」与「推荐行动」合并为单一「行动队列」模块；两
    类视觉语言：进行中（左色条 + 进度条 + 脉冲动画）、可执行（图标色块 +
    hover 上浮）；4 条跳转路由（建造/科技/探索/部队）全部保留，逐条验证无
    丢失
  - 桌面端双列布局：
    - 内容区 max-width 从 720px 扩展至 1040px，大屏桌面端不再有大块留白
    - 桌面端（≥768px）Hero（左 40%）与行动队列（右 60%）并排展示
    - 文明概况指标从纵向堆叠改为 6 列横排
    - 移动端（<768px）自动退化为单列布局，改动仅在 HomeView 内生效，不影响
      其他页面
  - 字体断裂修复（方案 B）：品牌名「星核纪元」中英文并排时气质断裂修复；采
    用 PingFang SC Bold + letter-spacing 4px + text-shadow 方案，中英文气
    质统一，零新增资源加载
  - 按钮系统建立：统一四类按钮：`.btn-primary` / `.btn-secondary` /
    `.btn-accent` / `.btn-ghost`；全项目 19 个按钮完成迁移，padding /
    font-size / color 不再有魔法值，所有页面按钮风格一致
  - 文明概况视觉层次：关键指标（建筑/科技）增加左侧色条 + 数值着色（科技
    plasma 色 / 部队 alert 色）+ 图标，一眼可辨主次指标
  - Section 背景区分：行动队列区加入微妙底色 + 圆角 + 内边距，各区块边界清
    晰，不再"一片平"
  - Section-title 分级：主标题（17px + 完整左边线）与次标题（14px + 短左边
    线）视觉权重明确分层，信息层级一目了然
- 改动文件清单：
  - `src/views/HomeView.vue`：全面重构：Hero 去环绕资源节点 + 核心区放大
    200/240px + 光晕渗透 + 可点击跳转建造 + 产出率带 /s + 行动队列合并 +
    桌面端双列布局 + 文明概况视觉层次 + Section 背景区分 + Section-title
    分级 + Token 引用迁移
  - `src/style.css`：新增间距 Token（8 级）+ 字号 Token（7 级）+ 图标尺寸
    Token（4 级）+ 按钮系统四类 + 表层明度梯度调整 + 辅色 quantum 饱和度对
    齐 + Section-title 分级样式
  - `src/components/layout/SideNav.vue`：移除底部转生次数显示 + Token 引用
    迁移
  - `src/components/layout/AppShell.vue`：内容区 max-width 720→1040px 适配
    双列布局 + Token 引用迁移
  - `src/components/layout/TopBar.vue`：Token 引用迁移
  - `src/components/layout/BottomNav.vue`：Token 引用迁移
  - `src/components/layout/OfflineReport.vue`：Token 引用迁移 + 按钮系统迁
    移
  - `src/components/ui/CostTag.vue`：Token 引用迁移
  - `src/components/ui/ModalOverlay.vue`：Token 引用迁移
  - `src/components/ui/UpgradeCountdown.vue`：Token 引用迁移
  - `src/views/BuildView.vue`：Token 引用迁移 + 按钮系统迁移
  - `src/views/TechView.vue`：Token 引用迁移 + 按钮系统迁移
  - `src/views/ArmyView.vue`：Token 引用迁移 + 按钮系统迁移
  - `src/views/MapView.vue`：Token 引用迁移 + 按钮系统迁移
  - `src/views/BattleView.vue`：Token 引用迁移 + 按钮系统迁移
  - `src/views/RelicView.vue`：Token 引用迁移 + 按钮系统迁移
  - `src/views/PrestigeView.vue`：Token 引用迁移 + 按钮系统迁移
  - `src/views/BattleView.test.ts`：按钮样式选择器适配
  - `src/App.vue`：Token 引用迁移
  - `src/data/buildings.ts`：crystal 扇区 color `#34D399`→`#2EE6A0`（辅色
    饱和度对齐）
  - `src/data/explore.ts`：inner 层 color `#34D399`→`#2EE6A0`
  - `src/data/tech.ts`：crystallography + exploration 分支 color `#34D399`
    →`#2EE6A0`
  - `src/stores/resources.ts`：crystal 资源 color `#34D399`→`#2EE6A0`
  - `package.json`：版本号 0.39→0.40
  - `deploy.py`：部署版本号同步

### 验证

- vue-tsc -b：零错误
- vite build：构建通过
- npx vitest run：8 文件 67 用例全部通过

---

## v0.41 — UI: 氛围与体验升级（16 项）

**变更性质：UI（氛围与体验升级 16 项）**
**开发时间：2026-07-16**

### 概述

延续 v0.40 主界面焕新，合并氛围体验与锦上添花两组共 16 项改动：前者聚焦沉
浸感与交互反馈，星云暗角、星点闪烁、核心环三态映射、交互反馈游戏化、
Elevation 三级系统、状态色语义、视觉动线引导等；补齐响应式断点、空状态引
导、路由跃迁光效、资源粒子动画等体验细节。新增 Token 仅 4 个
（--elevation-1/2/3 + --color-locked），锦上添花一组零新增全局 Token。无数
据结构变更，旧存档完全兼容，无需迁移。onboarding 已读状态使用 localStorage
独立存储，不影响存档。

### 变更明细

- 氛围与体验升级（10 项）：
  - 星点闪烁：背景星点添加随机闪烁动画，营造星空呼吸感
  - 资源变化高亮：资源数值变化时高亮反馈，产出/消耗直观可感
  - SideNav 可折叠：桌面端侧边导航支持折叠收起，释放内容区横向空间
  - TopBar pill 优化：顶部资源 pill 视觉优化，信息密度与可读性平衡
  - 星云暗角：主界面四角添加星云暗角效果，视觉聚焦中心区域，增强沉浸感
  - 核心环三态映射：核心能量球外环映射三种状态（探索/科技/能量），根据当前
    主导玩法动态切换视觉语义
  - 交互反馈游戏化：全局交互反馈升级：hover 上浮 + click 回弹 + flash 闪光 +
    核心脉动，操作手感向游戏化靠拢
  - Elevation 三级系统：新增 --elevation-1/2/3 三级阴影 Token，统一卡片/弹
    窗/浮层的层叠视觉语言
  - 状态色语义：新增 --color-locked 状态色 Token，锁定/未解锁状态统一色彩
    语义
  - 视觉动线引导 — Hero 光柱：Hero 区添加光柱效果，引导视觉动线从顶部向核
    心能量球聚焦
- 锦上添花（6 项）：
  - BottomNav 面板位置优化：移动端底部导航「更多」面板位置改为右对齐
    （right:0），宽度约束 min(160px, 100vw-16px)，避免小屏溢出
  - 快速操作入口：Hero 下方新增 4 个等宽快捷操作按钮，高频操作一键直达
  - 空状态 + 新手 onboarding 气泡：7 种空状态展示（建筑/科技/探索/部队/遗
    物/编队/战斗）+ 7 个新手引导气泡；使用 localStorage 持久化引导已读状
    态，不干扰老玩家
  - 四档响应断点 S/M/L/XL：建立 S/M/L/XL 四档响应式断点系统，各档位布局规
    则明确
  - 路由跃迁"空间跃迁"光效：路由切换时触发"空间跃迁"光效过渡，页面切换不再
    生硬
  - 资源产出粒子动画：资源产出时粒子向上飘浮动画，全局上限 15 个粒子，
    visibilitychange 时暂停以节省性能
- 改动文件清单：
  - `src/views/HomeView.vue`：星云暗角 + 核心环三态 + 交互反馈 + Hero 光柱 +
    快速操作入口 + 空状态 + 跃迁光效 + 粒子动画
  - `src/style.css`：Elevation 三级 Token + --color-locked + 暗角 + 星点闪
    烁 + 交互反馈动画 + 光柱 + 断点 + 跃迁光效
  - `src/components/layout/SideNav.vue`：可折叠
  - `src/components/layout/TopBar.vue`：pill 优化 + 资源变化高亮
  - `src/components/layout/BottomNav.vue`：面板位置优化（right:0 +
    min(160px,100vw-16px)）
  - `src/composables/useOnboarding.ts`：新建 — onboarding 引导状态管理
    （localStorage 持久化）
  - `src/composables/useResourceParticles.ts`：新建 — 资源粒子动画管理（全
    局上限 15、visibilitychange 暂停）
  - `src/components/ui/OnboardingBubble.vue`：新建 — 新手引导气泡组件
  - `package.json`：版本号 0.40→0.41
- Token 变更：新增 4 个全局 Token，锦上添花一组零新增：
  - `--elevation-1`：一级阴影（卡片）
  - `--elevation-2`：二级阴影（弹窗）
  - `--elevation-3`：三级阴影（浮层）
  - `--color-locked`：锁定/未解锁状态色

### 验证

- vue-tsc -b：零错误
- vite build：构建通过
- npx vitest run：8 文件 67 用例全部通过

---

## v0.42 — 修复: 代码评审修复（6 项 + 1 项误报）

**变更性质：修复（代码评审修复 6 项 + 1 项误报）**
**开发时间：2026-07-16**

### 概述

针对代码评审意见中的高严重度问题完成修复：6 项已修复（4 项前端代码 + 3 项
deploy.py 安全加固，其中 3 项安全加固同属一次提交）+ 1 项经核查为误报。构
建与测试验证全绿，暂缓部署未上线。

### 变更明细

- CSS `-var(--x)` 无效语法修复：4 处 CSS 使用 `-var(--x)` 语法取负值，CSS
  规范不支持此写法，浏览器解析失败导致相关负边距/负位移样式不生效。统一改
  为 `calc(-1 * var(--x))`，符合 CSS calc 函数规范。评审意见原列 3 处，前
  端在排查中额外发现第 4 处，一并修复
  - 涉及文件：`src/style.css`、`src/views/TechView.vue`、
    `src/components/ui/UpgradeCountdown.vue`、`src/views/PrestigeView.vue`
- BuildView 模板类名对齐：`BuildView.vue` 模板中使用 `lock_msg`（下划
  线），而 CSS 类名定义为 `lock-msg`（连字符），类名不匹配导致锁定提示样式
  不生效。模板 `lock_msg` → `lock-msg`，与 CSS 类名对齐。
  - 涉及文件：`src/views/BuildView.vue`
- RelicView 槽位满守卫：`RelicView.vue` 中遗物装备槽位满时 `findIndex` 返
  回 -1，未做 -1 守卫，后续直接用作索引访问数组导致运行时异常。增加 -1 守
  卫判断，槽位满时 toast 提示"槽位已满"，不再尝试装备。
  - 涉及文件：`src/views/RelicView.vue`
- deploy.py 凭据管理加固：移除源码中的明文凭据处理，改为从环境变量读
  取，缺失即退出并报错。
  - 涉及文件：`deploy.py`
- deploy.py SSH 策略加固：`deploy.py` 使用 `AutoAddPolicy`，首次连接未知主
  机时自动接受并写入 known_hosts，存在中间人攻击风险。改为
  `RejectPolicy`，拒绝未知主机连接，需提前在 known_hosts 中登记服务器指
  纹。
  - 涉及文件：`deploy.py`
- deploy.py rm -rf 路径校验：`deploy.py` 中 `rm -rf` 删除远端目录的路径无
  校验，异常路径（如空串、`/`、`/*`、相对路径等）可能导致误删。新增
  `validate_remote_dir` 函数对路径进行白名单校验，dry-run 自测 10 种异常路
  径全部拦截。
  - 涉及文件：`deploy.py`
- beforeunload 监听器（误报，无需修复）：评审意见列出 App.vue 缺少
  `beforeunload` 事件监听器。经核查，`beforeunload` 监听器在初始提交即已存
  在于 `App.vue` 中（v0.05 Bug 5 修复时引入），无需修复。
- 改动文件清单：
  - `src/style.css`：`-var(--x)` → `calc(-1 * var(--x))`
  - `src/views/TechView.vue`：`-var(--x)` → `calc(-1 * var(--x))`
  - `src/components/ui/UpgradeCountdown.vue`：`-var(--x)` →
    `calc(-1 * var(--x))`
  - `src/views/PrestigeView.vue`：`-var(--x)` → `calc(-1 * var(--x))`
  - `src/views/BuildView.vue`：`lock_msg` → `lock-msg`
  - `src/views/RelicView.vue`：findIndex -1 守卫 + toast
  - `deploy.py`：凭据改环境变量 + RejectPolicy + rm -rf 路径校验

### 验证

- vue-tsc -b：零错误
- vite build：构建成功
- npx vitest run：8 文件 67/67 用例全部通过
- deploy.py dry-run 路径校验：10 种异常路径全部拦截

---

## v0.43 — 修复: 代码评审修复补丁（20 项：前端 UI 层 9 项 + 逻辑/工程层 11 项）

**变更性质：修复（代码评审修复 20 项）**
**开发时间：2026-07-16**

### 概述

针对代码评审意见完成 20 项修复，覆盖前端 UI 层 9 项与逻辑/工程层 11 项。由
于 v0.42（前次修复）此前暂缓部署未上线，本次部署实际从 v0.41 直接跳到
v0.43，v0.42 的 6 项修复一并上线。

### 变更明细

- 前端 UI 层（9 项）：
  - TopBar.vue computed 内突变 reactive：`TopBar.vue` 的 `resourceList`
    computed 内对 `flashState`/`prevAmounts` 既读又写，在 computed 中产生
    副作用，违反 Vue 响应式最佳实践，可能导致无限重算或状态不一致。改为
    `watchEffect` + `ref`，消除 computed 内副作用。
    - 涉及文件：`src/components/layout/TopBar.vue`
  - BattleView.vue stronghold computed 非空断言：`BattleView.vue` 的
    `stronghold` computed 使用 `!` 非空断言，类型系统声称非空但实际可能为
    undefined，构成"类型谎言"。返回类型改为 `StrongholdDef | undefined`，
    模板侧 `v-if` 已守护。
    - 涉及文件：`src/views/BattleView.vue`
  - ModalOverlay.vue script 混用：`ModalOverlay.vue` 同时使用
    `<script setup>` 和 `<script>` 两个脚本块，混用模式增加维护复杂度。合
    并为单一 `<script setup>` 块。
    - 涉及文件：`src/components/ui/ModalOverlay.vue`
  - 导航 active 项补 aria-current：`SideNav.vue` 和 `BottomNav.vue` 的
    active 导航项未设置 `aria-current="page"` 属性，辅助技术无法识别当前页
    面位置。（评审意见只提 SideNav，BottomNav 同样缺失已一并修复）。active
    项补 `aria-current="page"`。
    - 涉及文件：`src/components/layout/SideNav.vue`、
      `src/components/layout/BottomNav.vue`
  - resources store allMeta 类型不精确：`resources` store 的 `allMeta` 类
    型定义不精确，使用方被迫断言，类型安全链断裂，影响 `OfflineReport.vue`
    和 `BattleView.vue`。导出 `ResourceMeta` 接口，`allMeta` 类型放宽为
    `Record<string, ResourceMeta>`，根因修复，使用方无需再断言。
    - 涉及文件：`src/stores/resources.ts`、
      `src/components/layout/OfflineReport.vue`、
      `src/views/BattleView.vue`
  - 消除 as any（前端部分）：前端视图中多处使用 `as any` 绕过类型检查，类
    型安全形同虚设。消除 `as any` 共 7 处，`TopBar.vue`（3 处）、
    `BattleView.vue`（2 处）、`OfflineReport.vue`（2 处），改为精确类型。
    - 涉及文件：`src/components/layout/TopBar.vue`、
      `src/views/BattleView.vue`、
      `src/components/layout/OfflineReport.vue`
  - AppShell.vue 静态 span 星点改 v-for：`AppShell.vue` 中 6 个装饰性星点
    使用 6 个静态 `<span>` 硬编码，`.s1` 至 `.s6` 规则各自独立，冗余且难维
    护。改为 `v-for` 生成，`style.css` 移除 `.s1` 至 `.s6` 规则。
    - 涉及文件：`src/components/layout/AppShell.vue`、`src/style.css`
  - style.css 导航响应式注释更新：`style.css` 中导航响应式相关注释提到
    Tailwind，但 Tailwind 已移除，注释过时误导。更新注释为
    `useBreakpoint`。
    - 涉及文件：`src/style.css`
  - index.html 补充 OG/Twitter meta 标签：`index.html` 缺少 Open Graph /
    Twitter Card meta 标签，社交分享无预览。补充 `og:title`/
    `og:description`/`og:type`/`og:image` + `twitter:card`/
    `twitter:title`/`twitter:description`/`twitter:image`。
    - 涉及文件：`index.html`
- 逻辑/工程层（11 项）：
  - exploration.ts applyTick 多探索到期仅处理一个：`exploration.ts` 的
    `applyTick` 在 `for` 循环内遇到第一个到期探索节点即 `return`，导致同一
    tick 内多个探索同时到期时仅处理第一个，其余被延迟到下一 tick。收集所有
    到期节点逐个处理并累积奖励返回。
    - 涉及文件：`src/stores/exploration.ts`
  - doComputeOfflineGains 未更新 lastSaveTime：`game.ts` 的
    `doComputeOfflineGains` 在无 `elapsedOverride` 参数时不更新
    `lastSaveTime`，导致离线收益补算后下次存档时间基准错位。统一在函数末尾
    更新 `lastSaveTime`。
    - 涉及文件：`src/stores/game.ts`
  - relics.ts as any（后端部分）：`relics.ts` 中 `const legacy = r as any`
    绕过类型检查。改为 `Partial<RelicDef>`。
    - 涉及文件：`src/stores/relics.ts`
  - package-lock.json 与 pnpm-lock.yaml 共存：项目同时存在
    `package-lock.json` 和 `pnpm-lock.yaml`，锁文件冲突可能导致依赖解析不
    一致。确认项目使用 pnpm，删除 `package-lock.json`，`package.json` 添加
    `"packageManager": "pnpm@9.15.4"`。
    - 涉及文件：`package.json`（删除 `package-lock.json`）
  - IndexedDB 写读无 checksum：`storage.ts` 的 IndexedDB 主存储写读无校验
    和，数据损坏无法检测。`writeSave` 统一 `{d,c}` 格式（数据 + 校验和），
    `readSave` 新增 `_parseStored` 兼容新旧格式。
    - 涉及文件：`src/lib/storage.ts`
  - _parseBackup 补调 validateSaveData：`_parseBackup` 在解析新旧格式备份
    时未调用 `validateSaveData`，损坏数据可能被静默接受。新旧格式路径均补
    调 `validateSaveData`。
    - 涉及文件：`src/lib/storage.ts`
  - validateSaveData 新增内容范围校验：`validateSaveData` 仅校验字段类型和
    结构，不校验内容范围，负数资源、无效 ID 等异常值可通过。新增内容范围校
    验，`amounts`/`totals` 非负有限、`levels`/`completed`/`military`/
    `combat`/`exploration`/`relics`/`transcend` 有效 ID 与结构。
    - 涉及文件：`src/lib/storage.ts`
  - vitest coverage 配置：`vitest.config.ts` 无 coverage 配置，无法生成测
    试覆盖率报告。添加 coverage 配置（v8 provider），`package.json` 添加
    `test:cov` script。
    - 涉及文件：`vitest.config.ts`、`package.json`
  - game.test.ts 断言静默通过：`game.test.ts` 中
    `if (game.canTranscend())` 包裹断言，条件不满足时断言被跳过，测试静默
    通过而非失败。改为显式断言，条件不满足即报失败。
    - 涉及文件：`src/stores/game.test.ts`
  - vite.config.ts 构建优化：`vite.config.ts` 无 sourcemap 配置、无手动分
    包，`server.host` 设为 `true` 暴露到所有网络接口。添加
    `build.sourcemap` + `manualChunks` 函数分包（vue/decimal/storage），
    `server.host` 从 `true` 改为 `'127.0.0.1'`。
    - 涉及文件：`vite.config.ts`
  - start-dev.sh 健壮性加固：`start-dev.sh` 无 `set -e`、路径用 `pwd` 绝对
    定位、包管理器调用用 `npm` 而非 `pnpm`。添加 `set -e`、路径改用
    `BASH_SOURCE` 相对定位、`npm` → `pnpm`。
    - 涉及文件：`start-dev.sh`
- 改动文件清单：
  - `src/components/layout/TopBar.vue`：computed 副作用改 watchEffect +
    ref；消除 3 处 as any
  - `src/views/BattleView.vue`：stronghold 返回 | undefined；消除 2 处 as
    any
  - `src/components/ui/ModalOverlay.vue`：合并 script setup
  - `src/components/layout/SideNav.vue`：补 aria-current="page"
  - `src/components/layout/BottomNav.vue`：补 aria-current="page"
  - `src/stores/resources.ts`：导出 ResourceMeta 接口，allMeta 类型精确化
  - `src/components/layout/OfflineReport.vue`：使用方无需断言；消除 2 处
    as any
  - `src/components/layout/AppShell.vue`：6 个静态 span 改 v-for
  - `src/style.css`：移除 .s1~.s6 规则；注释更新为 useBreakpoint
  - `index.html`：补充 OG/Twitter meta 标签
  - `src/stores/exploration.ts`：applyTick 多探索到期全部处理
  - `src/stores/game.ts`：doComputeOfflineGains 统一更新 lastSaveTime
  - `src/stores/relics.ts`：`r as any` → Partial<RelicDef>
  - `package-lock.json`：删除（与 pnpm-lock.yaml 冲突）
  - `package.json`：添加 packageManager 字段；添加 test:cov script
  - `src/lib/storage.ts`：writeSave {d,c} 格式 + readSave _parseStored；
    _parseBackup 补调 validateSaveData；validateSaveData 内容范围校验
  - `vitest.config.ts`：coverage 配置（v8 provider）
  - `src/stores/game.test.ts`：显式断言替代 if 包裹
  - `vite.config.ts`：sourcemap + manualChunks + server.host 127.0.0.1
  - `start-dev.sh`：set -e + BASH_SOURCE + pnpm
- 安全提醒：v0.42 已修复 `deploy.py` 中的凭据硬编码问题（改为环境变量
  读取）。

### 验证

- vue-tsc -b：零错误
- vite build：构建成功
- npx vitest run：67/67 用例全部通过

---

