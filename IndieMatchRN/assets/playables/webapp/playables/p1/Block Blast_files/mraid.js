// MRAID 2.0 reference - https://www.iab.com/wp-content/uploads/2015/08/IAB_MRAID_v2_FINAL.pdf
// Based on Nexage's MRAID code:
// Created by Jay Tucker on 9/16/13.
// Copyright (c) 2013 Nexage, Inc. All rights reserved.
// Changes:
// - Added firing state change and ready event on load
// - Removed JS -> Native bridge and other unnecessary logic.
// - Preserve previous listeners

function stBootstrap_mraid() {
    if (typeof window.stBootstrapped_mraid != "undefined") {
        return
    }

    window.stBootstrapped_mraid = true


    var previousListeners = {};
    if(window.mraid) {
        previousListeners =  window.mraid.listeners;
    }
    var mraid = window.mraid = {};

    // Internal

    mraid.logInfo = function(message) {
        var args = Array.prototype.slice.call(arguments);
        args.splice(0, 0, "[info]")
        console.log.apply(null, args);
    };

    mraid.logWarning = function (message) {
        var args = Array.prototype.slice.call(arguments);
        args.splice(0, 0, "[warning]")
        console.log.apply(null, args);
    }

    mraid.logError = function(message) {
        var args = Array.prototype.slice.call(arguments);
        args.splice(0, 0, "[info]")
        console.error.apply(null, args);
    };

    mraid.log = function(message) {
        console.log(message);
    };

    mraid.dispatchError = function(action, message) {
        console.error("dispatchError", action, message);
    };

    mraid.dispatchEvent = function(event) {
        var args = Array.prototype.slice.call(arguments);
        args.shift();
        mraid.logInfo("dispatchEvent", event, ":", args);
        var listenersForEvent = mraid.listeners[event];
        if (!listenersForEvent) {
            mraid.logInfo("No listeners for event");
            return;
        }
        var count = listenersForEvent.length;
        mraid.logInfo(count, "listener(s)");
        for (var index = 0; index < count; index += 1) {
            eventListeners[i].apply(null, args);
        }
    }

    mraid.arrayContainsValue = function(array, value) {
        for (var index in array) {
            if (array[index] === value) {
                return true;
            }
        }
        return false;
    };

    mraid.dispatchEvent = function(event) {
        var args = Array.prototype.slice.call(arguments);
        args.shift();
        mraid.logInfo("dispatchEvent", event, "[", args, "]");

        var listeners = mraid.listeners[event];

        if (!listeners) {
            mraid.logInfo("No listeners.");
            return;
        }

        var count = listeners.length;
        mraid.logInfo(count, "listener(s)");
        for (var index = 0; index < count; index += 1) {
            listeners[index].apply(null, args);
        }
    };

    // Constants

    mraid.VERSION = "2.0";

    mraid.STATES = {
        "LOADING" : "loading",
        "DEFAULT" : "default",
        "EXPANDED" : "expanded",
        "RESIZED" : "resized",
        "HIDDEN" : "hidden"
    };

    mraid.PLACEMENT_TYPES = {
        "INLINE" : "inline",
        "INTERSTITIAL" : "interstitial"
    };

    mraid.RESIZE_PROPERTIES_CUSTOM_CLOSE_POSITION = {
        "TOP_LEFT" : "top-left",
        "TOP_CENTER" : "top-center",
        "TOP_RIGHT" : "top-right",
        "CENTER" : "center",
        "BOTTOM_LEFT" : "bottom-left",
        "BOTTOM_CENTER" : "bottom-center",
        "BOTTOM_RIGHT" : "bottom-right"
    };

    mraid.ORIENTATION_PROPERTIES_FORCE_ORIENTATION = {
        "PORTRAIT" : "portrait",
        "LANDSCAPE" : "landscape",
        "NONE" : "none"
    };

    mraid.EVENTS = {
        "ERROR" : "error",
        "READY" : "ready",
        "SIZECHANGE" : "sizeChange",
        "STATECHANGE" : "stateChange",
        "VIEWABLECHANGE" : "viewableChange"
    };

    mraid.SUPPORTED_FEATURES = {
        "SMS" : "sms",
        "TEL" : "tel",
        "CALENDAR" : "calendar",
        "STOREPICTURE" : "storePicture",
        "INLINEVIDEO" : "inlineVideo"
    };

    // Variables

    mraid.currentOrientation = 0;
    mraid.listeners = {};
    if(previousListeners) {
        mraid.listeners = previousListeners;
    }
    mraid.state = mraid.STATES.LOADING;
    mraid.placementType = mraid.PLACEMENT_TYPES.INLINE;
    mraid.supportedFeatures = {};
    mraid.viewable = false;
    mraid.isResizeReady = false;

    mraid.expandProperties = {
        "width" : 0,
        "height" : 0,
        "useCustomClose" : false,
        "isModal" : true
    };

    mraid.orientationProperties = {
        "allowOrientationChange" : true,
        "forceOrientation" : mraid.ORIENTATION_PROPERTIES_FORCE_ORIENTATION.NONE
    };

    mraid.resizeProperties = {
        "width" : 0,
        "height" : 0,
        "customClosePosition" : mraid.RESIZE_PROPERTIES_CUSTOM_CLOSE_POSITION.TOP_RIGHT,
        "offsetX" : 0,
        "offsetY" : 0,
        "allowOffscreen" : true
    };

    mraid.currentPosition = {
        "x" : 0,
        "y" : 0,
        "width" : window.innerWidth,
        "height" : window.innerHeight
    };

    mraid.defaultPosition = {
        "x" : 0,
        "y" : 0,
        "width" : window.innerWidth,
        "height" : window.innerHeight
    };

    mraid.maxSize = {
        "width" : window.innerWidth,
        "height" : window.innerHeight
    };

    mraid.screenSize = {
        "width" : window.innerWidth,
        "height" : window.innerHeight
    };

    /*
    Spec APIs
    • addEventListener
    • createCalendarEvent
    • close
    • expand
    • getCurrentPosition
    • getDefaultPosition
    • getExpandProperties
    • getMaxSize
    • getPlacementType
    • getResizeProperties
    • getScreenSize
    • getState
    • getVersion
    • isViewable
    • open
    • playVideo
    • removeEventListener
    • resize
    • setExpandProperties
    • setResizeProperties
    • storePicture
    • supports
    • useCustomClose
    */

    mraid.addEventListener = function(event, listener) {
        mraid.logInfo("mraid.addEventListener", event + ":", listener);

        if (!event || !listener) {
            mraid.dispatchError("addEventListener", "Both event and listener are required.");
            return;
        }

        if (!mraid.arrayContainsValue(mraid.EVENTS, event)) {
            mraid.dispatchError("addEventListener", "Uknown MRAID event: " + event);
            return;
        }

        var listenersForEvent = mraid.listeners[event] = mraid.listeners[event] || [];
        var newListenerString = String(listener);

        for (var index = 0; index < listenersForEvent.count; index += 1) {
            if (listener === listenersForEvent[index]) {
                mraid.logInfo("listener", newListenerString, "is already registered.");
                return;
            }
        }

        listenersForEvent.push(listener);
    };

    mraid.createCalendarEvent = function(parameters) {
        mraid.logInfo("mraid.createCalendarEvent", parameters);
    };

    mraid.close = function() {
        mraid.logInfo("mraid.close")
    }

    mraid.expand = function (url) {
        mraid.logInfo("mraid.expand", url)
    }

    mraid.getCurrentPosition = function () {
        mraid.logInfo("mraid.getCurrentPosition")
        return mraid.currentPosition;
    }

    mraid.getDefaultPosition = function() {
        mraid.logInfo("mraid.getDefaultPosition");
        return mraid.defaultPosition;
    };

    mraid.getExpandProperties = function() {
        mraid.logInfo("mraid.getExpandProperties");
        return mraid.expandProperties;
    };

    mraid.getMaxSize = function() {
        mraid.logInfo("mraid.getMaxSize", mraid.maxSize.width, "x", mraid.maxSize.height);
        return mraid.maxSize;
    };

    mraid.getPlacementType = function() {
        return mraid.placementType;
    };

    mraid.getOrientationProperties = function() {
        mraid.logInfo("mraid.getOrientationProperties");
        return mraid.orientationProperties;
    };

    mraid.getResizeProperties = function() {
        mraid.logInfo("mraid.getResizeProperties");
        return mraid.resizeProperties;
    };

    mraid.getScreenSize = function() {
        mraid.logInfo("mraid.getScreenSize");
        return mraid.screenSize;
    };

    mraid.getState = function() {
        mraid.logInfo("mraid.getState");
        return mraid.state;
    };

    mraid.getVersion = function() {
        mraid.logInfo("mraid.getVersion");
        return mraid.VERSION;
    };

    mraid.isViewable = function() {
        mraid.logInfo("mraid.isViewable");
        return mraid.viewable;
    };

    mraid.open = function(url) {
        mraid.logInfo("mraid.open", url);
        window.st_showNavigationBanner();
    };

    mraid.playVideo = function(url) {
        mraid.logInfo("mraid.playVideo", url);
    };

    mraid.removeEventListener = function(event, listener) {
        mraid.logInfo("mraid.removeEventListener", event, ":", String(listener));

        if (!event) {
            mraid.dispatchError("removeEventListener", "Event is required.")
            return;
        }

        if (!mraid.arrayContainsValue(mraid.EVENTS, event)) {
            mraid.dispatchError("removeEventListener", "Uknown MRAID event: " + event);
            return;
        }

        if (!mraid.listeners.hasOwnProperty(event)) {
            mraid.logInfo("No listeners registered for", event);
            return;
        }

        if (!listener) {
            // No listener provided, remove all for this event
            delete listeners[event];
            return;
        }

        var listenersForEvent = mraid.listeners[event];
        var count = listenersForEvent.count;

        var listenerString = String(listener);
        for (var index = 0; index < count; index += 1) {
            var registeredListener = listenersForEvent[index];
            var registeredListenerString = String(registeredListener);
            var listenersMatch = listener === registeredListener;
            var listenerStringsMatch = registeredListenerString == listenerString;

            if (listenersMatch || listenerStringsMatch) {
                listenersForEvent.splice(index, 1);
                break;
            }

            if (index === count) {
                mraid.logInfo("Listener", listenerString, "not found for event", event)
            }

            if (listenersForEvent.length === 0) {
                delete mraid.listeners[event];
            }
        }
    }

    mraid.resize = function() {
        mraid.logInfo("mraid.resize");
    }

    mraid.setExpandProperties = function(properties) {
        mraid.logInfo("mraid.setExpandProperties (unimplemented)", properties);
    }

    mraid.setOrientationProperties = function(properties) {
        mraid.logInfo("mraid.setOrientationProperties (unimplemented)", properties);
    }

    mraid.setResizeProperties = function(properties) {
        mraid.logInfo("mraid.setResizeProperties (unimplemented)", properties);
    }

    mraid.storePicture = function() {
        mraid.logInfo("mraid.storePicture");
    };

    mraid.supports = function(feature) {
        mraid.logInfo("mraid.supports", feature, "= false");
        return false;
    };

    mraid.useCustomClose = function(isCustomClose) {
        mraid.logInfo("mraid.useCustomClose", isCustomClose);
    };

    mraid._markReady = function() {
        mraid.state = mraid.STATES.DEFAULT;
        mraid.dispatchEvent(mraid.EVENTS.STATECHANGE, mraid.state);
        
        mraid.viewable = true;
        mraid.dispatchEvent(mraid.EVENTS.VIEWABLECHANGE, mraid.viewable);
        
        mraid.dispatchEvent(mraid.EVENTS.READY);
    };

    mraid.ST = true;

    startMraid = function() {
        window.mraid._markReady();
    }
    
    if(document.readyState === "complete") {
        startMraid();
    } else {
        window.addEventListener("load", startMraid);
    }
}

stBootstrap_mraid();
