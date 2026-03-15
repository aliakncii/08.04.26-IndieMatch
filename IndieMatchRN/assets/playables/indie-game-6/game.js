const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreVal = document.getElementById('score-val');
const timeVal = document.getElementById('time-val');
const overlay = document.getElementById('center-overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlaySubtitle = document.getElementById('overlay-subtitle');

const GAME_WIDTH = 500;
const GAME_HEIGHT = 888;
let scale = 1;

// Global State
let isPlaying = false;
let score = 0;
let timeLeft = 30;
let timeInterval = null;
let lastTime = 0;

// Audio
let audioCtx = null;
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playChomp() {
    if (!audioCtx) return;
    let osc = audioCtx.createOscillator();
    let gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
}

function playFinish() {
    if (!audioCtx) return;
    let osc = audioCtx.createOscillator();
    let gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, audioCtx.currentTime);
    osc.frequency.linearRampToValueAtTime(200, audioCtx.currentTime + 0.5);
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.5);
}

// Cat (Player)
const cat = {
    x: GAME_WIDTH / 2,
    y: GAME_HEIGHT / 2,
    targetX: GAME_WIDTH / 2,
    targetY: GAME_HEIGHT / 2,
    angle: 0,
    speed: 0.15, // lerp speed
    radius: 30, // collision radius
    tailAngle: 0
};

// Mice
const mice = [];
const MICE_COUNT = 5;
const MOUSE_SPEED = 2;
const MOUSE_RADIUS = 15;

function spawnMouse() {
    // Spawn away from cat
    let mx, my, dist;
    do {
        mx = Math.random() * (GAME_WIDTH - 60) + 30;
        my = Math.random() * (GAME_HEIGHT - 60) + 30;
        let dx = mx - cat.x;
        let dy = my - cat.y;
        dist = Math.sqrt(dx*dx + dy*dy);
    } while (dist < 150); // don't spawn right on top of cat
    
    let angle = Math.random() * Math.PI * 2;
    mice.push({
        x: mx,
        y: my,
        vx: Math.cos(angle) * MOUSE_SPEED,
        vy: Math.sin(angle) * MOUSE_SPEED,
        angle: angle,
        tailAngle: 0
    });
}

// Input Handling
function updateTarget(e) {
    if (!isPlaying) return;
    let rect = canvas.getBoundingClientRect();
    let clientX = e.touches ? e.touches[0].clientX : e.clientX;
    let clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    cat.targetX = (clientX - rect.left) / scale;
    cat.targetY = (clientY - rect.top) / scale;
}

window.addEventListener('mousedown', (e) => {
    initAudio();
    if (!isPlaying && overlay.classList.contains('hidden')) return; // Ignore if game over and not reset
    if (!isPlaying) {
        startGame();
    }
    updateTarget(e);
});
window.addEventListener('mousemove', updateTarget);
window.addEventListener('touchstart', (e) => {
    e.preventDefault();
    initAudio();
    if (!isPlaying) startGame();
    updateTarget(e);
}, { passive: false });
window.addEventListener('touchmove', (e) => {
    e.preventDefault();
    updateTarget(e);
}, { passive: false });

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

// Game Logic
function startGame() {
    isPlaying = true;
    score = 0;
    timeLeft = 30;
    scoreVal.innerText = score;
    timeVal.innerText = timeLeft;
    timeVal.classList.add('text-red');
    
    overlay.classList.add('hidden');
    
    cat.x = GAME_WIDTH / 2;
    cat.y = GAME_HEIGHT / 2;
    cat.targetX = cat.x;
    cat.targetY = cat.y;
    
    mice.length = 0;
    for (let i = 0; i < MICE_COUNT; i++) spawnMouse();
    
    if (timeInterval) clearInterval(timeInterval);
    timeInterval = setInterval(() => {
        timeLeft--;
        timeVal.innerText = timeLeft;
        if (timeLeft <= 0) {
            endGame();
        }
    }, 1000);
}

function endGame() {
    isPlaying = false;
    clearInterval(timeInterval);
    playFinish();
    
    overlayTitle.innerText = "TIME'S UP!";
    overlaySubtitle.innerHTML = `You ate <b>${score}</b> mice!<br><span style="font-size:16px; opacity:0.7; margin-top:10px; display:block;">Tap to replay</span>`;
    overlay.classList.remove('hidden');
}

