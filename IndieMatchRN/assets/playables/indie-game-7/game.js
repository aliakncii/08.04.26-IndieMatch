const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const toolBtns = document.querySelectorAll('.tool-btn');
const colorPalette = document.getElementById('color-palette');
const colorBtns = document.querySelectorAll('.color-btn');
const btnNext = document.getElementById('btn-next');

let GAME_WIDTH = 500;
let GAME_HEIGHT = 888;
let scale = 1;

// State
let currentTool = 'snip'; // snip, grow, color
let currentColor = '#e74c3c';
let isPointerDown = false;
let pointerX = 0;
let pointerY = 0;
let lastPointerX = 0;
let lastPointerY = 0;

// Characters
const characters = [
    { skin: '#ffccb6', shirt: '#b3e5fc', hair: '#6e4c29', eye: '#333', blush: '#ffb6c1' },
    { skin: '#8d5524', shirt: '#f8bbd0', hair: '#111', eye: '#111', blush: '#6e3a1f' },
    { skin: '#f1c27d', shirt: '#c8e6c9', hair: '#e67e22', eye: '#4b3621', blush: '#e2a788' },
    { skin: '#ffecd2', shirt: '#fff9c4', hair: '#e74c3c', eye: '#2c3e50', blush: '#ffc8c8' }
];
let currentChar = 0;

// Physics Configuration
const GRAVITY = 0.5;
const FRICTION = 0.9;
const STIFFNESS = 0.5;
const MAX_STRAND_LENGTH = 30; // Max nodes per strand
const NODE_DISTANCE = 15;
const NUM_STRANDS = 60; // How many hairs

// Head metrics
const headCX = GAME_WIDTH / 2;
const headCY = GAME_HEIGHT * 0.35;
const headRadius = GAME_WIDTH * 0.35;

// Audio
let audioCtx = null;
function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playSnip() {
    if (!audioCtx) return;
    let osc = audioCtx.createOscillator();
    let gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
    
    // Highpass to make it sound "sharp"
    let filter = audioCtx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 2000;
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.05);
}

// Particle System for cut hair
const particles = [];

// Hair Structure (Verlet Integration)
class Node {
    constructor(x, y, isFixed = false, color = '#6e4c29') {
        this.x = x;
        this.y = y;
        this.oldX = x;
        this.oldY = y;
        this.isFixed = isFixed;
        this.color = color;
    }
}

class Strand {
    constructor(startX, startY, color, numNodes = 25) {
        this.nodes = [];
        this.startX = startX;
        this.startY = startY;
        
        let nodeColor = color;
        for (let i = 0; i < numNodes; i++) {
            let nX = startX;
            let nY = startY + i * NODE_DISTANCE;
            this.nodes.push(new Node(nX, nY, i === 0, nodeColor));
        }
    }
    
    update() {
        // Verlet Integration
        for (let i = 0; i < this.nodes.length; i++) {
            let n = this.nodes[i];
            if (!n.isFixed) {
                let vx = (n.x - n.oldX) * FRICTION;
                let vy = (n.y - n.oldY) * FRICTION;
                
                n.oldX = n.x;
                n.oldY = n.y;
                
                n.x += vx;
                n.y += vy + GRAVITY;
                
                // Repel away from head (Collision with head sphere)
                let dx = n.x - headCX;
                let dy = n.y - headCY;
                let dist = Math.sqrt(dx*dx + dy*dy);
                if (dist < headRadius * 1.1 && dy > 0) { // Only push outwards if below head center
                    let force = (headRadius * 1.1 - dist) / dist;
                    n.x += dx * force * 0.5;
                    n.y += dy * force * 0.5;
                }
            } else {
                n.x = this.startX;
                n.y = this.startY;
            }
        }
        
        // Solve Constraints (Distance)
        for (let iter = 0; iter < 3; iter++) {
            for (let i = 0; i < this.nodes.length - 1; i++) {
                let n1 = this.nodes[i];
                let n2 = this.nodes[i + 1];
                
                let dx = n2.x - n1.x;
                let dy = n2.y - n1.y;
                let dist = Math.sqrt(dx*dx + dy*dy);
                
                if (dist > 0) {
                    let diff = (NODE_DISTANCE - dist) / dist;
                    let offsetX = dx * diff * STIFFNESS;
                    let offsetY = dy * diff * STIFFNESS;
                    
                    if (!n1.isFixed) {
                        n1.x -= offsetX;
                        n1.y -= offsetY;
                    }
                    if (!n2.isFixed) {
                        n2.x += offsetX;
                        n2.y += offsetY;
                    }
                }
            }
        }
    }
    
