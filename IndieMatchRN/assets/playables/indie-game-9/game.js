const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const scoreVal = document.getElementById('score-val');
const missVal = document.getElementById('miss-val');
const timeVal = document.getElementById('time-val');
const levelVal = document.getElementById('level-val');
const hitsVal = document.getElementById('hits-val');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayDesc = document.getElementById('overlay-desc');
const btnStart = document.getElementById('btn-start');

const GAME_WIDTH = 500;
const GAME_HEIGHT = 888;
let scale = 1;

// --- GAME STATE ---
let isPlaying = false;
let level = 1;
let score = 0;
let misses = 0;
let hitsThisLevel = 0;
const HITS_NEEDED = 5;

let timeLeft = 0;
let lastTime = 0;

let pointerX = GAME_WIDTH / 2;
let pointerY = GAME_HEIGHT / 2;

// Entities
let targets = []; // {x, y, vx, vy, radius, lifeTime, maxLife}
let particles = [];

// --- AUDIO SYSTEM ---
let audioCtx;
let bgmOsc = null;
let bgmGain = null;
let bgmInterval = null;
let beatToggle = false;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

// Background tension heartbeat
function startBGM() {
    if (bgmInterval) clearInterval(bgmInterval);
    
    bgmInterval = setInterval(() => {
        if (!isPlaying || !audioCtx) return;
        
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.type = 'sine';
        // Alternate between two low thud frequencies
        osc.frequency.setValueAtTime(beatToggle ? 60 : 50, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 0.3);
        
        gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
        
        beatToggle = !beatToggle;
    }, 1000); // 1 beat per second, speeds up in higher levels maybe
}

function stopBGM() {
    if (bgmInterval) clearInterval(bgmInterval);
}

// Gunshot sound
function playShoot() {
    if (!audioCtx) return;
    
    // Noise burst for crack
    const bufferSize = audioCtx.sampleRate * 0.5;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    
    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 1000;
    
    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(1, audioCtx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
    
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(audioCtx.destination);
    
    // Low punch
    const osc = audioCtx.createOscillator();
    const oscGain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.1);
    
    oscGain.gain.setValueAtTime(1, audioCtx.currentTime);
    oscGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
    
    osc.connect(oscGain);
    oscGain.connect(audioCtx.destination);
    
    noise.start();
    osc.start();
    noise.stop(audioCtx.currentTime + 0.2);
    osc.stop(audioCtx.currentTime + 0.3);
}

// Glass break / ping on hit
function playHit() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(3000, audioCtx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
}

// --- LOGIC ---
function spawnTarget() {
    // Determine target properties based on level (1 to 10)
    let radius = 40 - (level * 2); // gets smaller
    if (radius < 15) radius = 15;
    
    let lifeTime = 3000 - (level * 200); // 3 seconds down to 1 second
    if (lifeTime < 800) lifeTime = 800; // Minimum 0.8s reaction time
    
    let speed = 0;
    let vx = 0;
    let vy = 0;
    
    // Levels 4+ add movement
    if (level >= 4 && level <= 7) {
        speed = 1 + (level * 0.5);
        vx = (Math.random() > 0.5 ? 1 : -1) * speed;
    } else if (level >= 8) {
        // Frantic diagonal/curved movement
        speed = 3 + (level * 0.8);
        vx = (Math.random() - 0.5) * speed * 2;
        vy = (Math.random() - 0.5) * speed * 2;
    }
    
    let x = radius + Math.random() * (GAME_WIDTH - radius * 2);
    let y = 150 + Math.random() * (GAME_HEIGHT - 300); // Keep in middle area
    
    targets.push({
        x: x,
        y: y,
        vx: vx,
        vy: vy,
        radius: radius,
        lifeTime: lifeTime,
        maxLife: lifeTime
    });
}

function createBloodSparks(x, y) {
    for (let i=0; i<15; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8,
            life: 1.0,
            color: '#ff3333'
        });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.05;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

