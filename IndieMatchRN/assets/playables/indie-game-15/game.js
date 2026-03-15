const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const levelIndicator = document.getElementById('level-indicator');
const resetBtn = document.getElementById('reset-btn');
const muteBtn = document.getElementById('mute-btn');
const unmuteIcon = document.getElementById('unmute-icon');
const muteIcon = document.getElementById('mute-icon');
const winOverlay = document.getElementById('win-overlay');
const nextLevelBtn = document.getElementById('next-level-btn');
const completedLevelEl = document.getElementById('completed-level');

// Audio Context & Nodes
let audioCtx;
let masterGain;
let musicGain;
let isMuted = false;
let musicNodes = [];

// Game State
let currentLevel = 0;
let nodes = [];
let edges = [];
let currentPath = [];
let isDrawing = false;
let solved = false;
let dashOffset = 0;

// Levels Data (Eulerian Paths/Circuits)
const LEVELS = [
    { // L1: Triangle
        nodes: [{x:0.5, y:0.25}, {x:0.2, y:0.75}, {x:0.8, y:0.75}],
        edges: [[0,1], [1,2], [2,0]]
    },
    { // L2: Square + Diagonal
        nodes: [{x:0.25, y:0.25}, {x:0.75, y:0.25}, {x:0.75, y:0.75}, {x:0.25, y:0.75}],
        edges: [[0,1], [1,2], [2,3], [3,0], [0,2]]
    },
    { // L3: House
        nodes: [{x:0.5, y:0.15}, {x:0.2, y:0.45}, {x:0.8, y:0.45}, {x:0.2, y:0.85}, {x:0.8, y:0.85}],
        edges: [[1,0], [0,2], [2,1], [1,3], [3,4], [4,2]]
    },
    { // L4: Butterfly
        nodes: [{x:0.2, y:0.25}, {x:0.8, y:0.25}, {x:0.5, y:0.5}, {x:0.2, y:0.75}, {x:0.8, y:0.75}],
        edges: [[0,1], [1,2], [2,0], [2,3], [3,4], [4,2]]
    },
    { // L5: Ribbon
        nodes: [{x:0.2, y:0.3}, {x:0.5, y:0.3}, {x:0.8, y:0.3}, {x:0.2, y:0.7}, {x:0.5, y:0.7}, {x:0.8, y:0.7}],
        edges: [[0,1], [1,2], [2,5], [5,4], [4,3], [3,0], [0,4], [4,1], [1,5]] // Removed duplicate [5,2]
    },

    { // L6: Pentagon with internal
        nodes: [{x:0.5, y:0.15}, {x:0.8, y:0.4}, {x:0.7, y:0.8}, {x:0.3, y:0.8}, {x:0.2, y:0.4}],
        edges: [[0,1], [1,2], [2,3], [3,4], [4,0], [0,2], [2,4]]
    },
    { // L7: Two stacked squares (joined)
        nodes: [{x:0.3, y:0.2}, {x:0.7, y:0.2}, {x:0.3, y:0.5}, {x:0.7, y:0.5}, {x:0.3, y:0.8}, {x:0.7, y:0.8}],
        edges: [[0,1], [1,3], [3,2], [2,0], [2,4], [4,5], [5,3]]
    },
    { // L8: Fish
        nodes: [{x:0.2, y:0.5}, {x:0.5, y:0.3}, {x:0.8, y:0.5}, {x:0.5, y:0.7}, {x:0.9, y:0.4}, {x:0.9, y:0.6}],
        edges: [[0,1], [1,2], [2,3], [3,0], [2,4], [4,5], [5,2]]
    },
    { // L9: Large Diamond with Cross
        nodes: [{x:0.5, y:0.1}, {x:0.1, y:0.5}, {x:0.9, y:0.5}, {x:0.5, y:0.9}, {x:0.5, y:0.5}],
        edges: [[0,1], [1,3], [3,2], [2,0], [0,4], [4,3]]
    },
    { // L10: Complex Hexagon
        nodes: [{x:0.5, y:0.1}, {x:0.85, y:0.3}, {x:0.85, y:0.7}, {x:0.5, y:0.9}, {x:0.15, y:0.7}, {x:0.15, y:0.3}, {x:0.5, y:0.5}],
        edges: [[0,1], [1,2], [2,3], [3,4], [4,5], [5,0], [0,6], [6,3], [6,1], [6,2]]
    }
];