    draw(ctx) {
        if (this.nodes.length < 2) return;
        
        // Draw segment by segment to support color changes
        for (let i = 0; i < this.nodes.length - 1; i++) {
            let n1 = this.nodes[i];
            let n2 = this.nodes[i + 1];
            
            ctx.beginPath();
            ctx.moveTo(n1.x, n1.y);
            // Thick curving
            ctx.lineWidth = 15 - (i / this.nodes.length) * 10;
            ctx.lineCap = 'round';
            ctx.strokeStyle = n1.color;
            ctx.lineTo(n2.x, n2.y);
            ctx.stroke();
        }
    }
}

// Global Hair Array
const scalpStrands = [];

function initHair() {
    scalpStrands.length = 0;
    let char = characters[currentChar];
    
    // Plant hair nodes along an arc
    for (let i = 0; i < NUM_STRANDS; i++) {
        let t = i / (NUM_STRANDS - 1); // 0 to 1
        let angle = Math.PI * 0.9 + t * Math.PI * 1.2; // Over top of head
        
        // Shift start positions slightly above to leave room to cut and reveal scalp
        let startX = headCX + Math.cos(angle) * headRadius * 0.85;
        let startY = headCY - 10 + Math.sin(angle) * headRadius * 0.9;
        
        scalpStrands.push(new Strand(startX, startY, char.hair, 25 + Math.random()*5));
    }
}

// Interactions Loop
function processInteractions() {
    if (!isPointerDown) return;
    
    let brushRadius = 30;
    
    // Check intersection with hair nodes
    for (let i = 0; i < scalpStrands.length; i++) {
        let strand = scalpStrands[i];
        
        for (let j = 0; j < strand.nodes.length; j++) {
            let n = strand.nodes[j];
            let dx = n.x - pointerX;
            let dy = n.y - pointerY;
            let dist = Math.sqrt(dx*dx + dy*dy);
            
            if (dist < brushRadius) {
                
                if (currentTool === 'snip') {
                    // Cut it here! Only if it's not the fixed root node
                    if (j > 0) { 
                        // Spawn particles for dropped segment
                        for(let k = j; k < strand.nodes.length; k++){
                            if(Math.random() > 0.5) {
                                particles.push({
                                    x: strand.nodes[k].x,
                                    y: strand.nodes[k].y,
                                    vx: (Math.random() - 0.5) * 5,
                                    vy: (Math.random() - 0.5) * 5 - 2,
                                    color: strand.nodes[k].color,
                                    life: 1.0
                                });
                            }
                        }
                        strand.nodes.splice(j); // Remove all subsequent nodes
                        playSnip();
                        break; // Move to next strand
                    }
                } 
                else if (currentTool === 'color') {
                    n.color = currentColor;
                }
            }
        }
        
        // Grow Tool - check distance to last node
        if (currentTool === 'grow') {
            let lastNode = strand.nodes[strand.nodes.length - 1];
            if (lastNode && strand.nodes.length < MAX_STRAND_LENGTH) {
                let dx = lastNode.x - pointerX;
                let dy = lastNode.y - pointerY;
                if (Math.sqrt(dx*dx + dy*dy) < brushRadius * 1.5) {
                    // Add new node occasionally
                    if (Math.random() < 0.2) {
                        let newColor = lastNode.color;
                        strand.nodes.push(new Node(lastNode.x, lastNode.y + 10, false, newColor));
                    }
                }
            }
        }
        
        // Physical brush interaction (pushing hair)
        if (currentTool !== 'snip') { // Snip doesn't push
            for (let j = 0; j < strand.nodes.length; j++) {
                let n = strand.nodes[j];
                let dx = n.x - pointerX;
                let dy = n.y - pointerY;
                let dist = Math.sqrt(dx*dx + dy*dy);
                if (dist < brushRadius && !n.isFixed) {
                    let force = (brushRadius - dist) / brushRadius;
                    n.x += (pointerX - lastPointerX) * force * 0.5;
                    n.y += (pointerY - lastPointerY) * force * 0.5;
                }
            }
        }
    }
}

// Particle rendering
function updateAndDrawParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.vy += GRAVITY * 0.5;
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.02;
        
        if (p.life <= 0 || p.y > GAME_HEIGHT) {
            particles.splice(i, 1);
            continue;
        }
        
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1.0;
}