function update(dt) {
    if (!isPlaying) return;
    
    // Update Cat
    let dx = cat.targetX - cat.x;
    let dy = cat.targetY - cat.y;
    let dist = Math.sqrt(dx*dx + dy*dy);
    
    if (dist > 5) { // move if not too close
        cat.x += dx * cat.speed;
        cat.y += dy * cat.speed;
        // Smooth rotation towards target
        let targetAngle = Math.atan2(dy, dx);
        
        // Shortest path rotation
        let diff = targetAngle - cat.angle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        cat.angle += diff * 0.2;
        
        // Wag tail based on movement
        cat.tailAngle = Math.sin(Date.now() / 100) * 0.5;
    } else {
        cat.tailAngle = 0; // stop wagging when still
    }
    
    // Clamp Cat
    cat.x = Math.max(cat.radius, Math.min(GAME_WIDTH - cat.radius, cat.x));
    cat.y = Math.max(cat.radius, Math.min(GAME_HEIGHT - cat.radius, cat.y));
    
    // Update Mice
    for (let i = mice.length - 1; i >= 0; i--) {
        let m = mice[i];
        
        // Randomly adjust angle occasionally to make them erratic
        if (Math.random() < 0.02) {
            m.angle += (Math.random() - 0.5) * Math.PI;
            m.vx = Math.cos(m.angle) * MOUSE_SPEED;
            m.vy = Math.sin(m.angle) * MOUSE_SPEED;
        }
        
        m.x += m.vx;
        m.y += m.vy;
        m.tailAngle = Math.sin(Date.now() / 50 + i) * 0.5;
        
        // Bounce off walls
        if (m.x < MOUSE_RADIUS || m.x > GAME_WIDTH - MOUSE_RADIUS) {
            m.vx *= -1;
            m.x = Math.max(MOUSE_RADIUS, Math.min(GAME_WIDTH - MOUSE_RADIUS, m.x));
            m.angle = Math.atan2(m.vy, m.vx);
        }
        if (m.y < MOUSE_RADIUS || m.y > GAME_HEIGHT - MOUSE_RADIUS) {
            m.vy *= -1;
            m.y = Math.max(MOUSE_RADIUS, Math.min(GAME_HEIGHT - MOUSE_RADIUS, m.y));
            m.angle = Math.atan2(m.vy, m.vx);
        }
        
        // Collision with Cat
        let cdx = m.x - cat.x;
        let cdy = m.y - cat.y;
        let cdist = Math.sqrt(cdx*cdx + cdy*cdy);
        
        if (cdist < cat.radius + MOUSE_RADIUS) {
            // Eaten!
            mice.splice(i, 1);
            score++;
            scoreVal.innerText = score;
            playChomp();
            
            // Spawn a new one to keep count steady
            spawnMouse();
        }
    }
}

// Drawing logic
function drawCat(x, y, angle, tailAngle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    
    // Tail
    ctx.save();
    ctx.translate(-25, 0);
    ctx.rotate(tailAngle);
    ctx.fillStyle = '#ff914d'; // Orange
    ctx.beginPath();
    ctx.roundRect(-20, -5, 25, 10, 5);
    ctx.fill();
    ctx.restore();
    
    // Ears
    ctx.fillStyle = '#e67e22';
    ctx.beginPath();
    ctx.moveTo(10, -15);
    ctx.lineTo(-10, -30);
    ctx.lineTo(-5, -15);
    ctx.fill();
    
    ctx.beginPath();
    ctx.moveTo(10, 15);
    ctx.lineTo(-10, 30);
    ctx.lineTo(-5, 15);
    ctx.fill();
    
    // Body (Oval)
    ctx.fillStyle = '#ff914d';
    ctx.beginPath();
    ctx.ellipse(0, 0, 30, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Face details
    ctx.fillStyle = '#333';
    // Eyes
    ctx.beginPath(); ctx.arc(15, -8, 2, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(15, 8, 2, 0, Math.PI*2); ctx.fill();
    // Nose
    ctx.fillStyle = '#ffcccb';
    ctx.beginPath(); ctx.arc(22, 0, 3, 0, Math.PI*2); ctx.fill();
    
    ctx.restore();
}

function drawMouse(x, y, angle, tailAngle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    
    // Tail
    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    // control points for squiggly tail
    let tx = -25;
    let ty = tailAngle * 10;
    ctx.quadraticCurveTo(-18, ty, tx, 0);
    ctx.stroke();
    
    // Body
    ctx.fillStyle = '#9ca3af'; // Grey
    ctx.beginPath();
    ctx.ellipse(0, 0, 15, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Ears
    ctx.fillStyle = '#ffcccb'; // pink inner ear
    ctx.beginPath(); ctx.arc(0, -8, 4, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(0, 8, 4, 0, Math.PI*2); ctx.fill();
    
    // Eyes
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(8, -4, 1.5, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(8, 4, 1.5, 0, Math.PI*2); ctx.fill();
    
    ctx.restore();
}

function draw() {
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    
    // Mice
    for (let m of mice) {
        drawMouse(m.x, m.y, m.angle, m.tailAngle);
    }
    
    // Cat
    drawCat(cat.x, cat.y, cat.angle, cat.tailAngle);
}

function gameLoop(timestamp) {
    let dt = timestamp - lastTime;
    lastTime = timestamp;
    
    update(dt);
    draw();
    
    requestAnimationFrame(gameLoop);
}

// Init
resize();
requestAnimationFrame(gameLoop);