const COLORS = {
    node: '#e2e8f0',
    edge: '#e2e8f0',
    activeEdge: '#6366f1',
    activeNode: '#6366f1'
};

const NODE_RADIUS = 14;
const EDGE_WIDTH = 6;

// --- INITIALIZATION ---
function init() {
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    loadLevel(currentLevel);
    animate();
    
    // Event Listeners
    canvas.addEventListener('mousedown', (e) => { setupAudioOnce(); startDrawing(e); });
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('touchstart', (e) => { 
        setupAudioOnce(); 
        startDrawing(e.touches[0]); 
    }, {passive: false});
    canvas.addEventListener('touchmove', (e) => { e.preventDefault(); draw(e.touches[0]); }, {passive: false});
    canvas.addEventListener('touchend', stopDrawing);
    
    resetBtn.onclick = () => { playSoundEffect(800, 0.05); loadLevel(currentLevel); };
    muteBtn.onclick = toggleMute;
    
    nextLevelBtn.onclick = () => {
        playSoundEffect(1000, 0.1);
        currentLevel = (currentLevel + 1) % LEVELS.length;
        loadLevel(currentLevel);
        winOverlay.classList.add('hidden');
    };
}

function resizeCanvas() {
    const parent = canvas.parentElement;
    canvas.width = parent.clientWidth * window.devicePixelRatio;
    canvas.height = parent.clientHeight * window.devicePixelRatio;
    canvas.style.width = parent.clientWidth + 'px';
    canvas.style.height = parent.clientHeight + 'px';
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    render();
}

function loadLevel(idx) {
    const level = LEVELS[idx];
    nodes = level.nodes.map((n, i) => ({
        id: i,
        absX: n.x * canvas.offsetWidth,
        absY: n.y * canvas.offsetHeight
    }));
    
    edges = level.edges.map(e => ({ n1: e[0], n2: e[1], traced: false }));
    currentPath = [];
    isDrawing = false;
    solved = false;
    levelIndicator.innerText = `Level ${idx + 1}`;
}

// --- AUDIO SYSTEM ---
function setupAudioOnce() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    musicGain = audioCtx.createGain();
    
    masterGain.connect(audioCtx.destination);
    musicGain.connect(masterGain);
    
    masterGain.gain.setValueAtTime(isMuted ? 0 : 1, audioCtx.currentTime);
    musicGain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    
    startMusic();
}

function toggleMute() {
    isMuted = !isMuted;
    if (masterGain) {
        masterGain.gain.setTargetAtTime(isMuted ? 0 : 1, audioCtx.currentTime, 0.05);
    }
    unmuteIcon.classList.toggle('hidden', isMuted);
    muteIcon.classList.toggle('hidden', !isMuted);
}

function playSoundEffect(freq, duration) {
    if (!audioCtx || isMuted) return;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq/2, audioCtx.currentTime + duration);
    g.gain.setValueAtTime(0.1, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(g);
    g.connect(masterGain);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

function startMusic() {
    const tempo = 85; 
    const step = 60 / tempo / 2; // 1/8 note
    const now = audioCtx.currentTime;
    
    function playPattern() {
        if (!audioCtx) return;
        const base = 48; // C3
        const major = [0, 4, 7, 11];
        const loopLen = 16 * step;
        
        // Lo-fi Plucks
        for(let i=0; i<16; i++) {
            if (Math.random() > 0.4) {
                const note = base + major[Math.floor(Math.random() * major.length)];
                const freq = 440 * Math.pow(2, (note - 69) / 12);
                
                const osc = audioCtx.createOscillator();
                const g = audioCtx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, audioCtx.currentTime + i * step);
                g.gain.setValueAtTime(0, audioCtx.currentTime + i * step);
                g.gain.linearRampToValueAtTime(0.05, audioCtx.currentTime + i * step + 0.02);
                g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + i * step + step * 0.8);
                
                osc.connect(g);
                g.connect(musicGain);
                osc.start(audioCtx.currentTime + i * step);
                osc.stop(audioCtx.currentTime + i * step + step);
            }
        }
        setTimeout(playPattern, loopLen * 1000);
    }
    playPattern();
}

