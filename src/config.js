const fs = require('fs');
const path = require('path');
const os = require('os');

class ConfigManager {
    constructor() {
        this.configDir = path.join(os.homedir(), '.config', 'voice-dictation');
        this.configFile = path.join(this.configDir, 'config.json');
        this.defaultConfig = {
            // General settings
            mode: 'typing', // 'typing' or 'coding'
            hotkey: 'ctrl+space',
            hotkeyMethod: 'global', // 'global' or 'toggle'

            // Audio settings
            whisperModel: 'base.en',

            // Typing mode settings
            typingDelay: 50,

            // Coding mode settings
            codingPath: process.cwd(),
            claudeCodePath: 'claude-code',
            systemPrompt: 'You are a helpful coding assistant. Implement the requested changes efficiently and clearly.',

            // API settings
            openaiApiKey: '',
            openaiBaseUrl: 'http://localhost:1234/v1',
            openaiModel: 'gpt-3.5-turbo',

            // Service settings
            autoStart: true,
            showNotifications: true,

            // Advanced settings
            audioSampleRate: 16000,
            audioBits: 16,
            audioChannels: 1
        };

        this.ensureConfigDir();
        this.loadConfig();
    }

    ensureConfigDir() {
        if (!fs.existsSync(this.configDir)) {
            fs.mkdirSync(this.configDir, { recursive: true });
        }
    }

    loadConfig() {
        try {
            if (fs.existsSync(this.configFile)) {
                const configData = fs.readFileSync(this.configFile, 'utf8');
                this.config = { ...this.defaultConfig, ...JSON.parse(configData) };
            } else {
                this.config = { ...this.defaultConfig };
                this.saveConfig();
            }
        } catch (error) {
            console.error('Error loading config:', error);
            this.config = { ...this.defaultConfig };
        }
    }

    saveConfig() {
        try {
            fs.writeFileSync(this.configFile, JSON.stringify(this.config, null, 2));
        } catch (error) {
            console.error('Error saving config:', error);
            throw error;
        }
    }

    get(key) {
        return this.config[key];
    }

    set(key, value) {
        this.config[key] = value;
    }

    getAll() {
        return { ...this.config };
    }

    setAll(newConfig) {
        this.config = { ...this.defaultConfig, ...newConfig };
    }

    reset() {
        this.config = { ...this.defaultConfig };
        this.saveConfig();
    }

    getConfigPath() {
        return this.configFile;
    }
}

module.exports = ConfigManager;