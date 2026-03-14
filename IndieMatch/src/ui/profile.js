// src/ui/profile.js
// Profil ekranı: grid güncelleme ve tab yönetimi.

import { config } from '../config.js';
import { likedPlayables, repostedPlayables, currentProfileTab, setCurrentProfileTab } from '../state/store.js';
import { showToast } from './toast.js';
import { switchTab } from '../nav/tabs.js';

export function updateProfileGrid() {
    const gridContainer = document.querySelector('.video-grid');
    if (!gridContainer) return;

    gridContainer.innerHTML = '';

    const sourceSet = currentProfileTab === 'likes' ? likedPlayables : repostedPlayables;
    const emptyMsg = currentProfileTab === 'likes' ? 'No likes yet' : 'No reposts yet';
    const emptySub = currentProfileTab === 'likes'
        ? 'Like playables to see them here'
        : 'Repost playables to see them here';

    if (sourceSet.size === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-likes-state';
        emptyState.innerHTML = `
            <div class="empty-icon">${currentProfileTab === 'likes' ? '♥' : '↻'}</div>
            <p>${emptyMsg}</p>
            <p class="empty-subtitle">${emptySub}</p>
        `;
        gridContainer.appendChild(emptyState);
        return;
    }

    sourceSet.forEach(playableId => {
        const playable = config.playables.find(p => p.id === playableId);
        if (!playable) return;

        const gridItem = document.createElement('div');
        gridItem.className = 'grid-item';
        gridItem.dataset.playableId = playableId;

        if (playable.thumbnail) {
            gridItem.style.backgroundImage = `url(${playable.thumbnail})`;
            gridItem.style.backgroundSize = 'cover';
            gridItem.style.backgroundPosition = 'center';
        }

        gridItem.innerHTML = `
            <div class="grid-overlay">
                <div class="grid-play-icon">▶</div>
                <div class="grid-label">${playable.gameName || playable.id.toUpperCase()}</div>
            </div>
        `;

        gridItem.addEventListener('click', () => {
            const { scrollToIndex } = window.__feedAPI__;
            const index = config.playables.findIndex(p => p.id === playableId);
            if (index !== -1) {
                scrollToIndex(index);
                switchTab('screen-indie');
                showToast(`Playing ${playable.gameName || playable.id}`);
            }
        });

        gridContainer.appendChild(gridItem);
    });
}

export function attachProfileTabListeners() {
    const profileTabs = document.querySelectorAll('.profile-tabs .tab');
    profileTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            profileTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            setCurrentProfileTab(tab.dataset.tab);
            updateProfileGrid();
        });
    });
}
