#!/usr/bin/env python3
"""部署星核纪元到云服务器

安全说明：
  - SSH 认证使用密钥方式，密钥路径从环境变量 DEPLOY_SSH_KEYPATH 读取，
    缺失时回退默认路径 ~/.ssh/starcore_deploy_ed25519，仍缺失则报错退出
  - SSH 主机密钥使用 RejectPolicy，拒绝未知主机，需预先配置 known_hosts
  - 远程目录路径执行严格校验，防止 rm -rf 误删

用法：
  export DEPLOY_SSH_KEYPATH='/path/to/key'   # 可选，不设则用默认路径
  python3 deploy.py            # 正常部署
  python3 deploy.py --dry-run  # 仅校验参数和路径，不实际连接
"""
import paramiko
import os
import sys

HOST = "203.0.113.10"
PORT = 22
USER = "user"
LOCAL_DIST = "~/starcore/dist"
REMOTE_DIR = "/var/www/starcore"


# —— 安全校验 ——

def validate_remote_dir(path: str) -> None:
    """校验远程目录路径合法性，防止 rm -rf 误删"""
    if not path or not isinstance(path, str):
        sys.exit(f"[FAIL] REMOTE_DIR 为空")
    if len(path) < 5:
        sys.exit(f"[FAIL] REMOTE_DIR 过短（<5 字符）: {path!r}")
    if not path.startswith('/'):
        sys.exit(f"[FAIL] REMOTE_DIR 必须为绝对路径: {path!r}")
    # 拒绝可疑模式
    suspicious = ['..', '//', '~', '$', '`', ';', '|', '&', '\n', '\r', ' ', '*']
    for s in suspicious:
        if s in path:
            sys.exit(f"[FAIL] REMOTE_DIR 含可疑字符 '{s}': {path!r}")
    # 部署目标约束：必须在 /var/www/ 下
    if not path.startswith('/var/www/'):
        sys.exit(f"[FAIL] REMOTE_DIR 必须位于 /var/www/ 下: {path!r}")
    print(f"  [OK] REMOTE_DIR 校验通过: {path}")


def get_ssh_key_path() -> str:
    """获取 SSH 私钥路径。

    优先级：环境变量 DEPLOY_SSH_KEYPATH > 默认路径 ~/.ssh/starcore_deploy_ed25519。
    仍不存在则报错退出。
    """
    key_path = os.environ.get('DEPLOY_SSH_KEYPATH') or os.path.expanduser('~/.ssh/starcore_deploy_ed25519')
    if not os.path.isfile(key_path):
        print(f"[FAIL] SSH 私钥未找到: {key_path}")
        print("  请设置环境变量 DEPLOY_SSH_KEYPATH 指向有效私钥文件，")
        print("  或将私钥放置于 ~/.ssh/starcore_deploy_ed25519")
        sys.exit(1)
    return key_path


# —— 部署逻辑 ——

def run_cmd(ssh, cmd, check=True):
    """执行远程命令"""
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    code = stdout.channel.recv_exit_status()
    if check and code != 0:
        print(f"  [FAIL] {cmd}")
        if err: print(f"  stderr: {err}")
        if out: print(f"  stdout: {out}")
        return False, out, err
    return True, out, err

def upload_dir_sftp(sftp, local_dir, remote_dir):
    """递归上传目录"""
    # 确保远程目录存在
    try:
        sftp.stat(remote_dir)
    except FileNotFoundError:
        sftp.mkdir(remote_dir)

    for item in os.listdir(local_dir):
        local_path = os.path.join(local_dir, item)
        remote_path = remote_dir + "/" + item
        if os.path.isdir(local_path):
            try:
                sftp.stat(remote_path)
            except FileNotFoundError:
                sftp.mkdir(remote_path)
            upload_dir_sftp(sftp, local_path, remote_path)
        else:
            print(f"  上传 {item} ...")
            sftp.put(local_path, remote_path)

