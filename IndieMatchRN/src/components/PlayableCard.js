// src/components/PlayableCard.js
// WebView wrapper for HTML playables (NATIVE version).
// The web version is in PlayableCard.web.js (Metro auto-selects by platform).
//
// Injects a pre-content shim that:
//  1) Disables network_rewriting.js (breaks fetch/XHR in standalone mode)
//  2) Provides a Bridge stub (required by Luna engine)
//  3) Captures JS errors and resource-load errors for debugging
//  4) Safety-net: forces mraid._markReady() if game hasn't started within 3s

import React, { forwardRef, useEffect, useRef } from 'react';
import { StyleSheet, View, ActivityIndicator, Linking } from 'react-native';
import { WebView } from 'react-native-webview';
import { MSG, BRIDGE_INJECTION, parseWebViewMessage } from '../utils/messageBridge';

/**
 * Injected BEFORE the HTML content loads.
 *
 * The on-disk mraid.jsa already provides a complete MRAID 2.0 implementation
 * that calls _markReady() on window "load" event. Our job here is:
 *   - Block network_rewriting.js from breaking network requests
 *   - Provide Bridge.ready() stub for Luna engine
 *   - Report errors back to RN for debugging
 *   - Safety-net: force _markReady() if mraid hasn't become ready within 3s
 */
const PRE_CONTENT_SHIM = `
(function() {
  // ── 0) Track ALL AudioContext instances created by the game ──
  // Intercept the constructor before any game code runs so we can
  // suspend/resume every context on pause/resume messages.
  (function() {
    var _OrigAC = window.AudioContext || window.webkitAudioContext;
    if (!_OrigAC) return;
    window.__trackedAudioContexts = [];
    function PatchedAC(opts) {
      var ctx = opts ? new _OrigAC(opts) : new _OrigAC();
      window.__trackedAudioContexts.push(ctx);
      return ctx;
    }
    PatchedAC.prototype = _OrigAC.prototype;
    window.AudioContext = PatchedAC;
    window.webkitAudioContext = PatchedAC;
  })();

  // ── 1) Block network_rewriting.js ──
  // Sets the guard flag that stBootstrapNetworkRewriting() checks
  window.stBootstrapped_networkRewriting = true;
  // Also define the namespace so it doesn't error
  window.st_network_rewriting = { enabled: false };
  // Stub the function itself
  window.stBootstrapNetworkRewriting = function() {};
  // st_showNavigationBanner is called WITHOUT the URL, so stub it out
  window.st_showNavigationBanner = function() {};

  // Override mraid.open ASAP — this is where the URL actually lives
  // mraid object may not exist yet, so we intercept after DOM is ready
  // and also patch it immediately in case mraid.jsa is already parsed
  function _patchMraidOpen() {
    if (window.mraid && window.mraid.open) {
      var _origOpen = window.mraid.open;
      window.mraid.open = function(url) {
        try {
          if (url && window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: '__open_url', url: String(url) }));
          }
        } catch(e) {}
        // Don't call _origOpen — that would trigger st_showNavigationBanner
      };
    }
  }
  _patchMraidOpen();
  document.addEventListener('DOMContentLoaded', _patchMraidOpen);
  window.addEventListener('load', _patchMraidOpen);

  // ── 2) Bridge stub for Luna engine ──
  if (!window.Bridge) {
    window.Bridge = {
      ready: function(cb) {
        if (typeof cb === 'function') {
          setTimeout(cb, 0);
        }
      }
    };
  }

  // ── 3) Error reporting → RN ──
  window.addEventListener('error', function(e) {
    try {
      var msg = {
        type: '__webview_error',
        message: e.message || 'Unknown error',
        filename: e.filename || '',
        lineno: e.lineno || 0,
        colno: e.colno || 0
      };
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(msg));
      }
    } catch(err) {}
  }, true);

  // Catch resource load failures (script, img, css)
  document.addEventListener('error', function(e) {
    try {
      var el = e.target;
      if (el && (el.tagName === 'SCRIPT' || el.tagName === 'LINK' || el.tagName === 'IMG')) {
        var msg = {
          type: '__resource_error',
          tagName: el.tagName,
          src: el.src || el.href || 'unknown'
        };
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify(msg));
        }
      }
    } catch(err) {}
  }, true);

  // ── 4) Safety-net: force mraid._markReady() after 3 seconds ──
  // If the on-disk mraid.jsa loaded correctly, _markReady() will have
  // already fired via the "load" event. This is just a backup.
  setTimeout(function() {
    try {
      if (window.mraid && typeof window.mraid._markReady === 'function') {
        if (window.mraid.state === 'loading' || !window.mraid.viewable) {
          window.mraid._markReady();
        }
      }
    } catch(e) {}
  }, 3000);

  // ── 5) Handle RN → WebView messages for mute/pause/resume ──
  window.addEventListener('message', function(e) {
    try {
      var data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      if (!data || !data.type) return;
      if (data.type === 'mute') {
        window.dispatchEvent(new Event(data.value ? 'luna:unsafe:mute' : 'luna:unsafe:unmute'));
        if (window.mraid && window.mraid._fire) {
          window.mraid._fire('audioVolumeChange', data.value ? 0 : 1);
        }
      }
      if (data.type === 'pause') {
        window.dispatchEvent(new Event('luna:unsafe:pause'));
        // Hard-stop ALL audio: suspend every tracked AudioContext
        if (window.__trackedAudioContexts) {
          window.__trackedAudioContexts.forEach(function(ctx) {
            try { if (ctx.state !== 'closed') ctx.suspend(); } catch(e) {}
          });
        }
        // Pause every <audio> and <video> element and reset playback position
        try {
          document.querySelectorAll('audio, video').forEach(function(el) {
            try { el.pause(); el.currentTime = 0; } catch(e) {}
          });
        } catch(e) {}
        // Also mute so any audio that slips through is silent
        if (window.mraid && window.mraid._fire) {
          window.mraid._fire('audioVolumeChange', 0);
        }
      }
      if (data.type === 'resume') {
        window.dispatchEvent(new Event('luna:unsafe:resume'));
        // Resume all tracked AudioContexts
        if (window.__trackedAudioContexts) {
          window.__trackedAudioContexts.forEach(function(ctx) {
            try { if (ctx.state === 'suspended') ctx.resume(); } catch(e) {}
          });
        }
      }
    } catch(err) {}
  });
})();
true;
`;

