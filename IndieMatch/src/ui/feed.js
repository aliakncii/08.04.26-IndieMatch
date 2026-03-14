// src/ui/feed.js
// Feed başlatma, item oluşturma, iframe yükleme ve scroll yönetimi.

import { config } from '../config.js';
import {
    currentIndex, setCurrentIndex,
    likedPlayables, repostedPlayables
} from '../state/store.js';
import { logDev, updateDevInfo, showLoading, hideLoading } from './devtools.js';
import { showToast } from './toast.js';
import { saveLikes, saveReposts } from '../utils/storage.js';
import { attachIframeListeners } from '../input/pointer.js';
import { updateProfileGrid } from './profile.js';

const feedContainer = document.getElementById('feed-container');
let scrollTimeout = null;

// ── Public API ───────────────────────────────────────────
export function scrollToIndex(index) {
    if (index < 0 || index >= config.playables.length) return;
    feedContainer.scrollTo({ top: index * feedContainer.clientHeight, behavior: 'smooth' });
    setCurrentIndex(index);
    loadNearbyIframes(index);
}

export function loadNearbyIframes(index) {
    const indicesToLoad = [index, index + 1, index - 1];
    const wrappers = document.querySelectorAll('.playable-wrapper');
    indicesToLoad.forEach(i => {
        if (i >= 0 && i < wrappers.length) {
            const iframe = wrappers[i].querySelector('iframe');
            if (iframe && !iframe.src && iframe.dataset.src) {
                iframe.src = iframe.dataset.src;
                logDev(`Preloading: ${i}`);
            }
        }
    });
}

// ── Like / Repost State ──────────────────────────────────
export function toggleLike() {
    const currentItem = config.playables[currentIndex];
    if (!currentItem) return;
    const isLiked = likedPlayables.has(currentItem.id);
    if (isLiked) { likedPlayables.delete(currentItem.id); showToast('Unliked!'); }
    else { likedPlayables.add(currentItem.id); showToast('Liked!'); }
    saveLikes();
    updateLikeButton();
    updateProfileGrid();
}

export function toggleRepost() {
    const currentItem = config.playables[currentIndex];
    if (!currentItem) return;
    const isReposted = repostedPlayables.has(currentItem.id);
    if (isReposted) { repostedPlayables.delete(currentItem.id); showToast('Removed Repost'); }
    else { repostedPlayables.add(currentItem.id); showToast('Reposted!'); }
    saveReposts();
    updateRepostButton();
    updateProfileGrid();
}

export function updateLikeButton() {
    const currentItem = config.playables[currentIndex];
    if (!currentItem) return;
    const isLiked = likedPlayables.has(currentItem.id);
    const wrapper = feedContainer.querySelectorAll('.playable-wrapper')[currentIndex];
    if (!wrapper) return;
    const likeEngBtn = wrapper.querySelector('.eng-btn[data-action="like"]');
    if (likeEngBtn) {
        likeEngBtn.classList.toggle('liked', isLiked);
        const icon = likeEngBtn.querySelector('.eng-icon');
        if (icon) icon.style.color = isLiked ? '#fe2c55' : '';
    }
}

export function updateRepostButton() {
    const currentItem = config.playables[currentIndex];
    if (!currentItem) return;
    const isReposted = repostedPlayables.has(currentItem.id);
    const wrapper = feedContainer.querySelectorAll('.playable-wrapper')[currentIndex];
    if (!wrapper) return;
    const repostBtn = wrapper.querySelector('.repost-btn');
    if (repostBtn) {
        repostBtn.style.color = isReposted ? '#00e676' : '#4CAF50';
        const countEl = repostBtn.querySelector('.repost-count');
        if (countEl) countEl.style.color = isReposted ? '#00e676' : '#4CAF50';
    }
}

export function animateHeart(x, y) {
    const heart = document.createElement('div');
    heart.className = 'floating-heart';
    heart.style.left = `${x}px`;
    heart.style.top = `${y}px`;
    document.body.appendChild(heart);
    setTimeout(() => heart.remove(), 1000);
}

// Overlay elemanlarına swipe ile scroll yapma (engBar, creatorDiv)
function addSwipeListeners(el) {
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
            if (deltaY < 0) scrollToIndex(currentIndex + 1);
            else scrollToIndex(currentIndex - 1);
        }
    }, { passive: true });
}

