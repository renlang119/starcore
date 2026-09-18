# 星核纪元 · 版本更新日志（历史存档 v0.36-v0.70）

> 本文件为历史存档（35 个版本），不再更新；后续条目见
> [changelog-v0.71-v1.05.md](changelog-v0.71-v1.05.md)（v0.71-v1.05）与
> [changelog.md](changelog.md)（v1.06 起），更早条目见
> [changelog-v0.01-v0.35.md](changelog-v0.01-v0.35.md)（v0.01-v0.35）。
> 条目新 → 旧倒序。

---

## v0.70 — 功能: 遗物强化等级轴（instance 级 0–20 级）

**变更性质：功能（新玩法系统）**
**开发时间：2026-09-07**

### 概述

新增遗物强化系统：每件遗物实例可独立强化，等级 0–20 统一封顶，消耗能量按稀
有度分档的指数成本曲线（base × 1.5^(Lv−1)）逐级提升自身效果。定位为跨多轮
转生的长线养成目标，量级压在与转生无限树单节点 Lv8（≈+114%）同级，非
第二权力轴。

### 变更明细

- 数据层（data/relics.ts 新增强化参数与公式）：
  - MAX_RELIC_LEVEL = 20（统一封顶，不按稀有度分档）
  - ENHANCE_GAIN：主效果（production/combat/explore/offline）每级 0.04，
    prestige/cost 每级 0.01（与转生树「prestige_mult 不无限化」口径同理）
  - 成本 base×1.5^(Lv−1)：普通 1e6 / 稀有 5e6 / 史诗 2.5e7 / 传说 1.25e8
    （普通满级累计 ≈6.6e9 ≈ 0.66 轮单轮收入；传说满级 ≈8.3e11）
  - 效果放大统一公式 `v → 1 + (v−1) × (1 + g × Lv)`，同一公式覆盖正向放大
    与折扣加深（科技成本 −10% → 满级 −12%，负熵 ×2 → ×2.2）
- store 层（stores/relics.ts）：
  - OwnedRelic 增加 level 字段；enhance(instanceId) 原子操作（校验存在/未
    满级 → 扣能量 → level+1，任一失败零副作用）
  - 能量支出走注入通道 setRelicEnhanceSpendProvider（game store 接入
    resources.spend，与 slot provider / 训练槽 provider 同款跨 store 模
    式）
  - equippedEffects 在聚合时输出强化后效果副本（value 与 label 动态化），
    EffectSystem 零改动（沿用 v0.61 套装派生先例）；套装加成不受强化影响
- 存档（storage.ts）：owned 条目新增可选 level 字段（缺省 0），
  validateSaveData 兼容双格式并校验非负整数 ≤ 20；SAVE_VERSION 保持 7，旧
  档零迁移
- 视图（RelicView.vue）：图鉴卡强化后显示 Lv 徽章与强化后效果 label，卡面
  「强化」按钮打开强化面板（当前级/下一级预览/成本/强化 ×1），能量不足
  toast 提示且零副作用
- 数值规范 §八 增补强化轴梯度带与连乘实测封顶；满编（5 槽满 20 级）相对增
  益实测：攻 +51% / 防 +25% / 能量产出 +111%
- 兼容性：
  - 存档新增可选字段，旧档缺失默认 0 级；SAVE_VERSION 保持 7
  - 不改资源体系（消耗纯能量，暗物质仍为稀有通货）；不新增成就（成就 31 →
    33 于 v0.69 完成，扩展另计）

### 验证

- build（含 vue-tsc）+ vitest 29 文件 378 用例全绿（+15：强化公式/成本曲线
  /label 替换/原子扣费/满级与不存在拒绝/效果放大与套装不联动/序列化往返/视
  图面板三例/存档校验两例）；lint:check / format:check 零输出
- Playwright v061 遗物专项新增两组用例：强化流程（注档 Lv5 → 面板 → 强化
  Lv6 → 卡面徽章与 label 更新）与移动视口（开面板无溢出）

---

## v0.69 — 功能: 远征深度里程碑成就（31 → 33）

**变更性质：功能（成就扩展）**
**开发时间：2026-09-07**

### 概述

补强远征长线目标：新增深度里程碑成就两条（D10/D20），成就总数 31 → 33。深
度读远征历史最深层数现值（跨转生保留，hardReset 才清零），不新增存档字段，
SAVE_VERSION 保持 7，旧档兼容零迁移。

### 变更明细

- 成就定义新增 2 条（归入战斗里程碑分区）：
  - ach_battle_4「深渊开拓者」：无尽远征推进至 10 层，攻防 +5%
  - ach_battle_5「虚境征服者」：无尽远征推进至 20 层，攻防 +8%
- 成就 store 外部现值通道扩展：指标类型增加 expeditionBest，provider 由
  game store 注入 combat store 同名字段（v0.60 起，跨转生保留）
- 拿满成就面攻防加成连乘实测：1.05×1.08×1.12×1.02×1.05×1.08 ≈ ×1.469
  （+46.9%，原基线 +29.5%），数值规范 §十 同步回写并补远征成就口径注记
- README 与设定文档成就计数 31 → 33 同步
- 单元测试：store 测试新增深度阈值边界用例（9/10/20 三档 + 攻防连乘断
  言），provider 注入点全部补齐新参数；测试基线 29 文件 363 用例
- 兼容性：
  - 不新增存档字段（读现值判定），旧档成就字段缺失自动未开始，SAVE_VERSION
    保持 7
  - 成就页分区数据驱动，自动多两张卡，无布局改动

### 验证

- build（含 vue-tsc）+ vitest 29 文件 363 用例全绿；lint:check /
  format:check 零输出
- Playwright 回归：十一脚本 preview 全过；成就专项脚本新增远征里程碑组（注
  入深度 10 档验证解锁态与加成到账），六脚本成就数断言 31 → 33 同步

---

## v0.68 — 文档: 勘误与条目用语清理

**变更性质：文档（勘误）**
**开发时间：2026-09-07**

### 概述

清理此前遗留的三处文档偏差：测试注释破折号、changelog 用例数勘误、历史条目
旧编号引用清理。纯注释与文档修正，无逻辑/存档变化，SAVE_VERSION 保持 7。

### 变更明细

- exploration.test.ts 两处注释去除破折号，对齐全项目书写规范
- changelog v0.67 条目 TechView 用例数勘误：10 → 9（实测各视图
  8/9/9/10/12/6/10 合计 64，与条目标题一致，偏差仅此一处）
