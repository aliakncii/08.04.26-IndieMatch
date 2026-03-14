// src/ui/devtools.js
// Geliştirici paneli yardımcıları.

import { currentIndex } from '../state/store.js';
import { config } from '../config.js';

const devInfo = document.getElementById('dev-info');
const devLog = document.getElementById('dev-log');
const loadingOverlay = document.getElementById('loading-overlay');

export function logDev(msg) {
    devLog.textContent = msg;
    console.log('[Dev]', msg);
    setTimeout(() => { if (devLog.textContent === msg) devLog.textContent = '-'; }, 3000);
}

export function updateDevInfo() {
    const item = config.playables[currentIndex];
    devInfo.innerHTML = `Idx: ${currentIndex} <br> ID: ${item?.id} <br> Path: ${item?.path}`;
}

export function showLoading() {
    loadingOverlay.classList.remove('hidden');
}

export function hideLoading() {
    loadingOverlay.classList.add('hidden');
}
