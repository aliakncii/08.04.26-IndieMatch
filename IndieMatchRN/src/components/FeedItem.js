// src/components/FeedItem.js
// Full-screen feed item wrapper — card-style layout matching the web UI.
// Layout (top to bottom):
//   [floating top bar: Following|For You + sound toggle]
//   [WebView — flex:1, fills remaining space]
//   [engagement bar — ♥ likes, 💬 comments, 🔖 save | ⊙ screenshot, ↗ share]
//   [creator info bar — avatar + name/title | 🔁 repost]

import React, { useRef, useState } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, Dimensions,
    Animated, Image,
} from 'react-native';
import PlayableCard from './PlayableCard';
import Toast from './Toast';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const TAB_BAR_HEIGHT = 60;
export const ITEM_HEIGHT = SCREEN_HEIGHT - TAB_BAR_HEIGHT;

const ENGAGEMENT_BAR_HEIGHT = 48;
const CREATOR_BAR_HEIGHT = 52;

// Heart animation shown on double-tap
function FloatingHeart({ x, y, onDone }) {
    const anim = useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        Animated.sequence([
            Animated.timing(anim, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.timing(anim, { toValue: 0, duration: 500, useNativeDriver: true }),
        ]).start(onDone);
    }, []);

    const scale = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1.2, 0.8] });
    const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -80] });
    const opacity = anim.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 1, 1, 0] });

    return (
        <Animated.Text
            style={[
                styles.floatingHeart,
                { left: x - 40, top: y - 40, opacity, transform: [{ scale }, { translateY }] },
            ]}
        >
            ♥
        </Animated.Text>
    );
}

