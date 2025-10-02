#!/bin/bash

# Voice Dictation Installation Script

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
USER_HOME="$HOME"
CONFIG_DIR="$USER_HOME/.config/voice-dictation"
DESKTOP_FILE="voice-dictation-settings.desktop"
SERVICE_FILE="voice-dictation.service"

echo "🎤 Installing Voice Dictation System..."

# Create config directory
echo "📁 Creating configuration directory..."
mkdir -p "$CONFIG_DIR"

# Copy desktop file to applications
echo "🖥️  Installing desktop entry..."
if [ -d "$USER_HOME/.local/share/applications" ]; then
    cp "$SCRIPT_DIR/$DESKTOP_FILE" "$USER_HOME/.local/share/applications/"
    echo "   ✅ Desktop file installed to ~/.local/share/applications/"
else
    echo "   ⚠️  ~/.local/share/applications not found, skipping desktop file"
fi

# Install systemd user service
echo "⚙️  Installing systemd user service..."
mkdir -p "$USER_HOME/.config/systemd/user"
cp "$SCRIPT_DIR/$SERVICE_FILE" "$USER_HOME/.config/systemd/user/"

# Update the service file with correct paths
sed -i "s|/run/media/zebratic/HDD_DATA/Work/hold-for-ai|$SCRIPT_DIR|g" "$USER_HOME/.config/systemd/user/$SERVICE_FILE"
sed -i "s|ReadWritePaths=/home/%i/.config/voice-dictation|ReadWritePaths=$CONFIG_DIR|g" "$USER_HOME/.config/systemd/user/$SERVICE_FILE"

echo "   ✅ Service file installed"

# Reload systemd
echo "🔄 Reloading systemd..."
systemctl --user daemon-reload

# Ask about auto-start
echo ""
read -p "🚀 Enable auto-start on login? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    systemctl --user enable voice-dictation.service
    echo "   ✅ Auto-start enabled"
fi

# Ask about starting now
echo ""
read -p "▶️  Start the service now? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    systemctl --user start voice-dictation.service
    echo "   ✅ Service started"

    # Check status
    sleep 2
    if systemctl --user is-active --quiet voice-dictation.service; then
        echo "   🎉 Service is running successfully!"
    else
        echo "   ❌ Service failed to start. Check: journalctl --user -u voice-dictation.service"
    fi
fi

echo ""
echo "🎉 Installation complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Open 'Voice Dictation Settings' from your applications menu"
echo "   2. Configure your preferences (API keys, project paths, etc.)"
echo "   3. Start using Ctrl+Space for voice dictation!"
echo ""
echo "💡 Tips:"
echo "   - Service status: systemctl --user status voice-dictation.service"
echo "   - View logs: journalctl --user -u voice-dictation.service -f"
echo "   - Reload config: systemctl --user reload voice-dictation.service"
echo ""