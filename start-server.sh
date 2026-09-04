#!/usr/bin/env bash
# Persistent startup script for Sprite Walker overlay server
# Usage: ./start-server.sh

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="${PROJECT_DIR}/server.log"
PID_FILE="${PROJECT_DIR}/server.pid"

cd "${PROJECT_DIR}"

# If already running, print info and exit
if [[ -f "${PID_FILE}" ]] && kill -0 "$(cat "${PID_FILE}")" 2>/dev/null; then
    echo "Server already running (PID: $(cat "${PID_FILE}"))"
    exit 0
fi

echo "Starting Sprite Walker server..."
nohup node server/index.js >> "${LOG_FILE}" 2>&1 &
SERVER_PID=$!

echo ${SERVER_PID} > "${PID_FILE}"

# Wait a moment and verify it's up
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