const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const finalScoreVal = document.getElementById('final-score-val');
const startOverlay = document.getElementById('start-overlay');
const gameOverOverlay = document.getElementById('game-over-overlay');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');

// Game State
let gameState = 'START';
let score = 0;
let lives = 3;
let fruits = [];
let fruitHalves = [];
let juiceStains = [];
let particles = [];
let trail = [];
let lastSpawnTime = 0;
let spawnInterval = 1600;
let gravity = 0.18;

const FRUIT_TYPES = {
    WATERMELON: { name: 'watermelon', color: '#1b4a0c', stripes: '#2d6a1b', inside: '#ff3030', raidus: 42, points: 10 },
    APPLE: { name: 'apple', color: '#8b0000', gloss: '#ff4d4d', inside: '#fff1e1', radius: 32, points: 10 },
    ORANGE: { name: 'orange', color: '#ff8c00', texture: '#ffae42', inside: '#ffd700', radius: 36, points: 10 },
    BOMB: { name: 'bomb', color: '#1a1a1a', radius: 38, isBomb: true }
};

// Audio Engine Configuration
let audioCtx;
let musicGain;
let masterGain;

class JuiceStain {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = Math.random() * 40 + 60;
        this.alpha = 0.5;
        this.points = [];
        for(let i=0; i<12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const dist = this.size * (0.6 + Math.random() * 0.4);
            this.points.push({ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist });
        }
    }

    update() {
        this.alpha -= 0.0005; // Fade out very slowly
        return this.alpha <= 0;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);
        for(let i=1; i<this.points.length; i++) ctx.lineTo(this.points[i].x, this.points[i].y);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
}

class FruitHalf {
    constructor(x, y, vx, vy, angle, type, side) {
        this.x = x;
        this.y = y;
        this.vx = vx + (side === 'left' ? -2 : 2);
        this.vy = vy - 2;
        this.angle = angle;
        this.rotationSpeed = (side === 'left' ? -0.1 : 0.1);
        this.type = type;
        this.side = side;
        this.radius = type.radius || 35;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += gravity;
        this.angle += this.rotationSpeed;
        return this.y > canvas.height + 100;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        
        ctx.fillStyle = this.type.inside || this.type.color;
        ctx.beginPath();
        if (this.side === 'left') {
            ctx.arc(0, 0, this.radius, Math.PI * 0.5, Math.PI * 1.5);
        } else {
            ctx.arc(0, 0, this.radius, Math.PI * 1.5, Math.PI * 0.5);
        }
        ctx.fill();
        
        ctx.strokeStyle = this.type.color;
        ctx.lineWidth = 4;
        ctx.stroke();
        
        ctx.restore();
    }
}

class Fruit {
    constructor(type) {
        this.type = type;
        this.radius = type.radius || 35;
        this.x = Math.random() * (canvas.width - 100) + 50;
        this.y = canvas.height + this.radius;
        const centerX = canvas.width / 2;
        this.vx = (centerX - this.x) * 0.015 + (Math.random() - 0.5) * 3;
        this.vy = -(Math.random() * 6 + 11);
        this.isSliced = false;
        this.angle = 0;
        this.rotationSpeed = (Math.random() - 0.5) * 0.12;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += gravity;
        this.angle += this.rotationSpeed;
        
        if (this.y > canvas.height + this.radius * 2 && this.vy > 0) {
            if (!this.type.isBomb && !this.isSliced) loseLife();
            return true;
        }
        return this.isSliced;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        
        if (this.type.name === 'watermelon') {
            // Skin
            ctx.fillStyle = this.type.color;
            ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, Math.PI * 2); ctx.fill();
            // Stripes
            ctx.strokeStyle = this.type.stripes;
            ctx.lineWidth = 6;
            for(let i=0; i<3; i++) {
                ctx.beginPath();
                ctx.arc(0, 0, this.radius * 0.8, (i*0.6), (i*0.6)+0.4);
                ctx.stroke();
            }
        } else if (this.type.isBomb) {
            ctx.fillStyle = '#111';
            ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, Math.PI * 2); ctx.fill();
            // Red Logo
            ctx.fillStyle = '#f00';
            ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
            // Fuse
            ctx.strokeStyle = '#666'; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.moveTo(0, -this.radius); ctx.lineTo(0, -this.radius - 12); ctx.stroke();
            // Spark
            if (Math.random() > 0.5) {
                ctx.fillStyle = '#ff0';
                ctx.beginPath(); ctx.arc(0, -this.radius - 12, 5, 0, Math.PI * 2); ctx.fill();
            }
        } else {
            ctx.fillStyle = this.type.color;
            ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, Math.PI * 2); ctx.fill();
            // Gloss
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.beginPath(); ctx.ellipse(-this.radius*0.3, -this.radius*0.3, this.radius*0.4, this.radius*0.2, Math.PI*0.25, 0, Math.PI*2); ctx.fill();
        }
        
        ctx.restore();
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y; this.color = color;
        this.vx = (Math.random() - 0.5) * 12;
        this.vy = (Math.random() - 0.5) * 12;
        this.alpha = 1;
        this.radius = Math.random() * 5 + 2;
    }
    update() {
        this.x += this.vx; this.y += this.vy;
        this.vy += gravity * 0.4;
        this.alpha -= 0.03;
        return this.alpha <= 0;
    }
    draw() {
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
    }
}

