#!/usr/bin/env bash
# 问星 H5 · 一键部署脚本
# 适用：Ubuntu 22.04 / 24.04（香港或海外轻量服务器，root 身份运行）
#
# 用法（在项目根目录）：
#   sudo bash deploy/setup.sh 你的域名 [AI_KEY]
#
# 例：
#   sudo bash deploy/setup.sh wx.example.com sk-xxxxxxxxxxxxxxxx
#
# 脚本会做：装 Node 20 → 装 Caddy（自动申请 HTTPS 证书）→ 写配置
#          → 注册开机自启服务 → 启动并自检。
# 可重复执行，不会重复安装。

set -euo pipefail

DOMAIN="${1:-}"
AI_KEY="${2:-}"
PORT="${PORT:-8787}"
SERVICE="wenxing"
NODE_MAJOR=20

# ---------- 0. 前置检查 ----------
if [ -z "$DOMAIN" ]; then
  echo "缺少域名。用法：sudo bash deploy/setup.sh 你的域名 [AI_KEY]"
  exit 1
fi
if [ "$(id -u)" -ne 0 ]; then
  echo "请用 root 运行：sudo bash deploy/setup.sh $DOMAIN"
  exit 1
fi

# 项目根目录 = 脚本所在目录的上一级
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [ ! -f "$APP_DIR/index.html" ] || [ ! -f "$APP_DIR/ai-proxy/server.js" ]; then
  echo "找不到项目文件。请在 tarot-h5 目录下执行本脚本（当前解析到：$APP_DIR）"
  exit 1
fi

echo "=============================================="
echo "  问星 H5 部署"
echo "  域名：$DOMAIN"
echo "  目录：$APP_DIR"
echo "  端口：$PORT（仅本机，由 Caddy 对外）"
echo "=============================================="

# ---------- 1. 系统依赖 ----------
echo "==> [1/6] 安装系统依赖"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl ca-certificates gnupg git apt-transport-https >/dev/null

# ---------- 2. Node.js ----------
if command -v node >/dev/null 2>&1 && [ "$(node -v | sed 's/v\([0-9]*\).*/\1/')" -ge 18 ]; then
  echo "==> [2/6] Node 已存在：$(node -v)，跳过"
else
  echo "==> [2/6] 安装 Node.js ${NODE_MAJOR}.x"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
NODE_BIN="$(command -v node)"
echo "     node: $(node -v)  ($NODE_BIN)"

# ---------- 3. Caddy（自动 HTTPS） ----------
if command -v caddy >/dev/null 2>&1; then
  echo "==> [3/6] Caddy 已存在，跳过"
else
  echo "==> [3/6] 安装 Caddy"
  curl -1sLf "https://dl.cloudsmith.io/public/caddy/stable/gpg.key" \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf "https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt" \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq
  apt-get install -y -qq caddy >/dev/null
fi

# ---------- 4. 运行配置 ----------
echo "==> [4/6] 写入应用配置"
ENV_FILE="$APP_DIR/ai-proxy/.env"
if [ -n "$AI_KEY" ]; then
  cat > "$ENV_FILE" <<EOF
# 由 deploy/setup.sh 生成（权限 600，不入库）
AI_KEY=$AI_KEY
AI_MODEL=deepseek-chat
AI_BASE_URL=https://api.deepseek.com/v1/chat/completions
AI_CACHE_TTL=21600
AI_SERVE_STATIC=1
EOF
  echo "     已写入 AI_KEY"
elif [ -f "$ENV_FILE" ] && grep -q '^AI_KEY=.\+' "$ENV_FILE"; then
  echo "     检测到已有 AI_KEY，保留不动"
else
  cat > "$ENV_FILE" <<'EOF'
# 由 deploy/setup.sh 生成（AI_KEY 留空 = 走离线规则兜底）
AI_KEY=
AI_MODEL=deepseek-chat
AI_BASE_URL=https://api.deepseek.com/v1/chat/completions
AI_CACHE_TTL=21600
AI_SERVE_STATIC=1
EOF
  echo "     未提供 AI_KEY，AI 将走离线兜底（页面不报错，之后可再跑本脚本补上）"
fi
chmod 600 "$ENV_FILE"

# ---------- 5. 开机自启服务 ----------
echo "==> [5/6] 注册系统服务（systemd）"
cat > "/etc/systemd/system/${SERVICE}.service" <<EOF
[Unit]
Description=Wenxing H5 (塔罗 / 命盘)
After=network.target

[Service]
Type=simple
WorkingDirectory=$APP_DIR
Environment=PORT=$PORT
Environment=HOST=127.0.0.1
Environment=NODE_ENV=production
ExecStart=$NODE_BIN ai-proxy/server.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$SERVICE" >/dev/null 2>&1 || true
systemctl restart "$SERVICE"

# ---------- 6. 反向代理 + 证书 ----------
echo "==> [6/6] 配置 Caddy（自动申请 HTTPS 证书）"
cat > /etc/caddy/Caddyfile <<EOF
# 由 deploy/setup.sh 生成
$DOMAIN {
	encode gzip zstd
	reverse_proxy 127.0.0.1:$PORT
}
EOF
systemctl enable caddy >/dev/null 2>&1 || true
systemctl restart caddy

# ---------- 自检 ----------
echo ""
echo "==> 自检"
sleep 2
if curl -fsS --max-time 8 "http://127.0.0.1:$PORT/health" >/dev/null 2>&1; then
  echo "     应用已启动 ✓"
else
  echo "     应用未响应，查看日志：journalctl -u $SERVICE -n 50 --no-pager"
fi

echo ""
echo "=============================================="
echo "  完成。等 10~60 秒证书签发后访问："
echo "    https://$DOMAIN"
echo ""
echo "  常用命令："
echo "    看应用日志   journalctl -u $SERVICE -f"
echo "    重启应用     systemctl restart $SERVICE"
echo "    看证书状态   journalctl -u caddy -n 50 --no-pager"
echo "    补/换 AI Key  sudo bash deploy/setup.sh $DOMAIN 新Key"
echo ""
echo "  若网站打不开，先检查："
echo "    1) 域名是否已解析到本机公网 IP"
echo "    2) 云控制台安全组是否放行 80 和 443"
echo "=============================================="
