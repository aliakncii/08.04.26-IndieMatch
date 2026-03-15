// src/screens/HomeFeedScreen.js
// Home tab feed — identical swipe mechanics and UI to the Indie (playable) feed.
// Data is pulled from homePlayables (games sourced from the oyunlar-güncel repo).
// Rendered as an inline child inside FeedScreen when the Home tab is active.

import React, { useCallback, useRef, useState } from 'react';
import {
    FlatList,
    View,
} from 'react-native';

import FeedItem, { ITEM_HEIGHT } from '../components/FeedItem';
import { homePlayables } from '../data/homePlayables';
import { getPlayableUri } from '../utils/assetHelper';

// Only mount prev + current + next (same as indie feed)
const WINDOW_SIZE = 1;

export default function HomeFeedScreen({ navigation }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isMuted, setIsMuted]           = useState(true);
    const [likedSet, setLikedSet]         = useState(new Set());
    const [savedSet, setSavedSet]         = useState(new Set());
    const [repostedSet, setRepostedSet]   = useState(new Set());
    const [toastMsg, setToastMsg]         = useState('');
    const [toastVisible, setToastVisible] = useState(false);

    const toastTimerRef   = useRef(null);
    const webViewRefs     = useRef({});
    const flatListRef     = useRef(null);
    const currentIndexRef = useRef(0);

    // ── Toast helper ──────────────────────────────────────────────────────────
    function showToast(msg) {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setToastMsg(msg);
        setToastVisible(true);
        toastTimerRef.current = setTimeout(() => setToastVisible(false), 2300);
    }

    // ── Sound toggle — broadcast to all mounted WebViews ─────────────────────
    function toggleMute() {
        setIsMuted((prev) => {
            const next = !prev;
            Object.values(webViewRefs.current).forEach((ref) => {
                ref?.injectJavaScript?.(
                    `window.postMessage(${JSON.stringify({ type: 'mute', value: next })}, '*'); true;`
                );
            });
            return next;
        });
    }

    // ── Like / Repost / Save ─────────────────────────────────────────────────
    function toggleLike() {
        const item = homePlayables[currentIndexRef.current];
        if (!item) return;
        setLikedSet((prev) => {
            const next = new Set(prev);
            next.has(item.id) ? next.delete(item.id) : next.add(item.id);
            return next;
        });
    }

    function toggleRepost() {
        const item = homePlayables[currentIndexRef.current];
        if (!item) return;
        setRepostedSet((prev) => {
            const next = new Set(prev);
            next.has(item.id) ? next.delete(item.id) : next.add(item.id);
            return next;
        });
    }

    function toggleSave() {
        const item = homePlayables[currentIndexRef.current];
        if (!item) return;
        setSavedSet((prev) => {
            const next = new Set(prev);
            next.has(item.id) ? next.delete(item.id) : next.add(item.id);
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


    // ── FlatList helpers ──────────────────────────────────────────────────────
    const getItemLayout = useCallback(
        (_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index }),
        []
    );

    const renderItem = useCallback(
        ({ item, index }) => {
            const isMounted = Math.abs(index - currentIndex) <= WINDOW_SIZE;
            const isActive  = index === currentIndex;
            const uri       = isMounted ? getPlayableUri(item.localPath) : null;

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
        <View style={{ flex: 1 }}>
            <FlatList
                ref={flatListRef}
                data={homePlayables}
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
        </View>
    );
}