def main():
    # 解析参数
    dry_run = '--dry-run' in sys.argv

    print("=" * 50)
    print("星核纪元 · 部署到云服务器")
    print("=" * 50)

    # 0. 安全校验
    print(f"\n[0/5] 安全校验 ...")
    validate_remote_dir(REMOTE_DIR)

    if dry_run:
        # dry-run：仅校验密钥文件是否存在，不实际连接
        key_path = os.environ.get('DEPLOY_SSH_KEYPATH') or os.path.expanduser('~/.ssh/starcore_deploy_ed25519')
        if not os.path.isfile(key_path):
            print(f"  [SKIP] SSH 私钥未找到: {key_path}（dry-run 模式下不阻塞）")
        else:
            print(f"  [OK] SSH 私钥就绪: {key_path}")
        print("\n[dry-run] 参数校验完成，未实际连接服务器。")
        return

    # 1. 读取凭据 + 连接 SSH
    print(f"\n[1/5] 连接服务器 {HOST}:{PORT} ...")
    key_path = get_ssh_key_path()
    ssh = paramiko.SSHClient()
    # 加载 known_hosts 并使用 RejectPolicy，拒绝未知主机密钥
    ssh.load_system_host_keys()
    ssh.set_missing_host_key_policy(paramiko.RejectPolicy())
    try:
        ssh.connect(HOST, port=PORT, username=USER, key_filename=key_path, timeout=15)
        print("  [OK] SSH 连接成功（密钥认证）")
    except paramiko.ssh_exception.SSHException as e:
        msg = str(e)
        if "Unable to verify" in msg or "not found" in msg.lower() or "key" in msg.lower():
            print(f"  [FAIL] 主机密钥验证失败: {e}")
            print(f"  请先运行: ssh-keyscan -p {PORT} -H {HOST} >> ~/.ssh/known_hosts")
        else:
            print(f"  [FAIL] SSH 连接失败: {e}")
        return
    except Exception as e:
        print(f"  [FAIL] SSH 连接失败: {e}")
        return

    # 2. 创建网站目录
    print(f"\n[2/5] 创建网站目录 {REMOTE_DIR} ...")
    run_cmd(ssh, f"sudo mkdir -p {REMOTE_DIR}")
    run_cmd(ssh, f"sudo chown -R {USER}:{USER} {REMOTE_DIR}")
    run_cmd(ssh, f"sudo rm -rf {REMOTE_DIR}/*")
    print("  [OK] 目录已清空")

    # 3. 上传构建产物
    print(f"\n[3/5] 上传构建产物 ...")
    sftp = ssh.open_sftp()
    upload_dir_sftp(sftp, LOCAL_DIST, REMOTE_DIR)
    sftp.close()
    print("  [OK] 所有文件已上传")

    # 4. 配置 Nginx
    print(f"\n[4/5] 配置 Nginx ...")
    nginx_conf = """server {
    listen 80;
    listen [::]:80;
    server_name _;

    root /var/www/starcore;
    index index.html;

    # gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;

    # 安全头（server 级别默认）
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # index.html — 不缓存，确保用户总是拿到最新入口
    # 浏览器每次请求都向服务器验证 ETag/Last-Modified
    location = /index.html {
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Cache-Control "no-cache, must-revalidate" always;
    }

    # SPA 路由：所有路径回退到 index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静态资源长缓存（文件名含 content hash，可安全 immutable）
    location /assets/ {
        expires 30d;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Cache-Control "public, immutable";
    }

    # 自托管字体缓存
    location /fonts/ {
        expires 30d;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Cache-Control "public, immutable";
        add_header Access-Control-Allow-Origin "*";
    }
}
"""
    # 写入临时文件再 sudo 移动
    run_cmd(ssh, "cat > /tmp/starcore_nginx.conf << 'NGINX_EOF'\n" + nginx_conf + "NGINX_EOF")
    run_cmd(ssh, "sudo mv /tmp/starcore_nginx.conf /etc/nginx/sites-available/starcore")
    run_cmd(ssh, "sudo ln -sf /etc/nginx/sites-available/starcore /etc/nginx/sites-enabled/starcore")
    # 移除 default 站点避免冲突
    run_cmd(ssh, "sudo rm -f /etc/nginx/sites-enabled/default", check=False)
    # 测试 Nginx 配置
    ok, out, err = run_cmd(ssh, "sudo nginx -t", check=False)
    if not ok:
        print(f"  [FAIL] Nginx 配置测试失败: {err}")
        ssh.close()
        return
    # 重载 Nginx
    run_cmd(ssh, "sudo systemctl reload nginx")
    run_cmd(ssh, "sudo systemctl enable nginx", check=False)
    print("  [OK] Nginx 配置完成并已重载")

    # 5. 验证
    print(f"\n[5/5] 验证部署 ...")
    ok, out, err = run_cmd(ssh, "curl -s -o /dev/null -w '%{http_code}' http://localhost/", check=False)
    print(f"  HTTP 状态码: {out}")
    if out == "200":
        print("  [OK] 部署验证成功！")
    else:
        print(f"  [WARN] 返回码非 200，检查 Nginx 状态")
        run_cmd(ssh, "sudo systemctl status nginx --no-pager -l", check=False)

    # 列出文件
    print("\n远程文件列表:")
    run_cmd(ssh, f"ls -la {REMOTE_DIR}/")
    run_cmd(ssh, f"ls -la {REMOTE_DIR}/assets/ | head -20")

    ssh.close()
    print("\n" + "=" * 50)
    print("部署完成！")
    print(f"访问地址: http://{HOST}")
    print("=" * 50)

if __name__ == "__main__":
    main()
