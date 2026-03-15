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
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import FeedItem, { TAB_BAR_HEIGHT, ITEM_HEIGHT } from '../components/FeedItem';
import ProfileScreen from './ProfileScreen';
import HomeFeedScreen from './HomeFeedScreen';
import { playables } from '../data/playables';
import { loadLikes, saveLikes, loadReposts, saveReposts, loadSaved, saveSaved } from '../storage';
import { getPlayableUri } from '../utils/assetHelper';

const ONBOARDING_KEY = 'onboarding_swipe_seen';

const {} = Dimensions.get('window');

// How far to the side of center each WebView window extends
const WINDOW_SIZE = 1; // prev + current + next = 3 mounted

const SIMPLE_PLACEHOLDERS = {
    kesfet: { icon: '📍', title: 'Keşfet', sub: 'Yeni indie oyunları keşfet.' },
    profil: { icon: '👤', title: 'Profil', sub: 'Profilini burada düzenleyebilirsin.' },
};

// ── Bottom tab bar component ──────────────────────────────────────────────────
function BottomTabBar({ activeTab, onPress }) {
    const c = (id) => activeTab === id ? '#ffffff' : 'rgba(255,255,255,0.5)';
    return (
        <View style={tabStyles.bar}>
            {/* Slot 0: Home */}
            <TouchableOpacity style={tabStyles.item} onPress={() => onPress('home')} activeOpacity={0.7}>
                <Feather name="home" size={26} color={c('home')} />
            </TouchableOpacity>

            {/* Slot 1: Playable feed */}
            <TouchableOpacity style={tabStyles.item} onPress={() => onPress('indie')} activeOpacity={0.7}>
                <Feather name="play-circle" size={26} color={c('indie')} />
            </TouchableOpacity>

            {/* Slot 2: Mesaj */}
            <TouchableOpacity style={tabStyles.item} onPress={() => onPress('mesaj')} activeOpacity={0.7}>
                <Feather name="message-circle" size={26} color={c('mesaj')} />
            </TouchableOpacity>

            {/* Slot 3: Keşfet */}
            <TouchableOpacity style={tabStyles.item} onPress={() => onPress('kesfet')} activeOpacity={0.7}>
                <Feather name="search" size={26} color={c('kesfet')} />
            </TouchableOpacity>

            {/* Slot 4: Profil + red dot badge */}
            <TouchableOpacity style={tabStyles.item} onPress={() => onPress('profil')} activeOpacity={0.7}>
                <View>
                    <Feather name="user" size={26} color={c('profil')} />
                    <View style={tabStyles.redDot} />
                </View>
            </TouchableOpacity>
        </View>
    );
}

// ── Mesaj screen ──────────────────────────────────────────────────────────────
function MesajScreen() {
    return (
        <View style={mesajStyles.container}>
            <Text style={mesajStyles.title}>Mesajlar</Text>
            <TextInput
                style={mesajStyles.searchBar}
                placeholder="Ara..."
                placeholderTextColor="rgba(255,255,255,0.4)"
            />
            <View style={mesajStyles.row}>
                <View style={mesajStyles.avatar} />
                <Text style={mesajStyles.rowLabel}>Arkadaş Ekle</Text>
                <Text style={mesajStyles.addIcon}>+</Text>
            </View>
        </View>
    );
}

// ── Generic placeholder for kesfet / profil ───────────────────────────────────
function PlaceholderScreen({ id }) {
    const cfg = SIMPLE_PLACEHOLDERS[id];
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
// Shown only on first open (AsyncStorage key: onboarding_swipe_seen).
// Layout:
//   - rgba(0,0,0,0.6) mask covers the game area above the bars (PART 3)
//   - Cyan-glowing box covers engagement + creator bars (HINT_HEIGHT = 104px)
//   - Swipe UP on the box to dismiss (PART 2)
const ENG_BAR_H = 52;
const CREATOR_BAR_H = 52;
const HINT_HEIGHT = ENG_BAR_H + CREATOR_BAR_H; // 104px
const MASK_HEIGHT = ITEM_HEIGHT - HINT_HEIGHT;  // game area above bars

function OnboardingOverlay({ onDismiss }) {
    const fadeAnim = useRef(new Animated.Value(1)).current;

    function dismiss() {
        Animated.timing(fadeAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start(onDismiss);
    }

    // Swipe-up gesture on the hint box dismisses the overlay
    const swipePan = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, g) => g.dy < -5 && Math.abs(g.dy) > Math.abs(g.dx),
            onPanResponderRelease: (_, g) => {
                if (g.dy < -30) dismiss();
            },
        })
    ).current;

    return (
        <Animated.View style={[onboardingStyles.container, { opacity: fadeAnim }]} pointerEvents="box-none">
            {/* Dark overlay over the game card area (PART 3 — rgba 0.6) */}
            <View
                style={[onboardingStyles.mask, { height: MASK_HEIGHT }]}
                pointerEvents="none"
            />

            {/* Cyan-bordered hint box over interaction + creator bars */}
            <View
                style={[onboardingStyles.hintBox, { height: HINT_HEIGHT }]}
                {...swipePan.panHandlers}
            >
                <Feather name="chevrons-up" size={32} color="#fff" />
                <Text style={onboardingStyles.text}>
                    Swipe up <Text style={onboardingStyles.only}>only</Text> in this area
                </Text>
            </View>
        </Animated.View>
    );
}

