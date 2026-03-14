// src/state/store.js
// Tüm uygulama state'i tek yerden yönetilir.

export let currentIndex = 0;
export let isMuted = true;
export let activeScreen = 'screen-indie';
export let currentProfileTab = 'likes';

export let likedPlayables = new Set();
export let repostedPlayables = new Set();

export function setCurrentIndex(val) { currentIndex = val; }
export function setIsMuted(val) { isMuted = val; }
export function setActiveScreen(val) { activeScreen = val; }
export function setCurrentProfileTab(val) { currentProfileTab = val; }
export function setLikedPlayables(set) { likedPlayables = set; }
export function setRepostedPlayables(set) { repostedPlayables = set; }
