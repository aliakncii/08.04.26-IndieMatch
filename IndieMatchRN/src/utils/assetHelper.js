// src/utils/assetHelper.js
// Copies playable HTML assets (and sub-resources) from the Expo bundle
// to the device's document directory — ONLY needed for production builds.
//
// In DEVELOPMENT (Expo Go), playables are served directly by the Metro
// dev server via the static middleware configured in metro.config.js.
// This avoids WKWebView's file:// access restrictions on iOS.
//
// NOTE: Large JS bundle files are renamed to .jsa so Metro treats them as
// raw assets (not source to be transpiled). The Metro middleware handles
// .js → .jsa fallback automatically.

import { Platform, NativeModules } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';
import Constants from 'expo-constants';

const ASSET_MANIFEST = [
    // ── p4: standalone single-file ──────────────────────────────────────────
    { module: require('../../assets/playables/p4/index.html'), dest: 'p4/index.html' },

    // ── p2: main + royalmatch_files/ ─────────────────────────────────────────
    { module: require('../../assets/playables/p2/index.html'), dest: 'p2/index.html' },
    { module: require('../../assets/playables/p2/royalmatch_files/mraid.jsa'), dest: 'p2/royalmatch_files/mraid.js' },
    { module: require('../../assets/playables/p2/royalmatch_files/network_rewriting.jsa'), dest: 'p2/royalmatch_files/network_rewriting.js' },
    { module: require('../../assets/playables/p2/royalmatch_files/730d60646e845712bc4101661eedd58345f01709_v1_js_load.jsa'), dest: 'p2/royalmatch_files/730d60646e845712bc4101661eedd58345f01709_v1_js_load.js' },

    // ── p1: main + Block Blast_files/ ────────────────────────────────────────
    { module: require('../../assets/playables/p1/index.html'), dest: 'p1/index.html' },
    { module: require('../../assets/playables/p1/Block Blast_files/mraid.jsa'), dest: 'p1/Block Blast_files/mraid.js' },
    { module: require('../../assets/playables/p1/Block Blast_files/network_rewriting.jsa'), dest: 'p1/Block Blast_files/network_rewriting.js' },
    { module: require('../../assets/playables/p1/Block Blast_files/7eb73a43de84059940641cd8347feff12e87f00e_v1_js_load.jsa'), dest: 'p1/Block Blast_files/7eb73a43de84059940641cd8347feff12e87f00e_v1_js_load.js' },
];

export const BASE_DIR = FileSystem.documentDirectory + 'playables/';
const SENTINEL = BASE_DIR + '_ready_v6'; // v6: force re-copy with verification

/**
 * Returns the Metro dev server base URL (e.g. "http://192.168.1.5:8081")
 * or null if not in dev mode / not available.
 *
 * Strategy 0 (best): react-native/Libraries/Core/Devtools/getDevServer
 *   Returns { url: "http://192.168.x.x:8081/" } directly. Works in both
 *   old and new architecture (Hermes + JSC), across all Expo SDK versions.
 *
 * Strategy 1: NativeModules.SourceCode.scriptURL
 *   Parses the URL from which the JS bundle was fetched. Works on old arch.
 *
 * Strategy 2: Expo Constants API (multiple SDK shapes as fallback).
 */
function getDevServerBaseUrl() {
    if (!__DEV__) return null;

    // ── Strategy 0: RN internal getDevServer (works on old + new arch) ────────
    try {
        // eslint-disable-next-line import/no-extraneous-dependencies
        const getDevServer = require('react-native/Libraries/Core/Devtools/getDevServer');
        const fn = getDevServer?.default ?? getDevServer;
        if (typeof fn === 'function') {
            const result = fn();
            if (result?.url) {
                const url = String(result.url).replace(/\/+$/, ''); // strip trailing slash
                console.log('[AssetHelper] Dev server (getDevServer):', url);
                return url;
            }
        }
    } catch (e) {
        // Module not available in all RN versions — fall through
    }

    // ── Strategy 1: SourceCode native module (old arch) ───────────────────────
    try {
        const scriptURL = NativeModules.SourceCode?.scriptURL;
        if (scriptURL) {
            const match = String(scriptURL).match(/^(https?:\/\/[^/]+)/);
            if (match) {
                console.log('[AssetHelper] Dev server (scriptURL):', match[1]);
                return match[1];
            }
        }
    } catch (e) {
        console.warn('[AssetHelper] scriptURL strategy failed:', e.message);
    }

    // ── Strategy 2: Expo Constants (fallback for various SDK versions) ────────
    try {
        const host =
            Constants.expoConfig?.hostUri ||
            Constants.expoGoConfig?.debuggerHost ||
            Constants.manifest2?.extra?.expoGo?.debuggerHost ||
            Constants.manifest?.debuggerHost ||
            Constants.manifest?.hostUri;

        if (host) {
            const cleanHost = String(host).split('/')[0].split('?')[0];
            console.log('[AssetHelper] Dev server (Constants):', cleanHost);
            return `http://${cleanHost}`;
        }
    } catch (e) {
        console.warn('[AssetHelper] Constants strategy failed:', e.message);
    }

    console.warn('[AssetHelper] Dev server URL not found — playables may not load in dev mode.');
    return null;
}