// ── Feed Init ────────────────────────────────────────────
export function initFeed() {
    config.playables.forEach((item, index) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'playable-wrapper';
        wrapper.dataset.index = index;

        // iframe
        const iframe = document.createElement('iframe');
        iframe.className = 'playable-iframe';
        if (index === 0) { iframe.src = item.path; showLoading(); }
        else { iframe.dataset.src = item.path; }
        iframe.allow = 'autoplay; fullscreen; clipboard-read; clipboard-write; gamepad; accelerometer; gyroscope';
        iframe.onload = () => {
            logDev(`Loaded: ${item.id}`);
            if (index === currentIndex) hideLoading();
            attachIframeListeners(iframe);
        };
        iframe.onerror = () => {
            logDev(`Error: ${item.id}`);
            if (index === currentIndex) hideLoading();
        };
        wrapper.appendChild(iframe);

        // engagement-bar
        const engBar = document.createElement('div');
        engBar.className = 'engagement-bar';
        engBar.innerHTML = `
            <div class="eng-left">
                <button class="eng-btn" data-action="like">
                    <span class="eng-icon">♥</span>
                    <span class="eng-count like-count">${item.likes || '0'}</span>
                </button>
                <button class="eng-btn" data-action="comment">
                    <span class="eng-icon">💬</span>
                    <span class="eng-count comment-count">${item.comments || '0'}</span>
                </button>
                <button class="eng-btn" data-action="save">
                    <span class="eng-icon">🔖</span>
                    <span class="eng-count save-count">Save</span>
                </button>
            </div>
            <div class="eng-right">
                <button class="eng-btn" data-action="screenshot">
                    <span class="eng-icon">⊙</span>
                </button>
                <button class="eng-btn" data-action="share">
                    <span class="eng-icon">↗</span>
                </button>
            </div>
        `;

        engBar.querySelector('.eng-btn[data-action="like"]').addEventListener('click', () => {
            setCurrentIndex(index);
            animateHeart(window.innerWidth / 2, window.innerHeight / 2);
            toggleLike();
        });
        engBar.querySelector('.eng-btn[data-action="comment"]').addEventListener('click', () => {
            showToast('Comments coming soon!');
        });
        engBar.querySelector('.eng-btn[data-action="share"]').addEventListener('click', () => {
            if (navigator.share) {
                navigator.share({ title: item.gameName, url: item.storeUrl || window.location.href });
            } else {
                showToast('Link copied!');
                navigator.clipboard?.writeText(item.storeUrl || window.location.href);
            }
        });
        wrapper.appendChild(engBar);

        // creator-info
        const creatorDiv = document.createElement('div');
        creatorDiv.className = 'creator-info';
        const avatarSrc = item.thumbnailUrl || item.thumbnail || '';
        const creatorHandle = `@${(item.creator || item.publisher || 'indie').replace(/\s+/g, '').toLowerCase()}`;
        const gameDesc = item.title || item.gameName || 'Indie Game';
        creatorDiv.innerHTML = `
            <div class="creator-left">
                <img class="creator-avatar" src="${avatarSrc}" alt="${creatorHandle}">
                <div class="creator-text">
                    <span class="creator-name">${creatorHandle}</span>
                    <span class="creator-desc">${gameDesc}</span>
                </div>
            </div>
            <div class="creator-right">
                <button class="repost-btn">
                    <span class="repost-icon">🔁</span>
                    <span class="repost-count">${item.reposts || '0'}</span>
                </button>
            </div>
        `;
        creatorDiv.querySelector('.repost-btn').addEventListener('click', () => {
            setCurrentIndex(index);
            toggleRepost();
        });
        wrapper.appendChild(creatorDiv);

        addSwipeListeners(engBar);
        addSwipeListeners(creatorDiv);
        feedContainer.appendChild(wrapper);
    });

    loadNearbyIframes(0);
    updateDevInfo();
}

// ── Scroll Detection ─────────────────────────────────────
export function attachScrollListener() {
    feedContainer.addEventListener('scroll', () => {
        if (scrollTimeout) clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            const height = feedContainer.clientHeight;
            const newIndex = Math.round(feedContainer.scrollTop / height);
            if (newIndex !== currentIndex) {
                setCurrentIndex(newIndex);
                updateDevInfo();
                updateLikeButton();
                updateRepostButton();
                showLoading();
                setTimeout(() => hideLoading(), 500);
                loadNearbyIframes(newIndex);
            }
        }, 50);
    });
}

// ── Double Tap to Like ───────────────────────────────────
export function attachDoubleTapLike() {
    let lastTap = 0;
    feedContainer.addEventListener('click', (e) => {
        const now = new Date().getTime();
        const tapLength = now - lastTap;
        if (tapLength < 300 && tapLength > 0) {
            animateHeart(e.clientX, e.clientY);
            toggleLike();
            e.preventDefault();
        }
        lastTap = now;
    });
}

// Expose feed API — kullanılan diğer modüller window üzerinden erişir (circular import önlenir)
window.__feedAPI__ = {
    scrollToIndex,
    scrollToNext: () => scrollToIndex(currentIndex + 1),
    scrollToPrev: () => scrollToIndex(currentIndex - 1),
};
