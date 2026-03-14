// src/screens/FeedScreen.js
// Main feed screen with bottom tab bar.
// Key behaviors:
//  - FlatList with pagingEnabled, snaps to ITEM_HEIGHT (screen minus tab bar)
//  - Windowed WebView: only mounts prev/current/next WebViews (max 3 at a time)
//  - Right-swipe gesture (from left edge) opens Profile screen
//  - Mute state is broadcast to all mounted WebViews
//  - Likes/Reposts persisted via AsyncStorage
//  - Bottom tab bar with 5 tabs (Rewarded/Mesaj/Keşfet/Profil show placeholder screens)

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    FlatList,
    PanResponder,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

import FeedItem, { TAB_BAR_HEIGHT, ITEM_HEIGHT } from '../components/FeedItem';
import { playables } from '../data/playables';
import { loadLikes, saveLikes, loadReposts, saveReposts } from '../storage';
import { getPlayableUri } from '../utils/assetHelper';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// How far to the side of center each WebView window extends
const WINDOW_SIZE = 1; // prev + current + next = 3 mounted

// ── Tab bar configuration ─────────────────────────────────────────────────────
const TABS = [
    { id: 'indie',    label: 'Indie',    icon: '⌂' },
    { id: 'rewarded', label: 'Rewarded', icon: '★' },
    { id: 'mesaj',    label: 'Mesaj',    icon: '💬' },
    { id: 'kesfet',   label: 'Keşfet',   icon: '📍' },
    { id: 'profil',   label: 'Profil',   icon: '👤' },
];

const PLACEHOLDER_SCREENS = {
    rewarded: { icon: '★',  title: 'Rewarded',  sub: 'Kazandığın ödüller burada görünecek.' },
    mesaj:    { icon: '💬', title: 'Mesajlar',  sub: 'Mesajlarını burada görebilirsin.' },
    kesfet:   { icon: '📍', title: 'Keşfet',    sub: 'Yeni indie oyunları keşfet.' },
    profil:   { icon: '👤', title: 'Profil',    sub: 'Profilini burada düzenleyebilirsin.' },
};

