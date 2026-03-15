// game.js

const inputP1 = document.getElementById('input-p1');
const inputP2 = document.getElementById('input-p2');
const boxP1 = document.getElementById('box-p1');
const boxP2 = document.getElementById('box-p2');
const btnAnalyze = document.getElementById('btn-analyze');
const resultOverlay = document.getElementById('result-overlay');
const matchScore = document.getElementById('match-score');

let hasP1 = false;
let hasP2 = false;

// Audio Context for Retro Sounds
let audioCtx;
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

// Function to play a retro blip sound
function playBlip(freq, type = 'square', dur = 0.1) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + dur);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + dur);
}

// Play success sound
function playSuccess() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    // Arpeggio
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.setValueAtTime(554.37, now + 0.1);
    osc.frequency.setValueAtTime(659.25, now + 0.2);
    osc.frequency.setValueAtTime(880, now + 0.3);
    
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.5);
    
    osc.start(now);
    osc.stop(now + 0.5);
}

// Handle File Uploads
function handleFileUpload(inputElement, boxElement, isP1) {
    const file = inputElement.files[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            boxElement.style.backgroundImage = `url(${e.target.result})`;
            boxElement.classList.add('has-image');
            
            initAudio();
            playBlip(600, 'square', 0.1);
            
            if (isP1) hasP1 = true;
            else hasP2 = true;
            
            checkReadyState();
        };
        
        reader.readAsDataURL(file);
    }
}

inputP1.addEventListener('change', () => handleFileUpload(inputP1, boxP1, true));
inputP2.addEventListener('change', () => handleFileUpload(inputP2, boxP2, false));

// Check if both photos are loaded
function checkReadyState() {
    if (hasP1 && hasP2) {
        btnAnalyze.removeAttribute('disabled');
        btnAnalyze.innerText = "ANALYZE LOVE";
    }
}

// Analysis Animation
btnAnalyze.addEventListener('click', () => {
    if (btnAnalyze.disabled) return;
    initAudio();
    
    btnAnalyze.disabled = true;
    let count = 0;
    
    // Computing animation
    const calcInterval = setInterval(() => {
        playBlip(300 + Math.random() * 500, 'sawtooth', 0.05);
        btnAnalyze.innerText = "COMPUTING" + ".".repeat(count % 4);
        count++;
        
        if (count > 20) {
            clearInterval(calcInterval);
            finishAnalysis();
        }
    }, 100); // 2 seconds total
});

function finishAnalysis() {
    playSuccess();
    
    // Generate random score
    const score = Math.floor(Math.random() * 101);
    matchScore.innerText = `${score}%`;
    
    btnAnalyze.innerText = "MATCH FOUND!";
    
    // Show overlay
    resultOverlay.classList.remove('hidden');
    resultOverlay.classList.add('show');
    
    // Reset capability after a few seconds
    setTimeout(() => {
        resultOverlay.classList.remove('show');
        setTimeout(() => {
            resultOverlay.classList.add('hidden');
            btnAnalyze.innerText = "ANALYZE AGAIN";
            btnAnalyze.removeAttribute('disabled');
        }, 300); // wait for fade out
    }, 4000);
}
