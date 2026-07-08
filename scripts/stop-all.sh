#!/usr/bin/env bash

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PID_FILE="$ROOT/scripts/.pids"

echo "  Stopping all Idea Orchestrator services…"

# Kill by saved PIDs first
if [ -f "$PID_FILE" ]; then
  while IFS= read -r pid; do
    kill -9 "$pid" 2>/dev/null && echo "  ✓ Killed PID $pid" || true
  done < "$PID_FILE"
  rm -f "$PID_FILE"
fi

# Also kill by port in case any were started manually
for port in 3001 3002 3003 5174; do
  pids=$(lsof -ti:"$port" 2>/dev/null)
  if [ -n "$pids" ]; then
    echo "$pids" | xargs kill -9 2>/dev/null
    echo "  ✓ Cleared port $port"
  fi
done

echo "  Done."
