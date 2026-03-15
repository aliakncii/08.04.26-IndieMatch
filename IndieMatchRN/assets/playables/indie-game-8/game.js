const sequenceDisplay = document.getElementById('sequence-display');
const btnPlay = document.getElementById('btn-play');
const instructionText = document.getElementById('instruction-text');
const keys = document.querySelectorAll('.key');

// Game State
let isPlaying = false;
let targetSequence = [];
let currentSequenceIndex = 0;

// Web Audio API Context
let audioCtx;
const baseFrequencies = {
    "1": 261.63, // C4
    "2": 277.18, // C#4
    "3": 293.66, // D4
    "4": 311.13, // D#4
    "5": 329.63, // E4
    "6": 349.23, // F4
    "7": 369.99, // F#4
    "8": 392.00, // G4
    "9": 415.30, // G#4
    "10": 440.00, // A4
    "11": 466.16, // A#4
    "12": 493.88, // B4
    "13": 523.25, // C5
    "14": 554.37, // C#5
    "15": 587.33, // D5
    "16": 622.25, // D#5
    "17": 659.25  // E5
};

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playNoteForFrequency(frequency) {
    if (!audioCtx) return;
    
    // Create oscillator and gain node (envelope)
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    // Synth-pop style piano (warm triangle/sine mix)
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);
    
    // Simple Attack-Decay-Sustain-Release (ADSR) envelope for piano feel
    const now = audioCtx.currentTime;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.8, now + 0.05); // Attack
    gainNode.gain.exponentialRampToValueAtTime(0.3, now + 0.3); // Decay
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 1.5); // Release
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc.start(now);
    osc.stop(now + 1.5);
}

// Generate UI for sequence
function renderSequence() {
    sequenceDisplay.innerHTML = '';
    targetSequence.forEach((note, index) => {
        const box = document.createElement('div');
        box.className = 'seq-box';
        box.innerText = note;
        
        if (index < currentSequenceIndex) box.classList.add('completed');
        else if (index === currentSequenceIndex) box.classList.add('active');
        
        sequenceDisplay.appendChild(box);
    });
}

// Game Logic
function generateNewSequence() {
    targetSequence = [];
    const possibleNotes = [1, 3, 5, 8, 10, 12, 13, 15]; // Mostly white keys for melody
    for (let i = 0; i < 8; i++) {
        targetSequence.push(possibleNotes[Math.floor(Math.random() * possibleNotes.length)]);
    }
    currentSequenceIndex = 0;
    renderSequence();
}

function startGame() {
    initAudio();
    isPlaying = true;
    instructionText.innerText = "TAP THE GOLDEN KEYS IN ORDER";
    generateNewSequence();
}

btnPlay.addEventListener('click', () => {
    startGame();
});

// Key Interaction
function handleKeyPress(keyElement, isDown) {
    if (isDown) {
        keyElement.classList.add('pressed');
        
        // Ensure audio context is started (iOS requirement)
        initAudio();
        
        const noteId = keyElement.getAttribute('data-note');
        const freq = baseFrequencies[noteId];
        if (freq) playNoteForFrequency(freq);
        
        if (isPlaying) {
            // Check if correct key in sequence was pressed
            if (parseInt(noteId) === targetSequence[currentSequenceIndex]) {
                currentSequenceIndex++;
                renderSequence();
                
                if (currentSequenceIndex >= targetSequence.length) {
                    // Won!
                    isPlaying = false;
                    instructionText.innerText = "PERFECT! PLAY AGAIN?";
                    playSuccessChord();
                }
            } else {
                // Wrong note! Highlight error
                instructionText.innerText = "WRONG KEY! TRY AGAIN";
                currentSequenceIndex = 0; // Reset
                renderSequence();
            }
        }
    } else {
        keyElement.classList.remove('pressed');
    }
}

function playSuccessChord() {
    setTimeout(() => {
        playNoteForFrequency(baseFrequencies["1"]);
        playNoteForFrequency(baseFrequencies["5"]);
        playNoteForFrequency(baseFrequencies["8"]);
        playNoteForFrequency(baseFrequencies["13"]);
    }, 500);
}

// Attach Event Listeners to Keys for Multi-touch
keys.forEach(key => {
    // Mouse
    key.addEventListener('mousedown', (e) => {
        if(e.button !== 0) return; // Only left click
        handleKeyPress(key, true);
    });
    key.addEventListener('mouseup', () => handleKeyPress(key, false));
    key.addEventListener('mouseleave', () => handleKeyPress(key, false));
    
    // Touch
    key.addEventListener('touchstart', (e) => {
        e.preventDefault(); // Prevent scrolling/zooming
        handleKeyPress(key, true);
    }, { passive: false });
    key.addEventListener('touchend', (e) => {
        e.preventDefault();
        handleKeyPress(key, false);
    }, { passive: false });
});

// Initial Render (empty boxes)
targetSequence = [0,0,0,0,0,0,0,0]; // Dummy just for visual
renderSequence();
sequenceDisplay.innerHTML = ''; // Hide until play
