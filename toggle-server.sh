#!/usr/bin/env bash
# Toggle script for Sprite Walker overlay server
# Usage: ./toggle-server.sh

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="${PROJECT_DIR}/server.pid"

cd "${PROJECT_DIR}"

# Check if server is currently running
if [[ -f "${PID_FILE}" ]] && kill -0 "$(cat "${PID_FILE}")" 2>/dev/null; then
    PID="$(cat "${PID_FILE}")"
    echo "Stopping Sprite Walker server (PID: ${PID})..."
    kill "${PID}"
    rm -f "${PID_FILE}"
    echo "Server stopped."
else
    if pgrep -f "node server/index.js" > /dev/null; then
        echo "Stopping existing Sprite Walker server processes..."
        pkill -f "node server/index.js" || true
        rm -f "${PID_FILE}"
        echo "Server stopped."
    else
        echo "Starting Sprite Walker server in foreground (Press Ctrl+C to stop)..."
        echo "--------------------------------------------------------"
        # Run in foreground so logs stream directly to your terminal
        node server/index.js &
        SERVER_PID=$!
        echo ${SERVER_PID} > "${PID_FILE}"
        
        # Trap Ctrl+C to clean up PID file when user exits
        trap "kill ${SERVER_PID} 2>/dev/null; rm -f '${PID_FILE}'; exit 0" INT TERM
        
        wait ${SERVER_PID} || true
        rm -f "${PID_FILE}"
    fi
fi
