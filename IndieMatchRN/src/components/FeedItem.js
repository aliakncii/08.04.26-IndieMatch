// src/components/FeedItem.js
// Full-screen feed item wrapper — card-style layout matching the web UI.
// Layout (top to bottom):
//   [floating top bar: Following|For You + sound toggle]
//   [WebView — flex:1, fills remaining space]
//   [engagement bar — ♥ likes, 💬 comments, 🔖 save | ⊙ screenshot, ↗ share]
//   [creator info bar — avatar + name/title | 🔁 repost]

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, Dimensions, Animated, Linking,
    Image, Modal, ScrollView, TextInput,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PlayableCard from './PlayableCard';
import Toast from './Toast';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const TAB_BAR_HEIGHT = 60;
export const ITEM_HEIGHT = SCREEN_HEIGHT - TAB_BAR_HEIGHT;

const ENGAGEMENT_BAR_HEIGHT = 52;
const CREATOR_BAR_HEIGHT = 52;

const CTA_DELAY_MS = 8000;
const CTA_ELIGIBLE_IDS = new Set(['p1', 'p2', 'p5', 'p7', 'p8', 'p9']);


export default function FeedItem({
    item,
    isActive,
    isMounted,
    isMuted,
    isLiked,
    isSaved,
    isReposted,
    uri,
    webViewRef,
    onLike,
    onSave,
    onRepost,
    onSoundToggle,
    toastMsg,
    toastVisible,
    onNavigateProfile,
}) {
    const { top: topInset } = useSafeAreaInsets();
    const [showComments, setShowComments] = useState(false);
    const [showShare, setShowShare] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [ctaVisible, setCtaVisible] = useState(false);

    const ctaAnim = useRef(new Animated.Value(0)).current; // 0 hidden → 1 shown
    const ctaBreatheAnim = useRef(new Animated.Value(1)).current; // scale breathing
    const ctaTimerRef = useRef(null);
    const ctaBreatheLoopRef = useRef(null);

    const ctaEligible = useMemo(() => {
        return Boolean(item?.id && CTA_ELIGIBLE_IDS.has(item.id) && item.storeUrl);
    }, [item?.id, item?.storeUrl]);

    const username = `@${(item.creator || item.publisher || 'indie').replace(/\s+/g, '').toLowerCase()}`;
    const title = item.title || item.gameName || 'Indie Game';

    useEffect(() => {
        // Reset when item becomes inactive/unloaded to avoid cross-item leakage.
        if (!isActive) {
            if (ctaTimerRef.current) clearTimeout(ctaTimerRef.current);
            ctaTimerRef.current = null;
            setCtaVisible(false);
            ctaAnim.setValue(0);
            ctaBreatheLoopRef.current?.stop?.();
            ctaBreatheLoopRef.current = null;
            ctaBreatheAnim.setValue(1);
        }
    }, [isActive, ctaAnim]);

    useEffect(() => {
        // Subtle continuous breathing while CTA is visible.
        if (!ctaVisible) {
            ctaBreatheLoopRef.current?.stop?.();
            ctaBreatheLoopRef.current = null;
            ctaBreatheAnim.setValue(1);
            return;
        }
        if (ctaBreatheLoopRef.current) return;

        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(ctaBreatheAnim, {
                    toValue: 1.04,
                    duration: 1050,
                    useNativeDriver: true,
                }),
                Animated.timing(ctaBreatheAnim, {
                    toValue: 1,
                    duration: 1050,
                    useNativeDriver: true,
                }),
            ])
        );

        ctaBreatheLoopRef.current = loop;
        loop.start();

        return () => {
            loop.stop();
            if (ctaBreatheLoopRef.current === loop) {
                ctaBreatheLoopRef.current = null;
            }
            ctaBreatheAnim.setValue(1);
        };
    }, [ctaVisible, ctaBreatheAnim]);

    useEffect(() => {
        if (!ctaEligible) return;
        if (!isActive) return;
        if (!hasLoaded) return;
        if (ctaVisible) return;
        if (ctaTimerRef.current) return;

        // Start exactly after "active + load finished".
        ctaTimerRef.current = setTimeout(() => {
            setCtaVisible(true);
            Animated.timing(ctaAnim, {
                toValue: 1,
                duration: 380,
                useNativeDriver: true,
            }).start();
        }, CTA_DELAY_MS);

        return () => {
            if (ctaTimerRef.current) clearTimeout(ctaTimerRef.current);
            ctaTimerRef.current = null;
        };
    }, [ctaEligible, isActive, hasLoaded, ctaVisible, ctaAnim]);

    function handleCtaPress() {
        if (!ctaEligible) return;
        const url = item.storeUrl;
        if (!url) return;
        Linking.openURL(url).catch((err) =>
            console.warn('[CTA] Linking.openURL failed:', err)
        );
    }

    const ctaAnimatedStyle = {
        opacity: ctaAnim,
        transform: [
            {
                translateY: ctaAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [8, 0],
                }),
            },
            {
                scale: ctaAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.88, 1],
                }),
            },
            { scale: ctaBreatheAnim },
        ],
    };

    return (
        <View style={styles.container}>
            {/* ── Game area (WebView) ────────────────────────────────────── */}
            <View style={[styles.gameArea, { marginTop: topInset }]}>
                {isMounted && uri ? (
                    <PlayableCard
                        ref={webViewRef}
                        uri={uri}
                        isActive={isActive}
                        isMuted={isMuted}
                        onLoadStart={() => setHasLoaded(false)}
                        onLoadEnd={() => setHasLoaded(true)}
                    />
                ) : (
                    <View style={styles.placeholder} />
                )}
                <Toast message={toastMsg} visible={toastVisible} />
            </View>

            {/* ── Engagement bar ─────────────────────────────────────────── */}
            <View style={styles.engagementBar}>
                {/* Left: heart + count, comment, bookmark */}
                <View style={styles.engLeft}>
                    <TouchableOpacity style={styles.engBtn} onPress={onLike}>
                        <Ionicons
                            name={isLiked ? 'heart' : 'heart-outline'}
                            size={23}
                            color={isLiked ? '#FF3040' : '#fff'}
                        />
                        <Text style={[styles.engCount, isLiked && styles.countLiked]}>
                            {item.likes || '0'}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.engBtn} onPress={() => setShowComments(true)}>
                        <Feather name="message-circle" size={22} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.engBtn} onPress={onSave}>
                        <Ionicons
                            name={isSaved ? 'bookmark' : 'bookmark-outline'}
                            size={22}
                            color={isSaved ? '#F59E0B' : '#fff'}
                        />
                    </TouchableOpacity>
                </View>

                {/* Right: repost + count, send */}
                <View style={styles.engRight}>
                    <TouchableOpacity style={styles.engBtn} onPress={onRepost}>
                        <Feather
                            name="repeat"
                            size={22}
                            color={isReposted ? '#4ADE80' : '#fff'}
                        />
                        <Text style={[styles.engCount, isReposted && styles.repostCount]}>
                            {item.reposts || '0'}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.engBtn} onPress={() => setShowShare(true)}>
                        <Feather name="send" size={22} color="#fff" />
                    </TouchableOpacity>
                </View>

                {/* CTA overlay in the engagement bar center gap (no layout shift) */}
                {ctaEligible && isActive && hasLoaded && (
                    <View pointerEvents="box-none" style={styles.ctaOverlayEng}>
                        <Animated.View style={[styles.ctaWrap, ctaAnimatedStyle]}>
                            <TouchableOpacity
                                onPress={handleCtaPress}
                                activeOpacity={0.85}
                                style={styles.ctaBtn}
                            >
                                <Text style={styles.ctaText}>INSTALL</Text>
                            </TouchableOpacity>
                        </Animated.View>
                    </View>
                )}
            </View>

            {/* ── Comments modal ─────────────────────────────────────────── */}
            <Modal
                visible={showComments}
                transparent
                animationType="slide"
                onRequestClose={() => setShowComments(false)}
            >
                <TouchableOpacity
                    style={modalStyles.backdrop}
                    activeOpacity={1}
                    onPress={() => setShowComments(false)}
                />
                <View style={modalStyles.sheet}>
                    <View style={modalStyles.handle} />
                    <Text style={modalStyles.sheetTitle}>Yorumlar</Text>
                    <ScrollView style={modalStyles.scrollArea} contentContainerStyle={modalStyles.emptyContainer}>
                        <Text style={modalStyles.emptyText}>Henüz yorum yok</Text>
                    </ScrollView>
                    <View style={modalStyles.inputRow}>
                        <View style={modalStyles.inputAvatar} />
                        <TextInput
                            style={modalStyles.textInput}
                            placeholder="Yorum ekle..."
                            placeholderTextColor="rgba(255,255,255,0.4)"
                            color="#fff"
                        />
                        <TouchableOpacity onPress={() => setShowComments(false)}>
                            <Text style={modalStyles.sendBtn}>Gönder</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ── Share modal ────────────────────────────────────────────── */}
            <Modal
                visible={showShare}
                transparent
                animationType="slide"
                onRequestClose={() => setShowShare(false)}
            >
                <TouchableOpacity
                    style={modalStyles.backdrop}
                    activeOpacity={1}
                    onPress={() => setShowShare(false)}
                />
                <View style={modalStyles.sheet}>
                    <View style={modalStyles.handle} />
                    <Text style={modalStyles.sheetTitle}>Gönder</Text>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={modalStyles.friendsRow}
                        contentContainerStyle={{ gap: 20, paddingHorizontal: 20 }}
                    >
                        {['Arkadaş 1', 'Arkadaş 2', 'Arkadaş 3', 'Arkadaş 4'].map((name) => (
                            <View key={name} style={modalStyles.friendItem}>
                                <View style={modalStyles.friendAvatar} />
                                <Text style={modalStyles.friendName} numberOfLines={1}>{name}</Text>
                            </View>
                        ))}
                    </ScrollView>
                    <View style={modalStyles.inputRow}>
                        <TextInput
                            style={[modalStyles.textInput, { flex: 1 }]}
                            placeholder="Mesaj ekle..."
                            placeholderTextColor="rgba(255,255,255,0.4)"
                            color="#fff"
                        />
                        <TouchableOpacity onPress={() => setShowShare(false)}>
                            <Text style={modalStyles.sendBtn}>Gönder</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

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
        borderRadius: 20,
        overflow: 'hidden',
    },
    placeholder: {
        flex: 1,
        backgroundColor: '#111',
    },

    // ── Engagement bar ────────────────────────────────────────────────────
    engagementBar: {
        height: ENGAGEMENT_BAR_HEIGHT,
        backgroundColor: '#000',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    engLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    engRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    engBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    engCount: {
        fontSize: 13,
        fontWeight: '600',
        color: '#fff',
    },
    countLiked: {
        color: '#FF3040',
    },
    repostCount: {
        color: '#4ADE80',
    },

    // ── CTA (INSTALL) ─────────────────────────────────────────────────────
    ctaOverlayEng: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 5,
    },
    ctaWrap: {
        borderRadius: 18,
    },
    ctaBtn: {
        minWidth: 140,
        paddingHorizontal: 18,
        paddingVertical: 9,
        borderRadius: 18,
        backgroundColor: 'rgba(0,0,0,0.62)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.28)',
        shadowColor: '#000',
        shadowOpacity: 0.45,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
        alignItems: 'center',
    },
    ctaText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '800',
        letterSpacing: 0.8,
        textAlign: 'center',
    },

    // ── Creator info bar ──────────────────────────────────────────────────
    creatorBar: {
        height: CREATOR_BAR_HEIGHT,
        backgroundColor: '#000',
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
    // repostCount defined above in engagementBar section — do not redeclare here
    repostActive: {
        color: '#00e676',
    },
});

