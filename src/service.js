#!/usr/bin/env node

const { spawn, exec } = require('child_process');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const fs = require('fs');
const path = require('path');
const ConfigManager = require('./config');

// Set process title for easier identification
process.title = 'voice-dictation-service';

class VoiceDictationService {
    constructor() {
        this.config = new ConfigManager();
        this.isRecording = false;
        this.soxProcess = null;
        this.audioFile = null;
        this.hotkeyProcess = null;

        // Paths
        this.whisperPath = path.resolve(__dirname, '..', 'whisper.cpp', 'build', 'bin', 'main');

        console.log('🎤 Voice Dictation Service Started');
        console.log(`Mode: ${this.config.get('mode')}`);
        console.log(`Hotkey: ${this.config.get('hotkey')}`);
        console.log('Service is ready and listening...\n');

        this.setupSignalHandlers();
        this.startHotkeyListener();
    }

    setupSignalHandlers() {
        process.on('SIGINT', () => this.shutdown());
        process.on('SIGTERM', () => this.shutdown());
        process.on('SIGHUP', () => this.reloadConfig());
    }

    reloadConfig() {
        console.log('📝 Reloading configuration...');
        this.config.loadConfig();
        console.log(`Updated mode: ${this.config.get('mode')}`);

        // Restart hotkey listener if needed
        this.stopHotkeyListener();
        setTimeout(() => this.startHotkeyListener(), 1000);
    }

    async runCMD(command) {
        return new Promise((resolve, reject) => {
            const process = exec(command);
            let stdout = '';

            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            process.on('exit', (code) => {
                if (code === 0) {
                    resolve(stdout.trim());
                } else {
                    reject(new Error(`Command exited with code ${code}`));
                }
            });

            process.on('error', (error) => {
                reject(error);
            });
        });
    }

    startHotkeyListener() {
        console.log('🎹 Starting hotkey listener...');

        try {
            console.log('🔍 Debug: Detecting display server and hotkey method...');

            // Check configuration preference first
            const hotkeyMethod = this.config.get('hotkeyMethod') || 'global';
            const isWayland = process.env.WAYLAND_DISPLAY || process.env.XDG_SESSION_TYPE === 'wayland';

            console.log(`🖥️ Display server: ${isWayland ? 'Wayland' : 'X11'}`);
            console.log(`⚙️ Hotkey method setting: ${hotkeyMethod}`);

            if (hotkeyMethod === 'toggle' || (isWayland && hotkeyMethod === 'global')) {
                console.log('🔄 Using toggle-based hotkey method');
                this.startWaylandHotkeyListener();
            } else {
                console.log('🖥️ Using global hotkey method (X11 xinput)');
                this.startX11HotkeyListener();
            }

        } catch (error) {
            console.error('❌ Failed to start hotkey listener:', error.message);
            setTimeout(() => this.startHotkeyListener(), 5000);
        }
    }

    startWaylandHotkeyListener() {
        console.log('🌊 Starting Wayland-compatible toggle listener...');

        // For Wayland, we use a file-based toggle system
        const triggerFile = '/tmp/voice-dictation-trigger';
        const lockFile = '/tmp/voice-dictation-recording';
        let isRecording = false;

        const checkToggle = () => {
            // Check for trigger file
            if (fs.existsSync(triggerFile)) {
                console.log('🎤 Trigger detected');
                fs.unlinkSync(triggerFile);

                if (fs.existsSync(lockFile)) {
                    // Currently recording - stop
                    if (isRecording) {
                        console.log('⏹️ Stopping recording (toggle)');
                        this.stopRecording();
                        isRecording = false;
                    }
                    fs.unlinkSync(lockFile);
                } else {
                    // Not recording - start
                    if (!isRecording) {
                        console.log('🎤 Starting recording (toggle)');
                        this.startRecording();
                        isRecording = true;

                        // Create lock file to indicate recording state
                        fs.writeFileSync(lockFile, 'recording');

                        // Auto-stop after 30 seconds max
                        setTimeout(() => {
                            if (isRecording && fs.existsSync(lockFile)) {
                                console.log('⏰ Auto-stopping recording after 30 seconds');
                                this.stopRecording();
                                isRecording = false;
                                fs.unlinkSync(lockFile);
                            }
                        }, 30000);
                    }
                }
            }

            // Check every 100ms
            setTimeout(checkToggle, 100);
        };

        console.log('📁 Wayland toggle method active');
        console.log('💡 Use the toggle script or: touch /tmp/voice-dictation-trigger');
        checkToggle();
    }

