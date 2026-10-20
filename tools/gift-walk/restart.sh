#!/bin/sh
cd /e/Dev/_recovery-staging/gift-session
pid=$(netstat -ano | grep ":3777 " | grep LISTENING | head -1 | awk '{print $5}')
[ -n "$pid" ] && taskkill //F //PID $pid >/dev/null 2>&1
sleep 2
WALK_ARTWORK="E:/Dev/_recovery-staging/frontend-deploy-review/catalog-samples/scene-completion-2026-10-19/portraits-fine_art-generated.png" PORT=3777 nohup node --import tsx tools/gift-walk/server.mts > /tmp/walk.log 2>&1 &
for i in $(seq 1 40); do sleep 2; curl -s -o /dev/null localhost:3777/api/v1/auth/me && break; done
tail -1 /tmp/walk.log