// --- LOGIC ---
function startDrawing(e) {
    if (solved) return;
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    const pos = getMousePos(e);
    const node = findNodeAt(pos.x, pos.y);
    if (node !== null) {
        isDrawing = true;
        currentPath = [node];
        playSoundEffect(600, 0.05);
    }
}

function draw(e) {
    if (!isDrawing || solved) return;
    const pos = getMousePos(e);
    const node = findNodeAt(pos.x, pos.y);
    if (node !== null) {
        const last = currentPath[currentPath.length - 1];
        if (node !== last) {
            const edge = findEdge(last, node);
            if (edge && !edge.traced) {
                edge.traced = true;
                currentPath.push(node);
                playSoundEffect(800 + currentPath.length * 50, 0.05);
                checkWin();
            }
        }
    }
    render(pos);
}

function stopDrawing() {
    if (!solved && isDrawing) loadLevel(currentLevel);
    isDrawing = false;
}

function checkWin() {
    if (edges.every(e => e.traced)) {
        solved = true;
        isDrawing = false;
        setTimeout(() => {
            completedLevelEl.innerText = currentLevel + 1;
            winOverlay.classList.remove('hidden');
        }, 300);
    }
}

function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function findNodeAt(x, y) {
    for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const dist = Math.sqrt((x - n.absX)**2 + (y - n.absY)**2);
        if (dist < NODE_RADIUS * 2.5) return i;
    }
    return null;
}


function findEdge(n1, n2) {
    return edges.find(e => (e.n1 === n1 && e.n2 === n2) || (e.n1 === n2 && e.n2 === n1));
}

function animate() {
    dashOffset++;
    render();
    requestAnimationFrame(animate);
}

function render(mousePos = null) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Edges
    edges.forEach(e => {
        const n1 = nodes[e.n1], n2 = nodes[e.n2];
        ctx.beginPath();
        ctx.moveTo(n1.absX, n1.absY); ctx.lineTo(n2.absX, n2.absY);
        ctx.strokeStyle = e.traced ? COLORS.activeEdge : COLORS.edge;
        ctx.lineWidth = EDGE_WIDTH;
        ctx.lineCap = 'round';
        ctx.stroke();
    });
    
    // Ghost line
    if (isDrawing && mousePos) {
        const last = nodes[currentPath[currentPath.length - 1]];
        ctx.beginPath();
        ctx.moveTo(last.absX, last.absY); ctx.lineTo(mousePos.x, mousePos.y);
        ctx.strokeStyle = COLORS.activeEdge;
        ctx.setLineDash([10, 5]); ctx.lineDashOffset = -dashOffset * 0.5;
        ctx.lineWidth = 4; ctx.stroke(); ctx.setLineDash([]);
    }
    
    // Nodes
    nodes.forEach((n, i) => {
        const active = currentPath.includes(i);
        const head = isDrawing && currentPath[currentPath.length - 1] === i;
        ctx.beginPath();
        ctx.arc(n.absX, n.absY, NODE_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = active ? COLORS.activeNode : COLORS.node;
        ctx.fill();
        if (head) {
            ctx.beginPath(); ctx.arc(n.absX, n.absY, NODE_RADIUS + 6, 0, Math.PI * 2);
            ctx.strokeStyle = COLORS.activeNode; ctx.lineWidth = 2; ctx.stroke();
        }
    });
}

init();
