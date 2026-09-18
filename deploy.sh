#!/bin/bash
# 星核纪元 · 部署脚本
#
# 构建产物 dist/ 同步到 nginx 站点目录，由 nginx 对外服务。
# 目标目录与站点域名通过环境变量或脚本顶部常量配置。

set -euo pipefail

# 显式传入的环境变量优先于 env 文件配置（source 会覆盖外部已设值，
# 外部 DEPLOY_DEST 曾被 deploy.env 静默改写，历史沙箱实踩）
EXPLICIT_DEST="${DEPLOY_DEST:-}"
EXPLICIT_URL="${DEPLOY_URL:-}"

# 可选部署配置：DEPLOY_DEST / DEPLOY_URL 环境变量，或用户侧 env 文件
ENV_CANDIDATES=(
  "$(dirname "${BASH_SOURCE[0]}")/.deploy.env"
  "${XDG_CONFIG_HOME:-$HOME/.config}/starcore/deploy.env"
)
for f in "${ENV_CANDIDATES[@]}"; do
  if [[ -f "$f" ]]; then
    source "$f"
  fi
done
DEST="${EXPLICIT_DEST:-${DEPLOY_DEST:-/var/www/starcore}}"
SITE_URL="${EXPLICIT_URL:-${DEPLOY_URL:-}}"
[[ -n "$SITE_URL" ]] || { echo "[FAIL] 未配置 DEPLOY_URL（环境变量或配置文件）" >&2; exit 1; }

SKIP_BUILD=0
if [[ "${1:-}" == "--skip-build" ]]; then
  SKIP_BUILD=1
fi

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_DIR"

VERSION=$(node -e "console.log(JSON.parse(require('fs').readFileSync('package.json','utf8')).version)")
# 显示版本串：与 src/version.ts 同口径去末尾 .0（0.87.0 显示 v0.87）
DISPLAY_VERSION="${VERSION%.0}"

echo "==== 星核纪元 · 部署 ===="

# 0. 前置校验：目标规范化后必须是 /var/www/ 下的站点目录
#    （realpath -m 展开 .. 与相对段，正则拒绝空尾段与目录穿越）
DEST="$(realpath -m "$DEST")"
if [[ ! "$DEST" =~ ^/var/www/[A-Za-z0-9._-]+/?$ ]]; then
  echo "[FAIL] 部署目标必须是 /var/www/ 下的站点目录: $DEST" >&2
  exit 1
fi
[[ -d "$DEST" ]] || { echo "[FAIL] 站点目录不存在: $DEST" >&2; exit 1; }
echo "  目标目录: $DEST"
echo "  站点地址: $SITE_URL"

# 1. 前置质量关卡：完整 check（构建含类型检查 + 单测 + 计数守恒 + lint/format，
#    任一失败即中断，不部署未过关的产物）。
#    计数守恒的 Playwright 段经 STARCORE_PW_DIR 环境变量启用（本机 deploy.env 配置）；
#    工作树不干净仅告警不阻断（软校验）。
echo "[1/5] 前置关卡（check：build / test / 守恒 / lint / format）..."
if [[ -n "$(git status --porcelain 2>/dev/null || true)" ]]; then
  echo "  [WARN] 工作树存在未提交改动，部署产物可能与远端仓库不一致（软校验不阻断）" >&2
fi
corepack pnpm check

# 2. 构建（含 vue-tsc 类型检查）
if [[ $SKIP_BUILD -eq 0 ]]; then
  echo "[2/5] 构建 ..."
  corepack pnpm build
else
  [[ -f dist/index.html ]] || { echo "[FAIL] dist/ 不存在，先构建" >&2; exit 1; }
  echo "[2/5] 跳过构建（--skip-build），预检本地产物版本 ..."
  LOCAL_BUNDLE=$(grep -oE 'index-[A-Za-z0-9_-]+\.js' dist/index.html | head -1 || true)
  # 显示串为运行时 replace 生成、bundle 无静态 v 串，验证双要素：
  # 完整版本串原样存在（版本源正确）+ 去零逻辑存在（显示口径在）
  if [[ -z "$LOCAL_BUNDLE" ]] \
    || ! grep -qE "\"${VERSION//./\\.}\"" "dist/assets/$LOCAL_BUNDLE" \
    || ! grep -qF 'replace(/\.0$/' "dist/assets/$LOCAL_BUNDLE"; then
    echo "[FAIL] 本地产物版本与 package.json（v$VERSION）不符，先重新构建" >&2
    exit 1
  fi
  echo "  [OK] 本地产物 v$VERSION（$LOCAL_BUNDLE）"
