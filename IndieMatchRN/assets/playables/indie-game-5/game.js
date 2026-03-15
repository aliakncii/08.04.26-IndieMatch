const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const uiTooltip = document.getElementById('tooltip');
const btnUndo = document.getElementById('btn-undo');
const btnFire = document.getElementById('btn-fire');
const btnSound = document.getElementById('btn-sound');
const phaseTitle = document.getElementById('phase-title');

// Game State
const GAME_WIDTH = 500;
const GAME_HEIGHT = 888; // 9:16 ratio approximately
let scale = 1;
let isInteracting = false;
let isFired = false;
let isSoundOn = true;

// Pottery Data
const SEGMENTS = 100; // Number of horizontal slices
let clayRadii = new Array(SEGMENTS).fill(0);
let clayHistory = []; // For Undo functionality

const POT_BASE_Y = GAME_HEIGHT * 0.8;
const POT_TOP_Y = GAME_HEIGHT * 0.3;
const POT_HEIGHT = POT_BASE_Y - POT_TOP_Y;
const SEGMENT_HEIGHT = POT_HEIGHT / SEGMENTS;

const MAX_RADIUS = GAME_WIDTH * 0.45;
const MIN_RADIUS = GAME_WIDTH * 0.05;

// Animation & Texture
let timeOut = 0;
let rotationOffset = 0; // Fake rotation for lines

// Audio Context
let audioCtx = null;
let humOsc = null;
let humGain = null;
let clayOsc = null;
let clayGain = null;
let clayFilter = null;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        // Background Hum (Wheel spinning)
        humOsc = audioCtx.createOscillator();
        humGain = audioCtx.createGain();
        humOsc.type = 'sine';
        humOsc.frequency.value = 85; // Warm low hum
        humGain.gain.value = 0; // muted initially
        
        let humFilter = audioCtx.createBiquadFilter();
        humFilter.type = 'lowpass';
        humFilter.frequency.value = 200;
        
        humOsc.connect(humGain);
        humGain.connect(humFilter);
        humFilter.connect(audioCtx.destination);
        humOsc.start();

        // Relaxing Wet Clay ASMR (Filtered White Noise)
        let bufferSize = 2 * audioCtx.sampleRate;
        let noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        let output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            // Soft noise
            output[i] = (Math.random() * 2 - 1) * 0.5;
        }
        
        clayOsc = audioCtx.createBufferSource();
        clayOsc.buffer = noiseBuffer;
        clayOsc.loop = true;
        
        clayGain = audioCtx.createGain();
        clayGain.gain.value = 0;
        
        clayFilter = audioCtx.createBiquadFilter();
        clayFilter.type = 'bandpass';
        clayFilter.frequency.value = 400; // Deep earthy swish
        clayFilter.Q.value = 0.6;
        
        clayOsc.connect(clayFilter);
        clayFilter.connect(clayGain);
        clayGain.connect(audioCtx.destination);
        clayOsc.start();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

btnSound.addEventListener('click', () => {
    isSoundOn = !isSoundOn;
    btnSound.innerText = isSoundOn ? '🔊' : '🔇';
    if (!isSoundOn && humGain) {
        humGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.1);
    } else if (isSoundOn && humGain && !isFired) {
        humGain.gain.setTargetAtTime(0.05, audioCtx.currentTime, 0.1);
    }
});

// Resize handler
function resize() {
    let windowRatio = window.innerWidth / window.innerHeight;
    let gameRatio = GAME_WIDTH / GAME_HEIGHT;

    if (windowRatio < gameRatio) {
        canvas.style.width = window.innerWidth + 'px';
        canvas.style.height = (window.innerWidth / gameRatio) + 'px';
        scale = window.innerWidth / GAME_WIDTH;
    } else {
        canvas.style.height = window.innerHeight + 'px';
        canvas.style.width = (window.innerHeight * gameRatio) + 'px';
        scale = window.innerHeight / GAME_HEIGHT;
    }

    canvas.width = GAME_WIDTH;
    canvas.height = GAME_HEIGHT;
}

window.addEventListener('resize', resize);

function initPottery() {
    for (let i = 0; i < SEGMENTS; i++) {
        // Initial blocky cylinder shape with slight tapering at bottom
        let yPosRatio = i / SEGMENTS; // 0 (top) to 1 (bottom)
        let baseR = GAME_WIDTH * 0.25;
        if (yPosRatio > 0.8) {
            baseR = GAME_WIDTH * 0.25 + (yPosRatio - 0.8) * GAME_WIDTH * 0.5;
        }
        clayRadii[i] = baseR;
    }
    saveHistory();
}