    startX11HotkeyListener() {
        console.log('🔍 Debug: Checking available input devices...');

        try {
            const script = `
            echo "=== DEBUG: Available input devices ==="
            xinput list
            echo "=== DEBUG: Looking for keyboards ==="
            xinput list | grep -i "keyboard\\|Virtual core keyboard"
            echo "=== DEBUG: Extracting keyboard ID ==="
            KEYBOARD_ID=$(xinput list | grep -i "keyboard\\|Virtual core keyboard" | head -1 | sed 's/.*id=\\([0-9]*\\).*/\\1/')
            echo "DEBUG: Using keyboard ID: $KEYBOARD_ID"

            if [ "$KEYBOARD_ID" ]; then
                echo "=== DEBUG: Starting key monitoring for ID $KEYBOARD_ID ==="
                xinput test "$KEYBOARD_ID" | while read line; do
                    echo "DEBUG: Raw input: $line"
                    # Detect Ctrl+Space combination
                    if echo "$line" | grep -q "key press.*37\\|key press.*105"; then
                        echo "CTRL_PRESS"
                    elif echo "$line" | grep -q "key release.*37\\|key release.*105"; then
                        echo "CTRL_RELEASE"
                    elif echo "$line" | grep -q "key press.*65"; then
                        echo "SPACE_PRESS"
                    elif echo "$line" | grep -q "key release.*65"; then
                        echo "SPACE_RELEASE"
                    fi
                done
            else
                echo "ERROR: No keyboard ID found"
                exit 1
            fi
        `;

        this.hotkeyProcess = spawn('bash', ['-c', script]);

        let ctrlPressed = false;
        let spacePressed = false;
        let isRecording = false;

        this.hotkeyProcess.stdout.on('data', (data) => {
                const lines = data.toString().trim().split('\n');

                for (const line of lines) {
                    // Only log non-debug lines for key events
                    if (!line.includes('DEBUG:') && !line.includes('===')) {
                        console.log(`🔑 Hotkey event: ${line}`);
                    } else if (line.includes('DEBUG:') || line.includes('===')) {
                        console.log(line); // Show debug output
                    }

                    if (line === 'CTRL_PRESS') {
                        ctrlPressed = true;
                        console.log('🎯 Ctrl key pressed');
                    } else if (line === 'CTRL_RELEASE') {
                        ctrlPressed = false;
                        console.log('🎯 Ctrl key released');
                        if (isRecording) {
                            console.log('⏹️ Stopping recording (Ctrl released)');
                            this.stopRecording();
                            isRecording = false;
                        }
                    } else if (line === 'SPACE_PRESS') {
                        spacePressed = true;
                        console.log('🎯 Space key pressed');
                        if (ctrlPressed && !isRecording) {
                            console.log('🎤 Starting recording (Ctrl+Space)');
                            this.startRecording();
                            isRecording = true;
                        }
                    } else if (line === 'SPACE_RELEASE') {
                        spacePressed = false;
                        console.log('🎯 Space key released');
                        if (isRecording) {
                            console.log('⏹️ Stopping recording (Space released)');
                            this.stopRecording();
                            isRecording = false;
                        }
                    }
                }
            });

            this.hotkeyProcess.stderr.on('data', (data) => {
                console.error('🚨 Hotkey process stderr:', data.toString());
            });

            this.hotkeyProcess.on('error', (error) => {
                console.error('❌ Hotkey listener error:', error.message);
                console.log('Retrying in 5 seconds...');
                setTimeout(() => this.startHotkeyListener(), 5000);
            });

            this.hotkeyProcess.on('exit', (code) => {
                if (code !== 0) {
                    console.error('❌ Hotkey listener exited unexpectedly');
                    console.log('Retrying in 5 seconds...');
                    setTimeout(() => this.startHotkeyListener(), 5000);
                }
            });

        } catch (error) {
            console.error('❌ Failed to start X11 hotkey listener:', error.message);
            setTimeout(() => this.startHotkeyListener(), 5000);
        }
    }

    // End of startX11HotkeyListener method

    stopHotkeyListener() {
        if (this.hotkeyProcess) {
            this.hotkeyProcess.kill();
            this.hotkeyProcess = null;
        }
    }

    async startRecording() {
        if (this.isRecording) return;

        this.audioFile = path.join(__dirname, `recording-${Date.now()}.wav`);
        this.isRecording = true;

        console.log('🎤 Recording started...');

        if (this.config.get('showNotifications')) {
            this.showNotification('🎤 Recording...', 'Voice dictation is listening');
        }

        // Start sox recording
        const soxArgs = [
            '-d',
            '-t', 'wav',
            '-r', this.config.get('audioSampleRate').toString(),
            '-b', this.config.get('audioBits').toString(),
            '-c', this.config.get('audioChannels').toString(),
            '-e', 'signed',
            this.audioFile
        ];

        this.soxProcess = spawn('sox', soxArgs);

        this.soxProcess.on('error', (error) => {
            console.error('❌ Recording failed:', error.message);
            this.isRecording = false;
        });
    }

