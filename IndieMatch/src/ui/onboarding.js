// src/ui/onboarding.js

import { scrollToIndex } from './feed.js';

export function showOnboarding() {
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

    if (mask) {
        mask.addEventListener('touchstart', dismiss, { passive: true });
        mask.addEventListener('click', dismiss);
    }

    if (content) {
        let obStartY = 0, obMoved = false;

        content.addEventListener('touchstart', (e) => {
            obStartY = e.touches[0].clientY;
            obMoved = false;
        }, { passive: true });

        content.addEventListener('touchmove', () => { obMoved = true; }, { passive: true });

        content.addEventListener('touchend', (e) => {
            const deltaY = e.changedTouches[0].clientY - obStartY;
            if (obMoved && Math.abs(deltaY) > 30) {
                scrollToIndex(deltaY < 0 ? 1 : -1);
            }
            dismiss();
        }, { passive: true });

        content.addEventListener('click', dismiss);
    }
}
