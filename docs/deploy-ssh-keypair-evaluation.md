# deploy.py SSH 密钥登录改造方案评估

> 评估人：开发侧 | 日期：2026-07-16 | 基于 deploy.py v0.42

## 结论：建议推进 ✅

密钥登录比密码登录更安全、更易管理，且能解决当前「密码环境变量缺失」这个部署阻塞。但 **known_hosts 未登记是独立问题，密钥登录不能解决**，仍需单独处理。

---

## 1. 服务器侧配置（用户操作）

### 1.1 生成密钥对

在**本地机器**（或你日常用的开发机）上生成：

```bash
ssh-keygen -t ed25519 -f ~/.ssh/starcore_deploy_key -C "starcore-deploy"
```

- 算法选 `ed25519`（比 RSA 更短更安全，paramiko 5.0 完全支持）
- `-C` 加注释，方便识别这把钥匙的用途
- **passphrase 建议设置**（见 §4 注意事项）

### 1.2 将公钥安装到服务器

需要先用密码登录一次服务器（最后一次用密码）：

```bash
# 方法 A：ssh-copy-id（推荐）
ssh-copy-id -i ~/.ssh/starcore_deploy_key.pub user@203.0.113.10

# 方法 B：手动
cat ~/.ssh/starcore_deploy_key.pub | ssh user@203.0.113.10 \
  "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```

### 1.3 验证密钥登录可用

```bash
ssh -i ~/.ssh/starcore_deploy_key user@203.0.113.10 "echo OK"
```

**能登录才可继续下一步。** 这一步是整个方案的关键验证点。

### 1.4（可选但推荐）禁用密码登录

确认密钥登录正常后，在服务器上禁用密码登录：

```bash
sudo nano /etc/ssh/sshd_config
# 设置：
#   PasswordAuthentication no
#   PubkeyAuthentication yes
sudo systemctl restart sshd
```

⚠️ **禁用前务必保持当前 SSH 会话不要断开**，另开一个终端测试密钥登录，防止锁死自己。

---

## 2. deploy.py 侧改动

### 2.1 核心改动：connect() 参数

**当前代码**（deploy.py L121）：

```python
ssh.connect(HOST, port=PORT, username=USER, password=pwd, timeout=15)
```

**改为**：

```python
key_path = get_ssh_keypath()
ssh.connect(HOST, port=PORT, username=USER, key_filename=key_path,
            timeout=15, look_for_keys=True, allow_agent=False)
```

- `key_filename`：指定私钥路径，paramiko 自动识别格式（OpenSSH/PEM/PuTTY）
- `look_for_keys=True`：key_filename 找不到时回退搜索 `~/.ssh/id_*`（兜底）
- `allow_agent=False`：不依赖 ssh-agent（部署环境通常没跑 agent）
- 移除 `password=pwd`

### 2.2 环境变量调整

**删除** `get_ssh_password()`（L46-53），**新增** `get_ssh_keypath()`：

```python
def get_ssh_keypath() -> str:
    """从环境变量读取 SSH 私钥路径，未设置则回退默认路径"""
    key_path = os.environ.get('DEPLOY_SSH_KEYPATH')
    if not key_path:
        # 回退默认路径
        default = os.path.expanduser('~/.ssh/starcore_deploy_key')
        if os.path.isfile(default):
            key_path = default
        else:
            print("[FAIL] 未找到 SSH 私钥")
            print("  请设置: export DEPLOY_SSH_KEYPATH='/path/to/private_key'")
            print(f"  或将私钥放在默认路径: {default}")
            sys.exit(1)
    
    if not os.path.isfile(key_path):
        print(f"[FAIL] 私钥文件不存在: {key_path}")
        sys.exit(1)
    
    # 校验权限（见 §4）
    stat = os.stat(key_path)
    if stat.st_mode & 0o077:
        print(f"[WARN] 私钥权限过松: {oct(stat.st_mode & 0o777)}，建议 chmod 600")
    
    return key_path
```

### 2.3 dry-run 模式适配

L104-112 的 dry-run 分支也要改：把 `DEPLOY_SSH_PASSWORD` 检查换成 `DEPLOY_SSH_KEYPATH` / 私钥文件存在性检查。

### 2.4 保留不变的安全机制

| 规则 | 状态 | 说明 |
|------|------|------|
| RejectPolicy | ✅ 保留 | host key 校验与认证方式无关，密钥登录也需要 known_hosts |
| validate_remote_dir | ✅ 保留 | 路径校验与认证方式无关 |
| 错误提示 | 🔧 微调 | 当前提示 `ssh-keyscan`，密钥方案下仍需提示，保持不变 |

### 2.5 改动量评估

- 改动文件：仅 `deploy.py` 1 个
- 改动行数：约 20 行（删 `get_ssh_password` + 加 `get_ssh_keypath` + 改 `connect()` 调用 + 改 dry-run 分支）
- 文件头注释 L1-13 更新（环境变量说明）
- 风险：低，逻辑清晰，dry-run 可自测

---

## 3. 能否解决当前两个部署阻塞？

### 阻塞 1：`DEPLOY_SSH_PASSWORD` 环境变量未设置

