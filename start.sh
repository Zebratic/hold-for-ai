#!/bin/bash

# Start the main speech-to-text process
node index.js & echo $! > ../speech-to-text.pid

# Start the hotkey listener
node hotkeys.js 