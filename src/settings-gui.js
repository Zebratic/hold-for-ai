#!/usr/bin/env node

const gi = require('node-gtk');
const Gtk = gi.require('Gtk', '3.0');
const Gdk = gi.require('Gdk', '3.0');
const GLib = gi.require('GLib', '2.0');
const { exec } = require('child_process');
const path = require('path');
const ConfigManager = require('./config');

class SettingsGUI {
    constructor() {
        this.config = new ConfigManager();
        this.widgets = {};

        // Initialize GTK
        Gtk.init(null);

        this.createWindow();
        this.loadSettings();
    }

    createWindow() {
        this.window = new Gtk.Window({
            title: 'Voice Dictation Settings',
            default_width: 800,
            default_height: 600,
            resizable: true
        });

        this.window.on('destroy', () => {
            Gtk.mainQuit();
        });

        // Apply dark theme
        this.applyDarkTheme();

        // Create header bar
        this.createHeaderBar();

        // Create main notebook with tabs
        this.notebook = new Gtk.Notebook();
        this.notebook.setTabPos(Gtk.PositionType.TOP);
        this.notebook.setScrollable(true);
        this.notebook.setShowBorder(false);

        // Create tabs
        this.createGeneralTab();
        this.createAudioTab();
        this.createAPITab();
        this.createAdvancedTab();
        this.createServiceTab();

        // Add notebook to window
        this.window.add(this.notebook);
        this.window.showAll();
    }

    applyDarkTheme() {
        const settings = Gtk.Settings.getDefault();
        settings.setProperty('gtk-application-prefer-dark-theme', true);

        // Apply custom CSS for modern styling
        const cssProvider = new Gtk.CssProvider();
        const css = `
            window {
                background-color: #2b2b2b;
                color: #ffffff;
            }

            .settings-frame {
                background-color: #383838;
                border: 1px solid #555555;
                border-radius: 8px;
                margin: 8px;
                padding: 12px;
            }

            .settings-frame label {
                color: #ffffff;
                font-weight: bold;
            }

            entry {
                background-color: #404040;
                color: #ffffff;
                border: 1px solid #666666;
                border-radius: 4px;
                padding: 8px;
            }

            entry:focus {
                border-color: #4a90e2;
                box-shadow: 0 0 4px rgba(74, 144, 226, 0.3);
            }

            combobox {
                background-color: #404040;
                color: #ffffff;
                border: 1px solid #666666;
                border-radius: 4px;
            }

            button {
                background: linear-gradient(to bottom, #4a4a4a, #3a3a3a);
                color: #ffffff;
                border: 1px solid #666666;
                border-radius: 4px;
                padding: 8px 16px;
                transition: all 0.2s ease;
            }

            button:hover {
                background: linear-gradient(to bottom, #5a5a5a, #4a4a4a);
                border-color: #777777;
            }

            button.suggested-action {
                background: linear-gradient(to bottom, #4a90e2, #357abd);
                border-color: #2968a3;
            }

            button.suggested-action:hover {
                background: linear-gradient(to bottom, #5ba0f2, #4580cd);
            }

            button.destructive-action {
                background: linear-gradient(to bottom, #e74c3c, #c0392b);
                border-color: #a93226;
            }

            checkbutton {
                color: #ffffff;
            }

            checkbutton check {
                background-color: #404040;
                border: 1px solid #666666;
                border-radius: 3px;
            }

            checkbutton check:checked {
                background-color: #4a90e2;
                border-color: #357abd;
            }

            notebook {
                background-color: #2b2b2b;
            }

            notebook header {
                background-color: #333333;
                border-bottom: 1px solid #555555;
            }

            notebook header tab {
                background-color: #383838;
                color: #cccccc;
                border: 1px solid #555555;
                border-radius: 4px 4px 0 0;
                margin: 2px;
                padding: 8px 16px;
            }

            notebook header tab:checked {
                background-color: #4a90e2;
                color: #ffffff;
                border-color: #357abd;
            }

            textview {
                background-color: #404040;
                color: #ffffff;
                border: 1px solid #666666;
                border-radius: 4px;
            }

            scrolledwindow {
                border: 1px solid #555555;
                border-radius: 4px;
            }

            .status-good {
                color: #27ae60;
                font-weight: bold;
            }

            .status-bad {
                color: #e74c3c;
                font-weight: bold;
            }

            .status-warning {
                color: #f39c12;
                font-weight: bold;
            }
        `;

        try {
            cssProvider.loadFromData(css);
            Gtk.StyleContext.addProviderForScreen(
                Gdk.Screen.getDefault(),
                cssProvider,
                Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
            );
        } catch (error) {
            console.warn('Failed to apply custom CSS:', error.message);
        }
    }