const PlayableCard = forwardRef(function PlayableCard(
  { uri, isActive, isMuted, onMessage, onLoadEnd, onLoadStart },
  ref
) {
  const internalRef = useRef(null);
  const webRef = ref || internalRef;

  useEffect(() => {
    if (!webRef.current) return;
    webRef.current.injectJavaScript(MSG.MUTE(isMuted));
  }, [isMuted]);

  useEffect(() => {
    if (!webRef.current) return;
    if (isActive) {
      webRef.current.injectJavaScript(MSG.RESUME());
    } else {
      // Pause then immediately force-mute to guarantee silence
      webRef.current.injectJavaScript(MSG.PAUSE());
      webRef.current.injectJavaScript(MSG.MUTE(true));
    }
  }, [isActive]);

  const handleMessage = (event) => {
    const parsed = parseWebViewMessage(event.nativeEvent.data);
    if (parsed) {
      // Log debug messages from the WebView
      if (parsed.type === '__open_url' && parsed.url) {
        Linking.openURL(parsed.url).catch(err =>
          console.warn('[PlayableCard] Linking.openURL failed:', err)
        );
      } else if (parsed.type === '__webview_error') {
        console.log('[PlayableCard] JS Error in WebView:', parsed.message, parsed.filename, 'L' + parsed.lineno);
      } else if (parsed.type === '__resource_error') {
        console.log('[PlayableCard] Resource load failed:', parsed.tagName, parsed.src);
      }
      if (onMessage) {
        onMessage(parsed);
      }
    }
  };

  const handleError = (syntheticEvent) => {
    const { nativeEvent } = syntheticEvent;
    console.warn('[PlayableCard] WebView error:', nativeEvent.description || nativeEvent);
  };

  const handleHttpError = (syntheticEvent) => {
    const { nativeEvent } = syntheticEvent;
    console.warn('[PlayableCard] HTTP error:', nativeEvent.statusCode, nativeEvent.url);
  };

  // Catch direct WebView navigation to App Store / market URLs
  const handleShouldStartLoad = ({ url }) => {
    if (
      url.startsWith('https://apps.apple.com') ||
      url.startsWith('itms-apps://') ||
      url.startsWith('market://')
    ) {
      Linking.openURL(url).catch(err =>
        console.warn('[PlayableCard] Linking.openURL (nav) failed:', err)
      );
      return false; // block WebView from navigating
    }
    return true;
  };

  return (
    <View style={styles.container}>
      <WebView
        ref={webRef}
        source={{ uri }}
        style={styles.webView}
        injectedJavaScriptBeforeContentLoaded={PRE_CONTENT_SHIM}
        injectedJavaScript={BRIDGE_INJECTION}
        onMessage={handleMessage}
        onLoadStart={onLoadStart}
        onLoadEnd={onLoadEnd}
        onShouldStartLoadWithRequest={handleShouldStartLoad}
        onError={handleError}
        onHttpError={handleHttpError}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
        originWhitelist={['*']}
        mixedContentMode="always"
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        renderLoading={() => <ActivityIndicator color="#fe2c55" style={styles.loader} />}
        startInLoadingState
      />
    </View>
  );
});

export default PlayableCard;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  webView: {
    flex: 1,
    backgroundColor: '#000',
  },
  loader: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -12 }, { translateY: -12 }],
  },
});

