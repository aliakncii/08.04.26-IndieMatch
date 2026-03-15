const canvas = document.getElementById('drawing-canvas');
const ctx = canvas.getContext('2d');
const targetCanvas = document.getElementById('target-canvas');
const tCtx = targetCanvas.getContext('2d');
const bestPercentEl = document.getElementById('best-percent');
const gradeBtn = document.getElementById('grade-btn');
const eraserBtn = document.getElementById('eraser-btn');
const resultOverlay = document.getElementById('result-overlay');
const resultPercentEl = document.getElementById('result-percent');
const resultCommentEl = document.getElementById('result-comment');
const difficultySelect = document.getElementById('difficulty-select');

let isDrawing = false;
let isEraser = false;
let bestScores = { easy: 0, medium: 0, hard: 0 };
let currentDifficulty = 'medium';
let audioCtx;
let scratchOsc;
let scratchGain;


// --- CONFIG ---
const BRUSH_SIZE = 8;
const ERASER_SIZE = 30;
const SKETCH_COLOR = '#2d3436';

// --- INITIALIZATION ---
function init() {
    setupAudio();
    resizeCanvas();

    window.addEventListener('resize', resizeCanvas);
    setupDrawListeners();
    drawTargetShape();
    
    // UI Events
    gradeBtn.addEventListener('click', calculateGrade);
    eraserBtn.addEventListener('click', toggleEraser);
    difficultySelect.addEventListener('change', (e) => {
        currentDifficulty = e.target.value;
        resetGame();
    });
    
    document.getElementById('retry-btn').addEventListener('click', resetGame);
    document.getElementById('share-btn').addEventListener('click', () => alert("Link copied to clipboard!"));
}

function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    targetCanvas.width = rect.width;
    targetCanvas.height = rect.height;
    
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    drawTargetShape();
}

// --- SHAPE DRAWING ---
function drawTargetShape() {
    tCtx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
    
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const size = Math.min(canvas.width, canvas.height) * 0.35;
    
    // Draw Star
    tCtx.fillStyle = 'black';
    tCtx.beginPath();
    drawStar(tCtx, cx, cy, 5, size, size / 2.2);
    tCtx.fill();
    
    // Also draw a very faint version on main canvas as a guide
    ctx.globalAlpha = 0.05;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    drawStar(ctx, cx, cy, 5, size, size / 2.2);
    ctx.stroke();
    ctx.globalAlpha = 1.0;
}

function drawStar(c, cx, cy, spikes, outerRadius, innerRadius) {
    let rot = Math.PI / 2 * 3;
    let x = cx;
    let y = cy;
    let step = Math.PI / spikes;

    c.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
        x = cx + Math.cos(rot) * outerRadius;
        y = cy + Math.sin(rot) * outerRadius;
        c.lineTo(x, y);
        rot += step;

        x = cx + Math.cos(rot) * innerRadius;
        y = cy + Math.sin(rot) * innerRadius;
        c.lineTo(x, y);
        rot += step;
    }
    c.lineTo(cx, cy - outerRadius);
    c.closePath();
}

// --- DRAWING LOGIC ---
function setupDrawListeners() {
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', stopDrawing);

    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        startDrawing(e.touches[0]);
    }, {passive: false});
    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        draw(e.touches[0]);
    }, {passive: false});
    canvas.addEventListener('touchend', stopDrawing);
}

function startDrawing(e) {
    if (!audioCtx) setupAudio();
    isDrawing = true;
    startScratch();
    const pos = getMousePos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
}

function draw(e) {
    if (!isDrawing) return;
    const pos = getMousePos(e);
    
    ctx.lineWidth = isEraser ? ERASER_SIZE : BRUSH_SIZE;
    ctx.strokeStyle = isEraser ? '#fffdf5' : SKETCH_COLOR;
    ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
    
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
}

function stopDrawing() {
    isDrawing = false;
}

function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
}

function toggleEraser() {
    isEraser = !isEraser;
    eraserBtn.classList.toggle('active', isEraser);
}