fi

# 3. 同步产物
# rsync --delete 清掉站点里已从产物中移除的旧文件；
# --exclude 防止误删服务器侧 .well-known（证书续期用）。
echo "[3/5] 同步到 $DEST ..."
sudo rsync -rcv --delete \
  --exclude='.well-known/' \
  --exclude='*.map' \
  dist/ "$DEST/"

# 分享元数据绝对地址注入：仓库与构建产物保持无域名相对形态，
# 部署时按 SITE_URL 注入线上绝对地址（og:image / og:url / canonical）。
# canonical 在仓库缺省（Vite 会把 link href 目录当作资产处理导致构建失败），
# 部署时随 og:url 行一并插入
echo "  注入分享元数据绝对地址 ..."
sudo sed -i \
  -e "s|<meta property=\"og:url\" content=\"/\" />|<meta property=\"og:url\" content=\"${SITE_URL}/\" />\n  <link rel=\"canonical\" href=\"${SITE_URL}/\" />|" \
  -e "s|content=\"/og.webp\"|content=\"${SITE_URL}/og.webp\"|g" \
  "$DEST/index.html"
INJECTED_OG=$(sudo grep -c "content=\"${SITE_URL}/og.webp\"" "$DEST/index.html" || true)
INJECTED_CANONICAL=$(sudo grep -c "rel=\"canonical\" href=\"${SITE_URL}/\"" "$DEST/index.html" || true)
if [[ "$INJECTED_OG" != "2" || "$INJECTED_CANONICAL" != "1" ]]; then
  echo "  [WARN] 分享元数据注入命中异常（og ${INJECTED_OG}/2，canonical ${INJECTED_CANONICAL}/1），请人工检查 $DEST/index.html" >&2
fi

# 4. 权限
echo "[4/5] 修正权限 ..."
sudo chown -R root:root "$DEST"
sudo chmod -R a+rX "$DEST"

# 5. 验证：线上入口 + 版本号
echo "[5/5] 验证 ..."
VERSION_RE="${DISPLAY_VERSION//./\\.}"
LOCAL_CODE=$(curl -s --max-time 15 -o /dev/null -w '%{http_code}' "$SITE_URL/?t=$(date +%s)" || true)
BUNDLE=$(curl -s --max-time 15 "$SITE_URL/?t=$(date +%s)" | grep -oE 'index-[A-Za-z0-9_-]+\.js' | head -1 || true)
REMOTE_VERSION=""
REMOTE_STRIP=""
if [[ -n "$BUNDLE" ]]; then
  # 单次抓取 bundle 后做串内匹配：避免 curl|grep 管道在 pipefail 下
  # 因对端提前关闭被误判（v0.90 实测验证段两次假 WARN 的加固）
  BUNDLE_JS=$(curl -s --max-time 15 "$SITE_URL/assets/$BUNDLE" || true)
  if [[ -n "$BUNDLE_JS" ]]; then
    REMOTE_VERSION=$(grep -oE "\"${VERSION//./\\.}\"" <<< "$BUNDLE_JS" | head -1 || true)
    if grep -qF 'replace(/\.0$/' <<< "$BUNDLE_JS"; then
      REMOTE_STRIP=strip-ok
    fi
  fi
fi

echo "  HTTP 状态: $LOCAL_CODE"
echo "  线上 bundle: $BUNDLE"
if [[ "$LOCAL_CODE" == "200" && -n "$REMOTE_VERSION" && -n "$REMOTE_STRIP" ]]; then
  echo "  [OK] 部署验证通过：线上版本 v$DISPLAY_VERSION"
else
  echo "  [WARN] 验证未完全通过，请人工检查（状态码 $LOCAL_CODE，版本串命中: ${REMOTE_VERSION:-无}）" >&2
  exit 2
fi

echo "==== 部署完成 ===="