**✅ 能解决。** 密钥方案不再依赖密码环境变量，改为读取私钥文件路径。只要私钥在约定路径（`~/.ssh/starcore_deploy_key` 或 `DEPLOY_SSH_KEYPATH` 指向的位置），此阻塞自动消除。

### 阻塞 2：`203.0.113.10` 不在 known_hosts

**❌ 不能解决。** 这是两个独立的问题：

- **认证**（你是谁）：密码 → 密钥 ← 本次改造解决这个
- **主机验证**（服务器是不是真的）：known_hosts ← RejectPolicy 管这个

即使切了密钥登录，paramiko 连接时仍会校验服务器 host key。如果 known_hosts 里没有 `203.0.113.10` 的记录，RejectPolicy 会拒绝连接。

**解决方式**（独立于密钥改造）：

```bash
ssh-keyscan -p 22 -H 203.0.113.10 >> ~/.ssh/known_hosts
```

这一步需要用户确认 `203.0.113.10` 是可信服务器（确认后我们执行即可）。

---

## 4. 安全收益与注意事项

### 4.1 安全收益

| 项目 | 密码方案 | 密钥方案 |
|------|---------|---------|
| 凭据泄露面 | 密码可被暴力破解、肩窥、环境变量泄露 | 私钥文件不可暴力破解 |
| 历史遗留凭据 | ⚠️ 建议随方案处理 | 迁移密钥后不再使用 |
| 暴力攻击防护 | 依赖服务器 fail2ban / 密码强度 | 禁用密码登录后暴力攻击彻底无效 |
| 凭据管理 | 密码需记忆、轮换麻烦 | 私钥文件管理，可加 passphrase |
| 梳理 | 难以区分是谁登录 | 公钥注释可标识用途 |

### 4.2 注意事项

1. **私钥文件权限必须 600**：`chmod 600 ~/.ssh/starcore_deploy_key`。权限过松时 paramiko 会拒绝使用（OpenSSH 行为，paramiko 也会 warn）。`get_ssh_keypath()` 会检查并 warn。

2. **passphrase 处理**：
   - 如果私钥设了 passphrase，paramiko 连接时需要提供
   - 方案 A：私钥不设 passphrase（简单，但私钥文件泄露=服务器沦陷）
   - 方案 B：私钥设 passphrase，环境变量 `DEPLOY_SSH_KEYPASS` 传入（`ssh.connect(..., key_filename=path, passphrase=passphrase)`）
   - **建议方案 B**，passphrase 通过环境变量传入，不落盘

3. **私钥保管**：
   - 私钥文件 **不要** 放在项目目录（避免误入 git）
   - 放在 `~/.ssh/` 下，权限 600
   - 不要通过聊天工具传输私钥

4. **历史凭据处理**：切换密钥并禁用密码登录后，此前使用的登录口令不再有效，无需单独处置。

---

## 5. 推进建议

### 建议：推进 ✅

理由：
1. 安全性显著提升（消除密码泄露面、历史凭据自动失效）
2. 改动量小（deploy.py ~20 行）
3. 解决当前的密码环境变量阻塞
4. 服务器侧配置简单，用户操作量不大

### 用户需先完成的服务器侧前置

按顺序执行：

```
□ 步骤 1：本地生成密钥对
  ssh-keygen -t ed25519 -f ~/.ssh/starcore_deploy_key -C "starcore-deploy"
  （设置 passphrase）

□ 步骤 2：公钥安装到服务器（需用密码登录一次）
  ssh-copy-id -i ~/.ssh/starcore_deploy_key.pub user@203.0.113.10

□ 步骤 3：验证密钥登录
  ssh -i ~/.ssh/starcore_deploy_key user@203.0.113.10 "echo OK"
  （看到 OK 才继续）

□ 步骤 4：（推荐）禁用服务器密码登录
  编辑 /etc/ssh/sshd_config → PasswordAuthentication no → systemctl restart sshd

□ 步骤 5：确认 203.0.113.10 可信，通知我们 ssh-keyscan 登记 known_hosts
```

### 用户完成前置后，我们这边做

1. 改 deploy.py（~20 行，key 认证替代 password）
2. dry-run 自测
3. 设置 `DEPLOY_SSH_KEYPATH`（如非默认路径）+ `DEPLOY_SSH_KEYPASS`（如有 passphrase）
4. `ssh-keyscan` 登记 known_hosts
5. 执行 deploy.py 部署 v0.43

### passphrase 可选方案

如果用户不想设 passphrase（简化流程），私钥不设即可，deploy.py 也不需要 `DEPLOY_SSH_KEYPASS`。安全性靠私钥文件 600 权限 + 服务器禁用密码登录兜底。这是可接受的折中。

---

## 附：paramiko connect() 关键参数参考

```python
SSHClient.connect(
    hostname, port=22, username=None,
    password=None,           # ← 密码方案
    key_filename=None,       # ← 密钥方案（本次改用）
    pkey=None,               # PKey 对象（另一种传密钥方式）
    timeout=None,
    allow_agent=True,        # SSH agent
    look_for_keys=True,      # 搜索 ~/.ssh/id_*
    passphrase=None,         # 私钥 passphrase
)
```

paramiko 5.0.0（当前环境）完全支持 ed25519 密钥。
