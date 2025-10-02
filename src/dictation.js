#!/usr/bin/env node

const { spawn, exec } = require('child_process');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

class GlobalDictation {
    constructor(options = {}) {
        this.isRecording = false;
        this.soxProcess = null;
        this.audioFile = null;
        this.hotkey = process.env.DICTATION_HOTKEY || 'ctrl+space';
        this.whisperPath = path.resolve(__dirname, '..', 'whisper.cpp', 'build', 'bin', 'main');
        this.modelPath = path.resolve(__dirname, '..', 'models', `${process.env.WHISPER_MODEL || 'base.en'}.bin`);

        // Mode configuration
        this.mode = options.mode || 'typing'; // 'typing' or 'coding'
        this.codingPath = options.codingPath || process.cwd();
        this.claudeCodePath = options.claudeCodePath || 'claude-code';

        console.log(`Global Dictation System - ${this.mode.toUpperCase()} Mode`);
        console.log(`Hotkey: ${this.hotkey}`);
        console.log(`Whisper: ${this.whisperPath}`);
        console.log(`Model: ${this.modelPath}`);

        if (this.mode === 'coding') {
            console.log(`Coding Path: ${this.codingPath}`);
            console.log(`Claude Code CLI: ${this.claudeCodePath}`);
            console.log(`Hold ${this.hotkey} to send voice prompt to Claude Code`);
        } else {
            console.log(`Hold ${this.hotkey} to dictate, release to type`);
        }
        console.log('Press Ctrl+C to exit\n');
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

    async startRecording() {
        if (this.isRecording) return;

        this.audioFile = path.join(__dirname, `dictation-${Date.now()}.wav`);
        this.isRecording = true;

        console.log('🎤 Recording...');

        // Start sox recording process
        const soxArgs = [
            '-d', // Use default input device
            '-t', 'wav', // Output format is WAV
            '-r', '16000', // Sample rate
            '-b', '16', // Bits per sample
            '-c', '1', // Mono
            '-e', 'signed', // Signed integer
            this.audioFile // Output file
        ];

        this.soxProcess = spawn('sox', soxArgs);

        this.soxProcess.on('error', (error) => {
            console.error('❌ Failed to start recording:', error.message);
        });
    }

    async stopRecording() {
        if (!this.isRecording) return;

        this.isRecording = false;

        // Stop the sox process
        if (this.soxProcess) {
            this.soxProcess.kill();
            this.soxProcess = null;
        }

        console.log('⏹️  Processing...');

        try {
            // Transcribe audio
            const transcript = await this.transcribeAudio(this.audioFile);

            if (transcript && transcript.trim()) {
                console.log(`📝 "${transcript}"`);

                if (this.mode === 'coding') {
                    await this.runClaudeCode(transcript.trim());
                } else {
                    await this.typeText(transcript.trim());
                }
            } else {
                console.log('🔇 No speech detected');
            }
        } catch (error) {
            console.error('❌ Error processing audio:', error.message);
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
                    modelPath: this.modelPath
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
            // Use xdotool to type text to the active window
            await this.runCMD(`xdotool type --delay 50 "${text.replace(/"/g, '\\"')}"`);
            console.log('⌨️  Text typed successfully');
        } catch (error) {
            console.error('❌ Failed to type text:', error.message);
        }
    }

    async runClaudeCode(prompt) {
        try {
            console.log('🤖 Running Claude Code...');

            // Change to the coding directory and run claude-code
            const command = `cd "${this.codingPath}" && ${this.claudeCodePath} "${prompt.replace(/"/g, '\\"')}"`;

            console.log(`📂 Working directory: ${this.codingPath}`);
            console.log(`🗣️  Prompt: "${prompt}"`);

            // Run claude-code command
            const output = await this.runCMD(command);

            if (output) {
                console.log('✅ Claude Code completed successfully');
                // Optionally show first few lines of output
                const lines = output.split('\n').slice(0, 3);
                if (lines.length > 0) {
                    console.log('📄 Output preview:');
                    lines.forEach(line => {
                        if (line.trim()) console.log(`   ${line.trim()}`);
                    });
                }
            }

        } catch (error) {
            console.error('❌ Claude Code error:', error.message);

            // Check if it's a command not found error
            if (error.message.includes('command not found') || error.message.includes('not found')) {
                console.log('💡 Tip: Make sure claude-code CLI is installed and in your PATH');
                console.log('   Or set CLAUDE_CODE_PATH environment variable');
            }
        }
    }

    async setupGlobalHotkey() {
        const HotkeyListener = require('./hotkey-listener');

        try {
            const hotkeyListener = new HotkeyListener(
                () => this.startRecording(),
                () => this.stopRecording()
            );

            return hotkeyListener.start();
        } catch (error) {
            console.error('❌ Hotkey setup failed. Falling back to manual mode.');
            this.setupManualMode();
        }
    }

    setupManualMode() {
        console.log('\n📖 Manual Mode:');
        console.log('Press Enter to start recording, Enter again to stop and transcribe');
        console.log('Press Ctrl+C to exit\n');

        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.setEncoding('utf8');

        process.stdin.on('data', (key) => {
            if (key === '\u0003') { // Ctrl+C
                process.exit();
            } else if (key === '\r' || key === '\n') { // Enter
                if (this.isRecording) {
                    this.stopRecording();
                } else {
                    this.startRecording();
                }
            }
        });
    }

    async start() {
        // Check if whisper binary exists
        if (!fs.existsSync(this.whisperPath)) {
            console.error(`❌ Whisper binary not found at: ${this.whisperPath}`);
            console.log('Please build whisper.cpp first:');
            console.log('cd whisper.cpp && make');
            process.exit(1);
        }

        // Check if model exists
        if (!fs.existsSync(this.modelPath)) {
            console.error(`❌ Model not found at: ${this.modelPath}`);
            console.log('Please download the model file to the models/ directory');
            process.exit(1);
        }

        // Handle exit
        process.on('SIGINT', () => {
            console.log('\n👋 Goodbye!');
            if (this.soxProcess) {
                this.soxProcess.kill();
            }
            process.exit();
        });

        // Try to setup global hotkey, fall back to manual mode
        if (process.argv.includes('--manual')) {
            this.setupManualMode();
        } else {
            try {
                await this.setupGlobalHotkey();
            } catch (error) {
                console.log('⚠️  Global hotkey failed, using manual mode');
                this.setupManualMode();
            }
        }
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

            // Run whisper command
            const command = `"${whisperPath}" -m "${modelPath}" -f "${audioFile}" --no-timestamps --language en --output-txt`;

            const { stdout } = await execPromise(command);

            // Try to read from output file first
            const txtFile = audioFile.replace(/\.[^/.]+$/, '.txt');
            let transcription = '';

            if (require('fs').existsSync(txtFile)) {
                transcription = require('fs').readFileSync(txtFile, 'utf8').trim();
                // Clean up the txt file
                require('fs').unlinkSync(txtFile);
            } else {
                // Fall back to stdout
                transcription = stdout.trim();
            }

            parentPort.postMessage({ type: 'transcription', data: transcription });
        } catch (error) {
            parentPort.postMessage({ type: 'error', data: error.message });
        }
    }

    transcribeInWorker();
} else {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const options = {};

    // Check for mode
    if (args.includes('--coding')) {
        options.mode = 'coding';
    }

    // Check for manual mode
    if (args.includes('--manual')) {
        options.manual = true;
    }

    // Check for coding path
    const codingPathIndex = args.indexOf('--coding-path');
    if (codingPathIndex !== -1 && args[codingPathIndex + 1]) {
        options.codingPath = args[codingPathIndex + 1];
    }

    // Check for claude-code path
    const claudeCodePathIndex = args.indexOf('--claude-code-path');
    if (claudeCodePathIndex !== -1 && args[claudeCodePathIndex + 1]) {
        options.claudeCodePath = args[claudeCodePathIndex + 1];
    }

    // Start the application
    const dictation = new GlobalDictation(options);
    dictation.start();
}