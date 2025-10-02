#!/bin/bash

# Simple global dictation script using xbindkeys for global hotkey

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DICTATION_SCRIPT="$SCRIPT_DIR/src/dictation.js"
PID_FILE="/tmp/dictation.pid"

# Function to check if dictation is running
is_running() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
            return 0
        else
            rm -f "$PID_FILE"
            return 1
        fi
    fi
    return 1
}

# Function to start dictation
start_dictation() {
    if is_running; then
        echo "Dictation is already running (PID: $(cat $PID_FILE))"
        return 1
    fi

    echo "Starting global dictation system..."

    # Check if coding mode is being used
    if [[ "$*" == *"--coding"* ]]; then
        echo "🤖 CODING MODE: Voice prompts will be sent to Claude Code CLI"
        echo "Use Ctrl+Space to send voice prompts to Claude Code"
    else
        echo "⌨️  TYPING MODE: Voice will be typed as text"
        echo "Use Ctrl+Space to dictate (hold to record, release to type)"
    fi

    if [[ "$*" == *"--manual"* ]]; then
        echo "📖 Manual mode: Use Enter key instead of Ctrl+Space"
    fi

    echo "Press Ctrl+C to stop"

    node "$DICTATION_SCRIPT" "$@" &
    echo $! > "$PID_FILE"

    # Wait for the process to finish
    wait
    rm -f "$PID_FILE"
}

# Function to stop dictation
stop_dictation() {
    if is_running; then
        PID=$(cat "$PID_FILE")
        echo "Stopping dictation (PID: $PID)"
        kill "$PID"
        rm -f "$PID_FILE"
        echo "Dictation stopped"
    else
        echo "Dictation is not running"
    fi
}

# Function to show status
status_dictation() {
    if is_running; then
        echo "Dictation is running (PID: $(cat $PID_FILE))"
    else
        echo "Dictation is not running"
    fi
}

# Main command handling
case "$1" in
    start)
        shift
        start_dictation "$@"
        ;;
    stop)
        stop_dictation
        ;;
    restart)
        stop_dictation
        sleep 1
        shift
        start_dictation "$@"
        ;;
    status)
        status_dictation
        ;;
    code)
        shift
        start_dictation --coding "$@"
        ;;
    manual)
        start_dictation --manual
        ;;
    *)
        echo "Usage: dictation {start|stop|restart|status|code|manual} [options]"
        echo ""
        echo "Commands:"
        echo "  start    - Start dictation with Ctrl+Space hotkey (typing mode)"
        echo "  code     - Start dictation in coding mode (sends prompts to Claude Code)"
        echo "  stop     - Stop dictation"
        echo "  restart  - Restart dictation"
        echo "  status   - Show dictation status"
        echo "  manual   - Start dictation in manual mode (Enter key)"
        echo ""
        echo "Coding Mode Options:"
        echo "  --coding-path PATH        - Set working directory for Claude Code"
        echo "  --claude-code-path PATH   - Set path to claude-code CLI binary"
        echo ""
        echo "General Options:"
        echo "  --manual                  - Use Enter key instead of Ctrl+Space"
        echo ""
        echo "Examples:"
        echo "  dictation code --coding-path /path/to/project    # Voice coding in specific project"
        echo "  dictation code --manual                          # Voice coding with Enter key"
        echo "  dictation start                                  # Regular typing dictation"
        echo ""
        echo "Requirements:"
        echo "  - sox (for audio recording)"
        echo "  - xdotool (for typing text in typing mode)"
        echo "  - claude-code CLI (for coding mode)"
        echo "  - whisper.cpp built binary"
        echo "  - Model file in models/ directory"
        exit 1
        ;;
esac