- changelog 历史条目（v0.51-v0.64）编号引用清理：变更标签统一为
  「变更性质」，v0.52/v0.64 条目的旧编号引用改写为语义化描述
- 历史存档（v0.01-v0.50）同步清理同类用语：旧编号引用、退役文档名、旧
  部署说明中的环境提示；两份 changelog 全文去破折号

### 验证

- build（含 vue-tsc）+ vitest 29 文件 362 用例全绿；lint:check
  /format:check 零输出

---

## v0.67 — 测试: 补齐七个视图单元测试，视图层测试缺口清零

**变更性质：测试（补强，无运行时行为与存档结构变化）**
**开发时间：2026-09-07**

### 概述

补齐视图层测试缺口：Build / Tech / Map / Relic / Army / Achievements /
Home 七个视图组件此前无单元测试（仅 BattleView / PrestigeView 有，其余靠
Playwright 回归脚本兜底）。本次新增 7 个测试文件 64 用例，9 个视图全部具备
组件级测试，测试基线由 22 文件 298 用例增至 29 文件 362 用例。

### 变更明细

1. **BuildView.test.ts**（8 用例）：挂载与扇区页签渲染（页签数/默认选中）/
   扇区切换列表联动 / 锁定卡「需要科技」提示 / 解锁卡产出与等级显示 /升级
   按钮禁用态 / 升级走原子操作（等级 +1 且资源扣减）/ 新手引导气泡显示与已
   读持久化
2. **TechView.test.ts**（9 用例）：挂载与「全部」分支全量渲染 / 分支筛选联
   动 / tier 升序排列 / available 与 locked 状态并存 / 前置提示 / 研究按钮
   随资源禁用 / 研究走原子操作（完成、扣资源、卡片转 completed 态、
   status-done 图标）/ 全部完成空状态 / 新手引导
3. **MapView.test.ts**（9 用例）：五层区块渲染（轨道带至恒星系层）与节点总
   数 / 首节点可探索、深层锁定提示 / 新档无已解锁据点、远征区块置灰（禁用
   态断言）/ 探索走原子操作（探索态、扣资源、进度条、toast）/节点完成后据
   点区块出现 / 攻克锚点后远征解锁与跳转 / 据点卡跳转 /全部完成空状态与 16
   据点全解锁
4. **RelicView.test.ts**（10 用例）：挂载（4 槽位、合成工坊、4 组套装行）/
   图鉴空状态 / 点卡装备到首个空槽、点槽卸下 / 当前效果区块 / 选材模式回填
   3 槽与材料稀有度提示 / 稀有度混选 toast 拒绝 / 合成成功（3 common → 1
   rare、材料消耗、产物弹窗）/ 不足 3 件按钮禁用 / 2 件同系激活 partial 套
   装 / 丢弃二次确认与已装备禁用
5. **ArmyView.test.ts**（12 用例）：挂载与战力面板 / 军事未解锁空状态引导
   /解锁后轻提示不遮挡单位卡（空态设计约束）/ 灵能者仍需进阶科技 /训练数量
   步进与任务入队（含资源扣减实值）/ 数量为 0 禁用 / 满槽禁用与提示文案 /
   编组页渲染 / 小数量全入直执行 / 大数量全入弹确认窗（确认前不入队、确认
   后执行）/ 编入撤出走 store 原子操作 / 编队选中态
6. **AchievementsView.test.ts**（6 用例）：挂载与汇总面板（0/31、未获得加
   成）/ 9 分类分区与 31 卡全渲染 / 全部未解锁时进度条齐备 / 解锁后时间戳
   与高亮态、汇总计数联动 / 加成汇总文案（全产出 +1%）/ 进度条宽度随终身计
   数增长
7. **HomeView.test.ts**（10 用例）：编排层五板块齐备（Hero/行动队列/快速操
   作/签到卡/概况）/ 概况统计项 / 核心能量值联动 / 点核心跳转建造页 /可执
   行行动项（新档可升级建筑）/ 探索进行中条目（0% 起步）/ 全资源清零 + 全
   探索完成后兜底入口（建造/研究）/ 待签到徽标与连击 0 / 签到后连击 1 / 周
   挑战三项渲染

- 测试组织：
  - 遵循既有组件测试约定：文件头 `@vitest-environment jsdom` 指令、真实
    Pinia store + 原子操作驱动（不 mock store）、Icons 组件 stub、
    vue-router 与 useFocusTrap mock、中文用例描述
  - 计数类断言采用动态值（BUILDINGS/TECHS/EXPLORE_NODES/UNITS/RELIC_SETS
    长度），数据规模漂移时测试自适配，不做硬编码
  - 涉及 UI 响应的断言严格等待 nextTick，规避响应式更新时序差异

### 验证

- `corepack pnpm test`：29 文件 362 用例全部通过
- `corepack pnpm build`（含 vue-tsc 类型检查）通过
- `lint:check` / `format:check` 零输出
- 未触碰运行时代码与数据契约，Playwright 回归脚本不受影响（v0.66 先例：纯
  测试版本免跑，UI 契约由既有断言覆盖）

---

## v0.66 — 测试: 补齐四个 store 单元测试与数值规范守恒断言

**变更性质：测试（补强 + 文档修正）**
**开发时间：2026-09-07**

### 概述

补齐测试缺口：resources / buildings / exploration / research 四个 store 此
前无单元测试（全游戏最底层的数值通道只被 game.test 间接覆盖）。新增 96 用
例，其中「数值规范守恒」组把 docs/游戏数值设定规范.md 的关键梯度固化为机器
断言，数值漂移即刻报错。

### 变更明细

1. **resources.test.ts**（21 用例）：初始状态 / gain 入 totals / spend 不
   足拒绝 /canAfford 等额边界（gte 语义）与未知键白名单 / spendCost 原子性
   /applyTick 速率推进与小数精度 / reset 含 keepDark 转生语义
   /serialize-hydrate 往返与容缺
2. **buildings.test.ts**（24 用例）：成本公式 ceil(base×growth^level) 逐资
   源验证 /大数等级精度 / 产出 = 每级 × 等级 × 乘数 / 解锁判定 /
   **规范守恒组**：增长率阶梯（1.18/1.15/1.13/1.10）、每级产出比 ≥×2（陷阱
   层防线）、跳层无倒挂（同扇区 Lv0 回本单调不减）、离子铸造站 v0.65
   修正口径
