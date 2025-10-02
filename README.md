# Speech-to-Text System Module

A systemd service that provides offline speech-to-text functionality with AI command interpretation and text-to-speech capabilities.

## Features

- Offline speech-to-text conversion using whisper.cpp
- AI command interpretation using OpenAI GPT-3.5
- Text-to-speech functionality
- Global hotkeys for easy control
- Clipboard integration

## Prerequisites

- Node.js v16 or higher
- OpenAI API key (only for command interpretation)
- `sox` package for audio recording
- `xclip` for clipboard operations
- `whisper.cpp` installed and available in PATH

## Installation

1. Install system dependencies:
```bash
sudo pacman -S sox xclip
```

2. Install and build whisper.cpp:
```bash
git clone https://github.com/ggerganov/whisper.cpp
cd whisper.cpp
make
sudo cp main /usr/local/bin/whisper
cd models
bash download-ggml-model.sh base.en
sudo mkdir -p /usr/local/share/whisper
sudo cp ggml-base.en.bin /usr/local/share/whisper/
```

3. Install Node.js dependencies:
```bash
npm install
```

4. Set up environment variables:
```bash
export OPENAI_API_KEY="your-openai-api-key"
```

5. Install the systemd service:
```bash
sudo cp config/speech-to-text.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable speech-to-text
sudo systemctl start speech-to-text
```

## Usage

The system provides the following hotkeys:

- F6: Start recording (exact text mode)
- F7: Start recording (command mode)
- F8: Stop recording
- F9: Speak selected text
- Ctrl+C: Exit hotkey listener

### Modes

1. Exact Text Mode (F6):
   - Hold F6 to record speech
   - Release to stop recording
   - The transcribed text will be copied to your clipboard

2. Command Mode (F7):
   - Hold F7 to record speech
   - Release to stop recording
   - The AI will interpret your speech as a command
   - The interpreted command will be copied to your clipboard

3. Text-to-Speech (F9):
   - Select any text
   - Press F9 to have the system speak the selected text

## Troubleshooting

1. If the service fails to start, check the logs:
```bash
journalctl -u speech-to-text -f
```

2. Make sure whisper.cpp is properly installed and the model is available:
```bash
whisper --model base.en --help
```

3. Verify that the OpenAI API key is valid (only needed for command interpretation)

## License

MIT
