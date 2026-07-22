#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
rm -rf dist
rm -f src/db/behaviortrack.db src/db/behaviortrack.db-shm src/db/behaviortrack.db-wal
bun run build 2>&1
sudo sh -c 'lsof -t -iTCP:3000 -sTCP:LISTEN | xargs -r kill -9' 2>/dev/null
sleep 0.5
setsid nohup bun run start > .run/server.log 2>&1 < /dev/null &
sleep 2
echo "DONE" > .run/rebuild-status.txt
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ >> .run/rebuild-status.txt
