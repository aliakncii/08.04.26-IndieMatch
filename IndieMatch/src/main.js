import { config } from './config.js';
import './style.css';

const feedContainer = document.getElementById('feed-container');
const toastEl = document.getElementById('toast');
const edgeLeft = document.getElementById('edge-zone-left');
const edgeRight = document.getElementById('edge-zone-right');

// Dev Panel Elements
const devInfo = document.getElementById('dev-info');
const devLog = document.getElementById('dev-log');
const soundBtn = document.getElementById('sound-control');
const tabFollowing = document.getElementById('tab-following');
const tabForYou = document.getElementById('tab-foryou');
const profileTabs = document.querySelectorAll('.profile-tabs .tab');

let isMuted = true; // Start muted by default (modern browser policy friendly)

let currentIndex = 0;
let isScrolling = false;
let scrollTimeout = null;

// Likes & Reposts State Management
let likedPlayables = new Set();
let repostedPlayables = new Set();
let currentProfileTab = 'likes';

// Load likes from localStorage
function loadLikes() {
    try {
        const stored = localStorage.getItem('indieMatchLikes');
        if (stored) {
            const parsed = JSON.parse(stored);
            likedPlayables = new Set(parsed);
            logDev(`Loaded ${likedPlayables.size} likes`);
        }
    } catch (e) {
        console.error('Error loading likes:', e);
    }
}

// Save likes to localStorage
function saveLikes() {
    try {
        const array = Array.from(likedPlayables);
        localStorage.setItem('indieMatchLikes', JSON.stringify(array));
    } catch (e) {
        console.error('Error saving likes:', e);
    }
}

// Load reposts from localStorage
function loadReposts() {
    try {
        const stored = localStorage.getItem('indieMatchReposts');
        if (stored) {
            const parsed = JSON.parse(stored);
            repostedPlayables = new Set(parsed);
            logDev(`Loaded ${repostedPlayables.size} reposts`);
        }
    } catch (e) {
        console.error('Error loading reposts:', e);
    }
}

// Save reposts to localStorage
function saveReposts() {
    try {
        const array = Array.from(repostedPlayables);
        localStorage.setItem('indieMatchReposts', JSON.stringify(array));
    } catch (e) {
        console.error('Error saving reposts:', e);
    }
}

// Toggle like for the current playable (looks up the active wrapper)
function toggleLike() {
    const currentItem = config.playables[currentIndex];
    if (!currentItem) return;

    const isLiked = likedPlayables.has(currentItem.id);

    if (isLiked) {
        likedPlayables.delete(currentItem.id);
        showToast('Unliked!');
    } else {
        likedPlayables.add(currentItem.id);
        showToast('Liked!');
    }

    saveLikes();
    updateLikeButton();
    updateProfileGrid();
}

// Toggle repost for the current playable
function toggleRepost() {
    const currentItem = config.playables[currentIndex];
    if (!currentItem) return;

    const isReposted = repostedPlayables.has(currentItem.id);

    if (isReposted) {
        repostedPlayables.delete(currentItem.id);
        showToast('Removed Repost');
    } else {
        repostedPlayables.add(currentItem.id);
        showToast('Reposted!');
    }

    saveReposts();
    updateRepostButton();
    updateProfileGrid();
}

// Update like button appearance on the active wrapper
function updateLikeButton() {
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

// Update repost button appearance on the active wrapper
function updateRepostButton() {
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

function logDev(msg) {
    devLog.textContent = msg;
    console.log('[Dev]', msg);
    setTimeout(() => { if (devLog.textContent === msg) devLog.textContent = '-'; }, 3000);
}

function updateDevInfo() {
    const item = config.playables[currentIndex];
    devInfo.innerHTML = `Idx: ${currentIndex} <br> ID: ${item?.id} <br> Path: ${item?.path}`;
}

const loadingOverlay = document.getElementById('loading-overlay');

function showLoading() {
    loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
    loadingOverlay.classList.add('hidden');
}

// Update Profile Grid (Likes or Reposts)
function updateProfileGrid() {
    const gridContainer = document.querySelector('.video-grid');
    if (!gridContainer) return;

    // Clear existing items
    gridContainer.innerHTML = '';

    const sourceSet = currentProfileTab === 'likes' ? likedPlayables : repostedPlayables;
    const emptyMsg = currentProfileTab === 'likes' ? 'No likes yet' : 'No reposts yet';
    const emptySub = currentProfileTab === 'likes' ? 'Like playables to see them here' : 'Repost playables to see them here';

    // If no items, show empty state
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

    // Add items to grid
    sourceSet.forEach(playableId => {
        const playable = config.playables.find(p => p.id === playableId);
        if (!playable) return;

        const gridItem = document.createElement('div');
        gridItem.className = 'grid-item';
        gridItem.dataset.playableId = playableId;

        // Use thumbnail as background if available
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

        // Click handler to navigate to that playable
        gridItem.addEventListener('click', () => {
            const index = config.playables.findIndex(p => p.id === playableId);
            if (index !== -1) {
                scrollToIndex(index);
                switchTab('screen-indie'); // Go back to feed
                showToast(`Playing ${playable.gameName || playable.id}`);
            }
        });

        gridContainer.appendChild(gridItem);
    });
}

// ══════════════════════════════════════════════════════
//  BOTTOM TAB NAVIGATION
// ══════════════════════════════════════════════════════

let activeScreen = 'screen-indie';

function switchTab(screenId) {
    // Hide all screens
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    // Remove active from all tab items
    document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));

    // Show target screen
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) targetScreen.classList.add('active');

    // Activate matching tab item
    const matchingTab = document.querySelector(`.tab-item[data-screen="${screenId}"]`);
    if (matchingTab) matchingTab.classList.add('active');

    activeScreen = screenId;
    logDev(`Tab: ${screenId}`);
}

