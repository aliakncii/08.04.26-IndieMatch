// src/utils/storage.js
// localStorage okuma/yazma işlemleri.

import {
    likedPlayables, setLikedPlayables,
    repostedPlayables, setRepostedPlayables
} from '../state/store.js';
import { logDev } from '../ui/devtools.js';

export function loadLikes() {
    try {
        const stored = localStorage.getItem('indieMatchLikes');
        if (stored) {
            setLikedPlayables(new Set(JSON.parse(stored)));
            logDev(`Loaded ${likedPlayables.size} likes`);
        }
    } catch (e) {
        console.error('Error loading likes:', e);
    }
}

export function saveLikes() {
    try {
        localStorage.setItem('indieMatchLikes', JSON.stringify(Array.from(likedPlayables)));
    } catch (e) {
        console.error('Error saving likes:', e);
    }
}

export function loadReposts() {
    try {
        const stored = localStorage.getItem('indieMatchReposts');
        if (stored) {
            setRepostedPlayables(new Set(JSON.parse(stored)));
            logDev(`Loaded ${repostedPlayables.size} reposts`);
        }
    } catch (e) {
        console.error('Error loading reposts:', e);
    }
}

export function saveReposts() {
    try {
        localStorage.setItem('indieMatchReposts', JSON.stringify(Array.from(repostedPlayables)));
    } catch (e) {
        console.error('Error saving reposts:', e);
    }
}
