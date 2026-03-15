// game.js
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreText = document.getElementById('score-text');

// 9:16 layout resolution
const GAME_WIDTH = 450;
const GAME_HEIGHT = 800;
canvas.width = GAME_WIDTH;
canvas.height = GAME_HEIGHT;

let score = 0;
const MAX_SCORE = 20;
let isGameOver = false;

// Audio context
let audioCtx = null;
let isSoundEnabled = true;
let talkingOsc = null;
let talkingInterval = null;
let lastZipProgress = 0; // For sound triggering
let zipAudioNode = null;

// Character State
let charParams = {};
let mouthOpenness = 0; // 0 to 1
let isTalking = true;
let isDraggingZipper = false;
let zipperProgress = 0; // 0 (left) to 1 (full right)
let currentPhrase = "";
let transitionOffsetX = 0; // For slide animation
let isExiting = false;

const PHRASES = [
    "You're doing it wrong.",
    "Actually, it's pronounced...",
    "I'm so important.",
    "Boring!",
    "Listen to me!",
    "My opinion matters.",
    "Blah blah blah...",
    "Did you know that...",
    "Let me tell you...",
    "In my humble opinion,"
];

const COLORS = {
    skin: ['#e4b596', '#875b33', '#fcd2b8', '#5c3818', '#c98a6a'],
    hat: ['#8c2d2d', '#2d4756', '#ff66c4', '#f1c40f', '#2ecc71'],
    glasses: ['#333', '#e74c3c', '#9b59b6', null] // null means no glasses
};

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

// Generate random character properties
function generateCharacter() {
    charParams = {
        skinColor: COLORS.skin[Math.floor(Math.random() * COLORS.skin.length)],
        hatColor: COLORS.hat[Math.floor(Math.random() * COLORS.hat.length)],
        hasGlasses: Math.random() > 0.5,
        glassesColor: COLORS.glasses[Math.floor(Math.random() * (COLORS.glasses.length - 1))], // Ensure valid color if true
        hatType: Math.floor(Math.random() * 3), // 0: Fez/Bucket, 1: Hair/Beanie, 2: Wide brim
        eyeWidth: 20 + Math.random() * 10,
        eyeHeight: 20 + Math.random() * 10,
        mouthWidth: 120 + Math.random() * 40,
        mouthHeight: 70 + Math.random() * 30
    };
    currentPhrase = PHRASES[Math.floor(Math.random() * PHRASES.length)];
    zipperProgress = 0;
    isTalking = true;
    startTalkingAudio();
}

function startTalkingAudio() {
    if (!isSoundEnabled) return;
    initAudio();
    
    clearInterval(talkingInterval);
    talkingInterval = setInterval(() => {
        if (!isTalking) {
            clearInterval(talkingInterval);
            return;
        }
        
        // Target mouth openness
        let targetOpenness = Math.random();
        
        // Simple synthetic voice pop (Pitch based on generated face characteristics!)
        if (targetOpenness > 0.5 && audioCtx) {
            let osc = audioCtx.createOscillator();
            let gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            
            osc.type = 'triangle';
            let baseFreq = 150 + (charParams.mouthWidth - 120) * 2;
            osc.frequency.setValueAtTime(baseFreq + Math.random() * 50, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
            
            osc.start();
            osc.stop(audioCtx.currentTime + 0.1);
        }
        
        mouthOpenness = targetOpenness;
    }, 120);
}

function playZipSound(speed) {
    if (!isSoundEnabled || !audioCtx) return;
    
    let osc = audioCtx.createOscillator();
    let bp = audioCtx.createBiquadFilter();
    let gain = audioCtx.createGain();
    
    osc.type = 'sawtooth';
    let freq = 400 + speed * 5000; // Zip gets higher if faster
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.05);
    
    bp.type = 'bandpass';
    bp.frequency.value = 1000;
    
    gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
    
    osc.connect(bp);
    bp.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.05);
}

// Draw Utils

function drawRoundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.fill();
    ctx.stroke();
}

