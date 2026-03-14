# IndieMatch-Antigravity — Proje Haritası

> Bu dosyayı oku → neyin nerede olduğunu anında bil, token harcama.

---

## Proje Yapısı

```
IndieMatch-Antigravity/
├── IndieMatch/          ← Web demo (Vite + Vanilla JS)
│   ├── index.html       ← Tek sayfa HTML shell (5 ekran + nav)
│   └── src/
│       ├── main.js      ← Orchestrator: sadece import + init (~45 satır)
│       ├── config.js    ← Oyun verisi: playables[], her oyunun id/path/meta
│       ├── state/
│       │   └── store.js         ← Tüm app state (index, liked, reposted, muted…)
│       ├── ui/
│       │   ├── feed.js          ← Feed init, item oluşturma, like/repost toggle, scroll
│       │   ├── profile.js       ← Profil grid, tab handler
│       │   ├── toast.js         ← showToast(msg)
│       │   ├── sound.js         ← toggleMute()
│       │   ├── devtools.js      ← logDev(), updateDevInfo(), showLoading/hideLoading
│       │   └── onboarding.js    ← showOnboarding() overlay
│       ├── nav/
│       │   └── tabs.js          ← switchTab(), switchFeedTab(), attachTabBarListeners()
│       ├── input/
│       │   └── pointer.js       ← touch/mouse/wheel handler'ları, swipe, iframe hook
│       ├── utils/
│       │   └── storage.js       ← localStorage: loadLikes/saveLikes/loadReposts/saveReposts
│       └── styles/
│           ├── base.css         ← Variables, reset, body, phone frame, screen system
│           ├── feed.css         ← Feed, iframe, engagement-bar, creator-info, edge-zones
│           ├── profile.css      ← Profil header, stats, video grid, empty state
│           ├── tabs.css         ← Bottom tab bar, placeholder screens
│           └── overlay.css      ← Spinner, toast, floating-heart, onboarding
│
├── IndieMatchRN/        ← React Native / Expo app
│   ├── App.js           ← Uygulama giriş noktası
│   ├── index.js         ← Expo register
│   └── src/
│       ├── components/  ← FeedItem, PlayableCard, Toast
│       ├── screens/     ← FeedScreen, ProfileScreen
│       ├── data/        ← playables.js (RN verisi)
│       ├── utils/       ← assetHelper.js, messageBridge.js
│       └── storage/     ← index.js (AsyncStorage)
├── IndieMatchRN/assets/
│   ├── playables/       ← p1/, p2/, p4/ + webapp/ (inline game HTML'leri)
│   └── thumbnails/      ← Oyun kapak görselleri
│
└── PROJECT_MAP.md       ← Bu dosya
```

---

## Hangi Dosyada Ne Yaparsın?

| Görev | Dosya |
|---|---|
| Yeni oyun ekle | `IndieMatch/src/config.js` |
| Feed davranışı / like-repost | `src/ui/feed.js` |
| Profil ekranı | `src/ui/profile.js` |
| Tab navigasyonu | `src/nav/tabs.js` |
| Toast mesajı | `src/ui/toast.js` |
| Ses kontrolü | `src/ui/sound.js` |
| Touch/swipe/scroll input | `src/input/pointer.js` |
| LocalStorage okuma/yazma | `src/utils/storage.js` |
| Global state değişkenleri | `src/state/store.js` |
| HTML yapısı / ekranlar | `IndieMatch/index.html` |
| Genel stil (renk, font) | `src/styles/base.css` |
| Feed görünümü | `src/styles/feed.css` |
| Profil görünümü | `src/styles/profile.css` |
| Tab bar görünümü | `src/styles/tabs.css` |
| Overlay / animasyon | `src/styles/overlay.css` |
| RN feed bileşeni | `IndieMatchRN/src/components/FeedItem.js` |
| RN feed ekranı | `IndieMatchRN/src/screens/FeedScreen.js` |
| RN oyun varlık yönetimi | `IndieMatchRN/src/utils/assetHelper.js` |

---

## Geliştirme Komutları

```bash
# Web projesini başlat
cd IndieMatch && npm run dev

# RN / Expo projesini başlat
cd IndieMatchRN && npx expo start
```
