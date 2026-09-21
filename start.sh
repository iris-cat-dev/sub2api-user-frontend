#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${ROOT}"

MODE="${1:-dev}"
if [[ $# -gt 0 ]]; then
  shift
fi

print_usage() {
  cat <<'EOF'
用法: ./start.sh [dev|pages|preview] [额外参数...]

  dev       启动 Vite 开发服务（默认）
  pages     构建后用 wrangler pages 本地预览（含 /api、/v1 代理）
  preview   构建后用 vite preview 预览生产产物

环境变量（可写入 .env，或启动前 export）:
  VITE_DEV_PORT=3000
  VITE_DEV_PROXY_TARGET=http://localhost:8080
  VITE_API_BASE_URL=/api/v1
EOF
}

if [[ "${MODE}" == "-h" || "${MODE}" == "--help" ]]; then
  print_usage
  exit 0
fi

case "${MODE}" in
  dev|pages|preview) ;;
  *)
    echo "未知模式: ${MODE}" >&2
    print_usage
    exit 1
    ;;
esac

if ! command -v node >/dev/null 2>&1; then
  echo "未找到 Node.js，请先安装 Node.js 20+" >&2
  exit 1
fi

NODE_MAJOR="$(node -p "Number(process.versions.node.split('.')[0])")"
if (( NODE_MAJOR < 18 )); then
  echo "Node.js 版本过低: $(node -v)，需要 18+" >&2
  exit 1
fi

ensure_pnpm() {
  if command -v pnpm >/dev/null 2>&1; then
    return 0
  fi
  if command -v corepack >/dev/null 2>&1; then
    corepack enable >/dev/null
    corepack prepare pnpm@11.9.0 --activate
    return 0
  fi
  echo "未找到 pnpm。请使用带 corepack 的 Node.js，或执行: npm install -g pnpm@11.9.0" >&2
  exit 1
}

ensure_pnpm

if [[ ! -f .env && -f .env.example ]]; then
  cp .env.example .env
  echo "已从 .env.example 生成 .env"
fi

if [[ ! -x node_modules/.bin/vite ]]; then
  echo "正在安装依赖..."
  pnpm install
fi

PORT="${VITE_DEV_PORT:-3000}"
PROXY="${VITE_DEV_PROXY_TARGET:-http://localhost:8080}"

echo "工作目录: ${ROOT}"
echo "模式: ${MODE}"

case "${MODE}" in
  dev)
    echo "前端: http://127.0.0.1:${PORT}"
    echo "API 代理: ${PROXY}  (/api, /v1)"
    exec pnpm exec vite -- "$@"
    ;;
  pages)
    exec pnpm run pages:dev -- "$@"
    ;;
  preview)
    pnpm run build
    exec pnpm exec vite preview -- "$@"
    ;;
esac
