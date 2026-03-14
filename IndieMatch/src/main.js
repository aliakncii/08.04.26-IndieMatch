// src/main.js
// Orchestrator — sadece modülleri import eder ve uygulamayı başlatır.

import { config } from './config.js';
import { loadLikes, loadReposts } from './utils/storage.js';
import { updateLikeButton, updateRepostButton, initFeed, attachScrollListener, attachDoubleTapLike } from './ui/feed.js';
import { updateProfileGrid, attachProfileTabListeners } from './ui/profile.js';
import { switchFeedTab, attachTabBarListeners } from './nav/tabs.js';
import { attachEdgeListeners, attachMouseListeners } from './input/pointer.js';
import { showOnboarding } from './ui/onboarding.js';
import { toggleMute } from './ui/sound.js';

// CSS
import './styles/base.css';
import './styles/feed.css';
import './styles/profile.css';
import './styles/tabs.css';
import './styles/overlay.css';

// ── Sound ────────────────────────────────────────────────
const soundBtn = document.getElementById('sound-control');
soundBtn.addEventListener('click', toggleMute);

// ── Feed Tabs (Following / For You header) ───────────────
const tabFollowing = document.getElementById('tab-following');
const tabForYou = document.getElementById('tab-foryou');
tabFollowing.addEventListener('click', () => switchFeedTab('following'));
tabForYou.addEventListener('click', () => switchFeedTab('foryou'));

// ── Boot Sequence ────────────────────────────────────────
loadLikes();
loadReposts();

initFeed();
attachScrollListener();
attachDoubleTapLike();

updateLikeButton();
updateRepostButton();
updateProfileGrid();

attachEdgeListeners();
attachMouseListeners();
attachTabBarListeners();
attachProfileTabListeners();

showOnboarding();
