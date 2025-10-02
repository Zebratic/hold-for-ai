const { spawn } = require('child_process');
const OpenAI = require('openai');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const VoiceAssistantGUI = require('./gui');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

// Load environment variables
dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || 'http://localhost:1234/v1'
});

let isRecording = false;
let soxProcess = null;
let audioFile = null;
let recordingStartTime = null;
let gui = null;
let audioWorker = null;

async function runCMD(command) {
    return new Promise((resolve, reject) => {
        const process = exec(command);
        let stdout = '';
        
        process.stdout.on('data', (data) => {
            const output = data.toString();
            process.stdout.write(output); // Print in real-time
            stdout += output;
        });
        
        process.stderr.on('data', (data) => {
            process.stderr.write(data.toString()); // Print stderr in real-time
        });
        
        process.on('exit', (code) => {
            if (code === 0) {
                resolve(stdout);
            } else {
                reject(new Error(`Command exited with code ${code}`));
            }
        });
        
        process.on('error', (error) => {
            reject(error);
        });
    });
}

function createAudioWorker(audioFile) {
    return new Promise((resolve, reject) => {
        const worker = new Worker(__filename, {
            workerData: { 
                audioFile,
                modelPath: path.join(__dirname, '..', 'models', `${process.env.WHISPER_MODEL || 'base.en'}.bin`)
            }
        });
        
        worker.on('message', (message) => {
            if (message.type === 'log') {
                console.log(`[Worker] ${message.data}`);
            } else if (message.type === 'transcription') {
                resolve(message.data);
            } else if (message.type === 'error') {
                reject(new Error(message.data));
            }
        });
        
        worker.on('error', (error) => {
            reject(error);
        });
        
        worker.on('exit', (code) => {
            if (code !== 0) {
                reject(new Error(`Worker stopped with exit code ${code}`));
            }
        });
        
        return worker;
    });
}

async function transcribeAudio(audioFile) {
    return new Promise(async (resolve, reject) => {
        try {
            gui.appendConsole('Transcribing audio...');
        
            // Use worker thread for transcription
            const transcription = await createAudioWorker(audioFile);
            resolve(transcription);
        } catch (error) {
            reject(error);
        }
    });
}-

async function processAudio() {
    try {
        console.log('Starting audio processing');
        gui.updateRecordingStatus(false);
        gui.appendConsole('Processing audio...');
        
        // Add recording to the list
        console.log('Adding recording to list:', audioFile);
        gui.addRecording(audioFile);
        
        // Transcribe audio
        console.log('Starting transcription process');
        const transcript = await transcribeAudio(audioFile);
        console.log('Transcription result:', transcript);
        
        if (transcript) {
            gui.appendConsole('Transcript: ' + transcript);
            
            // Check if it's a command request
            const isCommandRequest = transcript.toLowerCase().includes('command');
            console.log('Is command request:', isCommandRequest);
            
            // Send to OpenAI for processing
            gui.appendConsole('Sending to OpenAI...');
            console.log('Sending to OpenAI with model:', process.env.OPENAI_MODEL || 'gpt-3.5-turbo');
            const completion = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [
                    {
                        role: "system",
                        content: isCommandRequest 
                            ? "You are a command generator. When asked for a command, output ONLY the command without any explanation or additional text. If the request is not clear enough for a command, output 'Invalid command request'."
                            : "You are a speech-to-text assistant. Output ONLY the transcribed text without any additional processing or response."
                    },
                    {
                        role: "user",
                        content: transcript
                    }
                ],
            });
            
            console.log('OpenAI response received:', completion);
            gui.appendConsole('Output: ' + completion.choices[0].message.content.trim());
        } else {
            console.log('No transcript was generated');
        }
    } catch (error) {
        console.error('Error in processAudio:', error);
        gui.appendConsole('Error processing audio: ' + error.message);
    }
}

