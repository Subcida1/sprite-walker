#!/usr/bin/env bash
# Stop script for Sprite Walker overlay server
# Usage: ./stop-server.sh

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="${PROJECT_DIR}/server.pid"

if [[ -f "${PID_FILE}" ]]; then
    PID="$(cat "${PID_FILE}")"
    if kill -0 "${PID}" 2>/dev/null; then
        echo "Stopping server (PID: ${PID})..."
        kill "${PID}"
        rm -f "${PID_FILE}"
        echo "Server stopped."
        exit 0
    else
        echo "Server not running (stale PID file found)."
        rm -f "${PID_FILE}"
    fi
else
    echo "No PID file found. Killing any node server/index.js processes..."
    pkill -f "node server/index.js" || echo "No process found."
fi