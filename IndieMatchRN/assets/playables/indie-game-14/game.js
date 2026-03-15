const mainMenu = document.getElementById('main-menu');
const gameHud = document.getElementById('game-hud');
const gameContainer = document.getElementById('game-container');
const playerCar = document.getElementById('player-car');
const scoreEl = document.getElementById('score');
const finalScoreEl = document.getElementById('final-score');
const modeTextEl = document.getElementById('mode-text');
const tutorialPopup = document.getElementById('tutorial-popup');
const gameOverScreen = document.getElementById('game-over');

const startBtn = document.getElementById('start-btn');
const tutorialBtn = document.getElementById('tutorial-btn');
const closeTutorialBtn = document.getElementById('close-tutorial');
const restartBtn = document.getElementById('restart-btn');
const menuBtn = document.getElementById('menu-btn');
const diffBtns = document.querySelectorAll('.diff-btn');

let score = 0;
let gameActive = false;
let currentDifficulty = 'medium';
let gameLoopId;
let npcSpawnId;
let npcs = [];
let roadSpeed = 10;
let spawnInterval = 1000;
let audioCtx;
let engineNodes = [];
let sirenOsc;
let musicNodes = [];
let roadOffset = 0;




const DIFFICULTY_SETTINGS = {
    easy: { speed: 8, spawn: 1500, label: 'EASY MODE' },
    medium: { speed: 12, spawn: 1000, label: 'MEDIUM MODE' },
    hard: { speed: 18, spawn: 700, label: 'HARD MODE' }
};

// --- INITIALIZATION ---
function init() {
    setupEventListeners();
}

function setupEventListeners() {
    // Event Listeners
    startBtn.onclick = () => { playClick(); startGame(); };
    tutorialBtn.onclick = () => { playClick(); tutorialPopup.classList.remove('hidden'); };
    closeTutorialBtn.onclick = () => { playClick(); tutorialPopup.classList.add('hidden'); };
    restartBtn.onclick = () => { playClick(); startGame(); };
    menuBtn.onclick = () => { playClick(); backToMenu(); };


    diffBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            playClick(); // Play click sound for difficulty buttons
            diffBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentDifficulty = btn.dataset.diff;
            modeTextEl.innerText = DIFFICULTY_SETTINGS[currentDifficulty].label;
        });
    });

    // Touch/Mouse Controls for Player Car
    gameContainer.addEventListener('mousemove', movePlayer);
    gameContainer.addEventListener('touchmove', (e) => {
        e.preventDefault();
        movePlayer(e.touches[0]);
    }, { passive: false });
}

// --- GAME FLOW ---
function startGame() {
    if (!audioCtx) setupAudio();
    resumeAudio();
    score = 0;
    roadOffset = 0;
    scoreEl.innerText = score;
    gameActive = true;
    npcs.forEach(npc => npc.remove());
    npcs = [];
    
    mainMenu.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    gameHud.classList.remove('hidden');
    
    const settings = DIFFICULTY_SETTINGS[currentDifficulty];
    roadSpeed = settings.speed;
    spawnInterval = settings.spawn;
    
    // Reset player position
    playerCar.style.left = '50%';
    
    cancelAnimationFrame(gameLoopId);
    clearInterval(npcSpawnId);
    
    gameLoopId = requestAnimationFrame(gameLoop);
    npcSpawnId = setInterval(spawnNPC, spawnInterval);
    
    startMusic();
    startEngine();
}

function backToMenu() {
    stopMusic();
    stopEngine();
    stopSiren();
    gameOverScreen.classList.add('hidden');
    gameHud.classList.add('hidden');
    mainMenu.classList.remove('hidden');
}

function gameOver() {
    gameActive = false;
    cancelAnimationFrame(gameLoopId);
    clearInterval(npcSpawnId);
    stopMusic();
    stopEngine();
    stopSiren();
    playCrashSound();
    
    gameContainer.style.animation = 'shake 0.5s';
    setTimeout(() => gameContainer.style.animation = '', 500);
    
    finalScoreEl.innerText = Math.floor(score / 10);
    gameOverScreen.classList.remove('hidden');
}



