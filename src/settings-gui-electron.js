const { ipcRenderer } = require('electron');

class SettingsGUI {
    constructor() {
        this.config = {};
        this.init();
    }

    async init() {
        await this.loadSettings();
        await this.updateServiceStatus();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Auto-save on input changes
        const inputs = document.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            input.addEventListener('change', () => {
                this.saveSettings();
            });
        });
    }

    async loadSettings() {
        try {
            this.config = await ipcRenderer.invoke('get-config');
            this.populateForm();
            this.showStatus('Settings loaded successfully', 'success');
        } catch (error) {
            this.showStatus(`Error loading settings: ${error.message}`, 'error');
        }
    }

    populateForm() {
        document.getElementById('mode').value = this.config.mode || 'typing';
        document.getElementById('hotkey').value = this.config.hotkey || 'ctrl+space';
        document.getElementById('whisperModel').value = this.config.whisperModel || 'base.en';
        document.getElementById('codingPath').value = this.config.codingPath || '';
        document.getElementById('claudeCodePath').value = this.config.claudeCodePath || 'claude-code';
        document.getElementById('systemPrompt').value = this.config.systemPrompt || '';
        document.getElementById('showNotifications').checked = this.config.showNotifications !== false;
        document.getElementById('typingDelay').value = this.config.typingDelay || 50;
        document.getElementById('audioSampleRate').value = this.config.audioSampleRate || 16000;
    }

    async saveSettings() {
        try {
            const settings = {
                mode: document.getElementById('mode').value,
                hotkey: document.getElementById('hotkey').value,
                whisperModel: document.getElementById('whisperModel').value,
                codingPath: document.getElementById('codingPath').value,
                claudeCodePath: document.getElementById('claudeCodePath').value,
                systemPrompt: document.getElementById('systemPrompt').value,
                showNotifications: document.getElementById('showNotifications').checked,
                typingDelay: parseInt(document.getElementById('typingDelay').value),
                audioSampleRate: parseInt(document.getElementById('audioSampleRate').value)
            };

            for (const [key, value] of Object.entries(settings)) {
                await ipcRenderer.invoke('update-config', key, value);
            }

            this.showStatus('Settings saved successfully', 'success');
        } catch (error) {
            this.showStatus(`Error saving settings: ${error.message}`, 'error');
        }
    }

    async resetSettings() {
        if (confirm('Are you sure you want to reset all settings to defaults?')) {
            try {
                await ipcRenderer.invoke('reset-config');
                await this.loadSettings();
                this.showStatus('Settings reset to defaults', 'success');
            } catch (error) {
                this.showStatus(`Error resetting settings: ${error.message}`, 'error');
            }
        }
    }

    async updateServiceStatus() {
        try {
            const result = await ipcRenderer.invoke('service-control', 'status');
            const indicator = document.getElementById('serviceIndicator');
            const status = document.getElementById('serviceStatus');

            if (result.success && result.output === 'active') {
                indicator.className = 'status-indicator running';
                status.textContent = 'Service is running';
            } else {
                indicator.className = 'status-indicator stopped';
                status.textContent = 'Service is stopped';
            }
        } catch (error) {
            const indicator = document.getElementById('serviceIndicator');
            const status = document.getElementById('serviceStatus');
            indicator.className = 'status-indicator stopped';
            status.textContent = 'Service status unknown';
        }
    }

    async controlService(action) {
        try {
            const result = await ipcRenderer.invoke('service-control', action);

            if (result.success) {
                this.showStatus(`Service ${action} completed successfully`, 'success');

                // Wait a moment then update status
                setTimeout(() => {
                    this.updateServiceStatus();
                }, 1000);
            } else {
                this.showStatus(`Service ${action} failed: ${result.error}`, 'error');
            }
        } catch (error) {
            this.showStatus(`Error controlling service: ${error.message}`, 'error');
        }
    }

    async testTrigger() {
        try {
            const result = await ipcRenderer.invoke('test-trigger');

            if (result.success) {
                this.showTestResult('Voice trigger test successful! Check service logs.', 'success');
            } else {
                this.showTestResult(`Test failed: ${result.error}`, 'error');
            }
        } catch (error) {
            this.showTestResult(`Test error: ${error.message}`, 'error');
        }
    }

    refreshStatus() {
        this.updateServiceStatus();
        this.loadSettings();
        this.showStatus('Status refreshed', 'info');
    }

    showStatus(message, type) {
        const statusDiv = document.getElementById('statusMessage');
        statusDiv.className = `status ${type}`;
        statusDiv.textContent = message;

        // Auto-clear after 5 seconds
        setTimeout(() => {
            statusDiv.textContent = '';
            statusDiv.className = '';
        }, 5000);
    }

    showTestResult(message, type) {
        const testDiv = document.getElementById('testResults');
        testDiv.className = `status ${type}`;
        testDiv.textContent = message;

        // Auto-clear after 10 seconds
        setTimeout(() => {
            testDiv.textContent = '';
            testDiv.className = '';
        }, 10000);
    }
}

// Global functions for button clicks
async function saveSettings() {
    await window.settingsGUI.saveSettings();
}

async function loadSettings() {
    await window.settingsGUI.loadSettings();
}

async function resetSettings() {
    await window.settingsGUI.resetSettings();
}

async function controlService(action) {
    await window.settingsGUI.controlService(action);
}

async function testTrigger() {
    await window.settingsGUI.testTrigger();
}

async function refreshStatus() {
    await window.settingsGUI.refreshStatus();
}

// Initialize when page loads
window.addEventListener('DOMContentLoaded', () => {
    window.settingsGUI = new SettingsGUI();
});