// Logic Initialization
function init() {
    resize();
    window.addEventListener('resize', resize);
    
    canvas.addEventListener('mousedown', startSlice);
    canvas.addEventListener('mousemove', moveSlice);
    canvas.addEventListener('mouseup', endSlice);
    canvas.addEventListener('touchstart', (e) => startSlice(e.touches[0]));
    canvas.addEventListener('touchmove', (e) => { e.preventDefault(); moveSlice(e.touches[0]); }, { passive: false });
    canvas.addEventListener('touchend', endSlice);

    startBtn.onclick = startGame;
    restartBtn.onclick = startGame;

    requestAnimationFrame(gameLoop);
}

function resize() {
    const parent = canvas.parentElement;
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;
}

function startGame() {
    score = 0; lives = 3;
    fruits = []; fruitHalves = []; juiceStains = []; particles = []; trail = [];
    gameState = 'PLAYING';
    scoreEl.innerText = '0';
    startOverlay.classList.add('hidden');
    gameOverOverlay.classList.add('hidden');
    for(let i=1; i<=3; i++) document.getElementById(`life-${i}`).classList.remove('lost');
    setupAudio();
}

function loseLife() {
    lives--;
    const lifeIcon = document.getElementById(`life-${3 - lives}`);
    if (lifeIcon) lifeIcon.classList.add('lost');
    if (lives <= 0) endGame();
}

function endGame() {
    gameState = 'GAMEOVER';
    finalScoreVal.innerText = score;
    gameOverOverlay.classList.remove('hidden');
    if (musicGain) musicGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1);
}

// Interaction
let isSlicing = false;
function startSlice(e) { if (gameState !== 'PLAYING') return; isSlicing = true; trail = []; addTrailPoint(e); }
function moveSlice(e) { if (!isSlicing) return; addTrailPoint(e); checkCollisions(e); }
function endSlice() { isSlicing = false; trail = []; }

function addTrailPoint(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    trail.push({ x, y, time: Date.now() });
    if (trail.length > 12) trail.shift();
}

function checkCollisions(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    fruits.forEach(f => {
        if (!f.isSliced) {
            const dx = x - f.x; const dy = y - f.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < f.radius) {
                f.isSliced = true;
                if (f.type.isBomb) { playExplosion(); endGame(); }
                else {
                    score += f.type.points; scoreEl.innerText = score;
                    playSwish(); playSplat();
                    juiceStains.push(new JuiceStain(f.x, f.y, f.type.inside + '44'));
                    for(let i=0; i<15; i++) particles.push(new Particle(f.x, f.y, f.type.inside));
                    fruitHalves.push(new FruitHalf(f.x, f.y, f.vx, f.vy, f.angle, f.type, 'left'));
                    fruitHalves.push(new FruitHalf(f.x, f.y, f.vx, f.vy, f.angle, f.type, 'right'));
                }
            }
        }
    });
}