const modalStyles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    sheet: {
        backgroundColor: '#1C1C1E',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingBottom: 32,
        minHeight: 320,
    },
    handle: {
        width: 40,
        height: 4,
        backgroundColor: '#3A3A3C',
        borderRadius: 2,
        alignSelf: 'center',
        marginTop: 10,
        marginBottom: 4,
    },
    sheetTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
        textAlign: 'center',
        paddingTop: 16,
        paddingBottom: 12,
    },
    scrollArea: {
        minHeight: 120,
        maxHeight: 240,
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
    },
    emptyText: {
        color: '#8E8E93',
        fontSize: 14,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 12,
        gap: 10,
    },
    inputAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#3A3A3C',
    },
    textInput: {
        flex: 1,
        backgroundColor: '#2C2C2E',
        borderRadius: 20,
        paddingHorizontal: 14,
        paddingVertical: 8,
        fontSize: 14,
        color: '#fff',
    },
    sendBtn: {
        color: '#4ADE80',
        fontSize: 14,
        fontWeight: '700',
    },
    friendsRow: {
        paddingVertical: 16,
    },
    friendItem: {
        alignItems: 'center',
        width: 60,
    },
    friendAvatar: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: '#3A3A3C',
        marginBottom: 6,
    },
    friendName: {
        color: '#fff',
        fontSize: 11,
        textAlign: 'center',
    },
});
