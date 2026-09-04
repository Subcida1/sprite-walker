#!/usr/bin/env bash
# Toggle script for Sprite Walker overlay server
# Usage: ./toggle-server.sh

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="${PROJECT_DIR}/server.log"
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
    # Also check via pkill in case PID file was stale or missing
    if pgrep -f "node server/index.js" > /dev/null; then
        echo "Stopping existing Sprite Walker server processes..."
        pkill -f "node server/index.js" || true
        rm -f "${PID_FILE}"
        echo "Server stopped."
    else
        echo "Starting Sprite Walker server..."
        nohup node server/index.js >> "${LOG_FILE}" 2>&1 &
        SERVER_PID=$!
        echo ${SERVER_PID} > "${PID_FILE}"
        sleep 1
        if kill -0 "${SERVER_PID}" 2>/dev/null; then
            echo "Server started successfully (PID: ${SERVER_PID})"
            echo "Logs: tail -f ${LOG_FILE}"
            echo "Overlay: http://localhost:3847/"
        else
            echo "Server failed to start — check ${LOG_FILE}"
            rm -f "${PID_FILE}"
            exit 1
        fi
    fi
fi