// src/ui/sound.js
// Ses (mute/unmute) kontrolü.

import { isMuted, setIsMuted } from '../state/store.js';
import { logDev } from './devtools.js';

const soundBtn = document.getElementById('sound-control');

export function toggleMute() {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    soundBtn.innerHTML = newMuted
        ? '<span class="sound-icon">🔇</span>'
        : '<span class="sound-icon">🔊</span>';
    logDev(`Sound: ${newMuted ? 'OFF' : 'ON'}`);

    document.querySelectorAll('.playable-wrapper iframe').forEach(iframe => {
        if (iframe.contentWindow) {
            iframe.contentWindow.postMessage({ type: 'mute', value: newMuted }, '*');
        }
    });
}
