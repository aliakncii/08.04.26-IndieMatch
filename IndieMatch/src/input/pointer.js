// src/input/pointer.js
// Touch, mouse ve wheel event handler'ları.

import { logDev } from '../ui/devtools.js';

const feedContainer = document.getElementById('feed-container');
const edgeLeft = document.getElementById('edge-zone-left');
const edgeRight = document.getElementById('edge-zone-right');

let touchStartX = 0;
let touchStartY = 0;
let isDragging = false;
let activeFrame = null;

// ── Wheel ────────────────────────────────────────────────
export function handleWheel(e) {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 2) {
        e.preventDefault();
        e.stopPropagation();
    }
}

// ── Unified Pointer ──────────────────────────────────────
function getPointerPos(e) {
    if (e.touches && e.touches.length > 0) {
        return { x: e.touches[0].screenX, y: e.touches[0].screenY };
    }
    return { x: e.screenX, y: e.screenY };
}

export function handlePointerStart(e, sourceFrame = null) {
    isDragging = true;
    activeFrame = sourceFrame;
    const pos = getPointerPos(e);
    touchStartX = pos.x;
    touchStartY = pos.y;
    feedContainer.style.scrollSnapType = 'none';
    feedContainer.style.scrollBehavior = 'auto';
}

export function handlePointerMove(e) {
    if (!isDragging) return;
    if (!e.touches && e.buttons === 0) { isDragging = false; return; }
}

export function handlePointerEnd(e) {
    if (!isDragging) return;
    isDragging = false;
    activeFrame = null;
    feedContainer.style.scrollSnapType = 'y mandatory';
    feedContainer.style.scrollBehavior = 'smooth';
    touchStartX = 0;
    touchStartY = 0;
}

// ── Touch aliases ────────────────────────────────────────
export function handleTouchStart(e, sourceFrame = null) { handlePointerStart(e, sourceFrame); }
export function handleTouchMove(e) { handlePointerMove(e); }

// ── Swipe on overlay elements (engBar, creatorDiv) ───────
export function addSwipeListeners(el) {
    let startY = 0, startTime = 0, moved = false;

    el.addEventListener('touchstart', (e) => {
        startY = e.touches[0].clientY;
        startTime = Date.now();
        moved = false;
    }, { passive: true });

    el.addEventListener('touchmove', () => { moved = true; }, { passive: true });

    el.addEventListener('touchend', (e) => {
        if (!moved) return;
        const deltaY = e.changedTouches[0].clientY - startY;
        if (Math.abs(deltaY) > 30 && (Date.now() - startTime) < 600) {
            const api = window.__feedAPI__;
            if (api) {
                if (deltaY < 0) api.scrollToNext();
                else api.scrollToPrev();
            }
        }
    }, { passive: true });
}

// ── Iframe listener injection ────────────────────────────
export function attachIframeListeners(iframe) {
    try {
        const iWindow = iframe.contentWindow;
        if (!iWindow) return;
        logDev('Attaching Touch Hooks');
        const opts = { capture: true, passive: false };
        iWindow.addEventListener('touchstart', (e) => handleTouchStart(e, iframe), opts);
        iWindow.addEventListener('touchmove', handleTouchMove, opts);
        iWindow.addEventListener('touchend', handlePointerEnd, opts);
        iWindow.addEventListener('pointerdown', (e) => handleTouchStart(e, iframe), opts);
        iWindow.addEventListener('pointermove', handleTouchMove, opts);
        iWindow.addEventListener('pointerup', handlePointerEnd, opts);
        iWindow.addEventListener('wheel', handleWheel, opts);
    } catch (err) {
        console.error('Cannot access iframe', err);
        logDev('X-Origin Error?');
    }
}

// ── Edge zones ───────────────────────────────────────────
export function attachEdgeListeners() {
    [edgeLeft, edgeRight].forEach(zone => {
        const opts = { passive: false };
        zone.addEventListener('touchstart', (e) => handleTouchStart(e, null), opts);
        zone.addEventListener('touchmove', handleTouchMove, opts);
        zone.addEventListener('touchend', handlePointerEnd, opts);
    });
}

// ── Mouse (desktop) ──────────────────────────────────────
export function attachMouseListeners() {
    const container = document.getElementById('app');
    container.addEventListener('mousedown', handlePointerStart);
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerEnd);
    window.addEventListener('wheel', handleWheel, { passive: false });
}
