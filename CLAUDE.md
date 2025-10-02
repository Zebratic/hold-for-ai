# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a voice-activated speech-to-text system with AI command interpretation capabilities. The application provides offline speech-to-text conversion using whisper.cpp and integrates with OpenAI APIs for command processing.

## Architecture

The application consists of two main components:

### Core Components

- **src/index.js**: Main application entry point that handles:
  - Audio recording using sox
  - Speech-to-text transcription via whisper.cpp (in worker threads)
  - AI processing through OpenAI API or local LLM server
  - Audio file management and processing workflow

- **src/gui.js**: GTK-based GUI using node-gtk that provides:
  - Recording controls and status display
  - Real-time volume monitoring
  - Console output for user feedback
  - Recording playback and management interface

### Key Architecture Patterns

- **Worker Threads**: Transcription runs in separate worker threads to avoid blocking the main GUI
- **Event-Driven**: GUI callbacks handle user interactions and update UI state
- **Process Management**: Sox processes are spawned and managed for audio recording
- **AI Integration**: Supports both OpenAI API and local LLM servers via configurable base URL

## Environment Configuration

The application uses these environment variables:

- `OPENAI_API_KEY`: API key for OpenAI (required for command interpretation)
- `OPENAI_BASE_URL`: Base URL for API calls (defaults to localhost:1234 for local LLM)
- `OPENAI_MODEL`: Model to use (defaults to gpt-3.5-turbo)
- `WHISPER_MODEL`: Whisper model name (defaults to base.en)

## Development Commands

```bash
# Install dependencies
npm install

# Install as system service (recommended)
npm run install
# or
./install.sh

# Start background service (always listening)
npm run service
# or
node src/service.js

# Open settings manager (CLI)
npm run settings
# or
node src/settings-cli.js

# Open settings GUI (requires GTK)
npm run settings-gui
# or
node src/settings-gui.js

# Legacy commands (original applications)
npm start                    # Original GUI application
npm run dictation            # Standalone dictation
npm run dictation-coding     # Standalone coding mode
```

## Dependencies and Requirements

### System Dependencies
- sox: Audio recording and processing
- whisper.cpp: Speech-to-text (binary at whisper.cpp/build/bin/main)
- xdotool: Keystroke injection for dictation
- GTK 3.0: GUI framework via node-gtk (for original GUI app)

### Models
- Whisper models stored in `models/` directory (currently contains base.en.bin)
- Model path: `models/${WHISPER_MODEL || 'base.en'}.bin`

### Audio Processing Flow
1. Sox records audio to temporary WAV files in src/ directory
2. Worker thread processes audio using whisper-cli command
3. Transcription is sent to OpenAI/local LLM for interpretation
4. Results displayed in GUI console

## Key Technical Details

- Audio files: 16kHz, 16-bit, mono WAV format
- Worker thread isolation for CPU-intensive transcription
- Real-time volume monitoring during recording
- Support for both exact transcription and command interpretation modes
- GTK3 GUI with recording management features

## Voice Dictation Service System

The system now operates as a background service with GUI settings management:

### New Architecture Overview
- **Background Service** (`src/service.js`): Always-running service that listens for global hotkeys
- **Settings GUI** (`src/settings-gui.js`): GTK-based configuration interface
- **Settings CLI** (`src/settings-cli.js`): Command-line configuration interface
- **Config Management** (`src/config.js`): Centralized configuration system
- **Desktop Integration**: `.desktop` file and systemd service for system integration

### Service Features
- **Always-on Background Operation**: Service runs continuously, ready to respond to hotkeys
- **Dual Operating Modes**:
  - *Typing Mode*: Transcribes speech and types into active window
  - *Coding Mode*: Sends voice prompts directly to Claude Code CLI
- **Global Hotkey Support**: Configurable hotkey (default: Ctrl+Space)
- **Desktop Notifications**: Optional visual feedback for operations
- **Automatic Service Management**: Systemd integration for auto-start on login
- **Configuration Persistence**: Settings stored in `~/.config/voice-dictation/config.json`

### Settings Management
- **CLI Interface**: Interactive command-line settings manager (`npm run settings`)
- **GUI Interface**: GTK-based graphical settings (requires node-gtk rebuild)
- **Desktop Entry**: Appears in application menus after installation
- **Live Configuration**: Settings can be reloaded without restarting service

### Installation & Setup
```bash
# One-time setup
npm run install          # Installs systemd service and desktop files
systemctl --user start voice-dictation.service   # Start service
systemctl --user enable voice-dictation.service  # Enable auto-start
```

### Usage Workflows

**Global Hotkey Method (X11):**
1. Hold Ctrl+Space to start recording audio
2. Speak while holding the key combination
3. Release keys to stop recording and process
4. In Typing Mode: Transcribed text is automatically typed into active window
5. In Coding Mode: Transcribed prompt is sent to Claude Code CLI

**Toggle Method (Wayland Compatible):**
1. Press your configured hotkey to start recording
2. Speak your request
3. Press the hotkey again to stop recording and process
4. Processing works the same as global hotkey method

### Wayland Support

For Wayland users, the service automatically switches to toggle mode when Wayland is detected. You have two options:

**Option 1: Use the provided toggle script**
```bash
# The script is available at: ./voice-dictation-toggle.sh
# Or create one in your home directory using the settings GUI
```

**Option 2: Manual trigger**
```bash
# Start/stop recording manually
touch /tmp/voice-dictation-trigger
```

**Setup Instructions for Wayland:**
1. Run the settings GUI: `npm run settings-gui`
2. Go to "Service & Control" tab
3. Click "Create Toggle Script"
4. Configure your desktop environment to run the script on your preferred hotkey:
   - **GNOME**: Settings → Keyboard → Custom Shortcuts
   - **KDE**: System Settings → Shortcuts → Custom Shortcuts
   - **Others**: Check your desktop environment's hotkey settings

### Environment Variables
- `CLAUDE_CODE_PATH`: Path to claude-code CLI binary (defaults to 'claude-code')
- `DICTATION_HOTKEY`: Global hotkey combination (defaults to 'ctrl+space')