function renderCharacter() {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2 + 50;
    
    // Head Base (Rounded square/oval)
    ctx.fillStyle = charParams.skinColor;
    ctx.strokeStyle = charParams.skinColor;
    ctx.lineWidth = 1;
    drawRoundRect(ctx, cx - 150, cy - 150, 300, 300, 100);
    
    // Ears
    ctx.beginPath();
    ctx.arc(cx - 150, cy, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 150, cy, 30, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    drawEyes(cx, cy - 50);

    // Nose
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    drawRoundRect(ctx, cx - 15, cy, 30, 50, 15);

    // Mouth Background (Inside)
    const mx = cx;
    const my = cy + 100;
    const mw = charParams.mouthWidth;
    const mh = charParams.mouthHeight * (isTalking ? mouthOpenness : 0.1); // Flatten if zipped
    
    // Inside of mouth (Teeth and dark space)
    ctx.fillStyle = '#400000'; // Dark red
    ctx.beginPath();
    drawRoundRect(ctx, mx - mw/2, my - 20, mw, Math.max(mh, 10), 20);
    
    // Tooth
    ctx.fillStyle = '#fff';
    drawRoundRect(ctx, mx - mw/4, my - 20, Math.min(mw/2, 40), Math.min(mh/3, 15), 5);
    
    // Tongue
    if (mh > 20) {
        ctx.fillStyle = '#ff6b6b';
        ctx.beginPath();
        drawRoundRect(ctx, mx - mw/4, my + mh/2 - 20, mw/2, 30, 15);
    }
    
    // Zipper Track (Draws ON TOP of the mouth)
    drawZipper(mx, my - 20, mw);

    // Hat/Hair
    drawHat(cx, cy - 150);
}

function drawEyes(cx, cy) {
    ctx.fillStyle = '#f0f0f0';
    drawRoundRect(ctx, cx - 80, cy - 30, 60, 60, 15);
    drawRoundRect(ctx, cx + 20, cy - 30, 60, 60, 15);
    
    ctx.fillStyle = '#222';
    // Look direction slightly random or center
    let lookOffset = isTalking ? (Math.random() - 0.5) * 10 : 0;
    ctx.beginPath();
    ctx.arc(cx - 50 + lookOffset, cy, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 50 + lookOffset, cy, 10, 0, Math.PI * 2);
    ctx.fill();

    if (charParams.hasGlasses) {
        ctx.strokeStyle = charParams.glassesColor || '#333';
        ctx.lineWidth = 6;
        ctx.fillStyle = 'rgba(0,0,0,0)';
        drawRoundRect(ctx, cx - 90, cy - 40, 80, 80, 10);
        drawRoundRect(ctx, cx + 10, cy - 40, 80, 80, 10);
        // Bridge
        ctx.beginPath();
        ctx.moveTo(cx - 10, cy);
        ctx.lineTo(cx + 10, cy);
        ctx.stroke();
    }
}

function drawHat(cx, cy) {
    ctx.fillStyle = charParams.hatColor;
    ctx.strokeStyle = 'transparent';
    
    if (charParams.hatType === 0) {
        // Fez / Bucket block
        drawRoundRect(ctx, cx - 120, cy - 80, 240, 130, 20);
    } else if (charParams.hatType === 1) {
        // Skull cap / Hair arc
        ctx.beginPath();
        ctx.arc(cx, cy + 30, 150, Math.PI, Math.PI * 2);
        ctx.fill();
    } else {
        // Brim hat
        drawRoundRect(ctx, cx - 80, cy - 100, 160, 120, 20);
        drawRoundRect(ctx, cx - 180, cy, 360, 30, 15);
    }
}

function drawZipper(mx, my, mw) {
    // Track
    const trackStartX = mx - mw/2 - 10;
    const trackEndX = mx + mw/2 + 10;
    const trackWidth = trackEndX - trackStartX;
    const yCenter = my + 5;
    
    // Draw teeth (Simple dashed line)
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 8;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(trackStartX, yCenter);
    ctx.lineTo(trackEndX, yCenter);
    ctx.stroke();
    ctx.setLineDash([]); // Reset
    
    // Zipper progress covers the track with skin color to simulate 'closing'
    if (zipperProgress > 0) {
        let zipCoverWidth = trackWidth * zipperProgress;
        // Koyu renk fermuar şeridi (Closed section)
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(trackStartX, yCenter);
        ctx.lineTo(trackStartX + zipCoverWidth, yCenter);
        ctx.stroke();
    }
    
    // Zipper Handle (The pull tab)
    const handleX = trackStartX + (trackWidth * zipperProgress);
    
    // Metal Body
    ctx.fillStyle = '#f1c40f'; // Gold/Yellow like reference
    ctx.strokeStyle = '#d4ac0d';
    ctx.lineWidth = 2;
    drawRoundRect(ctx, handleX - 15, yCenter - 25, 30, 50, 5);
    
    // Hole in handle
    ctx.fillStyle = '#47a599'; // Background color (cheat to make hole)
    ctx.beginPath();
    ctx.arc(handleX, yCenter + 15, 6, 0, Math.PI*2);
    ctx.fill();
    
    charParams.zipperLine = {
        startX: trackStartX,
        endX: trackEndX,
        y: yCenter,
        width: trackWidth
    };
    
    charParams.zipperRect = {
        x: handleX - 25, // wider hit area
        y: yCenter - 35,
        w: 50,
        h: 70
    };
}

function renderSpeechBubble() {
    if (!isTalking) return;
    
    const bx = GAME_WIDTH - 200;
    const by = 200;
    const bw = 180;
    const bh = 80;
    
    ctx.fillStyle = '#eee';
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 2;
    drawRoundRect(ctx, bx, by, bw, bh, 15);
    
    // Callout triangle
    ctx.beginPath();
    ctx.moveTo(bx + 20, by + bh);
    ctx.lineTo(bx + 40, by + bh + 30);
    ctx.lineTo(bx + 60, by + bh);
    ctx.fill();
    ctx.stroke();
    
    // Text
    ctx.fillStyle = '#333';
    ctx.font = '16px Roboto';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Simple wrap text mechanism (crude)
    let words = currentPhrase.split(' ');
    let lines = [];
    let currentLine = "";
    for(let w of words) {
        if (ctx.measureText(currentLine + w + " ").width > bw - 20) {
            lines.push(currentLine);
            currentLine = w + " ";
        } else {
            currentLine += w + " ";
        }
    }
    lines.push(currentLine);
    
    let lineY = by + bh/2 - ((lines.length - 1) * 10);
    for(let line of lines) {
        ctx.fillText(line.trim(), bx + bw/2, lineY);
        lineY += 20;
    }
}

// --- INPUT HANDLING ---
function getPointer(e) {
    if (e.touches && e.touches.length > 0) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        let x = (e.touches[0].clientX - rect.left) * scaleX;
        let y = (e.touches[0].clientY - rect.top) * scaleY;
        return {x, y};
    }
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    let x = (e.clientX - rect.left) * scaleX;
    let y = (e.clientY - rect.top) * scaleY;
    return {x, y};
}