function attachTabBarListeners() {
    document.querySelectorAll('.tab-item').forEach(tabItem => {
        tabItem.addEventListener('click', () => {
            const screenId = tabItem.dataset.screen;
            if (screenId) switchTab(screenId);
        });
    });
}

// ══════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════

// Initialize Feed
function init() {
    config.playables.forEach((item, index) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'playable-wrapper';
        wrapper.dataset.index = index;

        // ── iframe ──────────────────────────────────────────
        const iframe = document.createElement('iframe');
        iframe.className = 'playable-iframe';
        if (index === 0) {
            iframe.src = item.path;
            showLoading();
        } else {
            iframe.dataset.src = item.path; // Lazy
        }
        iframe.allow = 'autoplay; fullscreen; clipboard-read; clipboard-write; gamepad; accelerometer; gyroscope';
        iframe.onload = () => {
            logDev(`Loaded: ${item.id}`);
            if (index === currentIndex) hideLoading();
            attachIframeListeners(iframe);
        };
        iframe.onerror = (e) => {
            logDev(`Error: ${item.id}`);
            console.error('Iframe Error', e);
            if (index === currentIndex) hideLoading();
        };
        wrapper.appendChild(iframe);

        // ── engagement-bar ───────────────────────────────────
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

        // Like button handler
        const likeEngBtn = engBar.querySelector('.eng-btn[data-action="like"]');
        likeEngBtn.addEventListener('click', () => {
            currentIndex = index;
            animateHeart(window.innerWidth / 2, window.innerHeight / 2);
            toggleLike();
        });

        // Comment button handler
        engBar.querySelector('.eng-btn[data-action="comment"]').addEventListener('click', () => {
            showToast('Comments coming soon!');
        });

        // Share button handler
        engBar.querySelector('.eng-btn[data-action="share"]').addEventListener('click', () => {
            if (navigator.share) {
                navigator.share({ title: item.gameName, url: item.storeUrl || window.location.href });
            } else {
                showToast('Link copied!');
                navigator.clipboard?.writeText(item.storeUrl || window.location.href);
            }
        });

        wrapper.appendChild(engBar);

        // ── creator-info ─────────────────────────────────────
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

        // Repost button handler
        const repostBtnEl = creatorDiv.querySelector('.repost-btn');
        repostBtnEl.addEventListener('click', () => {
            currentIndex = index;
            toggleRepost();
        });

        wrapper.appendChild(creatorDiv);

        addSwipeListeners(engBar);
        addSwipeListeners(creatorDiv);

        feedContainer.appendChild(wrapper);
    });

    loadNearbyIframes(0);
    updateDevInfo();

    loadLikes();
    loadReposts();
    updateLikeButton();
    updateRepostButton();
    updateProfileGrid();

    // Attach listeners
    attachEdgeListeners();
    attachUIListeners();
    attachTabBarListeners();
    showOnboarding();
}

function attachUIListeners() {
    // Sound Toggle
    soundBtn.addEventListener('click', toggleMute);

    // Tab Switching (Following/ForYou header tabs)
    tabFollowing.addEventListener('click', () => switchFeedTab('following'));
    tabForYou.addEventListener('click', () => switchFeedTab('foryou'));

    // Profile Tabs (Likes / Reposts)
    profileTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            profileTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentProfileTab = tab.dataset.tab;
            updateProfileGrid();
        });
    });

    // Double Tap on Feed → like current playable
    let lastTap = 0;
    feedContainer.addEventListener('click', (e) => {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTap;
        if (tapLength < 300 && tapLength > 0) {
            animateHeart(e.clientX, e.clientY);
            toggleLike();
            e.preventDefault();
        }
        lastTap = currentTime;
    });
}