// --- PLAYER CONTROLS ---
function movePlayer(e) {
    if (!gameActive) return;
    const rect = gameContainer.getBoundingClientRect();
    let x = e.clientX - rect.left;
    
    // Clamp to road boundaries
    const carWidth = playerCar.offsetWidth;
    const roadWidth = gameContainer.offsetWidth;
    
    x = Math.max(carWidth / 2, Math.min(x, roadWidth - carWidth / 2));
    playerCar.style.left = `${x}px`;
    playerCar.style.transform = `translateX(-50%)`;
}

// --- NPC LOGIC ---
function spawnNPC() {
    if (!gameActive) return;
    
    const isPolice = Math.random() < 0.2; 
    const npc = document.createElement('div');
    npc.className = `car ${isPolice ? 'police' : 'red'}`;
    
    const roadWidth = gameContainer.offsetWidth;
    const laneWidth = roadWidth / 5;
    const laneIndex = Math.floor(Math.random() * 5);
    const startX = (laneIndex * laneWidth) + (laneWidth / 2);
    
    npc.style.left = `${startX}px`;
    npc.style.transform = `translateX(-50%)`;
    
    npc.style.top = '-150px';
    npc.dataset.direction = 'down';
    
    // Siren will be handled in gameLoop based on visibility
    
    gameContainer.appendChild(npc);
    npcs.push(npc);
}



// --- AUDIO SYSTEM ---
function setupAudio() {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function resumeAudio() {
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function startEngine() {
    if (!audioCtx) return;
    stopEngine();
    
    const lpFilter = audioCtx.createBiquadFilter();
    lpFilter.type = 'lowpass';
    lpFilter.frequency.setValueAtTime(150, audioCtx.currentTime);
    
    // Base low growl (Smooth)
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(45, audioCtx.currentTime); 
    gain1.gain.setValueAtTime(0.08, audioCtx.currentTime);
    
    // Subtle rumble
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(30, audioCtx.currentTime);
    gain2.gain.setValueAtTime(0.05, audioCtx.currentTime);
    
    osc1.connect(lpFilter);
    osc2.connect(lpFilter);
    lpFilter.connect(audioCtx.destination);
    
    osc1.start();
    osc2.start();
    engineNodes = [osc1, osc2, lpFilter];
}



function stopEngine() {
    engineNodes.forEach(node => {
        if (node.stop) node.stop();
        node.disconnect();
    });
    engineNodes = [];
}

function startSiren() {
    if (!audioCtx || sirenOsc) return;
    
    const lpFilter = audioCtx.createBiquadFilter();
    lpFilter.type = 'lowpass';
    lpFilter.frequency.setValueAtTime(800, audioCtx.currentTime);
    
    sirenOsc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    sirenOsc.type = 'triangle'; // Smoother than square
    
    const now = audioCtx.currentTime;
    // Hi-Lo siren
    sirenOsc.frequency.setValueAtTime(660, now);
    for (let i = 0; i < 60; i += 0.5) {
        sirenOsc.frequency.setValueAtTime(660, now + i);
        sirenOsc.frequency.setValueAtTime(440, now + i + 0.25);
    }
    
    gain.gain.setValueAtTime(0.03, now);
    sirenOsc.connect(lpFilter);
    lpFilter.connect(gain);
    gain.connect(audioCtx.destination);
    sirenOsc.start();
}


function stopSiren() {
    if (sirenOsc) {
        sirenOsc.stop();
        sirenOsc = null;
    }
}

function playCrashSound() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    
    // Low thud
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, now);
    osc.frequency.exponentialRampToValueAtTime(10, now + 0.5);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    
    // Metal crunch noise
    const noise = audioCtx.createBufferSource();
    const bufferSize = audioCtx.sampleRate * 0.5;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    noise.buffer = buffer;
    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0.2, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    noise.connect(noiseGain);
    noiseGain.connect(audioCtx.destination);
    
    osc.start();
    noise.start();
}

function playClick() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, audioCtx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.05);
}