function saveHistory() {
    clayHistory.push([...clayRadii]);
    if (clayHistory.length > 10) clayHistory.shift(); // keep last 10
}

btnUndo.addEventListener('click', () => {
    if (isFired || clayHistory.length <= 1) return;
    clayHistory.pop(); // Remove current
    clayRadii = [...clayHistory[clayHistory.length - 1]];
});

// Input Handling
function getGameCoords(e) {
    let rect = canvas.getBoundingClientRect();
    let clientX = e.touches ? e.touches[0].clientX : e.clientX;
    let clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
        x: (clientX - rect.left) / scale,
        y: (clientY - rect.top) / scale
    };
}

function handlePointerDown(e) {
    if (isFired) return;
    isInteracting = true;
    uiTooltip.classList.add('hidden'); // Hide tooltip
    
    initAudio();
    if (isSoundOn && humGain) {
        humGain.gain.setTargetAtTime(0.05, audioCtx.currentTime, 0.1);
    }
    
    sculpt(e);
}

function handlePointerMove(e) {
    if (!isInteracting || isFired) return;
    sculpt(e);
}

function handlePointerUp() {
    if (isInteracting && !isFired) {
        isInteracting = false;
        saveHistory();
        
        // Stop squish sound
        if (clayGain) clayGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.1);
    }
}

function sculpt(e) {
    let { x, y } = getGameCoords(e);
    
    // Convert Y to segment index
    if (y < POT_TOP_Y || y > POT_BASE_Y) return;
    
    let center_x = GAME_WIDTH / 2;
    // Distance from center determines radius target
    let targetRadius = Math.abs(x - center_x);
    // Clamp to min/max
    targetRadius = Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, targetRadius));
    
    // Determine which segment we touched
    let centerIndex = Math.floor((y - POT_TOP_Y) / SEGMENT_HEIGHT);
    
    // Apply Gaussian brush to soften the indent
    const brushSize = 8; // Number of segments affected up/down
    let sculptedAmount = 0;
    
    for (let i = -brushSize; i <= brushSize; i++) {
        let idx = centerIndex + i;
        if (idx >= 0 && idx < SEGMENTS) {
            let distance = Math.abs(i);
            let weight = Math.exp(-(distance * distance) / (brushSize * brushSize * 0.3)); // Gaussian curve
            
            // Move current radius towards target radius smoothly
            let diff = targetRadius - clayRadii[idx];
            clayRadii[idx] += diff * weight * 0.15; // 0.15 sculpt strength
            
            sculptedAmount += Math.abs(diff * weight);
        }
    }
    
    // Audio feedback based on sculpting intensity
    if (isSoundOn && clayGain && audioCtx) {
        if (sculptedAmount > 0.5) {
            // Modulate the ASMR filter frequency for a satisfying "shhhh" wet scrape
            let targetFreq = 400 + Math.min(sculptedAmount * 80, 800);
            clayFilter.frequency.setTargetAtTime(targetFreq, audioCtx.currentTime, 0.1);
            clayGain.gain.setTargetAtTime(0.3, audioCtx.currentTime, 0.05); // pleasant volume
        } else {
            clayGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.1);
        }
    }
}

// Attach listeners
canvas.addEventListener('mousedown', handlePointerDown);
window.addEventListener('mousemove', handlePointerMove);
window.addEventListener('mouseup', handlePointerUp);

canvas.addEventListener('touchstart', (e) => { e.preventDefault(); handlePointerDown(e); }, { passive: false });
window.addEventListener('touchmove', handlePointerMove, { passive: false });
window.addEventListener('touchend', handlePointerUp);

// Fire Pot Button
btnFire.addEventListener('click', () => {
    if (isFired) return;
    isFired = true;
    btnFire.classList.add('disabled');
    btnFire.innerText = "FIRED! ✨";
    phaseTitle.innerText = "PHASE: FINISHED";
    btnUndo.style.opacity = 0.5;
    
    if (humGain && audioCtx) {
        humGain.gain.setTargetAtTime(0, audioCtx.currentTime, 1.0); // Spin down slowly
    }
    
    // "Ding" sound
    if (isSoundOn && audioCtx) {
        let dingOsc = audioCtx.createOscillator();
        let dingGain = audioCtx.createGain();
        dingOsc.type = 'sine';
        dingOsc.frequency.setValueAtTime(800, audioCtx.currentTime);
        dingGain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        dingGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.5);
        dingOsc.connect(dingGain);
        dingGain.connect(audioCtx.destination);
        dingOsc.start();
        dingOsc.stop(audioCtx.currentTime + 1.5);
    }
});

