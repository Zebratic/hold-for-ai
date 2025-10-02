#!/bin/bash
# Voice Dictation Toggle Script for Wayland
# This script provides a toggle mechanism for voice recording when global hotkeys don't work

TRIGGER_FILE="/tmp/voice-dictation-trigger"
LOCK_FILE="/tmp/voice-dictation-recording"

if [ -f "$LOCK_FILE" ]; then
    # Currently recording - stop recording
    rm -f "$LOCK_FILE"
    echo "🎤 Recording stopped"
    notify-send "Voice Dictation" "Recording stopped" --icon=microphone-sensitivity-medium
else
    # Not recording - start recording
    touch "$LOCK_FILE"
    touch "$TRIGGER_FILE"
    echo "🎤 Recording started"
    notify-send "Voice Dictation" "Recording started - press the hotkey again to stop" --icon=microphone-sensitivity-high
fi