function startMusic() {
    if (!audioCtx) return;
    stopMusic();
    
    const lpFilter = audioCtx.createBiquadFilter();
    lpFilter.type = 'lowpass';
    lpFilter.frequency.setValueAtTime(1000, audioCtx.currentTime);
    
    const tempo = 140;
    const step = 60 / tempo / 2; // 1/8 note
    const now = audioCtx.currentTime;
    
    // Driving Bassline (Smooth Sine/Triangle blend)
    const bassOsc = audioCtx.createOscillator();
    const bassGain = audioCtx.createGain();
    bassOsc.type = 'triangle';
    
    const bassFreqs = [41.2, 41.2, 41.2, 49.0, 55.0, 41.2, 41.2, 36.7];
    for (let i = 0; i < 120; i++) {
        bassOsc.frequency.setValueAtTime(bassFreqs[i % 8], now + i * step);
    }
    
    bassGain.gain.setValueAtTime(0.06, now);
    bassOsc.connect(lpFilter);
    
    // Soft Lead Melody
    const leadOsc = audioCtx.createOscillator();
    const leadGain = audioCtx.createGain();
    leadOsc.type = 'sine';
    
    const leadMelody = [164.8, 164.8, 196.0, 220.0, 0, 164.8, 146.8, 164.8];
    for (let i = 0; i < 120; i++) {
        if (leadMelody[i % 8] > 0) {
            leadOsc.frequency.setValueAtTime(leadMelody[i % 8], now + i * step);
            leadGain.gain.setValueAtTime(0.02, now + i * step);
            leadGain.gain.exponentialRampToValueAtTime(0.001, now + i * step + step * 0.8);
        } else {
            leadGain.gain.setValueAtTime(0, now + i * step);
        }
    }
    
    leadOsc.connect(leadGain);
    leadGain.connect(lpFilter);
    
    lpFilter.connect(audioCtx.destination);
    
    bassOsc.start();
    leadOsc.start();
    
    musicNodes = [bassOsc, leadOsc, lpFilter];
}


function stopMusic() {
    musicNodes.forEach(node => {
        if (node.stop) node.stop();
        node.disconnect();
    });
    musicNodes = [];
}


function gameLoop() {
    if (!gameActive) return;
    
    score++;
    scoreEl.innerText = Math.floor(score / 10);
    
    // Animate road lines
    roadOffset += roadSpeed;
    const laneLines = document.querySelectorAll('.lane-line');
    laneLines.forEach(line => {
        line.style.backgroundPosition = `0 ${roadOffset}px`;
    });
    
    npcs.forEach((npc, index) => {

        const isPolice = npc.classList.contains('police');
        // Red cars: move at roadSpeed (stationary relative to road)
        // Police cars: move at roadSpeed + extra (counter-flow feeling)
        const speed = isPolice ? roadSpeed * 1.6 : roadSpeed;
        
        const currentTop = parseInt(npc.style.top);
        npc.style.top = `${currentTop + speed}px`;
        
        // Remove off-screen NPCs (with buffer)
        const rect = npc.getBoundingClientRect();
        const containerRect = gameContainer.getBoundingClientRect();
        const buffer = 200;
        
        if (rect.top > containerRect.bottom + buffer) {
            npc.remove();
            npcs.splice(index, 1);
        }

        // Collision Detection
        if (checkCollision(playerCar, npc)) {
            gameOver();
        }
    });

    
    // Handle Siren based on police car visibility
    const visiblePolice = Array.from(document.querySelectorAll('.car.police')).filter(p => {
        const rect = p.getBoundingClientRect();
        const containerRect = gameContainer.getBoundingClientRect();
        return rect.bottom > containerRect.top && rect.top < containerRect.bottom;
    });
    
    if (visiblePolice.length > 0) {
        startSiren();
    } else {
        stopSiren();
    }
    
    gameLoopId = requestAnimationFrame(gameLoop);
}


function checkCollision(el1, el2) {
    const rect1 = el1.getBoundingClientRect();
    const rect2 = el2.getBoundingClientRect();
    
    // Padding for more forgiving collisions
    const padding = 5;
    
    return !(
        rect1.top + padding > rect2.bottom - padding ||
        rect1.bottom - padding < rect2.top + padding ||
        rect1.right - padding < rect2.left + padding ||
        rect1.left + padding > rect2.right - padding
    );
}

init();