function startRecording() {
    audioFile = path.join(__dirname, `recording-${Date.now()}.wav`);
    isRecording = true;
    recordingStartTime = Date.now();
    
    gui.updateRecordingStatus(true);
    gui.appendConsole('Listening... (speak now)');
    
    // Start sox recording process with default input device
    const soxArgs = [
        '-d', // Use default input device
        '-t', 'wav', // Output format is WAV
        '-r', '16000', // Sample rate
        '-b', '16', // Bits per sample
        '-c', '1', // Mono
        '-e', 'signed', // Signed integer
        audioFile // Output file
    ];

    soxProcess = spawn('sox', soxArgs);

    // Monitor volume levels
    const volumeProcess = spawn('sox', [
        '-d',
        '-n',
        'stat',
        '-freq',
        '-s',
        '-r', '16000',
        '-b', '16',
        '-c', '1',
        '-e', 'signed'
    ]);

    volumeProcess.stdout.on('data', (data) => {
        if (!isRecording) return;
        
        // Parse volume level from sox output
        const lines = data.toString().split('\n');
        for (const line of lines) {
            if (line.includes('Maximum amplitude:')) {
                const match = line.match(/Maximum amplitude:\s*([\d.]+)/);
                if (match) {
                    const volume = Math.min(100, Math.round(parseFloat(match[1]) * 100));
                    gui.updateVolume(volume);
                }
            }
        }
    });

    // Handle sox process errors
    soxProcess.stderr.on('data', (data) => {
        console.error('Sox error:', data.toString());
    });

    soxProcess.on('error', (error) => {
        console.error('Failed to start sox:', error);
        gui.appendConsole('Error: Failed to start recording');
    });
}

function stopRecording() {
    if (!isRecording) return;
    
    isRecording = false;
    
    // Stop the sox process
    if (soxProcess) {
        soxProcess.kill();
        soxProcess = null;
    }
    
    processAudio();
}

function main() {
    // Create GUI instance
    gui = new VoiceAssistantGUI();
    
    gui.appendConsole('Voice-Activated Speech-to-Text');
    gui.appendConsole('------------------------------');
    gui.appendConsole('Click Start Recording to begin.\n');
    gui.appendConsole('Press Ctrl+C to exit\n');

    // Set up record toggle callback
    gui.setRecordToggleCallback(() => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    });

    // Handle exit
    process.on('SIGINT', () => {
        isRecording = false;
        if (soxProcess) {
            soxProcess.kill();
            soxProcess = null;
        }
        gui.appendConsole('\nGoodbye!');
        process.exit();
    });

    // Start the GTK main loop
    gui.start();
}

// Worker thread code
if (!isMainThread) {
    const { audioFile, modelPath } = workerData;
    
    async function transcribeInWorker() {
        try {
            parentPort.postMessage({ type: 'log', data: 'Starting transcription in worker thread' });
            
            // Run whisper.cpp command
            const command = `whisper-cli ${audioFile} --model ${modelPath} --no-prints --no-timestamps`;
            parentPort.postMessage({ type: 'log', data: command });
            
            const stdout = await runCMD(command);
            
            // Get the transcription from stdout
            const transcription = stdout.trim();
            parentPort.postMessage({ type: 'log', data: `Transcription from stdout: ${transcription}` });
            
            // Also check for the output file as backup
            const txtFile = audioFile.replace(/\.[^/.]+$/, '.txt');
            if (fs.existsSync(txtFile)) {
                parentPort.postMessage({ type: 'log', data: `Transcription file found: ${txtFile}` });
                const fileTranscription = fs.readFileSync(txtFile, 'utf8').trim();
                parentPort.postMessage({ type: 'log', data: `File transcription: ${fileTranscription}` });
                // Prefer stdout but fall back to file if stdout is empty
                parentPort.postMessage({ type: 'transcription', data: transcription || fileTranscription });
            } else if (transcription) {
                parentPort.postMessage({ type: 'transcription', data: transcription });
            } else {
                throw new Error('No transcription available');
            }
        } catch (error) {
            parentPort.postMessage({ type: 'error', data: error.message });
        }
    }
    
    transcribeInWorker();
} else {
    // Start the application
    main();
}