// Audio Engine - Ninja Style
function setupAudio() {
    if (audioCtx) {
        if (musicGain) musicGain.gain.setTargetAtTime(0.15, audioCtx.currentTime, 0.5);
        return;
    }
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.connect(audioCtx.destination);
    
    musicGain = audioCtx.createGain();
    musicGain.connect(masterGain);
    musicGain.gain.setValueAtTime(0, audioCtx.currentTime);
    musicGain.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + 2);
    
    startMusic();
}

function startMusic() {
    const tempo = 120;
    const step = 60 / tempo / 4;
    const scale = [196, 220, 261, 293, 329, 392]; // G, A, C, D, E, G (Pentatonic)
    
    function loop() {
        if (gameState !== 'PLAYING') { setTimeout(loop, 1000); return; }
        const now = audioCtx.currentTime;
        for(let i=0; i<16; i++) {
            const time = now + i * step;
            // Taiko Beat
            if (i % 4 === 0) playTaiko(55, time);
            // Koto Melody
            if (i % 4 === 0 || (i % 4 === 2 && Math.random() > 0.5)) {
                const freq = scale[Math.floor(Math.random() * scale.length)];
                playKoto(freq, time);
            }
        }
        setTimeout(loop, 16 * step * 1000);
    }
    loop();
}

function playTaiko(freq, time) {
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.exponentialRampToValueAtTime(1, time + 0.3);
    g.gain.setValueAtTime(0.2, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
    osc.connect(g); g.connect(musicGain);
    osc.start(time); osc.stop(time + 0.3);
}

function playKoto(freq, time) {
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(0.1, time + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.4);
    osc.connect(g); g.connect(musicGain);
    osc.start(time); osc.stop(time + 0.4);
}

function playSwish() {
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.frequency.setValueAtTime(1500, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.15);
    g.gain.setValueAtTime(0.1, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
    osc.connect(g); g.connect(masterGain);
    osc.start(); osc.stop(audioCtx.currentTime + 0.15);
}

function playSplat() {
    const noise = audioCtx.createBufferSource();
    const buffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.1, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for(let i=0; i<buffer.length; i++) data[i] = (Math.random()*2-1) * Math.exp(-i/500);
    noise.buffer = buffer;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.1, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
    noise.connect(g); g.connect(masterGain);
    noise.start();
}

function playExplosion() {
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.frequency.setValueAtTime(100, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1, audioCtx.currentTime + 0.8);
    g.gain.setValueAtTime(0.5, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.8);
    osc.connect(g); g.connect(masterGain);
    osc.start(); osc.stop(audioCtx.currentTime + 0.8);
}

// Loops
function gameLoop() {
    update();
    render();
    requestAnimationFrame(gameLoop);
}

function update() {
    if (gameState !== 'PLAYING') return;
    const now = Date.now();
    if (now - lastSpawnTime > spawnInterval) {
        const count = Math.floor(Math.random() * 2) + (score > 200 ? 2 : 1);
        for(let i=0; i<count; i++) {
            const keys = Object.keys(FRUIT_TYPES);
            const type = FRUIT_TYPES[keys[Math.floor(Math.random() * keys.length)]];
            fruits.push(new Fruit(type));
        }
        lastSpawnTime = now;
        spawnInterval = Math.max(700, spawnInterval * 0.998);
    }
    fruits = fruits.filter(f => !f.update());
    fruitHalves = fruitHalves.filter(h => !h.update());
    juiceStains = juiceStains.filter(s => !s.update());
    particles = particles.filter(p => !p.update());
}

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    juiceStains.forEach(s => s.draw());
    particles.forEach(p => p.draw());
    fruitHalves.forEach(h => h.draw());
    fruits.forEach(f => f.draw());

    if (trail.length > 2) {
        ctx.save();
        ctx.shadowBlur = 15; ctx.shadowColor = '#fff';
        ctx.strokeStyle = '#fff';
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        for(let i=1; i<trail.length; i++) {
            ctx.lineWidth = (i / trail.length) * 8;
            ctx.beginPath();
            ctx.moveTo(trail[i-1].x, trail[i-1].y);
            ctx.lineTo(trail[i].x, trail[i].y);
            ctx.stroke();
        }
        ctx.restore();
    }
}

init();
