// src/nav/tabs.js
// Ekran geçişleri ve bottom tab bar yönetimi.

import { setActiveScreen } from '../state/store.js';
import { logDev } from '../ui/devtools.js';
import { showToast } from '../ui/toast.js';

const tabFollowing = document.getElementById('tab-following');
const tabForYou = document.getElementById('tab-foryou');

export function switchTab(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));

    const targetScreen = document.getElementById(screenId);
    if (targetScreen) targetScreen.classList.add('active');

    const matchingTab = document.querySelector(`.tab-item[data-screen="${screenId}"]`);
    if (matchingTab) matchingTab.classList.add('active');

    setActiveScreen(screenId);
    logDev(`Tab: ${screenId}`);
}

export function attachTabBarListeners() {
    document.querySelectorAll('.tab-item').forEach(tabItem => {
        tabItem.addEventListener('click', () => {
            const screenId = tabItem.dataset.screen;
            if (screenId) switchTab(screenId);
        });
    });
}

export function switchFeedTab(tab) {
    if (tab === 'following') {
        tabFollowing.classList.add('active');
        tabFollowing.classList.remove('inactive');
        tabForYou.classList.add('inactive');
        tabForYou.classList.remove('active');
        showToast('Switched to Following');
    } else {
        tabForYou.classList.add('active');
        tabForYou.classList.remove('inactive');
        tabFollowing.classList.add('inactive');
        tabFollowing.classList.remove('active');
        showToast('Back to For You');
    }
}
