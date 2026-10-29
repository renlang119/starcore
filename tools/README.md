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
corepack pnpm e2e --remote https://example.com      # 对远程目标运行重跑集
corepack pnpm e2e starcore-v135-save-integrity.mjs  # 运行任意脚本清单
```

- 运行器自动管理本地预览服务的启动与停止；`--no-start` 可复用已运行的服务；
- 每脚本日志分账写入日志目录（缺省系统临时目录 `starcore-e2e`，`--log-dir` 可改）；
- 浏览器缺失时先运行 `corepack pnpm diagnose --fix`。

## 数值校验（balance）

数值调整后的复算与核验脚本（纯 Python 3 标准库，无第三方依赖）：

```bash
python3 tools/balance/starcore-v126-encounter-ev.py   # 遭遇事件 EV 核验表
python3 tools/balance/starcore-v127-dispatch-ev.py    # 派遣远征 EV 核验表
python3 tools/balance/starcore-ev-ledger.py           # 全系统 EV 总账（三档画像全系统收支）
python3 tools/balance/starcore-v123-trait-calib.py    # 编队特性校准模拟
```

- 数据统一经导出器生成的快照 `tools/balance/data/balance-data.json`
  （生成命令 `corepack pnpm balance:export`，新鲜度校验 `corepack pnpm balance:export:check`
  已挂 check 链尾：改数据表后须重新导出，否则 check 挂红）；快照 schema:3，
  `units.cost` 投影与 `explore` / `weeklyBoss` / `transcend` 三域随 EV 总账
  第一段并入（transcend 域自 `src/stores/transcend.ts` 模块级常量 SSR 载入）；
  `profiles` 域随第二段并入（三档画像：兵量与配装为校准声明手维护区，
  乘数聚值自 tech / achievements / relics / transcend 域真值连乘推导，
  v092 / v120 / 总账脚本统一消费）；
- 脚本不再解析 TS 源码：公共加载与断言底座见 `tools/balance/lib/balance_data.py`，
  各脚本判据、输出列与退出码不变；
- `starcore-v092-battle-sim.py`：战斗解析忠实移植，各模拟脚本的共享底座；
- `starcore-v120-milestone-calib.py` / `starcore-v123-trait-calib.py` / `starcore-v124-boss-calib.py`：数值校准模拟；
  v123 的特性面有意排除 `logistics_doctrine`（经济面特性不进战斗模拟，脚本内断言其战斗三字段保持中性）；
- `starcore-v126-encounter-ev.py` / `starcore-v127-dispatch-ev.py`：EV 核验表（断言式，退出码即结论）；
- `starcore-ev-ledger.py`：全系统 EV 总账（issue #18 口径，不挂版本号）：
  三档玩家画像下训练 / 探索 / 远征 / 周强敌 / 派遣 / 驻扎收支入账，
  转生（门槛与成本曲线断言）与自动协议（离线自动化节点标注）作结构标注，
  按时间口径分表（一次性 / 周频 / 时薪）不做跨口径加总，汇总两指标
  （稳态时薪净收支 + 一次性投入回收小时数）；折算率承 v1.27 定稿口径；
  遗物概率面不进账；先本地与 PR 内跑，合并后视运行时长再定是否进 CI balance job；
- 改数值后先重新导出快照（`corepack pnpm balance:export`），再过核验表。
- CI 口径（v1.67 起）：`.github/workflows/check.yml` 的 `balance` 独立 job 依序运行
  v126 / v127 两枚 EV 核验表；`command -v python3` 守卫承担可选依赖语义，缺
  python3 时显式打印跳过说明、不硬失败（同 diagnose 的 Python 可选先例）。
- 校准三枚（v120 / v123 / v124）不进 CI，理由与断言语况分开说：v123 / v124 对
  FAIL 本就以非零退出码硬判、v120 为纯报告输出；
  排除它们的真实原因是红线语义与「有意调参」耦合，调参触线也会红，作门禁会
  产生预期外红灯，且全域扫描耗时更长。是否断言化收口另行议定，登记为候选。
