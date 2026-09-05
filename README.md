# 星核纪元 · StarCore Era

科幻题材的放置/挂机网页游戏：公元 2387 年，殖民舰抵达仙女座星系的戴森球遗迹，
玩家经营星核文明，在「文明与熵的永恒博弈」中积累能量、探索星域、征战据点、
收集遗物，并通过「奇点重启」转生循环不断成长。

## 玩法概览

- **建造**：5 类资源（能量/晶体/合金/数据/暗物质）共 20 种建筑，成本递增
- **科技树**：8 大分支 39 项科技，驱动产出、战斗、探索与转生
- **探索**：4 个星域节点，定时完成发放奖励
- **部队**：4 种兵种双三角克制，训练并行槽 1→3（科技扩展）
- **据点 PVE**：4 类 8 据点，胜利后可驻扎挂机产出
- **遗物**：21 件稀有度池抽取，提供全局加成
- **转生**：奇点重启，负熵点亮天赋树，开启新一轮循环

详细设定与架构见 [docs/游戏设定与架构.md](docs/游戏设定与架构.md)，
版本历史见 [changelog.md](changelog.md)。

## 技术栈

Vue 3 · TypeScript · Vite · Pinia · Vue Router · decimal.js · localforage

纯前端，无后端；存档保存在浏览器本地（IndexedDB + localStorage 备份）。

## 开发

```bash
corepack pnpm install     # 安装依赖（pnpm 9，经 corepack）
corepack pnpm dev         # 本地开发
corepack pnpm build       # 类型检查 + 生产构建
corepack pnpm test        # vitest 单元/组件测试
corepack pnpm lint:check  # eslint
corepack pnpm format:check # prettier
```

## 部署

纯静态 SPA。构建产物在 `dist/`，由 `./deploy.sh` 同步至静态站点
（站点地址/目录经环境变量配置，见脚本内说明）。