3. **exploration.test.ts**（20 用例）：前置链校验 / 扣费原子性 / 重复开始
   拒绝 /**完成时间锁定**（开始后 mult 变化不影响进行中探索）/ applyTick
   幂等 /旧档无 endTime 动态补算兼容 / getProgress 三点采样 / reset 与
   hydrate 白名单
4. **research.test.ts**（31 用例）：前置判定（单/多/跨分支深链）/
   unlockedSet 派生 /getMult 连乘与 extraEffects / getValue 累加 /
   techCostMult /**规范守恒组**：43 科技 8 分支、5 根科技、requires 零悬
   空、无循环依赖（拓扑排序全通过）、全研究后各资源乘数（能量 ×1.56 / 晶体
   ×1.82 / 合金 ×1.75 /数据 ×1.95 / 暗物质 ×2.1 / 攻防 ×1.56 / 探索
   ×4.095）、能量乘数最低口径、unlock 目标对照 BUILDINGS/UNITS 零悬空
5. **规范文档修正（§三）**：原「边际交叉深度 ≤80 级可达带内」表述与实测不
   符（晶体 T2→T3 交叉在 L≈125），替换为真正的硬约束「跳层无倒挂：同扇区
   Lv0 回本逐层单调不减」。合金 T3 修正前正是倒挂（85714s 劣于 T4 的
   50000s）才构成陷阱层；晶体 T3 虽慢热但必经，属踏脚层而非陷阱层。头部同
   步注记更新为 v0.66

### 验证

- `corepack pnpm test`：**22 文件 298 用例**全过（202 基线 + 96 新增）
- `corepack pnpm build`（含 vue-tsc）通过
- `lint:check` / `format:check` 零输出（新测试文件曾触发 Prettier 折行，
  format --write 修复后复跑通过）
- 纯测试与文档变更，无运行时行为变化；Playwright 回归不受影响（未触 UI/数
  据契约）

---

## v0.65 — 数值: 全量数值复查后的曲线修正与规范文档入库

**变更性质：数值（曲线修正 + 规范文档入库）**
**开发时间：2026-09-06**

### 概述

对全部数值源（src/data/ 与相关 store）做一次通检：引用完整性、计数守恒、成
就连乘、建筑回本梯度、远征缩放曲线、战斗阶梯模拟。核验通过项不动，四处数
值/口径偏离予以修正，并将数值口径整理为规范文档入库。

### 变更明细

1. **合金 T3 陷阱层修正**：离子铸造站每级产出 0.35 到 1.2。原值仅比 T2 高
   17%（其他扇区 T2 到 T3 为 2 至 4 倍），能量回本 85714s、边际交叉 L≈146
   实际不可达，而 T4 星际熔炉 Lv0 回本更优，构成负收益层。修正后每级产出比
   T2→T3 = ×4.0，能量回本 25000s，交叉 L≈75 与数据扇区同带
2. **晶体后期收入通道**：沉默者旗舰（silencer_3）胜利奖励补晶体 1e5。此前
   晶体是唯一无战斗/远征收入的资源，而全部 T4 建筑升级均消耗晶体。远征奖励
   基准 = 旗舰奖励，晶体随之进入远征奖励轴（×1.35^(d-1)）
3. **无尽远征软墙口径回写**：endless.ts 注释「约 D6-D8 碰软墙」修正为「约
   D7-D10 进入灰区，胜负对编队构成敏感，模板轮换允许 ±1 层抖动」。以战斗公
   式移植模拟实测为准（攻×3 防×2.5 部队 D7 起胜率跌破满胜）
4. **成就描述数字风格统一**：ach_energy_4 描述「1e12」改为
   「1,000,000,000,000」，与同组逗号分隔风格一致
5. **据点 tier 语义定义**：pve.ts 补注释明确 tier 为剧情章节标签，不代表难
   度排序；难度梯度以敌方总强度为准
6. **签到奖励入 totals 口径注记**：daily.ts 补设计意图注释，明确计入终身成
   就与转生负熵是设计行为
7. **新增 docs/游戏数值设定规范.md**：十二章节记录全部数值梯度带、设计意图
   与守恒约束（资源收入矩阵/建筑曲线/科技乘数/战斗/探索/远征/遗物/转生/成
   就/签到/离线），含数值改动三连查流程；README 补索引链接

### 验证

- 数值核验脚本实测：引用完整性零悬空（建筑/科技/探索/据点/套装交叉引用）、
  计数守恒（科技 43 = ach_tech_3 阈值、遗物 20 种 = ach_relic_4 阈值、套装
  20/20 全覆盖）、成就 31 条描述与阈值逐项一致、成就全拿连乘 = 产出
  +51.4%/攻防 +29.5%/探索 +39.2%/离线 +46.4%（与文档声明吻合）
- 战斗模拟：12 据点阶梯各期合理进度部队全部可过；远征 D1-D12 曲线复查，模
  板归一化系数与单调性保持
- `corepack pnpm build`（含 vue-tsc）通过
- `corepack pnpm test`：18 文件 202 用例全过
- `lint:check` / `format:check` 零输出

---

## v0.64 — 修复: 文档一致性核对后的实现侧对齐

**变更性质：修复（实现侧对齐）**
**开发时间：2026-09-06**

### 概述

全量文档与代码一致性核对的实现侧收尾：修掉核对发现的三处「实现偏离规范」
项，规范文档侧已在此前的文档回写中同步。

### 变更明细

1. **字号豁免外残留**：RelicView 合成工坊 `.material-tag`
   `font-size: 10px` → `var(--text-xs)`，「除 .section-title 外零硬编码字
   号」验收恢复达标
2. **产出率格式对齐规范**（组件与按钮设计规范 §1.4）：`fmtRate` 输出
   `+1K/s` → `+1K /s`（数字与后缀间补空格）；零产出 `+0/s` → `0 /s`；顺带
   修复纯数字入参为负时误加 `+` 号的边界。UpgradeCountdown 的 `fmtRateStr`
   同步口径。TopBar / HeroCore 显示随之更新
3. **行动队列探索条目满格归类**：`useActionQueue` 探索条目 progress ≥ 1
   （满格未结算）时由 in-progress 转 actionable（规范 §2.2 口径），详情文
   案「已完成」不变

### 验证

- `corepack pnpm build`（含 vue-tsc）通过
- `corepack pnpm test`：18 文件 202 用例全过（fmtRate 新增 2 用例：纯数字
  负值、零值）
- `lint:check` / `format:check` 零输出
- 字号验收命令复跑：`font-size: \d+px` 全项目仅剩 .section-title 17px 豁免
  项
- Playwright 回归：v049 行动队列 + batchA Hero 产出率格式专项复跑通过

---

## v0.63 — 修复: 勘误（格式化 + 数值口径回写）

**变更性质：修复（勘误）**
**开发时间：2026-09-06**

### 概述

对 v0.44-v0.62 全量复查发现的偏差一次性勘误：1 处格式化遗漏 + 2 处历史条目
数值口径回写 + 1 处代码注释陈旧计数。纯格式、注释与文档修正，无逻辑/存档变
化，SAVE_VERSION 保持 7。

### 变更明细

- DailyCard.vue 挑战进度条 div 折行不符合 Prettier 规则（v0.62 提交时
  format:check 漏跑），恢复单行写法
- runAutomation 注释的扫描计数「20 建筑/39 科技/4 节点」同步为恒星系层落地
  后的「20 建筑/43 科技/10 节点」
- changelog v0.57 条目成就加成汇总按逐条连乘实测值回写：全产出 +51%、攻防
  +29%、探索 +39%、离线 +46%
- changelog v0.59 条目敌方倍率表述回写为「最高单兵属性约为原终局据点的 4
  至 6 倍」并附攻击/防御/血量实值；《游戏设定与架构》成就系统行同步

### 验证

- build（含 vue-tsc）+ vitest 18 文件 200 用例全绿；lint:check /
  format:check 零输出

---

## v0.62 — 功能: 每日签到与周期挑战（回访钩子）

**变更性质：功能（玩法扩展）**
**开发时间：2026-09-06**

### 概述

玩法扩展第七步（本系列完成）：留存机制清单的最后一项，回访钩子。每日签到给
每天回来一次的理由（自动签到，零交互成本），每周 3 项周期挑战给一周一个轻
量目标。奖励量级克制在「顺路的糖」档位，不造第二资源轴。

### 变更明细

- 每日签到：本地日期判定，当日首次进游戏自动签到（无需点击）；连击 7 天循
  环，第 1/3/7 天节点给能量与暗物质（2e4/5e4+3/1e5+7），普通日保底 5e3 能
  量；断签连击清零并给回归补偿包（5e4 能量 + 2 暗物质），回来总有东西拿
- 周期挑战：每周一（本地时区）换新 3 项；模板池 5 类（攻克据点/完成探索/研
  究科技/升级建筑/奇点重启），按周标识种子确定性抽取（FNV-1a +
  mulberry32，与战斗随机数同族），同周全端一致；档位阈值随周错开
- 挑战计数：复用成就终身计数钩子通道（战斗/探索/研究/升级/转生五处各一行
  bump），换周清零；完成后手动领取（暗物质 + 签到连击 +1，两系统勾连），不
  强制全完成
- UI：首页新增「每日签到 · 周期挑战」合并卡片（今日签到徽标、7 天连击进度
  点含奖励节点高亮、3 项挑战进度条与领取按钮），不加页面不加导航项；挑战领取
  经 game.claimChallenge 原子发放暗物质
- 存档：daily 可选字段（最后签到日/连击/周计数/周标识/本周挑战），
  SAVE_VERSION 保持 7 零迁移；旧档缺失视为从未签到，从当天开始；损坏挑战条
  目（未知模板 id）hydrate 时过滤
- 兼容性：
  - 旧档无 daily 字段从容降级；签到奖励走 resources.gain 通道，计入 totals
    与终身计数（差值采集法全覆盖，成就能量指标含签到奖励为设计行为）
  - 日期判定用本地时间（纯前端单机，奖励量级小无跨时区刷取收益）

### 验证

- build（含 vue-tsc）+ vitest 18 文件 200 用例全绿；lint / format 零输出
- Playwright 全套 11 脚本通过：v045 至 v061 十脚本 + 新增 v062 专项（卡片
  渲染、自动首签与刷新不重签、完成态领取与暗物质到账、连击注档圆点态、换周
  重掷与计数清零、成就 31 卡不回归、导航无新增项、移动视口不溢出）

---

## v0.61 — 功能: 遗物合成与套装（收集深化）

**变更性质：功能（玩法扩展）**
**开发时间：2026-09-06**

### 概述

玩法扩展第六步：收集深化。重复掉落的遗物从无用库存变为合成材料（3 合 1 升
稀有度），装备侧新增 4 组来源系别套装（2 件小额加成、3 件满套翻倍），图鉴
收集与后期刷取（远征主产地）形成循环。顺带修正「欧米茄传承」成就与遗物池口
径不一致的存量缺陷。

### 变更明细

- 遗物合成：任意 3 件同稀有度、未装备遗物 → 高一档稀有度池中随机 1 件（普
  通→稀有→史诗→传说逐级跳）；合成原子操作，材料数量不足/重复/已装备/传说顶
  档/稀有度混选一律拒绝且无副作用；产物走 obtain 通道生成新实例，成就与存
  档天然兼容
- 套装：遗物按来源归入 4 组：掠夺者战团（攻击 +5%/满 +10%）、巨兽血裔（能
  量产出 +6%/满 +12%）、先驱遗产（数据产出 +6%/满 +12%）、沉默者回响（暗物
  质产出 +6%/满 +12%）；同系装备 2 件触发、3 件满套；20 件遗物全部入组、无
  重复无遗漏
- 套装实现：加成为派生遗物效果注入装备效果聚合通道（效果系统零改动）；量级
  刻意压小额，套装是收集方向标而非第二权力轴
- UI：遗物页新增合成工坊（显式选材模式开关，开启后点卡选材料、关闭恢复装
  备；材料槽 3 格与产物稀有度预览；合成产物弹窗）与套装区块（4 组件数进度
  与激活态高亮）；图鉴标题改为「X 件 / X 种」；卡片新增套装归属角标与已选
  材料标记
- 成就修正：欧米茄传承（ach_relic_4）原按持有件数计、阈值 21，与遗物池 20
  种不一致（20 种 + 1 件重复即误达成）；改为按图鉴种类数（distinct id）判
  定，阈值 20，文案同步「集齐全部 20 种遗物」；已解锁玩家不受影响
- 兼容性：
  - 存档零迁移（SAVE_VERSION 保持 7）：合成与套装只对既有 owned/equipped
    结构做运行时变动，无新字段
  - 掉落率与稀有度权重不变（rollRelic 口径不动）；成就表仍 31 卡 9 区

### 验证

- build（含 vue-tsc）+ vitest 17 文件 181 用例全绿；lint / format 零输出
- Playwright 全套 10 脚本通过：v045 至 v060 九脚本 + 新增 v061 专项（工坊/
  套装渲染、选材模式开关、合成全流程与产物弹窗、稀有度混选拦截、已装备与传
  说置灰、套装激活与卸下失活、图鉴件数种类计数、成就 31 卡与 20 种口径、移
  动视口不溢出）

---

## v0.60 — 功能: 无尽远征模式（无限深度挑战层）

**变更性质：功能（玩法扩展）**
**开发时间：2026-09-06**

### 概述

玩法扩展第五步：据点全通后的可重复挑战层。本轮攻克沉默者旗舰后开放
「无尽远征」，敌方数值与奖励随深度无限指数缩放，构成长线「转生 → 练兵 → 推
深」meta 循环，为后期玩家提供刷资源、暗物质与遗物的长尾出口。

### 变更明细

- 解锁：本轮攻克「沉默者旗舰」（silencer_3）后开放；转生清本轮据点进度，入
  口随之锁定，需重新打通
- 敌方缩放：深度 d 敌方 = 模板 × scale(d)，scale = 0.5 × 1.25^(d-1)；编成
  按 (d-1) mod 4 轮换 4 类现役最强据点模板（沉默者旗舰 / 掠夺者母巢 / 虚空
  巨兽母体 / 奇点方舟），克制关系随模板复用，不新增兵种；各模板按总强度
  （攻+防+血×数量）归一化到旗舰基准，跨深度难度单调平滑，模板内部构成差异
  （单体巨兽 vs 步兵海）保留
- 奖励缩放：奖励 = 沉默者旗舰基准 × 1.35^(d-1)，成长刻意快于敌方（越深越值
  得打）；遗物掉率 min(0.95, 0.5+0.05d)、稀有度偏向 min(1, 0.5+0.05d)，远
  征成为后期刷遗物主产地
- 深度推进：深度自选（1 至历史最深+1），攻克当前前沿才推进纪录，重打已过深
  度只取奖励不推进，失败不降深度；远征历史最深层数（expeditionBest）跨转生
  保留，hardReset 才清零
- 战斗规则：完整沿用既有结算与软墙口径（保底伤害 1 + 50 回合超时判负），敌
  方数值无限上涨时战斗自然超时判负，软墙即无限深度的天然边界
- UI：星图页新增「无尽远征」独立区块（未解锁置灰可见并提示解锁条件）；远征
  战斗页新增深度步进面板（默认跟随前沿、手动选深后尊重选择、越界自动钳
  制），隐藏挂机驻扎（挑战层不开放驻扎）
- 实现口径：新增 src/data/endless.ts 合成据点（固定 id endless，不入
  STRONGHOLDS 表，现有 16 据点零改动）；combat store 新增 expeditionBest
  与 recordExpedition；无新路由（复用 /battle/:id）
- 数值校准：战斗公式忠实移植 + 蒙特洛模拟，刚全通部队（攻×3 防×2.5）约推进
  至 6-8 层碰软墙，每轮转生可推深 2-4 层
- 兼容性：
  - 存档零迁移（SAVE_VERSION 保持 7）：expeditionBest 为可选字段，v0.59 旧
    档缺失自动视为 0
  - 现有据点/探索/科技/成就数据零改动；远征战果计入战斗里程碑终身计数（既
    有钩子）

### 验证

- build（含 vue-tsc）+ vitest 16 文件 163 用例全绿；lint / format 零输出
- Playwright 全套 9 脚本通过：v045 / v046 / v048 / v049 / v056 / v057 /
  v058 / v059 / 新增 v060 专项（未解锁置灰与不跳转、解锁链、旧档无字段兼
  容、深度跟随前沿、胜利推进、步进钳制、驻扎隐藏、常规据点不受影响、移动视
  口不溢出、成就 31 卡不回归）

---

## v0.59 — 功能: 星图第二层「恒星系层」（探索 6 节点 + 据点 8 座 + 科技 4 项）

**变更性质：功能（玩法扩展 · 纯内容数据扩展）**
**开发时间：2026-09-06**

### 概述

玩法扩展第四步：把世界观「五层宇宙观」从一层推进到两层。深空虫洞之后新增恒
星系层，三个邻近恒星系以探索节点二叉汇合链展开，沉默者叙事线推进至「我们并
非沉默，我们是在倾听」，并为后续星团层埋下钩子。一周目内容量约提升至 2.2
到 2.5 倍。

### 变更明细

- 探索：新增恒星系层（StarLayer 第 5 值 stellar，色 #E879F9，距离 4.2
  ly+），6 节点二叉汇合链：半人马门户（入口）→ 碎晶星带 / 熔炉星系（双分
  支）→ 死寂星系（汇合）→ 中子星残骸 → 银河悬臂边缘（终章）；基础总时长
  20.5 小时，配探索效率科技后净约 5 至 8 小时
- 据点：8 座新据点（掠夺者星际舰队 / 晶背巨兽群 / 先驱星系档案馆 / 沉默者
  殖民舰 / 掠夺者母巢 / 虚空巨兽母体 / 奇点方舟 / 沉默者旗舰），全部复用 4
  类据点与既有兵种克制三角，敌方最高单兵属性约为原终局据点的 4 至 6 倍（攻
  击 200→1200、防御 100→400、血量 8000→50000）；据点总量 8 → 16
- 科技：4 项 tier 5 科技（银河测绘 / 虫洞稳定理论：探索效率 ×1.4 与 ×1.5；
  舰队后勤学：攻防各 ×1.3；暗物质共振：暗物质产出 ×1.5），全部复用既有效果
  类型，图标复用现有 symbol，科技总量 39 → 43
- 资源口径：探索成本类型扩展支持晶体（碎晶星带消耗晶体 20000）；新层暗物质
  支出（节点 185 + 科技 120）给后期暗物质经济制造张力，暗物质共振作为对冲
- 成就：「智慧之巅」阈值与文案随科技总量同步 39 → 43（累计口径，老档进度不
  回退）；其余 30 条不动
- UI：星图页新增恒星系层分区；首页进度 X/10、科技进度 X/43 等派生展示均为
  数据驱动自适应
- 兼容性：
  - 存档零迁移（SAVE_VERSION 保持 7）：新节点/据点/科技均为纯增量数据，旧
    档缺失字段自动视为未开始/未研究，验证器无需改动
  - 行动队列「无行动兜底」测试的节点清单与 v046 空态白名单（TECH_IDS
    /NODE_IDS）已同步
  - 自动化探索协议与新层天然兼容：availableNodes 挡前置、买不起自动跳过，
    无逻辑改动

### 验证

- build（含 vue-tsc）+ vitest 15 文件 148 用例全绿；lint / format 零输出
- Playwright 全套 8 脚本通过：v045 双端九路由 / v046 空态（白名单 43 科技
  10 节点）/ v048 / v049 / v056 / v057 / v058 / 新增 v059 专项（五层渲染、
  入口解锁链、旧档兼容、据点 16 口径、自动化不误开新层、成就 31 卡不回归）

---

## v0.58 — 功能: 自动化 QoL（转生树 3 个自动协议节点）

**变更性质：功能（玩法扩展）**
**开发时间：2026-09-06**

### 概述

玩法扩展第三步：放置游戏标配的自动化 QoL。转生树新增 3 个买断协议节点（建
造/研究/探索协议），购买后常开，每 tick 自动执行对应操作，给中后期玩家
「解放双手」的转生目标。

### 变更明细

- 转生树买断区 11 → 14 节点，新增（存档结构零改动，SAVE_VERSION 保持 7）：
  - 建造协议（t_auto_build，10 负熵）：自动升级买得起的已解锁建筑，每建筑
    每 tick 至多 1 级
  - 研究协议（t_auto_research，10 负熵）：自动研究买得起的可用科技
  - 探索协议（t_auto_explore，8 负熵）：自动开始可探索的星域节点（在线时）
- 新增效果类型 auto_build / auto_research / auto_explore，走
  effectSystem.getValue 累加通道（同 training_slot 模式）
- game store 新增 runAutomation：每 tick 在资源增长后执行，
  **复用既有原子操作**（tryUpgradeBuilding / tryResearch /
  startExplore），科技成本乘数、成就终身计数钩子、探索并发口径与手动路径天
  然一致；购买策略 = 买得起即买，不留储备；只在线 tick 生效
- UI：Build / Tech / Map 三页页头「⚙ 协议进行中」小徽标，对应开关激活时显
  示，不加新面板
- 买断池总成本 40 → 68 负熵；无限节点不变，转生循环中期目标加强
- 兼容性：
  - 存档结构无变化，旧档读取零迁移
  - 未购买这些节点的玩家行为完全不变（每 tick 三个 getValue 调用，开销可忽
    略）

### 验证

- `pnpm build`（含 vue-tsc）通过
- `pnpm test`：15 文件 148 用例全绿（新增自动化集成 6 例、转生树节点数/效
  果类型 1 例）
- `lint:check` / `format:check` 零输出
- Playwright：回归六套全绿（v056 买断数断言已同步 14）+ 自动化专项全绿（未
  购对照不自动化/购后自动建造·研究·探索/三页徽标/转生树新节点购买与展示）
- 部署后线上版本串核对一致

---

## v0.57 — 功能: 成就/里程碑系统（31 成就 9 类）

**变更性质：功能（玩法扩展）**
**开发时间：2026-09-06**

### 概述

玩法扩展第二步：给玩家跨转生的长期目标感，与 v0.56 无限树形成双成长轴（无
限树 = 负熵支出端，成就 = 免费小额永久加成 + 收集驱动）。新增 31 个成就、
独立成就页与全局解锁提示。

### 变更明细

- 新增 `src/data/achievements.ts`：31 个成就定义，9 类（能量 4 / 暗物质 3
  / 建造 4 / 研究 3 / 探索 3 / 战斗 3 / 遗物收藏 4 / 奇点轮回 4 / 游玩时长
  3）；图标复用既有 symbol 不画新图
- 奖励口径：小额永久加成，走 EffectSystem 既有通道；全部拿满约等于全产出
  +51%、攻防 +29%、探索 +39%、离线 +46%，量级压在无限树单节点几级之内；
  prestige_mult 仅「欧米茄传承」（集齐 21 遗物）1 个成就给 +10%
- 新增 `src/stores/achievements.ts`：终身计数器（转生会重置单轮 totals/科
  技/据点，终身计数跨转生累计、仅清除存档时归零）+ 阈值解锁 + toast 队列 +
  EffectSource 实现；遗物/转生/时长三个指标读外部现值（provider 注入，沿用
  跨 store 派生值模式）
- 终身能量/暗物质采集用「totals 差值快照」法：tick 尾部取本轮 totals 增量
  计入终身，单点覆盖建筑产出/探索奖励/战斗奖励/离线补算全部通道；hydrate
  与转生时快照显式对齐防重复计入
- 钩子接线：tick（采集+时长+解锁判定）、tryUpgradeBuilding、tryResearch、
  探索完成、战斗胜利（BattleView）、doTranscend（转生前采集+转生类成就即时
  判定）；hardReset 全清
- 顺手修既有缺陷：totalPlayTime 此前不入存档（刷新归零），v7 起入档，首页
  「文明概况-时长」成为真·终身时长
- UI：新路由 `/achievements` 成就页（已解锁/进行中进度条/未达成三态 + 顶部
  汇总加成预览）；导航加 secondary 项（桌面侧栏自动出现，移动收进「更多」
  面板）；AppShell 挂全局 AchievementToast（一次一条、2.5s 自动消失、连续
  解锁排队）
- 存档 v6 → v7：新增 achievements 与 totalPlayTime 可选字段，迁移 noop（旧
  档缺失自动默认）；校验宽容旧档、新档结构校验（非负数/合法时间戳）；
  hydrate 层过滤未知成就 id；老玩家终身计数从装档起算、历史产量不追溯（无
  数据来源），hydrate 后按当时现值补发遗物/转生类成就
- 兼容性：
  - 旧存档（v6 及以前）读取零迁移成本：无成就字段时从零起算，不废档
  - 既有效果通道（科技/遗物/转生树）数值零变化，成就乘数为新增连乘因子
  - 转生保留成就与终身计数；清除存档才归零

### 验证

- `pnpm build`（含 vue-tsc）通过
- `pnpm test`：15 文件 141 用例全绿（新增 achievements 22 例、storage 成就
  校验 4 例、save-migrate v6→v7 1 例）
- `lint:check` / `format:check` 零输出
- Playwright：既有回归五套全绿 + 新增成就专项（旧档兼容/成就页渲染/解锁与
  toast/转生保留/导航双端入口）
- 部署后线上版本串核对一致

---

## v0.56 — 功能: 转生树无限化（4 个可重复购买节点）

**变更性质：功能（玩法扩展）**
**开发时间：2026-09-05**

### 概述

修复转生树买断制的循环断裂问题：原 11 个节点共 40 负熵买满后，转生不再产生
任何收益，核心循环终结。本次保留全部买断节点（引导期目标），新增 4 个
「无限天赋」节点：可重复购买、成本指数递增、效果按等级永久叠加，使负熵支出
端永不枯竭。

### 变更明细

- 新增无限节点 4 个：
  - 奇点共振（t_inf_prod）：全资源产出每级 +10%，基础 5 负熵，成本 ×1.5/级
  - 战争遗产（t_inf_combat）：部队攻防每级 +5%，基础 5 负熵，成本 ×1.5/级
  - 深空航行（t_inf_explore）：探索效率每级 +10%，基础 6 负熵，成本
    ×1.5/级
  - 时间膨胀（t_inf_offline）：离线收益每级 +10%，基础 8 负熵，成本
    ×1.6/级
- 成本公式 `ceil(基础 × 增长率^等级)`，向上取整；负熵收入为 sqrt 压缩增长
  而成本指数增长，等级增速对数级放缓，数值自收敛
- 故意不无限化的效果：prestige_mult（负熵生负熵正反馈失控）、relic_slot /
  starting_energy（无限叠加失衡）
- `TranscendNode` 数据结构：`purchased: boolean` 改为 `level: number` + 可
  选 `maxLevel`（缺省 1 = 买断）/ `costGrowth`；效果汇总按等级叠加（乘数型
  每级连乘一次）
- 存档版本 5 → 6：迁移函数将旧档 `purchased:true` 转为 `level:1`；存档校验
  兼容双格式（校验先于迁移执行，旧档不废弃）；hydrate 对等级做非负整数与上
  限截断防御
- 奇点重启页转生树分区展示：买断区在上，新增「无限天赋」区在下；无限节点卡
  片显示当前等级、下一级成本与累计加成，按钮常驻（余额不足时禁用）
- 新增 `src/stores/transcend.test.ts`（该 store 首个独立测试）与
  `src/lib/save-migrate.test.ts`
- 兼容性：
  - 旧存档（v5 及以前）读取时自动迁移，已购节点保留为 1 级，负熵余额与转生
    次数不变
  - 旧格式导出码（purchased 结构）仍可导入
  - 买断节点数值、负熵获取公式、转生重置范围均无变化

### 验证

- `pnpm build`（含 vue-tsc）通过
- `pnpm test`：14 文件 114 用例全绿（新增 transcend 21 例、save-migrate 5
  例、storage 双格式校验 3 例）
- `lint:check` / `format:check` 零输出
- Playwright：既有回归四套全绿 + 新增无限树专项（旧档迁移 UI、重复购买扣
  费、买满买断节点后无限节点仍可购买）
- 部署后线上版本串核对一致

---

## v0.55 — 工程化: 全局样式模块化拆分 + UpgradeCountdown 归位 build/

**变更性质：工程化（结构优化）**
**开发时间：2026-09-05**

### 概述

style.css（763 行单文件）按职责拆为 src/styles/ 七个模块，style.css 改作
@import 聚合入口；UpgradeCountdown 由通用 ui/ 目录归位至业务目录 build/。
选择器级零改动。纯结构重构，样式内容、渲染输出与游戏行为零变化；存档不受影
响。

### 变更明细

- `src/style.css` 拆分为聚合入口 + `src/styles/` 七模块：fonts（自托管字
  体）、tokens（设计 Token）、base（重置+滚动条）、background（星点/星
  云/暗角）、animations（keyframes+路由过渡）、utilities（工具类/布局/空态
  /Modal/导航安全网/品牌名）、buttons（按钮系统）；@import 顺序保持原单文
  件级联顺序
- 清理 Token 段头注释中残留的「Tailwind 4 CSS-first」表述（v0.54 移除依赖
  时漏网）
- `UpgradeCountdown.vue`（632 行）自 `components/ui/` 移至
  `components/build/`：该组件仅 BuildView 引用，属业务组件而非通用 UI；
  BuildView import 路径同步更新
- 校验：新旧 CSS 去注释排序 diff 仅两处预期注释行差异，选择器与声明零丢失

### 验证

- 新旧 CSS 实质内容 diff 校验通过（仅预期注释差异）
- `pnpm build`（含 vue-tsc）通过
- `pnpm test`：12 文件 86 用例全绿
- `lint:check` / `format:check` 零输出
- Playwright 回归四套全绿（release 双端八路由 / 空状态 / 训练槽位 / 行动队
  列）
- 部署后线上版本串核对一致

---

## v0.54 — 工程化: HomeView 结构拆分 + 移除未使用的 Tailwind 依赖

**变更性质：工程化（结构优化）**
**开发时间：2026-09-05**

### 概述

HomeView.vue（1056 行）按板块拆分：行动队列数据组装抽为 composable，四个板
块各成子组件，视图瘦身为编排层。另移除开发依赖中已不再使用的 Tailwind CSS
（样式系统早已切换为原生 CSS 设计 Token）。纯结构重构，渲染输出（DOM 结构/
类名/文案）与游戏行为零变化；存档不受影响。

### 变更明细

- 新增 `src/composables/useActionQueue.ts`：行动队列数据组装与截断口径（进
  行中全保留、可执行补足至总数 ≤6），逻辑自 HomeView 原样迁移
- 新增 `src/components/home/` 四个子组件，模板与样式自 HomeView 原样迁移：
  - HeroCore：星核核心视觉（能量值/产出率/三层状态环/点击跳转）
  - ActionQueuePanel：行动队列渲染
  - QuickActions：快速操作入口
  - OverviewPanel：文明概况
- `src/views/HomeView.vue`：1056 行 → 约 85 行，仅保留板块编排、新手引导状
  态与双列布局样式
- 测试迁移：`src/views/HomeView.test.ts` →
  `src/composables/useActionQueue.test.ts`，5 条队列规则用例脱离视图挂载，
  直接断言 composable 返回
- 移除 devDependencies 中未使用的 tailwindcss；README 与《游戏设定与架构》
  技术栈表述同步去掉 Tailwind CSS 4

### 验证

- `pnpm build`（含 vue-tsc）通过
- `pnpm test`：12 文件 86 用例全绿（队列 5 用例迁移至 composable 层，总数
  不变）
- `lint:check` / `format:check` 零输出
- Playwright 回归四套全绿（release 双端八路由 / 空状态 / 训练槽位 / 行动队
  列）
- 部署后线上版本串核对一致

---

## v0.53 — 文档: 文档库整理（删 8 份历史草稿，保留文档全中文命名）

**变更性质：文档（结构整理）**
**开发时间：2026-09-05**

### 概述

docs/ 文档库去重清理：删除 8 份历史文档（有效结论均已落地代码/本日志/保
留文档），保留的 7 份活跃参考文档全部改为中文名。文档总量 8511 行 → 约
4200 行。

### 变更明细

- 文件名映射（旧 → 新）：
  - p0-token-mapping.md → 设计Token规范.md
  - p1-design-deliverables.md → 组件与按钮设计规范.md
  - p2-atmosphere-visual-spec.md → 氛围视觉规范.md
  - p2-interaction-state-spec.md → 交互状态规范.md
  - p3-design-specs.md → 体验增强设计规范.md
  - icon-design-spec.md → 图标设计规范.md
  - 游戏设定与架构.md 不变（v0.52 入库）
- 删除清单（git 历史可查）：
  - home-ui-总体推进方案.md（P0–P3 计划表，全部落地完毕）与 home-ui-总体推
    进方案-技术复查.md（计划的技术复查）
  - starcore-v0.41-复查-前端层.md（v0.41 时点复查，9/11 项已修复）
  - ui-eval-report.md（早期评估，结论已转化）
  - cache-strategy-evaluation.md（缓存评估，结论已落地部署配置）
  - old-icon-visual-tweaks.md + audits/old-icon-unification-audit.md（图标
    历史草稿，已并入图标设计规范 v2.0；audits/ 目录随删）
  - p1-2-行动队列合并-数据源梳理.md（合并前结构梳理，最终口径见 v0.49 条目
    与代码注释）
- 连带更新：
  - 代码注释中文档名引用同步更新 5 处（EmptyState / useOnboarding /
    useResourceParticles / HomeView）
  - 保留文档中对退役文件的引用改为概念表述（「计划文档已退役，git 历史可
    查」）
  - 本日志的历史条目保留旧文件名不改（日志即历史）

### 验证

- vue-tsc -b 零错误 + vite build 通过；lint:check / format:check 零输出
- vitest run 12 文件 86/86 通过；Playwright 双端回归全过

---

## v0.52 — 文档: 治理收口（矛盾回写 / 历史时点标注 / README 重写 / 设定文档入库）

**变更性质：文档（治理收口）**
**开发时间：2026-09-05**

### 概述

统一回写文档与实现的存量偏差：文档间矛盾按代码实际立场收口、过时文档标注历
史时点、README 重写、设定文档反向整理入库，并将战斗软墙设计意图文档化。纯
文档 + 一处代码注释，无逻辑/存档变化

### 变更明细

- Token 映射文档：验收补注已知豁免（`.section-title` 17px，最小字号口
  径），并补登 `--color-core-deep` 与组件级注入变量口径
- 推进方案文档：核心数值 28px 订正为 31px（`--text-2xl`）；产出率 11px 订
  正为 12px；「三段式」标题订正为「四档」，推进方案/HomeView 注释同步，历
  史复查文档保留原措辞
- 历史文档标注：v0.41 复查文档与行动队列方案文档顶部加历史时点标注（过时项
  已被后续版本修复，行号已漂移）
- README 重写为项目门面（玩法/技术栈/开发/部署）
- 《游戏设定与架构》反向整理入库（`docs/游戏设定与架构.md`，从 changelog
  转述 + 当前代码核对整理，标注非原件）
- 战斗软墙设计文档化：combat.ts 补充「保底 1 + 50 回合 = 软墙设计」注释，
  并记入设定文档数值意图表

### 验证

- vue-tsc -b 零错误 + vite build 通过；lint:check / format:check 零输出
- vitest run 12 文件 86/86 通过
- Playwright 回归：双端八路由无错误、移动端无溢出

---

## v0.51 — 工程化: 新手引导存储口径对齐设计文档

**变更性质：工程化（引导存储口径对齐设计文档）**
**开发时间：2026-09-05**

### 概述

新手引导的 localStorage 存储与体验增强设计规范 §3.3.4 不符（key 名与数据结
构均不同）。本版本按文档对齐：key 改为 `starcore_onboarding`，结构改为
JSON 对象（每个 step 一个 boolean）。

### 变更明细

- `useOnboarding`：`STORAGE_KEY` 由 `sc_onboarding_v1` 改为
  `starcore_onboarding`；持久化由「已完成 id 数组」改为「step → boolean 对
  象」
- 读取侧兼容防御：内容损坏时按全新处理，不抛错
- 兼容性：
  - 旧 key（`sc_onboarding_v1`）不再读取：老玩家会重新看到一遍引导气泡，属
    一次性打扰，已确认接受
  - 不影响游戏存档（引导状态与存档相互独立）

### 验证

- vitest run 12 文件 86/86 通过（新增 useOnboarding 测试 5 例：首 step 显
  示 / 对象结构写入 / skipAll / 预置跳过 / 损坏内容兜底）
- vue-tsc -b 零错误 + vite build 通过；lint:check / format:check 零输出
- Playwright 回归：行动队列 / 槽位 / 空状态 / 双端八路由全过

---

> v0.50 及更早的历史条目已归档（现档 [changelog-v0.01-v0.35.md](changelog-v0.01-v0.35.md)，历史存档不再更新，新条目继续在活跃档置顶）。

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

首页行动队列的实现与行动队列方案文档「最终建议」存在三处偏离。经逐项评
估，按「实现小改 + 文档回写」统一口径：去掉信息重复的训练汇总卡，截断规则
改为不丢进度信息的形式，文档标注最终落地口径。纯 UI 展示逻辑调整，无存档结
构变化

### 变更明细

- 移除训练汇总卡：训练中已有逐条进度（如「训练 突击兵 ×10 — 45%」），「N
  支部队训练中 · 查看进度」卡片信息重复，按行动队列方案文档建议移除
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
页面无引导，新玩家在对应场景下无路可走。本版按体验增强设计规范 §3.2 规范
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
