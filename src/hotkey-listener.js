#!/usr/bin/env node

const { spawn } = require('child_process');

class HotkeyListener {
    constructor(onPress, onRelease) {
        this.onPress = onPress;
        this.onRelease = onRelease;
        this.isPressed = false;
    }

    start() {
        console.log('Starting global hotkey listener...');
        console.log('Hold Ctrl+Space to dictate, release to type');

        // Use xev to monitor keyboard events
        const xev = spawn('bash', ['-c', `
            xinput list | grep -i "keyboard\\|Virtual core keyboard" | head -1 | sed 's/.*id=\\([0-9]*\\).*/\\1/' | while read id; do
                if [ "$id" ]; then
                    xinput test "$id"
                fi
            done
        `]);

        let ctrlPressed = false;
        let spacePressed = false;

        xev.stdout.on('data', (data) => {
            const lines = data.toString().split('\n');

            for (const line of lines) {
                console.log(line);
                // Monitor for Ctrl key events
                if (line.includes('key press') && (line.includes('keycode 37') || line.includes('keycode 105'))) {
                    ctrlPressed = true;
                } else if (line.includes('key release') && (line.includes('keycode 37') || line.includes('keycode 105'))) {
                    ctrlPressed = false;
                    this.handleRelease();
                }

                // Monitor for Space key events (keycode 65)
                if (line.includes('key press') && line.includes('keycode 65')) {
                    spacePressed = true;
                    if (ctrlPressed) {
                        this.handlePress();
                    }
                } else if (line.includes('key release') && line.includes('keycode 65')) {
                    spacePressed = false;
                    this.handleRelease();
                }
            }
        });

        xev.on('error', (error) => {
            console.error('❌ Hotkey listener failed:', error.message);
            console.log('Falling back to manual mode...');
            throw error;
        });

        return xev;
    }

    handlePress() {
        if (!this.isPressed) {
            this.isPressed = true;
            if (this.onPress) this.onPress();
        }
    }

    handleRelease() {
        if (this.isPressed) {
            this.isPressed = false;
            if (this.onRelease) this.onRelease();
        }
    }
}

module.exports = HotkeyListener;