export default function FeedItem({
    item,
    isActive,
    isMounted,
    isMuted,
    isLiked,
    isReposted,
    uri,
    webViewRef,
    onLike,
    onRepost,
    onSoundToggle,
    toastMsg,
    toastVisible,
    onNavigateProfile,
}) {
    const [hearts, setHearts] = useState([]);
    const lastTapRef = useRef(0);

    const username = `@${(item.creator || item.publisher || 'indie').replace(/\s+/g, '').toLowerCase()}`;
    const title = item.title || item.gameName || 'Indie Game';

    function handleDoubleTap(e) {
        const now = Date.now();
        if (now - lastTapRef.current < 300) {
            const { locationX, locationY } = e.nativeEvent;
            const id = now;
            setHearts((prev) => [...prev, { x: locationX, y: locationY, id }]);
            onLike && onLike();
        }
        lastTapRef.current = now;
    }

    function removeHeart(id) {
        setHearts((prev) => prev.filter((h) => h.id !== id));
    }

    return (
        <View style={styles.container}>
            {/* ── Floating top bar ───────────────────────────────────────── */}
            <View style={styles.topBar} pointerEvents="box-none">
                <View style={styles.topHeader} pointerEvents="none">
                    <Text style={styles.tabInactive}>Following</Text>
                    <Text style={styles.separator}> | </Text>
                    <Text style={styles.tabActive}>For You</Text>
                </View>
                <TouchableOpacity style={styles.soundControl} onPress={onSoundToggle}>
                    <Text style={styles.soundIcon}>{isMuted ? '🔇' : '🔊'}</Text>
                </TouchableOpacity>
            </View>

            {/* ── Game area (WebView) ────────────────────────────────────── */}
            <View style={styles.gameArea} onTouchEnd={handleDoubleTap}>
                {isMounted && uri ? (
                    <PlayableCard
                        ref={webViewRef}
                        uri={uri}
                        isActive={isActive}
                        isMuted={isMuted}
                    />
                ) : (
                    <View style={styles.placeholder} />
                )}
                {hearts.map((h) => (
                    <FloatingHeart key={h.id} x={h.x} y={h.y} onDone={() => removeHeart(h.id)} />
                ))}
                <Toast message={toastMsg} visible={toastVisible} />
            </View>

            {/* ── Engagement bar ─────────────────────────────────────────── */}
            <View style={styles.engagementBar}>
                <View style={styles.engLeft}>
                    <TouchableOpacity style={styles.engBtn} onPress={onLike}>
                        <Text style={[styles.engIcon, isLiked && styles.iconLiked]}>♥</Text>
                        <Text style={styles.engCount}>{item.likes || '0'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.engBtn}>
                        <Text style={styles.engIcon}>💬</Text>
                        <Text style={styles.engCount}>{item.comments || '0'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.engBtn}>
                        <Text style={styles.engIcon}>🔖</Text>
                        <Text style={styles.engCount}>Save</Text>
                    </TouchableOpacity>
                </View>
                <View style={styles.engRight}>
                    <TouchableOpacity style={styles.engBtn}>
                        <Text style={styles.engIcon}>⊙</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.engBtn}>
                        <Text style={styles.engIcon}>↗</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* ── Creator info bar ──────────────────────────────────────── */}
            <View style={styles.creatorBar}>
                <View style={styles.creatorLeft}>
                    <TouchableOpacity onPress={onNavigateProfile}>
                        <Image source={item.thumbnail} style={styles.avatar} />
                    </TouchableOpacity>
                    <View style={styles.creatorText}>
                        <Text style={styles.creatorName} numberOfLines={1}>{username}</Text>
                        <Text style={styles.creatorDesc} numberOfLines={1}>{title}</Text>
                    </View>
                </View>
                <TouchableOpacity style={styles.repostBtn} onPress={onRepost}>
                    <Text style={[styles.repostIcon, isReposted && styles.repostActive]}>🔁</Text>
                    <Text style={[styles.repostCount, isReposted && styles.repostActive]}>
                        {item.reposts || '0'}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: SCREEN_WIDTH,
        height: ITEM_HEIGHT,
        backgroundColor: '#000',
        flexDirection: 'column',
        overflow: 'hidden',
    },

    // ── Top floating bar ──────────────────────────────────────────────────
    topBar: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 55,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'flex-end',
        paddingBottom: 8,
        zIndex: 20,
    },
    topHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    tabInactive: {
        color: 'rgba(255,255,255,0.6)',
        fontWeight: '600',
        fontSize: 16,
    },
    separator: {
        color: 'rgba(255,255,255,0.4)',
        marginHorizontal: 8,
        fontSize: 16,
    },
    tabActive: {
        color: 'white',
        fontWeight: '600',
        fontSize: 16,
        borderBottomWidth: 2,
        borderBottomColor: 'white',
        paddingBottom: 2,
    },
    soundControl: {
        position: 'absolute',
        right: 16,
        bottom: 8,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    soundIcon: { fontSize: 18 },

    // ── Game area ─────────────────────────────────────────────────────────
    gameArea: {
        flex: 1,
        backgroundColor: '#000',
    },
    placeholder: {
        flex: 1,
        backgroundColor: '#111',
    },
    floatingHeart: {
        position: 'absolute',
        fontSize: 60,
        color: '#fe2c55',
        textShadowColor: 'rgba(0,0,0,0.3)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
        zIndex: 50,
        pointerEvents: 'none',
    },

    // ── Engagement bar ────────────────────────────────────────────────────
    engagementBar: {
        height: ENGAGEMENT_BAR_HEIGHT,
        backgroundColor: '#111',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
    },
    engLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 20,
    },
    engRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    engBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    engIcon: {
        fontSize: 17,
        color: '#fff',
    },
    engCount: {
        fontSize: 11,
        color: '#ccc',
    },
    iconLiked: {
        color: '#fe2c55',
    },

    // ── Creator info bar ──────────────────────────────────────────────────
    creatorBar: {
        height: CREATOR_BAR_HEIGHT,
        backgroundColor: '#0a0a0a',
        borderTopWidth: 1,
        borderTopColor: '#1a1a1a',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
    },
    creatorLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
        marginRight: 12,
    },
    avatar: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#333',
    },
    creatorText: {
        flex: 1,
    },
    creatorName: {
        color: 'white',
        fontSize: 13,
        fontWeight: '600',
    },
    creatorDesc: {
        color: '#888',
        fontSize: 11,
        marginTop: 1,
    },
    repostBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    repostIcon: {
        fontSize: 16,
        color: '#4CAF50',
    },
    repostCount: {
        fontSize: 11,
        color: '#4CAF50',
        fontWeight: '600',
    },
    repostActive: {
        color: '#00e676',
    },
});