    createHeaderBar() {
        const headerBar = new Gtk.HeaderBar();
        headerBar.setTitle('Voice Dictation Settings');
        headerBar.setSubtitle('Configure your voice-to-text system');
        headerBar.setShowCloseButton(true);

        // Add service status indicator
        this.statusIndicator = new Gtk.Label({
            label: '●',
            margin_end: 10
        });
        this.statusIndicator.getStyleContext().addClass('status-warning');

        headerBar.packEnd(this.statusIndicator);
        this.window.setTitlebar(headerBar);
    }

    createGeneralTab() {
        const scrolled = new Gtk.ScrolledWindow();
        scrolled.setPolicy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);

        const mainBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 20,
            margin_top: 20,
            margin_bottom: 20,
            margin_start: 20,
            margin_end: 20
        });

        // Operating Mode Section
        const modeFrame = this.createStyledFrame('Operating Mode', mainBox);

        this.createLabeledWidget(modeFrame, 'Mode:', () => {
            this.widgets.modeCombo = new Gtk.ComboBoxText();
            this.widgets.modeCombo.appendText('typing', '⌨️ Typing Mode - Transcribe and type text');
            this.widgets.modeCombo.appendText('coding', '🤖 Coding Mode - Send prompts to Claude Code');
            return this.widgets.modeCombo;
        });

        const modeDesc = new Gtk.Label({
            label: 'Choose how voice input should be processed',
            halign: Gtk.Align.START,
            wrap: true,
            margin_top: 5
        });
        modeDesc.getStyleContext().addClass('dim-label');
        modeFrame.packStart(modeDesc, false, false, 0);

        // Input Settings Section
        const inputFrame = this.createStyledFrame('Input Settings', mainBox);

        this.createLabeledWidget(inputFrame, 'Hotkey Method:', () => {
            this.widgets.hotkeyMethodCombo = new Gtk.ComboBoxText();
            this.widgets.hotkeyMethodCombo.appendText('global', '🌐 Global Hotkey (X11 only)');
            this.widgets.hotkeyMethodCombo.appendText('toggle', '🔄 Toggle Script (Wayland compatible)');
            return this.widgets.hotkeyMethodCombo;
        });

        this.createLabeledWidget(inputFrame, 'Hotkey Combination:', () => {
            this.widgets.hotkeyEntry = new Gtk.Entry({
                placeholder_text: 'e.g., ctrl+space'
            });
            return this.widgets.hotkeyEntry;
        });

        // System Integration Section
        const systemFrame = this.createStyledFrame('System Integration', mainBox);

        this.widgets.autoStartCheck = new Gtk.CheckButton({
            label: '🚀 Start service automatically on login'
        });
        systemFrame.packStart(this.widgets.autoStartCheck, false, false, 5);

        this.widgets.notificationsCheck = new Gtk.CheckButton({
            label: '🔔 Show desktop notifications'
        });
        systemFrame.packStart(this.widgets.notificationsCheck, false, false, 5);

        scrolled.add(mainBox);

        const tabLabel = new Gtk.Label({ label: '⚙️ General' });
        this.notebook.appendPage(scrolled, tabLabel);
    }

    createAudioTab() {
        const scrolled = new Gtk.ScrolledWindow();
        scrolled.setPolicy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);

        const mainBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 20,
            margin_top: 20,
            margin_bottom: 20,
            margin_start: 20,
            margin_end: 20
        });

        // Speech Recognition Section
        const speechFrame = this.createStyledFrame('Speech Recognition', mainBox);

        this.createLabeledWidget(speechFrame, 'Whisper Model:', () => {
            this.widgets.modelCombo = new Gtk.ComboBoxText();
            this.widgets.modelCombo.appendText('tiny.en', '⚡ Tiny (fastest, least accurate)');
            this.widgets.modelCombo.appendText('base.en', '⭐ Base (recommended)');
            this.widgets.modelCombo.appendText('small.en', '💪 Small (better quality)');
            this.widgets.modelCombo.appendText('medium.en', '🏆 Medium (high quality)');
            this.widgets.modelCombo.appendText('large', '🚀 Large (best quality, slowest)');
            return this.widgets.modelCombo;
        });

        const modelDesc = new Gtk.Label({
            label: 'Larger models provide better accuracy but are slower',
            halign: Gtk.Align.START,
            wrap: true,
            margin_top: 5
        });
        modelDesc.getStyleContext().addClass('dim-label');
        speechFrame.packStart(modelDesc, false, false, 0);

        // Typing Mode Settings
        const typingFrame = this.createStyledFrame('⌨️ Typing Mode Settings', mainBox);

        this.createLabeledWidget(typingFrame, 'Typing Delay (ms):', () => {
            this.widgets.typingDelayEntry = new Gtk.Entry({
                placeholder_text: '50'
            });
            return this.widgets.typingDelayEntry;
        });

        const typingDesc = new Gtk.Label({
            label: 'Delay between keystrokes when typing transcribed text',
            halign: Gtk.Align.START,
            wrap: true,
            margin_top: 5
        });
        typingDesc.getStyleContext().addClass('dim-label');
        typingFrame.packStart(typingDesc, false, false, 0);

        // Coding Mode Settings
        const codingFrame = this.createStyledFrame('🤖 Coding Mode Settings', mainBox);

        this.createLabeledWidget(codingFrame, 'Default Project Path:', () => {
            const hbox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 5 });
            this.widgets.codingPathEntry = new Gtk.Entry({
                placeholder_text: '/path/to/project'
            });
            const browseBtn = new Gtk.Button({ label: '📁 Browse' });
            browseBtn.on('clicked', () => this.browseForFolder());

            hbox.packStart(this.widgets.codingPathEntry, true, true, 0);
            hbox.packStart(browseBtn, false, false, 0);
            return hbox;
        });

        this.createLabeledWidget(codingFrame, 'Claude Code CLI Path:', () => {
            this.widgets.claudeCodePathEntry = new Gtk.Entry({
                placeholder_text: 'claude-code'
            });
            return this.widgets.claudeCodePathEntry;
        });

        this.createLabeledWidget(codingFrame, 'System Prompt:', () => {
            const scrolled = new Gtk.ScrolledWindow();
            scrolled.setPolicy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC);
            scrolled.setSizeRequest(-1, 120);

            this.widgets.systemPromptView = new Gtk.TextView({
                wrap_mode: Gtk.WrapMode.WORD
            });
            this.widgets.systemPromptBuffer = this.widgets.systemPromptView.getBuffer();
            scrolled.add(this.widgets.systemPromptView);
            return scrolled;
        });

        const codingDesc = new Gtk.Label({
            label: 'Instructions sent to Claude Code before each voice prompt',
            halign: Gtk.Align.START,
            wrap: true,
            margin_top: 5
        });
        codingDesc.getStyleContext().addClass('dim-label');
        codingFrame.packStart(codingDesc, false, false, 0);

        scrolled.add(mainBox);

        const tabLabel = new Gtk.Label({ label: '🎤 Audio & Modes' });
        this.notebook.appendPage(scrolled, tabLabel);
    }

    createAPITab() {
        const scrolled = new Gtk.ScrolledWindow();
        scrolled.setPolicy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);

        const mainBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 20,
            margin_top: 20,
            margin_bottom: 20,
            margin_start: 20,
            margin_end: 20
        });

        // API Notice
        const noticeBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 10,
            margin_bottom: 10
        });
        const noticeIcon = new Gtk.Label({ label: 'ℹ️' });
        const noticeText = new Gtk.Label({
            label: 'API settings are optional. Configure these for enhanced features in coding mode.',
            wrap: true,
            halign: Gtk.Align.START
        });
        noticeBox.packStart(noticeIcon, false, false, 0);
        noticeBox.packStart(noticeText, true, true, 0);
        mainBox.packStart(noticeBox, false, false, 0);

        // OpenAI API Section
        const apiFrame = this.createStyledFrame('🤖 OpenAI API Configuration', mainBox);

        this.createLabeledWidget(apiFrame, 'API Key:', () => {
            this.widgets.apiKeyEntry = new Gtk.Entry({
                placeholder_text: 'sk-...',
                visibility: false
            });
            return this.widgets.apiKeyEntry;
        });

        this.createLabeledWidget(apiFrame, 'Base URL:', () => {
            this.widgets.baseUrlEntry = new Gtk.Entry({
                placeholder_text: 'http://localhost:1234/v1'
            });
            return this.widgets.baseUrlEntry;
        });

        this.createLabeledWidget(apiFrame, 'Model:', () => {
            this.widgets.apiModelEntry = new Gtk.Entry({
                placeholder_text: 'gpt-3.5-turbo'
            });
            return this.widgets.apiModelEntry;
        });

        const apiDesc = new Gtk.Label({
            label: 'Leave Base URL as localhost:1234 for local LLM servers, or use https://api.openai.com/v1 for OpenAI',
            halign: Gtk.Align.START,
            wrap: true,
            margin_top: 5
        });
        apiDesc.getStyleContext().addClass('dim-label');
        apiFrame.packStart(apiDesc, false, false, 0);

        scrolled.add(mainBox);

        const tabLabel = new Gtk.Label({ label: '🔗 API Settings' });
        this.notebook.appendPage(scrolled, tabLabel);
    }

    createAdvancedTab() {
        const scrolled = new Gtk.ScrolledWindow();
        scrolled.setPolicy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);

        const mainBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 20,
            margin_top: 20,
            margin_bottom: 20,
            margin_start: 20,
            margin_end: 20
        });

        // Warning
        const warningBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 10,
            margin_bottom: 10
        });
        const warningIcon = new Gtk.Label({ label: '⚠️' });
        const warningText = new Gtk.Label({
            label: 'Advanced settings. Only modify if you know what you\'re doing.',
            wrap: true,
            halign: Gtk.Align.START
        });
        warningBox.packStart(warningIcon, false, false, 0);
        warningBox.packStart(warningText, true, true, 0);
        mainBox.packStart(warningBox, false, false, 0);

        // Audio Configuration
        const audioFrame = this.createStyledFrame('🎧 Audio Configuration', mainBox);

        this.createLabeledWidget(audioFrame, 'Sample Rate (Hz):', () => {
            this.widgets.sampleRateEntry = new Gtk.Entry({
                placeholder_text: '16000'
            });
            return this.widgets.sampleRateEntry;
        });

        this.createLabeledWidget(audioFrame, 'Audio Bits:', () => {
            this.widgets.audioBitsEntry = new Gtk.Entry({
                placeholder_text: '16'
            });
            return this.widgets.audioBitsEntry;
        });

        this.createLabeledWidget(audioFrame, 'Audio Channels:', () => {
            this.widgets.audioChannelsEntry = new Gtk.Entry({
                placeholder_text: '1'
            });
            return this.widgets.audioChannelsEntry;
        });

        const audioDesc = new Gtk.Label({
            label: 'Standard settings: 16000 Hz, 16-bit, 1 channel (mono). Higher values may improve quality but increase file size.',
            halign: Gtk.Align.START,
            wrap: true,
            margin_top: 5
        });
        audioDesc.getStyleContext().addClass('dim-label');
        audioFrame.packStart(audioDesc, false, false, 0);

        scrolled.add(mainBox);

        const tabLabel = new Gtk.Label({ label: '⚙️ Advanced' });
        this.notebook.appendPage(scrolled, tabLabel);
    }

    createServiceTab() {
        const scrolled = new Gtk.ScrolledWindow();
        scrolled.setPolicy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);

        const mainBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 20,
            margin_top: 20,
            margin_bottom: 20,
            margin_start: 20,
            margin_end: 20
        });

        // Service Status Section
        const statusFrame = this.createStyledFrame('📊 Service Status', mainBox);

        this.widgets.statusLabel = new Gtk.Label({
            label: 'Service: Checking...',
            halign: Gtk.Align.START,
            margin_bottom: 10
        });
        statusFrame.packStart(this.widgets.statusLabel, false, false, 0);

        const serviceButtonBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 10,
            halign: Gtk.Align.START
        });

        const startServiceBtn = new Gtk.Button({ label: '▶️ Start Service' });
        startServiceBtn.getStyleContext().addClass('suggested-action');
        startServiceBtn.on('clicked', () => this.startService());

        const stopServiceBtn = new Gtk.Button({ label: '⏹️ Stop Service' });
        stopServiceBtn.getStyleContext().addClass('destructive-action');
        stopServiceBtn.on('clicked', () => this.stopService());

        const restartServiceBtn = new Gtk.Button({ label: '🔄 Restart Service' });
        restartServiceBtn.on('clicked', () => this.restartServiceIfNeeded());

        serviceButtonBox.packStart(startServiceBtn, false, false, 0);
        serviceButtonBox.packStart(stopServiceBtn, false, false, 0);
        serviceButtonBox.packStart(restartServiceBtn, false, false, 0);
        statusFrame.packStart(serviceButtonBox, false, false, 0);

        // Wayland Support Section
        const waylandFrame = this.createStyledFrame('🌊 Wayland Support', mainBox);

        const waylandDesc = new Gtk.Label({
            label: 'For Wayland users: Use the toggle script method for hotkey functionality.',
            halign: Gtk.Align.START,
            wrap: true,
            margin_bottom: 10
        });
        waylandFrame.packStart(waylandDesc, false, false, 0);

        const createToggleBtn = new Gtk.Button({ label: '📜 Create Toggle Script' });
        createToggleBtn.on('clicked', () => this.createToggleScript());
        waylandFrame.packStart(createToggleBtn, false, false, 0);

        // Settings Actions Section
        const actionsFrame = this.createStyledFrame('⚙️ Settings Actions', mainBox);

        const actionButtonBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 10,
            halign: Gtk.Align.START
        });

        const resetBtn = new Gtk.Button({ label: '🔄 Reset to Defaults' });
        resetBtn.getStyleContext().addClass('destructive-action');
        resetBtn.on('clicked', () => this.resetSettings());

        const saveBtn = new Gtk.Button({ label: '💾 Save Settings' });
        saveBtn.getStyleContext().addClass('suggested-action');
        saveBtn.on('clicked', () => this.saveSettings());

        actionButtonBox.packStart(resetBtn, false, false, 0);
        actionButtonBox.packStart(saveBtn, false, false, 0);
        actionsFrame.packStart(actionButtonBox, false, false, 0);

        scrolled.add(mainBox);

        const tabLabel = new Gtk.Label({ label: '🔧 Service & Control' });
        this.notebook.appendPage(scrolled, tabLabel);

        // Check service status periodically
        this.updateServiceStatus();
        GLib.timeoutAdd(GLib.PRIORITY_DEFAULT, 5000, () => {
            this.updateServiceStatus();
            return true;
        });
    }

    createStyledFrame(title, parent) {
        const frame = new Gtk.Frame({ label: title });
        frame.getStyleContext().addClass('settings-frame');

        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 15,
            margin_top: 15,
            margin_bottom: 15,
            margin_start: 15,
            margin_end: 15
        });

        frame.add(box);
        parent.packStart(frame, false, false, 0);
        return box;
    }

    createLabeledWidget(parent, labelText, widgetFactory) {
        const hbox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 10
        });

        const label = new Gtk.Label({
            label: labelText,
            halign: Gtk.Align.START,
            xalign: 0
        });
        label.setSizeRequest(200, -1);

        const widget = widgetFactory();

        hbox.packStart(label, false, false, 0);
        hbox.packStart(widget, true, true, 0);
        parent.packStart(hbox, false, false, 5);

        return widget;
    }

    browseForFolder() {
        const dialog = new Gtk.FileChooserDialog({
            title: 'Select Project Directory',
            parent: this.window,
            action: Gtk.FileChooserAction.SELECT_FOLDER
        });

        dialog.addButton('Cancel', Gtk.ResponseType.CANCEL);
        dialog.addButton('Select', Gtk.ResponseType.ACCEPT);

        const response = dialog.run();
        if (response === Gtk.ResponseType.ACCEPT) {
            const folder = dialog.getFilename();
            this.widgets.codingPathEntry.setText(folder);
        }
        dialog.destroy();
    }

    loadSettings() {
        const config = this.config.getAll();

        // General settings
        this.widgets.modeCombo.setActiveId(config.mode);
        this.widgets.hotkeyEntry.setText(config.hotkey);
        this.widgets.modelCombo.setActiveId(config.whisperModel);
        this.widgets.autoStartCheck.setActive(config.autoStart);
        this.widgets.notificationsCheck.setActive(config.showNotifications);

        // Set hotkey method based on environment
        const isWayland = process.env.WAYLAND_DISPLAY || process.env.XDG_SESSION_TYPE === 'wayland';
        if (this.widgets.hotkeyMethodCombo) {
            this.widgets.hotkeyMethodCombo.setActiveId(isWayland ? 'toggle' : 'global');
        }

        // Mode-specific settings
        this.widgets.typingDelayEntry.setText(config.typingDelay.toString());
        this.widgets.codingPathEntry.setText(config.codingPath);
        this.widgets.claudeCodePathEntry.setText(config.claudeCodePath);
        this.widgets.systemPromptBuffer.setText(config.systemPrompt, -1);

        // API settings
        this.widgets.apiKeyEntry.setText(config.openaiApiKey);
        this.widgets.baseUrlEntry.setText(config.openaiBaseUrl);
        this.widgets.apiModelEntry.setText(config.openaiModel);

        // Advanced settings
        this.widgets.sampleRateEntry.setText(config.audioSampleRate.toString());
        this.widgets.audioBitsEntry.setText(config.audioBits.toString());
        this.widgets.audioChannelsEntry.setText(config.audioChannels.toString());
    }

    saveSettings() {
        try {
            // General settings
            this.config.set('mode', this.widgets.modeCombo.getActiveId());
            this.config.set('hotkey', this.widgets.hotkeyEntry.getText());
            this.config.set('whisperModel', this.widgets.modelCombo.getActiveId());
            this.config.set('autoStart', this.widgets.autoStartCheck.getActive());
            this.config.set('showNotifications', this.widgets.notificationsCheck.getActive());

            // Save hotkey method preference
            if (this.widgets.hotkeyMethodCombo) {
                this.config.set('hotkeyMethod', this.widgets.hotkeyMethodCombo.getActiveId());
            }

            // Mode-specific settings
            this.config.set('typingDelay', parseInt(this.widgets.typingDelayEntry.getText()) || 50);
            this.config.set('codingPath', this.widgets.codingPathEntry.getText());
            this.config.set('claudeCodePath', this.widgets.claudeCodePathEntry.getText());

            const startIter = this.widgets.systemPromptBuffer.getStartIter();
            const endIter = this.widgets.systemPromptBuffer.getEndIter();
            const systemPrompt = this.widgets.systemPromptBuffer.getText(startIter, endIter, false);
            this.config.set('systemPrompt', systemPrompt);

            // API settings
            this.config.set('openaiApiKey', this.widgets.apiKeyEntry.getText());
            this.config.set('openaiBaseUrl', this.widgets.baseUrlEntry.getText());
            this.config.set('openaiModel', this.widgets.apiModelEntry.getText());

            // Advanced settings
            this.config.set('audioSampleRate', parseInt(this.widgets.sampleRateEntry.getText()) || 16000);
            this.config.set('audioBits', parseInt(this.widgets.audioBitsEntry.getText()) || 16);
            this.config.set('audioChannels', parseInt(this.widgets.audioChannelsEntry.getText()) || 1);

            this.config.saveConfig();

            this.showMessage('✅ Settings saved successfully!', 'info');

            // Restart service if it's running
            this.restartServiceIfNeeded();

        } catch (error) {
            console.error('Error saving settings:', error);
            this.showMessage('❌ Error saving settings: ' + error.message, 'error');
        }
    }

    resetSettings() {
        const dialog = new Gtk.MessageDialog({
            parent: this.window,
            modal: true,
            messageType: Gtk.MessageType.QUESTION,
            buttons: Gtk.ButtonsType.YES_NO,
            text: 'Reset all settings to defaults?'
        });

        const response = dialog.run();
        dialog.destroy();

        if (response === Gtk.ResponseType.YES) {
            this.config.reset();
            this.loadSettings();
            this.showMessage('🔄 Settings reset to defaults', 'info');
        }
    }

    updateServiceStatus() {
        exec('pgrep -f "voice-dictation-service"', (error, stdout) => {
            if (error) {
                this.widgets.statusLabel.setLabel('🔴 Service: Stopped');
                this.widgets.statusLabel.getStyleContext().removeClass('status-good');
                this.widgets.statusLabel.getStyleContext().addClass('status-bad');
                if (this.statusIndicator) {
                    this.statusIndicator.getStyleContext().removeClass('status-good');
                    this.statusIndicator.getStyleContext().addClass('status-bad');
                }
            } else {
                this.widgets.statusLabel.setLabel('🟢 Service: Running');
                this.widgets.statusLabel.getStyleContext().removeClass('status-bad');
                this.widgets.statusLabel.getStyleContext().addClass('status-good');
                if (this.statusIndicator) {
                    this.statusIndicator.getStyleContext().removeClass('status-bad');
                    this.statusIndicator.getStyleContext().addClass('status-good');
                }
            }
        });
    }

    startService() {
        exec('node ' + require('path').join(__dirname, 'service.js') + ' &', (error) => {
            if (error) {
                this.showMessage('❌ Failed to start service: ' + error.message, 'error');
            } else {
                this.showMessage('▶️ Service started', 'info');
                setTimeout(() => this.updateServiceStatus(), 1000);
            }
        });
    }

    stopService() {
        exec('pkill -f "voice-dictation-service"', (error) => {
            if (error) {
                this.showMessage('❌ Failed to stop service: ' + error.message, 'error');
            } else {
                this.showMessage('⏹️ Service stopped', 'info');
                setTimeout(() => this.updateServiceStatus(), 1000);
            }
        });
    }

    restartServiceIfNeeded() {
        exec('pgrep -f "voice-dictation-service"', (error, stdout) => {
            if (!error && stdout.trim()) {
                this.stopService();
                setTimeout(() => this.startService(), 2000);
            }
        });
    }

    createToggleScript() {
        const scriptPath = path.join(process.env.HOME, 'voice-dictation-toggle.sh');
        const scriptContent = `#!/bin/bash
# Voice Dictation Toggle Script for Wayland
# Created by Voice Dictation Settings GUI

TRIGGER_FILE="/tmp/voice-dictation-trigger"
LOCK_FILE="/tmp/voice-dictation-recording"

if [ -f "$LOCK_FILE" ]; then
    # Currently recording - stop recording
    rm -f "$LOCK_FILE"
    echo "🎤 Recording stopped"
    notify-send "Voice Dictation" "Recording stopped" --icon=microphone
else
    # Not recording - start recording
    touch "$LOCK_FILE"
    touch "$TRIGGER_FILE"
    echo "🎤 Recording started"
    notify-send "Voice Dictation" "Recording started - press the hotkey again to stop" --icon=microphone
fi
`;

        try {
            const fs = require('fs');
            fs.writeFileSync(scriptPath, scriptContent, { mode: 0o755 });

            this.showMessage(`✅ Toggle script created at ${scriptPath}

Configure your desktop environment to run this script when you press your preferred hotkey combination.

For GNOME: Settings > Keyboard > Custom Shortcuts
For KDE: System Settings > Shortcuts > Custom Shortcuts
For others: Check your desktop environment's hotkey settings`, 'info');

        } catch (error) {
            this.showMessage(`❌ Failed to create toggle script: ${error.message}`, 'error');
        }
    }

    showMessage(message, type = 'info') {
        const messageType = type === 'error' ? Gtk.MessageType.ERROR : Gtk.MessageType.INFO;
        const dialog = new Gtk.MessageDialog({
            parent: this.window,
            modal: true,
            messageType: messageType,
            buttons: Gtk.ButtonsType.OK,
            text: message
        });

        dialog.run();
        dialog.destroy();
    }

    start() {
        Gtk.main();
    }
}

// Start the application
if (require.main === module) {
    const app = new SettingsGUI();
    app.start();
}

module.exports = SettingsGUI;