function pointerDown(e) {
    if (isGameOver) return;
    initAudio();
    isSoundEnabled = true;
    
    const pos = getPointer(e);
    
    // Check if clicked exactly on zipper handle
    if (charParams.zipperRect) {
        let r = charParams.zipperRect;
        if (pos.x >= r.x && pos.x <= r.x + r.w && pos.y >= r.y && pos.y <= r.y + r.h) {
            isDraggingZipper = true;
        }
    }
}

function pointerMove(e) {
    if (!isDraggingZipper || isGameOver) return;
    
    const pos = getPointer(e);
    
    if (charParams.zipperLine) {
        // Calculate progress based on X
        let px = pos.x - charParams.zipperLine.startX;
        let progress = px / charParams.zipperLine.width;
        
        if (progress < 0) progress = 0;
        if (progress > 1) progress = 1;
        
        // Only allow zipper to go forward (no unzipping)
        if (progress > zipperProgress) {
            let diff = progress - zipperProgress;
            zipperProgress = progress;
            
            // Faint zip sound based on speed
            if (diff > 0.01) {
                playZipSound(diff);
            }
        }
    }
}

function pointerUp(e) {
    isDraggingZipper = false;
    
    // If zipper is completely pulled
    if (zipperProgress >= 0.95 && isTalking) {
        zipperProgress = 1.0;
        isTalking = false; // Stops mouth and speech bubble
        
        score++;
        scoreText.innerText = `${score} / ${MAX_SCORE}`;
        
        if (score >= MAX_SCORE) {
            isGameOver = true;
            setTimeout(() => {
                scoreText.innerText = "You Win 😊";
                // Transition off screen
                isTalking = false; // dummy
            }, 500);
        } else {
            // 1. Zipli karakteri 0.6s ekranda tut (susturmayı anlasın)
            setTimeout(() => {
                isExiting = true;
            }, 600);
            
            // 2. Toplam 1000ms (1 saniye) boşluk sonrası yeni karakter sağdan gelsin
            setTimeout(() => {
                isExiting = false;
                transitionOffsetX = GAME_WIDTH; // start new char from right
                generateCharacter();
            }, 1900); // 600ms bekle + ~300ms çıkış + 1000ms (1 saniye boşluk) = 1900ms
        }
    }
}

// Listeners
canvas.addEventListener('mousedown', pointerDown);
window.addEventListener('mousemove', pointerMove);
window.addEventListener('mouseup', pointerUp);
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); pointerDown(e); }, {passive: false});
window.addEventListener('touchmove', (e) => { e.preventDefault(); pointerMove(e); }, {passive: false});
window.addEventListener('touchend', pointerUp);


function draw() {
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    
    // Transition slide effect
    ctx.save();
    ctx.translate(transitionOffsetX, 0);
    
    renderCharacter();
    renderSpeechBubble();
    
    ctx.restore();
}

function update() {
    if (isExiting) {
        // Hızlıca sola kayarak ekrandan çıkar
        transitionOffsetX -= 40; 
    }
    // Transition Animation (Slide into view)
    else if (!isGameOver && Math.abs(transitionOffsetX) > 0.5) {
        transitionOffsetX += (0 - transitionOffsetX) * 0.15; // Ease in
        if (Math.abs(transitionOffsetX) < 0.5) {
            transitionOffsetX = 0;
        }
    } else if (isGameOver && transitionOffsetX > -GAME_HEIGHT) {
        // Fall down on win
        transitionOffsetX -= 10;
    }
}

// UI Buttons
document.getElementById('btn-sound').addEventListener('click', (e) => {
    isSoundEnabled = !isSoundEnabled;
    e.target.innerText = isSoundEnabled ? "🔊" : "🔇";
    if (!isSoundEnabled) {
        clearInterval(talkingInterval);
    } else if (isTalking) {
        startTalkingAudio();
    }
});

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Init
generateCharacter();
gameLoop();
