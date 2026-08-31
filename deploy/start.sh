#!/bin/sh
# 容器启动脚本：后端 uvicorn + 前端 next start + Caddy 反代（主进程）
set -e

# 1. 启动后端（单 worker；SQLite 并发安全；仅监听容器内回环，不直接对外）
cd /app/backend
nohup /app/.venv/bin/uvicorn app.main:app \
  --host 127.0.0.1 --port 8000 --workers 1 \
  > /tmp/uvicorn.log 2>&1 &

# 2. 启动前端
cd /app/frontend
nohup npx next start -p 3000 > /tmp/next.log 2>&1 &

# 3. 给后端一点建表/启动时间（FastAPI 通常 1-2s 就绪）
sleep 5

# 4. Caddy 前台运行（容器主进程，被 kill 则容器退出触发重启）
exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
