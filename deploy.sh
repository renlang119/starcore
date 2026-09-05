#!/bin/bash
# 星核纪元 · 部署脚本
#
# 构建产物 dist/ 同步到 nginx 站点目录 /var/www/starcore，
# 由 nginx 对外服务。
#
# 用法：
#   ./deploy.sh            # 构建 + 部署 + 验证
#   ./deploy.sh --skip-build   # 跳过构建，直接同步现有 dist/
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_DIR"

DEST="/var/www/starcore"
SKIP_BUILD=0
[[ "${1:-}" == "--skip-build" ]] && SKIP_BUILD=1

echo "==== 星核纪元 · 部署 ===="

# 0. 前置校验：目标必须是站点目录，防止误同步
case "$DEST" in
  /var/www/*) ;;
  *) echo "[FAIL] 部署目标必须是 /var/www/ 下: $DEST" >&2; exit 1 ;;
esac
[[ -d "$DEST" ]] || { echo "[FAIL] 站点目录不存在: $DEST" >&2; exit 1; }

# 1. 构建（含 vue-tsc 类型检查）
if [[ $SKIP_BUILD -eq 0 ]]; then
  echo "[1/4] 构建 ..."
  corepack pnpm build
else
  [[ -f dist/index.html ]] || { echo "[FAIL] dist/ 不存在，先构建" >&2; exit 1; }
  echo "[1/4] 跳过构建（--skip-build）"
fi

# 2. 同步产物
# rsync --delete 清掉站点里已从产物中移除的旧文件（如 v0.44 清理的 icons.svg 残留），
# 这是 cp -r 覆盖式部署做不到的；--exclude 防止误删服务器侧 .well-known（证书续期用）。
echo "[2/4] 同步到 $DEST ..."
sudo rsync -rcv --delete \
  --exclude='.well-known/' \
  dist/ "$DEST/"

# 3. 权限
echo "[3/4] 修正权限 ..."
sudo chown -R root:root "$DEST"
sudo chmod -R a+rX "$DEST"

# 4. 验证：线上入口 + 版本号
echo "[4/4] 验证 ..."
LOCAL_CODE=$(curl -s -o /dev/null -w '%{http_code}' "https://example.com/?t=$(date +%s)")
VERSION=$(node -e "console.log(JSON.parse(require('fs').readFileSync('package.json','utf8')).version)")
BUNDLE=$(curl -s "https://example.com/?t=$(date +%s)" | grep -oE 'index-[A-Za-z0-9_-]+\.js' | head -1)
REMOTE_VERSION=$(curl -s "https://example.com/assets/$BUNDLE" | grep -oE "\"$VERSION\"" | head -1)

echo "  HTTP 状态: $LOCAL_CODE"
echo "  线上 bundle: $BUNDLE"
if [[ "$LOCAL_CODE" == "200" && -n "$REMOTE_VERSION" ]]; then
  echo "  [OK] 部署验证通过：线上版本 v$VERSION"
else
  echo "  [WARN] 验证未完全通过，请人工检查（状态码 $LOCAL_CODE，版本串命中: ${REMOTE_VERSION:-无}）" >&2
  exit 2
fi

echo "==== 部署完成 ===="
