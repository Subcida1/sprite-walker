#!/usr/bin/env bash
# Toggle script that launches server in a new terminal window with live logs
# Usage: ./toggle-server.sh

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="${PROJECT_DIR}/server.pid"

cd "${PROJECT_DIR}"

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
        echo "Starting Sprite Walker server in a new terminal window..."
        
        # Detect available terminal emulator on KDE / Kubuntu / Linux
        TERMINAL_EMULATOR=""
        if command -v konsole &>/dev/null; then
            TERMINAL_EMULATOR="konsole"
        elif command -v gnome-terminal &>/dev/null; then
            TERMINAL_EMULATOR="gnome-terminal"
        elif command -v xterm &>/dev/null; then
            TERMINAL_EMULATOR="xterm"
        fi

        if [[ -n "${TERMINAL_EMULATOR}" ]]; then
            if [[ "${TERMINAL_EMULATOR}" == "konsole" ]]; then
                konsole --noclose -e bash -c "cd '${PROJECT_DIR}' && npm start" &
            elif [[ "${TERMINAL_EMULATOR}" == "gnome-terminal" ]]; then
                gnome-terminal -- bash -c "cd '${PROJECT_DIR}' && npm start; exec bash" &
            elif [[ "${TERMINAL_EMULATOR}" == "xterm" ]]; then
                xterm -hold -e "cd '${PROJECT_DIR}' && npm start" &
            fi
            
            # Give server a moment to spin up and grab PID
            sleep 1
            pgrep -f "node server/index.js" > "${PID_FILE}" || true
            echo "Server launched in new terminal window!"
        else
            # Fallback if no graphical terminal found
            echo "No graphical terminal found, starting in background with tail -f..."
            nohup npm start > server.log 2>&1 &
            echo $! > "${PID_FILE}"
            tail -f server.log
        fi
    fi
fi