function handleShoot() {
    if (!isPlaying) return;
    
    playShoot();
    
    // Check collision with center of scope
    let hitSomething = false;
    for (let i = targets.length - 1; i >= 0; i--) {
        let t = targets[i];
        let dx = pointerX - t.x;
        let dy = pointerY - t.y;
        let dist = Math.sqrt(dx*dx + dy*dy);
        
        // Scope crosshair is exactly in the center, so if dist < radius, we hit it
        if (dist <= t.radius) {
            // HIT!
            targets.splice(i, 1);
            hitSomething = true;
            score += 10 * level;
            hitsThisLevel++;
            
            playHit();
            createBloodSparks(t.x, t.y);
            
            scoreVal.innerText = score;
            hitsVal.innerText = hitsThisLevel;
            
            if (hitsThisLevel >= HITS_NEEDED) {
                levelUp();
            } else {
                // Spawn next immediate target
                setTimeout(spawnTarget, 200 + Math.random() * 500); 
            }
            break; // only hit one per shot
        }
    }
    
    if (!hitSomething) {
        // Missed completely -> Penality? Or just lose a target if it despawns.
        // Let's rely on despawn timer for misses, clicking empty space is just a wasted shot.
    }
}

function levelUp() {
    targets = [];
    level++;
    if (level > 10) {
        // Win Game
        endGame(true);
        return;
    }
    hitsThisLevel = 0;
    levelVal.innerText = level;
    hitsVal.innerText = hitsThisLevel;
    
    // Level up visual indication
    setTimeout(spawnTarget, 1000);
}

function endGame(won = false) {
    isPlaying = false;
    stopBGM();
    overlay.classList.remove('hidden');
    if (won) {
        overlayTitle.innerText = "MISSION ACCOMPLISHED";
        overlayTitle.style.color = "#32cd32";
        overlayDesc.innerText = `You cleared all 10 levels!\nFinal Score: ${score}`;
    } else {
        overlayTitle.innerText = "MISSION FAILED";
        overlayTitle.style.color = "#ff3333";
        overlayDesc.innerText = `You missed too many targets.\nLevel Reached: ${level}\nFinal Score: ${score}`;
    }
    btnStart.innerText = "RESTART";
}

function resetGame() {
    level = 1;
    score = 0;
    misses = 0;
    hitsThisLevel = 0;
    targets = [];
    particles = [];
    
    scoreVal.innerText = score;
    missVal.innerText = misses;
    levelVal.innerText = level;
    hitsVal.innerText = hitsThisLevel;
    
    isPlaying = true;
    overlay.classList.add('hidden');
    initAudio();
    startBGM();
    
    spawnTarget();
}

function update(dt) {
    if (!isPlaying) return;
    
    updateParticles();
    
    // Update Targets
    for (let i = targets.length - 1; i >= 0; i--) {
        let t = targets[i];
        
        t.x += t.vx;
        t.y += t.vy;
        t.lifeTime -= dt;
        
        // Bounce off walls
        if (t.x < t.radius || t.x > GAME_WIDTH - t.radius) t.vx *= -1;
        if (t.y < 120 || t.y > GAME_HEIGHT - t.radius) t.vy *= -1;
        
        if (t.lifeTime <= 0) {
            // Target escaped! Miss
            targets.splice(i, 1);
            misses++;
            missVal.innerText = misses;
            
            if (misses >= 3) {
                endGame(false);
            } else {
                setTimeout(spawnTarget, 500); // spawn next
            }
        }
    }
}