// Base Rendering
function drawBackground() {
    let char = characters[currentChar];

    // Fill
    ctx.fillStyle = '#ffb6c1';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    
    // Draw "Mirror" Area
    ctx.fillStyle = '#fce4ec';
    ctx.beginPath();
    ctx.roundRect(40, 40, GAME_WIDTH - 80, GAME_HEIGHT * 0.6, 20);
    ctx.fill();
    // Mirror borders (lights)
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 15;
    ctx.stroke();
    
    // Light bulbs
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 6; i++) {
        let y = 60 + i * ((GAME_HEIGHT * 0.6) / 5);
        ctx.beginPath(); ctx.arc(40, y, 10, 0, Math.PI*2); ctx.fill(); // Left
        ctx.beginPath(); ctx.arc(GAME_WIDTH - 40, y, 10, 0, Math.PI*2); ctx.fill(); // Right
    }
    
    // Draw character body
    ctx.fillStyle = char.shirt;
    ctx.beginPath();
    ctx.ellipse(headCX, headCY + 250, 200, 200, 0, Math.PI, 0, false);
    ctx.fill();
    
    // Draw Neck
    ctx.fillStyle = char.skin;
    ctx.fillRect(headCX - 30, headCY + 100, 60, 50);
    
    // Draw Base Head (Skin)
    ctx.beginPath();
    ctx.ellipse(headCX, headCY, headRadius * 0.85, headRadius * 0.95, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = char.eye;
    ctx.beginPath(); ctx.ellipse(headCX - 40, headCY - 20, 8, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(headCX + 40, headCY - 20, 8, 12, 0, 0, Math.PI * 2); ctx.fill();

    // Eyelashes
    ctx.strokeStyle = char.eye;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(headCX - 48, headCY - 30); ctx.lineTo(headCX - 55, headCY - 35); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(headCX + 48, headCY - 30); ctx.lineTo(headCX + 55, headCY - 35); ctx.stroke();

    // Blush
    ctx.fillStyle = char.blush;
    ctx.beginPath(); ctx.ellipse(headCX - 60, headCY + 10, 15, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(headCX + 60, headCY + 10, 15, 10, 0, 0, Math.PI * 2); ctx.fill();

    // Mouth (Smile)
    ctx.strokeStyle = '#d63031';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(headCX, headCY + 30, 25, 0, Math.PI, false);
    ctx.stroke();
}

// Listeners
function updatePointer(e) {
    let rect = canvas.getBoundingClientRect();
    let cx = e.touches ? e.touches[0].clientX : e.clientX;
    let cy = e.touches ? e.touches[0].clientY : e.clientY;
    
    lastPointerX = pointerX;
    lastPointerY = pointerY;
    
    pointerX = (cx - rect.left) / scale;
    pointerY = (cy - rect.top) / scale;
}

canvas.addEventListener('mousedown', (e) => {
    initAudio();
    isPointerDown = true;
    updatePointer(e);
});
window.addEventListener('mousemove', (e) => {
    if (isPointerDown) updatePointer(e);
});
window.addEventListener('mouseup', () => { isPointerDown = false; });

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    initAudio();
    isPointerDown = true;
    updatePointer(e);
}, { passive: false });
window.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if(isPointerDown) updatePointer(e);
}, { passive: false });
window.addEventListener('touchend', () => { isPointerDown = false; });

// UI Interactions
toolBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        toolBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTool = btn.dataset.tool;
        
        if (currentTool === 'color') {
            colorPalette.classList.remove('hidden');
        } else {
            colorPalette.classList.add('hidden');
        }
    });
});

colorBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        colorBtns.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        currentColor = btn.dataset.color;
    });
});

btnNext.addEventListener('click', () => {
    currentChar = (currentChar + 1) % characters.length;
    initHair();
    
    // Pop animation on character switch
    canvas.style.transform = 'scale(0.95)';
    setTimeout(() => { canvas.style.transform = 'scale(1)'; }, 100);
});

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

// Main Loop
function gameLoop() {
    processInteractions();
    
    // Physics pass
    for (let strand of scalpStrands) {
        strand.update();
    }
    
    // Draw pass
    drawBackground();
    for (let strand of scalpStrands) {
        strand.draw(ctx);
    }
    updateAndDrawParticles();
    
    requestAnimationFrame(gameLoop);
}

// Init
resize();
initHair();
requestAnimationFrame(gameLoop);
