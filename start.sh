#!/usr/bin/env bash
set -euo pipefail

# start.sh - 启动开发服务器（前端 + 后端）
# 使用：
#   ./start.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if ! command -v npm >/dev/null 2>&1; then
  echo "错误：npm 未安装，请先安装 Node.js 和 npm。"
  exit 1
fi

# 安装依赖（可选）
if [ "${1:-}" = "install" ]; then
  echo "正在安装所有依赖..."
  npm run install:all
  echo "安装完成。"
  exit 0
fi

# 开发模式启动
if [ ! -x "$(pwd)/node_modules/.bin/concurrently" ]; then
  echo "警告：缺少依赖或者未安装。请先运行 './start.sh install' 或 'npm run install:all'。"
  echo "尝试自动安装依赖..."
  npm run install:all
fi

echo "启动开发服务器（前端+后端）..."
npm run dev