// --- DRAWING ---
function drawBackground() {
    // Draw "Living Room" abstraction
    // Walls
    let grad = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    grad.addColorStop(0, '#5c4840');
    grad.addColorStop(1, '#2b211a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    
    // Window
    ctx.fillStyle = '#6b7b7a'; // dull window light
    ctx.fillRect(50, 150, 400, 250);
    ctx.strokeStyle = '#2b211a';
    ctx.lineWidth = 10;
    ctx.strokeRect(50, 150, 400, 250);
    ctx.beginPath();
    ctx.moveTo(250, 150); ctx.lineTo(250, 400); // window pane
    ctx.stroke();
    
    // Furniture abstractions
    ctx.fillStyle = '#8f3333'; // red couch side
    ctx.fillRect(0, 450, 100, 200);
    ctx.fillRect(350, 480, 150, 150);
    
    // Rug
    ctx.fillStyle = '#a69a8b';
    ctx.beginPath();
    ctx.moveTo(100, 600);
    ctx.lineTo(400, 600);
    ctx.lineTo(350, 500);
    ctx.lineTo(150, 500);
    ctx.fill();
    
    // Center table
    ctx.fillStyle = '#262626';
    ctx.beginPath();
    ctx.ellipse(250, 550, 60, 20, 0, 0, Math.PI * 2);
    ctx.fill();
}

function drawTargets() {
    for (let t of targets) {
        // Stickman / Object
        ctx.fillStyle = '#ff7b52'; // skin color
        ctx.beginPath();
        // Head
        ctx.arc(t.x, t.y - t.radius/2, t.radius/3, 0, Math.PI*2);
        ctx.fill();
        
        ctx.fillStyle = '#cc0000'; // red shirt
        ctx.fillRect(t.x - t.radius/3, t.y - t.radius/6, t.radius*0.66, t.radius);
        
        // Timer ring around target (decreasing radius as life goes down)
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        ctx.beginPath();
        let angle = (t.lifeTime / t.maxLife) * Math.PI * 2;
        ctx.arc(t.x, t.y, t.radius + 5, -Math.PI/2, -Math.PI/2 + angle);
        ctx.stroke();
    }
}

function drawScope() {
    if (!isPlaying) return;
    
    // Large tinted vignette outside scope
    const outerRadius = 150;
    
    ctx.save();
    // Start clip mask for inside scope to be bright, outside to be dark green tinted
    
    // Fill screen with dark vignette
    ctx.fillStyle = 'rgba(0, 50, 0, 0.4)';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    
    // "Cut out" the scope
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(pointerX, pointerY, outerRadius, 0, Math.PI * 2, false);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    
    // Draw Scope Reticle
    ctx.strokeStyle = '#32cd32'; // bright green
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pointerX, pointerY, outerRadius, 0, Math.PI * 2);
    ctx.stroke();
    
    // Inner rings
    ctx.beginPath();
    ctx.arc(pointerX, pointerY, outerRadius * 0.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(pointerX, pointerY, outerRadius * 0.1, 0, Math.PI * 2);
    ctx.stroke();
    
    // Crosshairs
    ctx.beginPath();
    ctx.moveTo(pointerX - outerRadius, pointerY);
    ctx.lineTo(pointerX + outerRadius, pointerY);
    ctx.moveTo(pointerX, pointerY - outerRadius);
    ctx.lineTo(pointerX, pointerY + outerRadius);
    ctx.stroke();
    
    // Scope center dot
    ctx.fillStyle = '#32cd32';
    ctx.beginPath();
    ctx.arc(pointerX, pointerY, 3, 0, Math.PI*2);
    ctx.fill();
    
    ctx.restore();
}

function draw() {
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    drawBackground();
    drawTargets();
    
    // Particles
    for (let p of particles) {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 4, 4);
    }
    ctx.globalAlpha = 1.0;
    
    drawScope();
}

function gameLoop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    let dt = timestamp - lastTime;
    lastTime = timestamp;
    
    update(dt);
    draw();
    
    requestAnimationFrame(gameLoop);
}

// --- INPUTS ---
function updatePointer(e) {
    let rect = canvas.getBoundingClientRect();
    let clientX = e.touches ? e.touches[0].clientX : e.clientX;
    let clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    pointerX = (clientX - rect.left) / scale;
    pointerY = (clientY - rect.top) / scale;
}

window.addEventListener('mousemove', updatePointer);
window.addEventListener('touchmove', (e) => {
    e.preventDefault();
    updatePointer(e);
}, { passive: false });

canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    updatePointer(e);
    handleShoot();
});

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    updatePointer(e);
    handleShoot();
}, { passive: false });

btnStart.addEventListener('click', () => {
    resetGame();
});

// Resize wrapper
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
resize();

// Start loop
requestAnimationFrame(gameLoop);
