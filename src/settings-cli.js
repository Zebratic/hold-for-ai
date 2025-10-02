#!/usr/bin/env node

const readline = require('readline');
const ConfigManager = require('./config');
const { exec } = require('child_process');

class SettingsCLI {
    constructor() {
        this.config = new ConfigManager();
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }

    async showMenu() {
        console.clear();
        console.log('🎤 Voice Dictation Settings');
        console.log('============================\n');

        const config = this.config.getAll();

        console.log('📋 Current Configuration:');
        console.log(`   Mode: ${config.mode}`);
        console.log(`   Hotkey: ${config.hotkey}`);
        console.log(`   Whisper Model: ${config.whisperModel}`);
        console.log(`   Auto-start: ${config.autoStart ? 'Yes' : 'No'}`);
        console.log(`   Notifications: ${config.showNotifications ? 'Yes' : 'No'}`);

        if (config.mode === 'coding') {
            console.log(`   Coding Path: ${config.codingPath}`);
            console.log(`   Claude Code CLI: ${config.claudeCodePath}`);
        }

        console.log(`   Typing Delay: ${config.typingDelay}ms`);

        // Check service status
        await this.checkServiceStatus();

        console.log('\n📝 Options:');
        console.log('   1. Change mode (typing/coding)');
        console.log('   2. Change hotkey');
        console.log('   3. Change whisper model');
        console.log('   4. Configure coding settings');
        console.log('   5. Configure API settings');
        console.log('   6. Toggle auto-start');
        console.log('   7. Toggle notifications');
        console.log('   8. View/edit all settings');
        console.log('   9. Service controls');
        console.log('   r. Reset to defaults');
        console.log('   q. Quit\n');

        return this.getUserChoice();
    }

    async checkServiceStatus() {
        return new Promise((resolve) => {
            exec('pgrep -f "voice-dictation-service"', (error, stdout) => {
                if (error) {
                    console.log('   🔴 Service: Stopped');
                } else {
                    console.log('   🟢 Service: Running');
                }
                resolve();
            });
        });
    }

    getUserChoice() {
        return new Promise((resolve) => {
            this.rl.question('Enter your choice: ', (answer) => {
                resolve(answer.trim().toLowerCase());
            });
        });
    }

    getUserInput(prompt, defaultValue = '') {
        return new Promise((resolve) => {
            const displayPrompt = defaultValue ? `${prompt} [${defaultValue}]: ` : `${prompt}: `;
            this.rl.question(displayPrompt, (answer) => {
                resolve(answer.trim() || defaultValue);
            });
        });
    }

    async changeMode() {
        console.log('\n📋 Available modes:');
        console.log('   1. typing - Type transcribed text into active window');
        console.log('   2. coding - Send voice prompts to Claude Code CLI');

        const choice = await this.getUserInput('Enter mode (typing/coding)', this.config.get('mode'));

        if (['typing', 'coding'].includes(choice)) {
            this.config.set('mode', choice);
            this.config.saveConfig();
            console.log(`✅ Mode changed to: ${choice}`);
        } else {
            console.log('❌ Invalid mode');
        }

        await this.pause();
    }

    async changeHotkey() {
        console.log('\n⌨️  Current hotkey:', this.config.get('hotkey'));
        console.log('Examples: ctrl+space, alt+f1, shift+ctrl+v');

        const hotkey = await this.getUserInput('Enter new hotkey', this.config.get('hotkey'));
        this.config.set('hotkey', hotkey);
        this.config.saveConfig();
        console.log(`✅ Hotkey changed to: ${hotkey}`);

        await this.pause();
    }

    async changeModel() {
        console.log('\n🎙️  Available models:');
        console.log('   tiny.en    - Fastest, lowest quality');
        console.log('   base.en    - Good balance (recommended)');
        console.log('   small.en   - Better quality, slower');
        console.log('   medium.en  - High quality, much slower');
        console.log('   large      - Best quality, very slow');

        const model = await this.getUserInput('Enter model', this.config.get('whisperModel'));
        this.config.set('whisperModel', model);
        this.config.saveConfig();
        console.log(`✅ Model changed to: ${model}`);

        await this.pause();
    }

    async configureCoding() {
        console.log('\n🤖 Coding Mode Settings:');

        const codingPath = await this.getUserInput('Project directory', this.config.get('codingPath'));
        const claudeCodePath = await this.getUserInput('Claude Code CLI path', this.config.get('claudeCodePath'));

        console.log('\nSystem prompt (press Enter twice when done):');
        const systemPrompt = await this.getMultilineInput(this.config.get('systemPrompt'));

        this.config.set('codingPath', codingPath);
        this.config.set('claudeCodePath', claudeCodePath);
        this.config.set('systemPrompt', systemPrompt);
        this.config.saveConfig();

        console.log('✅ Coding settings updated');
        await this.pause();
    }