// ── Bottom tab bar component ──────────────────────────────────────────────────
function BottomTabBar({ activeTab, onPress }) {
    return (
        <View style={tabStyles.bar}>
            {TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                const isIndie = tab.id === 'indie';
                return (
                    <TouchableOpacity
                        key={tab.id}
                        style={tabStyles.item}
                        onPress={() => onPress(tab.id)}
                        activeOpacity={0.7}
                    >
                        <Text style={[
                            tabStyles.icon,
                            isActive && (isIndie ? tabStyles.indieActive : tabStyles.active),
                        ]}>
                            {tab.icon}
                        </Text>
                        <Text style={[
                            tabStyles.label,
                            isActive && (isIndie ? tabStyles.indieActive : tabStyles.active),
                        ]}>
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

// ── Placeholder screen for non-feed tabs ─────────────────────────────────────
function PlaceholderScreen({ id }) {
    const cfg = PLACEHOLDER_SCREENS[id];
    return (
        <View style={placeholderStyles.container}>
            <Text style={placeholderStyles.icon}>{cfg.icon}</Text>
            <Text style={placeholderStyles.title}>{cfg.title}</Text>
            <Text style={placeholderStyles.sub}>{cfg.sub}</Text>
            <View style={placeholderStyles.badge}>
                <Text style={placeholderStyles.badgeText}>Yakında</Text>
            </View>
        </View>
    );
}

// ── Onboarding overlay ────────────────────────────────────────────────────────
// Shown once on first open.
// Layout:
//   - Dark mask covers the game area (everything ABOVE the engagement+creator bars)
//   - Cyan highlighted box sits exactly ON TOP OF the engagement+creator bars
const ENG_BAR_H = 48;
const CREATOR_BAR_H = 52;
const HINT_HEIGHT = ENG_BAR_H + CREATOR_BAR_H; // 100px — covers the two bottom bars
const MASK_HEIGHT = ITEM_HEIGHT - HINT_HEIGHT;  // game area above the bars

function OnboardingOverlay({ onDismiss }) {
    const bounceAnim = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(bounceAnim, { toValue: -10, duration: 500, useNativeDriver: true }),
                Animated.timing(bounceAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
            ])
        ).start();
    }, []);

    function dismiss() {
        Animated.timing(fadeAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start(onDismiss);
    }

    return (
        <Animated.View style={[onboardingStyles.container, { opacity: fadeAnim }]} pointerEvents="box-none">
            {/* Dark mask over the game (top portion) */}
            <TouchableOpacity
                style={[onboardingStyles.mask, { height: MASK_HEIGHT }]}
                activeOpacity={1}
                onPress={dismiss}
            />

            {/* Cyan highlighted box — overlays engagement + creator bars */}
            <TouchableOpacity
                style={[onboardingStyles.hintBox, { height: HINT_HEIGHT }]}
                activeOpacity={1}
                onPress={dismiss}
            >
                <Animated.Text
                    style={[onboardingStyles.hand, { transform: [{ translateY: bounceAnim }] }]}
                >
                    👆
                </Animated.Text>
                <Text style={onboardingStyles.text}>
                    Swipe up <Text style={onboardingStyles.only}>only</Text> in this area
                </Text>
            </TouchableOpacity>
        </Animated.View>
    );
}

// ── Main FeedScreen ───────────────────────────────────────────────────────────
export default function FeedScreen({ navigation }) {
    const [activeTab, setActiveTab] = useState('indie');
    const [showOnboarding, setShowOnboarding] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isMuted, setIsMuted] = useState(true);
    const [likedSet, setLikedSet] = useState(new Set());
    const [repostedSet, setRepostedSet] = useState(new Set());
    const [toastMsg, setToastMsg] = useState('');
    const [toastVisible, setToastVisible] = useState(false);
    const toastTimerRef = useRef(null);

    const webViewRefs = useRef({});
    const flatListRef = useRef(null);
    const currentIndexRef = useRef(0);

    // ── Load persisted data on mount ──────────────────────────────────────────
    useEffect(() => {
        (async () => {
            const [likes, reposts] = await Promise.all([loadLikes(), loadReposts()]);
            setLikedSet(likes);
            setRepostedSet(reposts);
        })();
    }, []);

    // ── Navigate back from Profile → scroll to chosen item ───────────────────
    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            const params = navigation.getState()?.routes?.find(r => r.name === 'Feed')?.params;
            if (params?.scrollToIndex !== undefined) {
                const idx = params.scrollToIndex;
                flatListRef.current?.scrollToIndex({ index: idx, animated: false });
                setCurrentIndex(idx);
                currentIndexRef.current = idx;
                navigation.setParams({ scrollToIndex: undefined });
            }
        });
        return unsubscribe;
    }, [navigation]);

    // ── Toast helper ──────────────────────────────────────────────────────────
    function showToast(msg) {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setToastMsg(msg);
        setToastVisible(true);
        toastTimerRef.current = setTimeout(() => setToastVisible(false), 2300);
    }

    // ── Sound toggle ──────────────────────────────────────────────────────────
    function toggleMute() {
        setIsMuted((prev) => {
            const next = !prev;
            Object.values(webViewRefs.current).forEach((ref) => {
                ref?.injectJavaScript?.(`window.postMessage(${JSON.stringify({ type: 'mute', value: next })}, '*'); true;`);
            });
            return next;
        });
    }

    // ── Like / Repost ─────────────────────────────────────────────────────────
    function toggleLike() {
        const item = playables[currentIndexRef.current];
        if (!item) return;
        setLikedSet((prev) => {
            const next = new Set(prev);
            if (next.has(item.id)) { next.delete(item.id); showToast('Unliked!'); }
            else { next.add(item.id); showToast('Liked!'); }
            saveLikes(next);
            return next;
        });
    }

    function toggleRepost() {
        const item = playables[currentIndexRef.current];
        if (!item) return;
        setRepostedSet((prev) => {
            const next = new Set(prev);
            if (next.has(item.id)) { next.delete(item.id); showToast('Removed Repost'); }
            else { next.add(item.id); showToast('Reposted!'); }
            saveReposts(next);
            return next;
        });
    }

    // ── Viewability → update currentIndex ────────────────────────────────────
    const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 });
    const onViewableItemsChanged = useCallback(({ viewableItems }) => {
        if (viewableItems.length > 0) {
            const idx = viewableItems[0].index ?? 0;
            setCurrentIndex(idx);
            currentIndexRef.current = idx;
        }
    }, []);

    // ── Right-swipe PanResponder (left-edge → open Profile) ──────────────────
    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (evt, gestureState) => {
                const { dx, dy, moveX } = gestureState;
                return moveX < SCREEN_WIDTH * 0.25 && dx > 20 && Math.abs(dy) < 40;
            },
            onPanResponderRelease: (evt, gestureState) => {
                if (gestureState.dx > 60) {
                    navigation.navigate('Profile', { currentIndex: currentIndexRef.current });
                }
            },
        })
    ).current;

    // ── Render each feed item ─────────────────────────────────────────────────
    const getItemLayout = useCallback(
        (_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index }),
        []
    );

    const renderItem = useCallback(
        ({ item, index }) => {
            const isMounted = Math.abs(index - currentIndex) <= WINDOW_SIZE;
            const isActive = index === currentIndex;
            const uri = isMounted ? getPlayableUri(item.localPath) : null;

            if (!webViewRefs.current[index]) {
                webViewRefs.current[index] = React.createRef();
            }

            return (
                <FeedItem
                    item={item}
                    isActive={isActive}
                    isMounted={isMounted}
                    isMuted={isMuted}
                    isLiked={likedSet.has(item.id)}
                    isReposted={repostedSet.has(item.id)}
                    uri={uri}
                    webViewRef={webViewRefs.current[index]}
                    onLike={toggleLike}
                    onRepost={toggleRepost}
                    onSoundToggle={toggleMute}
                    toastMsg={isActive ? toastMsg : ''}
                    toastVisible={isActive ? toastVisible : false}
                    onNavigateProfile={() =>
                        navigation.navigate('Profile', { currentIndex })
                    }
                />
            );
        },
        [currentIndex, isMuted, likedSet, repostedSet, toastMsg, toastVisible]
    );

    return (
        <View style={styles.container} {...panResponder.panHandlers}>
            {/* ── Feed or placeholder screen ─────────────────────────────── */}
            {activeTab === 'indie' ? (
                <FlatList
                    ref={flatListRef}
                    data={playables}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    getItemLayout={getItemLayout}
                    pagingEnabled
                    showsVerticalScrollIndicator={false}
                    bounces={false}
                    decelerationRate="fast"
                    snapToInterval={ITEM_HEIGHT}
                    snapToAlignment="start"
                    viewabilityConfig={viewabilityConfig.current}
                    onViewableItemsChanged={onViewableItemsChanged}
                    windowSize={3}
                    maxToRenderPerBatch={1}
                    initialNumToRender={1}
                    removeClippedSubviews={false}
                    style={{ height: ITEM_HEIGHT }}
                />
            ) : (
                <View style={styles.placeholderWrapper}>
                    <PlaceholderScreen id={activeTab} />
                </View>
            )}

            {/* ── Onboarding overlay (shown once on first open) ─────────── */}
            {activeTab === 'indie' && showOnboarding && (
                <View style={styles.onboardingWrapper} pointerEvents="box-none">
                    <OnboardingOverlay onDismiss={() => setShowOnboarding(false)} />
                </View>
            )}

            {/* ── Bottom tab bar ─────────────────────────────────────────── */}
            <BottomTabBar activeTab={activeTab} onPress={setActiveTab} />
        </View>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    placeholderWrapper: {
        height: ITEM_HEIGHT,
        backgroundColor: '#000',
    },
    onboardingWrapper: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        // Covers full feed item: game + engagement + creator bars (NOT the tab bar)
        height: ITEM_HEIGHT,
        zIndex: 100,
    },
});

