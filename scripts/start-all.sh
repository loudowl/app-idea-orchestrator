#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IDEA_AGENT="$ROOT/../app-idea-agent"
AI_WEB_TEAM="$ROOT/../ai-web-team/backend"

# Colours
YELLOW='\033[1;33m'
CYAN='\033[1;36m'
MAGENTA='\033[1;35m'
GREEN='\033[1;32m'
RESET='\033[0m'

# PID file so stop-all can find the processes
PID_FILE="$ROOT/scripts/.pids"
rm -f "$PID_FILE"

echo ""
echo "  Starting all Idea Orchestrator services…"
echo "  ─────────────────────────────────────────"
echo "  idea-agent  → port 3001  (yellow)"
echo "  ai-web-team → port 3002  (cyan)"
echo "  backend     → port 3003  (magenta)"
echo "  web         → port 5174  (green)"
echo "  ─────────────────────────────────────────"
echo "  Stop with: npm run stop:all"
echo ""

# Helper: prefix each line of output with a coloured label
prefix() {
  local color="$1" label="$2"
  while IFS= read -r line; do
    echo -e "${color}[${label}]${RESET} $line"
  done
}

# 1. app-idea-agent
(cd "$IDEA_AGENT" && npm start 2>&1 | prefix "$YELLOW" "idea-agent") &
echo $! >> "$PID_FILE"

# 2. ai-web-team backend (activate venv then run)
(cd "$AI_WEB_TEAM" && bash -c 'source .venv/bin/activate && python main.py' 2>&1 | prefix "$CYAN" "ai-web-team") &
echo $! >> "$PID_FILE"

# 3. orchestrator backend
(cd "$ROOT/backend" && npm run dev 2>&1 | prefix "$MAGENTA" "backend") &
echo $! >> "$PID_FILE"

# 4. orchestrator web
(cd "$ROOT/web" && npm run dev 2>&1 | prefix "$GREEN" "web") &
echo $! >> "$PID_FILE"

# Wait — if any process dies, kill the rest
wait -n 2>/dev/null || wait
echo ""
echo "  A service exited. Run 'npm run stop:all' to clean up."