    async configureAPI() {
        console.log('\n🔑 API Settings (Optional):');

        const apiKey = await this.getUserInput('OpenAI API Key', this.config.get('openaiApiKey') ? '***hidden***' : '');
        const baseUrl = await this.getUserInput('API Base URL', this.config.get('openaiBaseUrl'));
        const model = await this.getUserInput('API Model', this.config.get('openaiModel'));

        if (apiKey && apiKey !== '***hidden***') {
            this.config.set('openaiApiKey', apiKey);
        }
        this.config.set('openaiBaseUrl', baseUrl);
        this.config.set('openaiModel', model);
        this.config.saveConfig();

        console.log('✅ API settings updated');
        await this.pause();
    }

    async getMultilineInput(defaultValue = '') {
        return new Promise((resolve) => {
            console.log('Current value:');
            console.log(defaultValue || '(empty)');
            console.log('\nEnter new value (press Enter twice to finish):');

            let lines = [];
            let emptyLineCount = 0;

            const onLine = (line) => {
                if (line === '') {
                    emptyLineCount++;
                    if (emptyLineCount >= 2) {
                        this.rl.off('line', onLine);
                        resolve(lines.join('\n'));
                        return;
                    }
                } else {
                    emptyLineCount = 0;
                }
                lines.push(line);
            };

            this.rl.on('line', onLine);
        });
    }

    async toggleAutoStart() {
        const current = this.config.get('autoStart');
        this.config.set('autoStart', !current);
        this.config.saveConfig();
        console.log(`✅ Auto-start: ${!current ? 'Enabled' : 'Disabled'}`);
        await this.pause();
    }

    async toggleNotifications() {
        const current = this.config.get('showNotifications');
        this.config.set('showNotifications', !current);
        this.config.saveConfig();
        console.log(`✅ Notifications: ${!current ? 'Enabled' : 'Disabled'}`);
        await this.pause();
    }

    async viewAllSettings() {
        console.log('\n📋 All Settings:');
        const config = this.config.getAll();

        for (const [key, value] of Object.entries(config)) {
            if (key === 'openaiApiKey' && value) {
                console.log(`   ${key}: ***hidden***`);
            } else {
                console.log(`   ${key}: ${JSON.stringify(value)}`);
            }
        }

        console.log(`\n📁 Config file: ${this.config.getConfigPath()}`);
        await this.pause();
    }

    async serviceControls() {
        console.log('\n⚙️  Service Controls:');
        console.log('   1. Start service');
        console.log('   2. Stop service');
        console.log('   3. Restart service');
        console.log('   4. View service logs');
        console.log('   5. Install systemd service');

        const choice = await this.getUserChoice();

        switch (choice) {
            case '1':
                console.log('Starting service...');
                exec('node ' + require('path').join(__dirname, 'service.js') + ' &');
                break;
            case '2':
                console.log('Stopping service...');
                exec('pkill -f "voice-dictation-service"');
                break;
            case '3':
                console.log('Restarting service...');
                exec('pkill -f "voice-dictation-service" && sleep 2 && node ' + require('path').join(__dirname, 'service.js') + ' &');
                break;
            case '4':
                console.log('Service logs (last 20 lines):');
                exec('journalctl --user -u voice-dictation.service -n 20', (error, stdout) => {
                    console.log(stdout || 'No logs found (service may not be installed)');
                });
                break;
            case '5':
                console.log('Installing systemd service...');
                exec('./install.sh', (error, stdout) => {
                    console.log(stdout || 'Installation complete');
                });
                break;
        }

        await this.pause();
    }

    async resetSettings() {
        const confirm = await this.getUserInput('Reset all settings to defaults? (yes/no)', 'no');
        if (confirm === 'yes') {
            this.config.reset();
            console.log('✅ Settings reset to defaults');
        }
        await this.pause();
    }

    pause() {
        return new Promise((resolve) => {
            this.rl.question('\nPress Enter to continue...', () => resolve());
        });
    }

    async start() {
        console.log('🎤 Voice Dictation Settings Manager\n');

        while (true) {
            const choice = await this.showMenu();

            switch (choice) {
                case '1':
                    await this.changeMode();
                    break;
                case '2':
                    await this.changeHotkey();
                    break;
                case '3':
                    await this.changeModel();
                    break;
                case '4':
                    await this.configureCoding();
                    break;
                case '5':
                    await this.configureAPI();
                    break;
                case '6':
                    await this.toggleAutoStart();
                    break;
                case '7':
                    await this.toggleNotifications();
                    break;
                case '8':
                    await this.viewAllSettings();
                    break;
                case '9':
                    await this.serviceControls();
                    break;
                case 'r':
                    await this.resetSettings();
                    break;
                case 'q':
                    console.log('👋 Goodbye!');
                    this.rl.close();
                    return;
                default:
                    console.log('❌ Invalid choice');
                    await this.pause();
            }
        }
    }
}

// Start the application
if (require.main === module) {
    const app = new SettingsCLI();
    app.start().catch(console.error);
}

module.exports = SettingsCLI;