function toggleMute() {
    isMuted = !isMuted;
    soundBtn.innerHTML = isMuted ? '<span class="sound-icon">🔇</span>' : '<span class="sound-icon">🔊</span>';
    logDev(`Sound: ${isMuted ? 'OFF' : 'ON'}`);

    const wrappers = document.querySelectorAll('.playable-wrapper iframe');
    wrappers.forEach(iframe => {
        if (iframe.contentWindow) {
            iframe.contentWindow.postMessage({ type: 'mute', value: isMuted }, '*');
        }
    });
}

function switchFeedTab(tab) {
    if (tab === 'following') {
        tabFollowing.classList.add('active');
        tabFollowing.classList.remove('inactive');
        tabForYou.classList.add('inactive');
        tabForYou.classList.remove('active');
        showToast("Switched to Following");
    } else {
        tabForYou.classList.add('active');
        tabForYou.classList.remove('inactive');
        tabFollowing.classList.add('inactive');
        tabFollowing.classList.remove('active');
        showToast("Back to For You");
    }
}

function animateHeart(x, y) {
    const heart = document.createElement('div');
    heart.className = 'floating-heart';
    heart.style.left = `${x}px`;
    heart.style.top = `${y}px`;
    document.body.appendChild(heart);

    setTimeout(() => {
        heart.remove();
    }, 1000);
}

// Lazy Loading / Preloading
function loadNearbyIframes(index) {
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

// Scroll Snap Detection
feedContainer.addEventListener('scroll', (e) => {
    if (scrollTimeout) clearTimeout(scrollTimeout);

    scrollTimeout = setTimeout(() => {
        const height = feedContainer.clientHeight;
        const scrollPos = feedContainer.scrollTop;
        const newIndex = Math.round(scrollPos / height);

        if (newIndex !== currentIndex) {
            currentIndex = newIndex;
            updateDevInfo();
            updateLikeButton();
            updateRepostButton();
            showLoading();

            setTimeout(() => hideLoading(), 500);

            loadNearbyIframes(newIndex);
        }
    }, 50);
});

// Toast Helper
function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.remove('hidden');
    void toastEl.offsetWidth;
    toastEl.classList.add('visible');

    setTimeout(() => {
        toastEl.classList.remove('visible');
        setTimeout(() => {
            toastEl.classList.add('hidden');
        }, 300);
    }, 2000);
}

// ══════════════════════════════════════════════════════
//  POINTER / TOUCH HANDLERS (Vertical feed only)
// ══════════════════════════════════════════════════════

let touchStartX = 0;
let touchStartY = 0;
let isDragging = false;
let activeFrame = null;

// Mouse Support for Desktop
function attachMouseListeners() {
    const container = document.getElementById('app');

    container.addEventListener('mousedown', (e) => {
        handlePointerStart(e);
    });

    window.addEventListener('mousemove', (e) => {
        handlePointerMove(e);
    });

    window.addEventListener('mouseup', (e) => {
        handlePointerEnd(e);
    });

    // Trackpad / Wheel — vertical only, horizontal swipe disabled
    window.addEventListener('wheel', handleWheel, { passive: false });
}

function handleWheel(e) {
    // Only handle vertical scroll — horizontal swipe is disabled (no profile swipe)
    // Let natural vertical scrolling work on the feed
    // Block horizontal to prevent browser back gesture
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 2) {
        e.preventDefault(); // Block horizontal browser gesture only
        e.stopPropagation();
    }
    // Vertical scrolling passes through naturally to feed-container
}

// Unified Pointer Handler
function getPointerPos(e) {
    if (e.touches && e.touches.length > 0) {
        return { x: e.touches[0].screenX, y: e.touches[0].screenY };
    }
    return { x: e.screenX, y: e.screenY };
}

function handleTouchStart(e, sourceFrame = null) {
    handlePointerStart(e, sourceFrame);
}

function handlePointerStart(e, sourceFrame = null) {
    isDragging = true;
    activeFrame = sourceFrame;

    const pos = getPointerPos(e);
    touchStartX = pos.x;
    touchStartY = pos.y;

    feedContainer.style.scrollSnapType = 'none';
    feedContainer.style.scrollBehavior = 'auto';
}

function handleTouchMove(e) {
    handlePointerMove(e);
}