// ── Main FeedScreen ───────────────────────────────────────────────────────────
export default function FeedScreen({ navigation }) {
    const [activeTab, setActiveTab] = useState('indie');
    const [showOnboarding, setShowOnboarding] = useState(false); // false until AsyncStorage resolves
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isMuted, setIsMuted] = useState(true);
    const [likedSet, setLikedSet] = useState(new Set());
    const [savedSet, setSavedSet] = useState(new Set());
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
            const [likes, reposts, saved, onboardingSeen] = await Promise.all([
                loadLikes(),
                loadReposts(),
                loadSaved(),
                AsyncStorage.getItem(ONBOARDING_KEY),
            ]);
            setLikedSet(likes);
            setRepostedSet(reposts);
            setSavedSet(saved);
            // Only show onboarding if never seen before
            if (!onboardingSeen) {
                setShowOnboarding(true);
            }
        })();
    }, []);

    function handleOnboardingDismiss() {
        setShowOnboarding(false);
        AsyncStorage.setItem(ONBOARDING_KEY, '1').catch(() => { });
    }

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
            if (next.has(item.id)) { next.delete(item.id); }
            else { next.add(item.id); }
            saveLikes(next);
            return next;
        });
    }

    function toggleRepost() {
        const item = playables[currentIndexRef.current];
        if (!item) return;
        setRepostedSet((prev) => {
            const next = new Set(prev);
            if (next.has(item.id)) { next.delete(item.id); }
            else { next.add(item.id); }
            saveReposts(next);
            return next;
        });
    }

    function toggleSave() {
        const item = playables[currentIndexRef.current];
        if (!item) return;
        setSavedSet((prev) => {
            const next = new Set(prev);
            if (next.has(item.id)) { next.delete(item.id); }
            else { next.add(item.id); }
            saveSaved(next);
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
                    isSaved={savedSet.has(item.id)}
                    isReposted={repostedSet.has(item.id)}
                    uri={uri}
                    webViewRef={webViewRefs.current[index]}
                    onLike={toggleLike}
                    onSave={toggleSave}
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
        [currentIndex, isMuted, likedSet, savedSet, repostedSet, toastMsg, toastVisible]
    );

    return (
        <View style={styles.container}>
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
            ) : activeTab === 'home' ? (
                <HomeFeedScreen navigation={navigation} />
            ) : activeTab === 'mesaj' ? (
                <View style={styles.placeholderWrapper}><MesajScreen /></View>
            ) : activeTab === 'profil' ? (
                <View style={styles.placeholderWrapper}>
                    <ProfileScreen navigation={navigation} />
                </View>
            ) : (
                <View style={styles.placeholderWrapper}>
                    <PlaceholderScreen id={activeTab} />
                </View>
            )}

            {/* ── Onboarding overlay (shown once on first open) ─────────── */}
            {activeTab === 'indie' && showOnboarding && (
                <View style={styles.onboardingWrapper} pointerEvents="box-none">
                    <OnboardingOverlay onDismiss={handleOnboardingDismiss} />
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
        backgroundColor: '#000',
        borderTopWidth: 1,
        borderTopColor: '#1a1a1a',
        flexDirection: 'row',
        alignItems: 'stretch',
    },
    item: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    redDot: {
        position: 'absolute',
        top: -2,
        right: -2,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#fe2c55',
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


const mesajStyles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
        paddingHorizontal: 20,
        paddingTop: 32,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 16,
    },
    searchBar: {
        backgroundColor: '#1C1C1E',
        borderRadius: 12,
        paddingHorizontal: 14,
        height: 40,
        color: '#fff',
        fontSize: 15,
        marginBottom: 20,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#2C2C2E',
    },
    rowLabel: {
        flex: 1,
        fontSize: 15,
        color: '#fff',
    },
    addIcon: {
        fontSize: 22,
        color: '#4ADE80',
        fontWeight: '700',
    },
});

const onboardingStyles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 100,
    },
    // PART 3: rgba(0,0,0,0.6) dim over the game card while hint is showing
    mask: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    // PART 1: Cyan-glowing bordered box covering the interaction + creator bar area
    hintBox: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        borderWidth: 2,
        borderColor: '#00E5FF',
        backgroundColor: 'rgba(0,0,0,0.75)',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        // Glow effect
        shadowColor: '#00E5FF',
        shadowOpacity: 0.8,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 0 },
        elevation: 8,
    },
    text: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
    },
    only: {
        color: '#00E5FF',
        fontWeight: '700',
    },
});