// --- GRADING LOGIC ---
function calculateGrade() {
    const drawingData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const targetData = tCtx.getImageData(0, 0, targetCanvas.width, targetCanvas.height).data;
    
    let targetArea = 0;
    let matchedArea = 0;
    let overflowArea = 0;
    
    for (let i = 3; i < targetData.length; i += 4) {
        const isTarget = targetData[i] > 128; // Alpha channel
        const isDrawn = drawingData[i] > 128;
        
        if (isTarget) {
            targetArea++;
            if (isDrawn) matchedArea++;
        } else if (isDrawn) {
            overflowArea++;
        }
    }
    
    let percent = (matchedArea / targetArea) * 100;
    // Penalty for overflow
    const penalty = (overflowArea / targetArea) * 50;
    percent = Math.max(0, Math.round(percent - penalty));
    
    playGradeSound(percent);
    if (percent === 100) spawnConfetti();
    showResult(percent);
}

// --- AUDIO SYSTEM ---
function setupAudio() {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function startScratch() {
    if (!audioCtx || isEraser) return;
    scratchOsc = audioCtx.createOscillator();
    scratchGain = audioCtx.createGain();
    
    scratchOsc.type = 'brown' in AudioContext.prototype ? 'brown' : 'sine'; // Fallback
    if (scratchOsc.type === 'sine') {
        scratchOsc.frequency.setValueAtTime(400, audioCtx.currentTime);
    }
    
    scratchGain.gain.setValueAtTime(0, audioCtx.currentTime);
    scratchGain.gain.linearRampToValueAtTime(0.015, audioCtx.currentTime + 0.1);
    
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    
    scratchOsc.connect(filter);
    filter.connect(scratchGain);
    scratchGain.connect(audioCtx.destination);
    scratchOsc.start();
}

function stopScratch() {
    if (scratchGain) {
        scratchGain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.1);
        setTimeout(() => scratchOsc?.stop(), 100);
    }
}

function playGradeSound(percent) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    if (percent > 85) {
        // Success chord
        osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
        osc.frequency.exponentialRampToValueAtTime(659.25, audioCtx.currentTime + 0.2); // E5
    } else {
        // Failure buzzer
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(100, audioCtx.currentTime + 0.3);
    }
    
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.5);
}

function spawnConfetti() {
    for (let i = 0; i < 50; i++) {
        const c = document.createElement('div');
        c.style.position = 'fixed';
        c.style.width = '10px';
        c.style.height = '10px';
        c.style.background = `hsl(${Math.random() * 360}, 70%, 60%)`;
        c.style.left = Math.random() * 100 + 'vw';
        c.style.top = '-10px';
        c.style.zIndex = '5000';
        c.style.borderRadius = '50%';
        document.body.appendChild(c);
        
        const anim = c.animate([
            { transform: 'translateY(0) rotate(0)', opacity: 1 },
            { transform: `translateY(100vh) translateX(${Math.random() * 200 - 100}px) rotate(720deg)`, opacity: 0 }
        ], {
            duration: 2000 + Math.random() * 2000,
            easing: 'cubic-bezier(0, .5, .5, 1)'
        });
        
        anim.onfinish = () => c.remove();
    }
}


function showResult(percent) {
    resultPercentEl.innerText = percent + '%';
    
    const comments = {
        fail: ["Bro thinks he's aura 💔💔", "Did you even try? 😂", "My cat draws better... 🐱", "Aura points: -999,999"],
        ok: ["Almost got it! ✍️", "Not bad, keep practicing!", "You have potential...", "Getting there!"],
        good: ["Wow, you're an artist! 🎨", "Incredible accuracy!", "Aura: +10,000 ✨", "Perfecto!"]
    };
    
    let category = 'fail';
    if (percent > 40) category = 'ok';
    if (percent > 85) category = 'good';
    
    const randomComment = comments[category][Math.floor(Math.random() * comments[category].length)];
    resultCommentEl.innerText = randomComment;
    
    if (percent > bestScores[currentDifficulty]) {
        bestScores[currentDifficulty] = percent;
        bestPercentEl.innerText = percent + '%';
    }
    
    resultOverlay.classList.remove('hidden');
}

function resetGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    resultOverlay.classList.add('hidden');
    isEraser = false;
    eraserBtn.classList.remove('active');
    drawTargetShape();
}

init();

