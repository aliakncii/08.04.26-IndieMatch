// src/utils/messageBridge.js
// Helpers for the RN ↔ WebView message bridge.
// RN to WebView: use webViewRef.current.injectJavaScript(MSG.MUTE(true))
// WebView to RN: webView onMessage fires with event.nativeEvent.data (JSON string)

/** Messages we SEND to playables (RN → WebView) */
export const MSG = {
  /** Send mute state to a playable. Matches the web's postMessage({ type: 'mute', value: bool }) */
  MUTE: (muted) => `window.postMessage(${JSON.stringify({ type: 'mute', value: muted })}, '*'); true;`,
  PAUSE: () => `window.postMessage(${JSON.stringify({ type: 'pause' })}, '*'); true;`,
  RESUME: () => `window.postMessage(${JSON.stringify({ type: 'resume' })}, '*'); true;`,
};

/**
 * Injected JS snippet added to every WebView via injectedJavaScript prop.
 * Bridges window.ReactNativeWebView.postMessage so playables can report events back to RN.
 * Also re-dispatches incoming postMessages from RN so existing playable listeners work unmodified.
 */
export const BRIDGE_INJECTION = `
(function() {
  // Prevent double-injection
  if (window.__indieBridgeInstalled) return;
  window.__indieBridgeInstalled = true;

  // Forward outgoing messages to RN (from playable → RN)
  var _origPostMessage = window.postMessage.bind(window);
  window.addEventListener('message', function(e) {
    try {
      var data = typeof e.data === 'string' ? e.data : JSON.stringify(e.data);
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(data);
      }
    } catch(err) {}
  });

  // Make sure postMessage still works for same-window dispatch (playable self-messaging)
  window.postMessage = function(msg, origin) {
    _origPostMessage(msg, origin || '*');
    // Also notify RN of outgoing messages
    try {
      var data = typeof msg === 'string' ? msg : JSON.stringify(msg);
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(data);
      }
    } catch(err) {}
  };
})();
true; // required by react-native-webview
`;

/**
 * Parse a raw message string received from WebView onMessage.
 * Returns an object or null.
 */
export function parseWebViewMessage(rawData) {
  try {
    return JSON.parse(rawData);
  } catch (e) {
    return null;
  }
}