function handlePointerMove(e) {
    if (!isDragging) return;
    if (!e.touches && e.buttons === 0) {
        isDragging = false;
        return;
    }
    // Navigation via two-finger scroll only — no drag-based nav
}

function handlePointerEnd(e) {
    if (!isDragging) return;
    isDragging = false;
    activeFrame = null;

    feedContainer.style.scrollSnapType = 'y mandatory';
    feedContainer.style.scrollBehavior = 'smooth';

    touchStartX = 0;
    touchStartY = 0;
}

function scrollToNext() { scrollToIndex(currentIndex + 1); }
function scrollToPrev() { scrollToIndex(currentIndex - 1); }

function addSwipeListeners(el) {
    let startY = 0;
    let startTime = 0;
    let moved = false;

    el.addEventListener('touchstart', (e) => {
        startY = e.touches[0].clientY;
        startTime = Date.now();
        moved = false;
    }, { passive: true });

    el.addEventListener('touchmove', () => {
        moved = true;
    }, { passive: true });

    el.addEventListener('touchend', (e) => {
        if (!moved) return; // tap, not swipe
        const deltaY = e.changedTouches[0].clientY - startY;
        if (Math.abs(deltaY) > 30 && (Date.now() - startTime) < 600) {
            if (deltaY < 0) scrollToIndex(currentIndex + 1);
            else scrollToIndex(currentIndex - 1);
        }
    }, { passive: true });
}

// Inject listeners into Iframe
function attachIframeListeners(iframe) {
    try {
        const iWindow = iframe.contentWindow;
        if (!iWindow) return;

        logDev("Attaching Touch Hooks");

        const opts = { capture: true, passive: false };

        iWindow.addEventListener('touchstart', (e) => {
            handleTouchStart(e, iframe);
        }, opts);

        iWindow.addEventListener('touchmove', (e) => {
            handleTouchMove(e);
        }, opts);

        iWindow.addEventListener('touchend', (e) => handlePointerEnd(e), opts);

        iWindow.addEventListener('pointerdown', (e) => {
            handleTouchStart(e, iframe);
        }, opts);
        iWindow.addEventListener('pointermove', (e) => {
            handleTouchMove(e);
        }, opts);
        iWindow.addEventListener('pointerup', (e) => handlePointerEnd(e), opts);

        iWindow.addEventListener('wheel', (e) => {
            handleWheel(e);
        }, opts);

    } catch (err) {
        console.error("Cannot access iframe", err);
        logDev("X-Origin Error?");
    }
}

// Edge Swipe Logic
function attachEdgeListeners() {
    [edgeLeft, edgeRight].forEach(zone => {
        const opts = { passive: false };
        zone.addEventListener('touchstart', (e) => handleTouchStart(e, null), opts);
        zone.addEventListener('touchmove', handleTouchMove, opts);
        zone.addEventListener('touchend', handlePointerEnd, opts);
    });
}

function scrollToIndex(index) {
    if (index < 0 || index >= config.playables.length) return;
    feedContainer.scrollTo({
        top: index * feedContainer.clientHeight,
        behavior: 'smooth'
    });
    currentIndex = index;
    loadNearbyIframes(index);
}

function showOnboarding() {
    const key = 'indie_onboarded';
    if (localStorage.getItem(key)) return;

    const overlay = document.getElementById('onboarding-overlay');
    if (!overlay) return;

    const mask = document.getElementById('onboarding-mask');
    const content = document.getElementById('onboarding-content');

    function dismiss() {
        overlay.style.transition = 'opacity 0.4s';
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 400);
        localStorage.setItem(key, '1');
    }

    // Tap on the dark mask area → just dismiss
    if (mask) {
        mask.addEventListener('touchstart', dismiss, { passive: true });
        mask.addEventListener('click', dismiss);
    }

    // Swipe from the highlighted bottom area → navigate + dismiss
    if (content) {
        let obStartY = 0;
        let obMoved = false;

        content.addEventListener('touchstart', (e) => {
            obStartY = e.touches[0].clientY;
            obMoved = false;
        }, { passive: true });

        content.addEventListener('touchmove', () => {
            obMoved = true;
        }, { passive: true });

        content.addEventListener('touchend', (e) => {
            const deltaY = e.changedTouches[0].clientY - obStartY;
            if (obMoved && Math.abs(deltaY) > 30) {
                if (deltaY < 0) scrollToIndex(currentIndex + 1);
                else scrollToIndex(currentIndex - 1);
            }
            dismiss();
        }, { passive: true });

        // Click/tap on content area also dismisses
        content.addEventListener('click', dismiss);
    }
}

init();
attachMouseListeners();