// Render logic
function drawPottery() {
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    let center_x = GAME_WIDTH / 2;

    // Draw Potter's Wheel Base
    ctx.fillStyle = '#9e9287';
    ctx.beginPath();
    ctx.ellipse(center_x, POT_BASE_Y, GAME_WIDTH * 0.45, 40, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2.5D Illusion Settings
    let baseColorR = isFired ? 210 : 204;
    let baseColorG = isFired ? 140 : 166;
    let baseColorB = isFired ? 90 : 130;
    
    // Draw the segments
    for (let i = 0; i < SEGMENTS; i++) {
        let yTop = POT_TOP_Y + (i * SEGMENT_HEIGHT);
        let yBot = yTop + SEGMENT_HEIGHT;
        
        let rTop = clayRadii[i];
        let rBot = (i < SEGMENTS - 1) ? clayRadii[i + 1] : rTop;
        
        // To give it a 3D cylindrical look, we use a linear gradient horizontally
        let widthTop = rTop * 2;
        let widthBot = rBot * 2;
        
        // Find left edges
        let xTL = center_x - rTop;
        let xTR = center_x + rTop;
        let xBL = center_x - rBot;
        let xBR = center_x + rBot;
        
        // Create Gradient for lighting
        // Darker on left, bright in left-middle, base on right
        let gradient = ctx.createLinearGradient(center_x - MAX_RADIUS, 0, center_x + MAX_RADIUS, 0);
        gradient.addColorStop(0, `rgb(${baseColorR - 60}, ${baseColorG - 50}, ${baseColorB - 40})`); // Left shadow
        gradient.addColorStop(0.3, `rgb(${baseColorR + 40}, ${baseColorG + 30}, ${baseColorB + 20})`); // Highlight
        gradient.addColorStop(0.7, `rgb(${baseColorR}, ${baseColorG}, ${baseColorB})`); // Mid
        gradient.addColorStop(1, `rgb(${baseColorR - 30}, ${baseColorG - 20}, ${baseColorB - 20})`); // Right shadow
        
        ctx.fillStyle = gradient;
        
        // Draw trapezoid for this segment
        ctx.beginPath();
        ctx.moveTo(xTL, yTop);
        ctx.lineTo(xTR, yTop);
        ctx.lineTo(xBR, yBot);
        ctx.lineTo(xBL, yBot);
        ctx.closePath();
        ctx.fill();
        
        // Draw the spinning texture lines (horizontal thin lines)
        // If not fired and actively touching, lines jitter a bit to simulate wet clay
        let jitter = (!isFired && isInteracting) ? (Math.random() * 0.5 - 0.25) : 0;
        
        // Fake rotation offset shifting
        if ((i + Math.floor(rotationOffset)) % 4 === 0) {
            ctx.fillStyle = 'rgba(0,0,0,0.03)'; // Subtle dark line
            ctx.fillRect(xTL + 2, yTop + jitter, widthTop - 4, SEGMENT_HEIGHT * 0.5);
        } else if ((i + Math.floor(rotationOffset)) % 5 === 0) {
            ctx.fillStyle = 'rgba(255,255,255,0.03)'; // Subtle light line
            ctx.fillRect(xTL + 2, yTop + jitter, widthTop - 4, SEGMENT_HEIGHT * 0.5);
        }
    }
    
    // Draw the hole/lip at the very top
    ctx.fillStyle = '#3a332d'; // Dark inside
    ctx.beginPath();
    ctx.ellipse(center_x, POT_TOP_Y, clayRadii[0], clayRadii[0] * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw a thin rim highlight
    ctx.strokeStyle = `rgb(${baseColorR}, ${baseColorG}, ${baseColorB})`;
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Draw a curved bottom to match the wheel
    ctx.fillStyle = `rgb(${baseColorR - 60}, ${baseColorG - 50}, ${baseColorB - 40})`;
    ctx.beginPath();
    ctx.ellipse(center_x, POT_BASE_Y, clayRadii[SEGMENTS - 1], clayRadii[SEGMENTS - 1] * 0.15, 0, 0, Math.PI, false);
    ctx.fill();
}

function update() {
    if (!isFired) {
        // Spin logic
        rotationOffset += 0.5;
        if (rotationOffset > 100) rotationOffset = 0;
    }
}

function gameLoop() {
    update();
    drawPottery();
    requestAnimationFrame(gameLoop);
}

// Initial Setup
resize();
initPottery();
gameLoop();
