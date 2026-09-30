# 诊断工具集

项目配套的诊断工具随仓库提供，克隆后即可使用。工具不依赖个人环境配置：仓库路径、浏览器位置与端口均自动解析。

## 环境自检（diagnose）

```bash
corepack pnpm diagnose        # 检测环境与仓库状态，缺件时给出修复指引
corepack pnpm diagnose --fix  # 对可自动修复的缺件执行修复
```

检测项：Node 版本与 TypeScript 类型剥离能力（检查链与诊断工具依赖）、corepack 与 pnpm、依赖安装状态、构建产物（dist/）、浏览器可用性（端到端诊断需要）、Python3（数值校验工具需要，可选）、端口 4173 与仓库 git 状态。

`--fix` 按白名单执行修复（corepack 获取 pnpm、依赖安装、构建产物、浏览器获取），逐项打印执行过程，不执行白名单以外的任何改动。

浏览器可用 `STARCORE_CHROMIUM` 环境变量指定自定义可执行文件路径；缓存目录可用 `PLAYWRIGHT_BROWSERS_PATH` 覆盖。

## 端到端诊断（e2e）

对本地预览或任意部署地址运行回归脚本集（覆盖全部玩法功能与存档安全性）：

```bash
corepack pnpm e2e                                   # 本地全量回归（自动起停预览，自动选择空闲端口）
corepack pnpm e2e --remote https://example.com      # 对远程目标运行复跑集
corepack pnpm e2e starcore-v135-save-integrity.mjs  # 运行任意脚本清单
```

- 运行器自动管理本地预览服务的启动与停止；`--no-start` 可复用已运行的服务；
- 每脚本日志分账写入日志目录（缺省系统临时目录 `starcore-e2e`，`--log-dir` 可改）；
- 浏览器缺失时先运行 `corepack pnpm diagnose --fix`。

## 数值校验（balance）

数值调整后的复算与核验脚本（需要 Python 3）；用法见各脚本头注。
