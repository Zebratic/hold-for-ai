const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const ConfigManager = require('./config');

class ElectronSettingsApp {
    constructor() {
        this.config = new ConfigManager();
        this.mainWindow = null;

        app.whenReady().then(() => {
            this.createWindow();
        });

        app.on('window-all-closed', () => {
            if (process.platform !== 'darwin') {
                app.quit();
            }
        });

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                this.createWindow();
            }
        });

        this.setupIPC();
    }

    createWindow() {
        this.mainWindow = new BrowserWindow({
            width: 800,
            height: 600,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false
            },
            icon: path.join(__dirname, '..', 'assets', 'icon.png'),
            title: 'Voice Dictation Settings'
        });

        this.mainWindow.loadFile(path.join(__dirname, 'settings-gui.html'));

        // Open DevTools in development
        if (process.env.NODE_ENV === 'development') {
            this.mainWindow.webContents.openDevTools();
        }
    }

    setupIPC() {
        // Get current configuration
        ipcMain.handle('get-config', () => {
            return this.config.getAll();
        });

        // Update configuration
        ipcMain.handle('update-config', (event, key, value) => {
            this.config.set(key, value);
            return { success: true };
        });

        // Reset configuration
        ipcMain.handle('reset-config', () => {
            this.config.reset();
            return { success: true };
        });

        // Service control
        ipcMain.handle('service-control', async (event, action) => {
            const { exec } = require('child_process');
            const { promisify } = require('util');
            const execAsync = promisify(exec);

            try {
                let command;
                switch (action) {
                    case 'start':
                        command = 'systemctl --user start voice-dictation.service';
                        break;
                    case 'stop':
                        command = 'systemctl --user stop voice-dictation.service';
                        break;
                    case 'restart':
                        command = 'systemctl --user restart voice-dictation.service';
                        break;
                    case 'status':
                        command = 'systemctl --user is-active voice-dictation.service';
                        break;
                    case 'reload':
                        command = 'systemctl --user reload voice-dictation.service';
                        break;
                    default:
                        throw new Error('Unknown action');
                }

                const { stdout } = await execAsync(command);
                return { success: true, output: stdout.trim() };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });

        // Test trigger
        ipcMain.handle('test-trigger', async () => {
            const fs = require('fs');
            try {
                fs.writeFileSync('/tmp/voice-dictation-trigger', '');
                return { success: true, message: 'Trigger file created' };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });
    }
}

new ElectronSettingsApp();