    async stopRecording() {
        if (!this.isRecording) return;

        this.isRecording = false;

        if (this.soxProcess) {
            this.soxProcess.kill();
            this.soxProcess = null;
        }

        console.log('⏹️  Processing audio...');

        if (this.config.get('showNotifications')) {
            this.showNotification('⏳ Processing...', 'Transcribing your speech');
        }

        try {
            const transcript = await this.transcribeAudio(this.audioFile);

            if (transcript && transcript.trim()) {
                console.log(`📝 Transcript: "${transcript}"`);

                const mode = this.config.get('mode');
                if (mode === 'coding') {
                    await this.runClaudeCode(transcript.trim());
                } else {
                    await this.typeText(transcript.trim());
                }
            } else {
                console.log('🔇 No speech detected');
                if (this.config.get('showNotifications')) {
                    this.showNotification('🔇 No speech detected', 'Try speaking more clearly');
                }
            }
        } catch (error) {
            console.error('❌ Processing error:', error.message);
            if (this.config.get('showNotifications')) {
                this.showNotification('❌ Error', error.message);
            }
        } finally {
            // Clean up audio file
            try {
                fs.unlinkSync(this.audioFile);
            } catch (err) {
                // Ignore cleanup errors
            }
        }
    }

    async transcribeAudio(audioFile) {
        return new Promise((resolve, reject) => {
            const worker = new Worker(__filename, {
                workerData: {
                    audioFile,
                    whisperPath: this.whisperPath,
                    modelPath: path.resolve(__dirname, '..', 'models', `${this.config.get('whisperModel')}.bin`)
                }
            });

            worker.on('message', (message) => {
                if (message.type === 'transcription') {
                    resolve(message.data);
                } else if (message.type === 'error') {
                    reject(new Error(message.data));
                }
            });

            worker.on('error', (error) => {
                reject(error);
            });

            worker.on('exit', (code) => {
                if (code !== 0) {
                    reject(new Error(`Worker stopped with exit code ${code}`));
                }
            });
        });
    }

    async typeText(text) {
        try {
            const delay = this.config.get('typingDelay');
            await this.runCMD(`xdotool type --delay ${delay} "${text.replace(/"/g, '\\"')}"`);
            console.log('⌨️  Text typed successfully');

            if (this.config.get('showNotifications')) {
                this.showNotification('✅ Text typed', `"${text.substring(0, 50)}..."`);
            }
        } catch (error) {
            console.error('❌ Failed to type text:', error.message);
        }
    }

    async runClaudeCode(prompt) {
        try {
            console.log('🤖 Running Claude Code...');

            const codingPath = this.config.get('codingPath');
            const claudeCodePath = this.config.get('claudeCodePath');

            // Add system prompt if configured
            const systemPrompt = this.config.get('systemPrompt');
            let fullPrompt = prompt;
            if (systemPrompt && systemPrompt.trim()) {
                fullPrompt = `${systemPrompt}\n\nUser request: ${prompt}`;
            }

            const command = `cd "${codingPath}" && ${claudeCodePath} "${fullPrompt.replace(/"/g, '\\"')}"`;

            console.log(`📂 Working directory: ${codingPath}`);
            console.log(`🗣️  Prompt: "${prompt}"`);

            const output = await this.runCMD(command);

            console.log('✅ Claude Code completed successfully');

            if (this.config.get('showNotifications')) {
                this.showNotification('🤖 Claude Code completed', `Request: "${prompt.substring(0, 50)}..."`);
            }

        } catch (error) {
            console.error('❌ Claude Code error:', error.message);

            if (this.config.get('showNotifications')) {
                this.showNotification('❌ Claude Code error', error.message);
            }
        }
    }

    showNotification(title, message) {
        try {
            exec(`notify-send "${title}" "${message}" --icon=microphone`);
        } catch (error) {
            // Ignore notification errors
        }
    }

    shutdown() {
        console.log('\n👋 Shutting down Voice Dictation Service...');

        if (this.soxProcess) {
            this.soxProcess.kill();
        }

        this.stopHotkeyListener();

        console.log('Service stopped gracefully');
        process.exit(0);
    }
}

// Worker thread code for transcription
if (!isMainThread) {
    const { audioFile, whisperPath, modelPath } = workerData;

    async function transcribeInWorker() {
        try {
            const { exec } = require('child_process');
            const util = require('util');
            const execPromise = util.promisify(exec);

            const command = `"${whisperPath}" -m "${modelPath}" -f "${audioFile}" --no-timestamps --language en --output-txt`;

            const { stdout } = await execPromise(command);

            const txtFile = audioFile.replace(/\.[^/.]+$/, '.txt');
            let transcription = '';

            if (require('fs').existsSync(txtFile)) {
                transcription = require('fs').readFileSync(txtFile, 'utf8').trim();
                require('fs').unlinkSync(txtFile);
            } else {
                transcription = stdout.trim();
            }

            parentPort.postMessage({ type: 'transcription', data: transcription });
        } catch (error) {
            parentPort.postMessage({ type: 'error', data: error.message });
        }
    }

    transcribeInWorker();
} else {
    // Start the service
    const service = new VoiceDictationService();
}