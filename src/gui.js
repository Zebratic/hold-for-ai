const gi = require('node-gtk');
const Gtk = gi.require('Gtk', '3.0');
const Gdk = gi.require('Gdk', '3.0');
const GLib = gi.require('GLib', '2.0');
const { exec, spawn } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const fs = require('fs');

class VoiceAssistantGUI {
    constructor() {
        // Initialize GTK
        Gtk.init(null);
        
        this.window = new Gtk.Window({
            title: 'Voice Assistant',
            default_width: 800,
            default_height: 600
        });
        
        this.window.on('destroy', () => {
            Gtk.mainQuit();
        });

        // Create main container
        const mainBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 10,
            margin_top: 10,
            margin_bottom: 10,
            margin_start: 10,
            margin_end: 10
        });

        // Create control section
        const controlFrame = new Gtk.Frame({
            label: 'Controls'
        });
        const controlBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 10
        });

        this.recordButton = new Gtk.Button({
            label: 'Start Recording'
        });
        controlBox.packStart(this.recordButton, false, false, 5);
        controlFrame.add(controlBox);
        mainBox.packStart(controlFrame, false, false, 5);

        // Create status section
        const statusFrame = new Gtk.Frame({
            label: 'Status'
        });
        const statusBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 5
        });

        this.recordingLabel = new Gtk.Label({
            label: 'Not Recording'
        });
        this.volumeLabel = new Gtk.Label({
            label: 'Volume: 0%'
        });
        statusBox.packStart(this.recordingLabel, false, false, 5);
        statusBox.packStart(this.volumeLabel, false, false, 5);
        statusFrame.add(statusBox);
        mainBox.packStart(statusFrame, false, false, 5);

        // Create console section
        const consoleFrame = new Gtk.Frame({
            label: 'Console'
        });
        const consoleBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 5
        });

        const scrolledWindow = new Gtk.ScrolledWindow();
        this.consoleView = new Gtk.TextView({
            editable: false,
            wrap_mode: Gtk.WrapMode.WORD
        });
        this.consoleBuffer = this.consoleView.getBuffer();
        scrolledWindow.add(this.consoleView);
        consoleBox.packStart(scrolledWindow, true, true, 5);
        consoleFrame.add(consoleBox);
        mainBox.packStart(consoleFrame, true, true, 5);

        // Create recordings section
        const recordingsFrame = new Gtk.Frame({
            label: 'Recordings'
        });
        const recordingsBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 5
        });

        const recordingsScrolledWindow = new Gtk.ScrolledWindow();
        this.recordingsList = new Gtk.ListBox();
        this.recordingsList.setSelectionMode(Gtk.SelectionMode.SINGLE);
        recordingsScrolledWindow.add(this.recordingsList);
        recordingsBox.packStart(recordingsScrolledWindow, true, true, 5);

        const recordingsButtonsBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 5
        });

        this.playButton = new Gtk.Button({
            label: 'Play'
        });
        this.deleteButton = new Gtk.Button({
            label: 'Delete'
        });
        recordingsButtonsBox.packStart(this.playButton, false, false, 5);
        recordingsButtonsBox.packStart(this.deleteButton, false, false, 5);
        recordingsBox.packStart(recordingsButtonsBox, false, false, 5);

        recordingsFrame.add(recordingsBox);
        mainBox.packStart(recordingsFrame, true, true, 5);

        // Set up event handlers
        this.recordButton.on('clicked', () => {
            if (this.recordToggleCallback) {
                this.recordToggleCallback();
            }
        });

        this.playButton.on('clicked', () => {
            const selectedRow = this.recordingsList.getSelectedRow();
            if (selectedRow) {
                const filePath = selectedRow.get_child().get_text();
                this.playRecording(filePath);
            }
        });

        this.deleteButton.on('clicked', () => {
            const selectedRow = this.recordingsList.getSelectedRow();
            if (selectedRow) {
                const filePath = selectedRow.get_child().get_text();
                this.deleteRecording(filePath);
            }
        });

        // Add main box to window
        this.window.add(mainBox);

        // Show all widgets
        this.window.showAll();
    }

    setRecordToggleCallback(callback) {
        this.recordToggleCallback = callback;
    }

    updateRecordButton(isRecording) {
        this.recordButton.setLabel(isRecording ? 'Stop Recording' : 'Start Recording');
    }

    updateRecordingStatus(isRecording) {
        this.recordingLabel.setLabel(isRecording ? 'Recording...' : 'Not Recording');
        this.updateRecordButton(isRecording);
    }

    updateVolume(volume) {
        this.volumeLabel.setLabel(`Volume: ${volume}%`);
    }

    appendConsole(text) {
        const endIter = this.consoleBuffer.getEndIter();
        this.consoleBuffer.insert(endIter, text + '\n', -1);
        this.consoleView.scrollToIter(endIter, 0, false, 0, 0);
    }

    addRecording(filePath) {
        const row = new Gtk.ListBoxRow();
        const box = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 5
        });
        const label = new Gtk.Label({ label: filePath });
        box.packStart(label, true, true, 5);
        row.add(box);
        row.filePath = filePath;
        this.recordingsList.add(row);
        this.recordingsList.showAll();
    }

    playRecording(filePath) {
        const player = spawn('play', [filePath]);
        player.on('error', (err) => {
            this.appendConsole('Error playing recording: ' + err.message);
        });
    }

    deleteRecording(filePath) {
        try {
            fs.unlinkSync(filePath);
            const selectedRow = this.recordingsList.getSelectedRow();
            if (selectedRow) {
                const child = selectedRow.getChild();
                if (child) {
                    this.recordingsList.remove(selectedRow);
                    this.appendConsole('Recording deleted: ' + filePath);
                }
            }
        } catch (err) {
            this.appendConsole('Error deleting recording: ' + err.message);
        }
    }

    start() {
        // Start the GTK main loop
        Gtk.main();
    }
}

module.exports = VoiceAssistantGUI; 