/**
 * Call once on app startup.
 * In dev mode (Expo Go): no-op — Metro serves playables via HTTP.
 * In production: copies all playable assets to the document directory.
 */
export async function ensurePlayablesReady() {
    // On web, playables are served directly by Metro/webpack
    if (Platform.OS === 'web') return;

    // In development, Metro dev server serves playables via HTTP middleware
    const devUrl = getDevServerBaseUrl();
    if (devUrl) {
        console.log('[AssetHelper] Dev mode — playables served by Metro at:', devUrl + '/playables/');
        return;
    }

    // --- Production path: copy files to document directory ---
    const info = await FileSystem.getInfoAsync(SENTINEL);
    if (info.exists) {
        console.log('[AssetHelper] Sentinel found, skipping copy');
        return;
    }

    console.log('[AssetHelper] Copying assets to:', BASE_DIR);
    let allOk = true;

    for (const { module, dest } of ASSET_MANIFEST) {
        try {
            const asset = Asset.fromModule(module);
            await asset.downloadAsync();

            const destUri = BASE_DIR + dest;
            const parentDir = destUri.substring(0, destUri.lastIndexOf('/') + 1);
            await FileSystem.makeDirectoryAsync(parentDir, { intermediates: true });

            if (asset.localUri) {
                const existing = await FileSystem.getInfoAsync(destUri);
                if (existing.exists) {
                    await FileSystem.deleteAsync(destUri, { idempotent: true });
                }

                await FileSystem.copyAsync({ from: asset.localUri, to: destUri });

                const copied = await FileSystem.getInfoAsync(destUri);
                if (copied.exists) {
                    console.log('[AssetHelper] ✓ Copied:', dest, '(', copied.size, 'bytes)');
                } else {
                    console.error('[AssetHelper] ✗ Verify FAILED:', dest);
                    allOk = false;
                }
            } else {
                console.warn('[AssetHelper] ✗ No localUri for:', dest);
                allOk = false;
            }
        } catch (err) {
            console.error('[AssetHelper] ✗ Error copying', dest, ':', err.message);
            allOk = false;
        }
    }

    if (allOk) {
        await FileSystem.writeAsStringAsync(SENTINEL, '1');
        console.log('[AssetHelper] All assets copied, sentinel written');
    } else {
        console.warn('[AssetHelper] Some copies failed — sentinel NOT written (will retry)');
    }
}

/**
 * Returns the URI pointing to a playable's main HTML file.
 * - Web: relative URL served by Metro middleware
 * - Dev (Expo Go): HTTP URL from Metro dev server
 * - Production: file:// URI from document directory
 *
 * @param {string} localPath - e.g. 'p1/index.html'
 */
export function getPlayableUri(localPath) {
    if (Platform.OS === 'web') {
        return `/playables/${localPath}`;
    }

    // In development, use Metro dev server (avoids WKWebView file:// restrictions)
    const devUrl = getDevServerBaseUrl();
    if (devUrl) {
        const uri = `${devUrl}/playables/${localPath}`;
        console.log('[AssetHelper] getPlayableUri (HTTP):', localPath, '→', uri);
        return uri;
    }

    // Production: file:// from document directory
    const uri = BASE_DIR + localPath;
    console.log('[AssetHelper] getPlayableUri (file):', localPath, '→', uri);
    return uri;
}