const tabStyles = StyleSheet.create({
    bar: {
        height: TAB_BAR_HEIGHT,
        backgroundColor: '#111',
        borderTopWidth: 1,
        borderTopColor: '#222',
        flexDirection: 'row',
        alignItems: 'stretch',
    },
    item: {
        flex: 1,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
    },
    icon: {
        fontSize: 20,
        color: '#555',
    },
    label: {
        fontSize: 10,
        fontWeight: '500',
        color: '#555',
        letterSpacing: 0.2,
    },
    active: {
        color: '#ffffff',
    },
    indieActive: {
        color: '#fe2c55',
    },
});

const placeholderStyles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    icon: {
        fontSize: 48,
        color: '#555',
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        color: 'white',
    },
    sub: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        paddingHorizontal: 32,
    },
    badge: {
        marginTop: 8,
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: '#222',
        borderWidth: 1,
        borderColor: '#333',
    },
    badgeText: {
        fontSize: 12,
        color: '#888',
        fontWeight: '600',
    },
});

const onboardingStyles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 100,
    },
    // Dark translucent mask covering the upper game area
    mask: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.88)',
    },
    // Highlighted strip at bottom of the game area (the swipe zone)
    hintBox: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        borderWidth: 2,
        borderColor: 'cyan',
        borderRadius: 12,
        backgroundColor: 'rgba(0,255,255,0.05)',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    hand: {
        fontSize: 32,
    },
    text: {
        color: 'white',
        fontSize: 15,
        fontWeight: '700',
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    only: {
        color: 'cyan',
    },
});
