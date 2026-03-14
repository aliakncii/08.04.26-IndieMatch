function stBootstrapNetworkRewriting() {
    if (!window.sensor_tower_artifacts) {
        console.warn("Sensor Tower: Missing artifact list.");
        window.sensor_tower_artifacts = [];
    }

    var namespace = window.st_network_rewriting = {};

    // Get notified on all DOM mutations
    var options = {
        attributes: true,
        childList: true,
        subtree: true
    }

    var mutationCallback = function(records, observer) {
        records.forEach( record => {
            if (record.type == "childList") {
                record.addedNodes.forEach ( node => {
                    if (node.tagName == "STYLE") {
                        parseStyleSheet(node.sheet);
                    }
                    if (node.hasAttribute && node.hasAttribute("src")) {
                        let newSrc = overrideForUrl(node.getAttribute("src"), false);
                        if (newSrc != null) {
                            node.setAttribute("src", newSrc);
                        }
                    }
                })
            } else if (record.type == "attributes") {
                handleAttributesMutation(record.target, record.attributeName);
            }
        });
    }

    function handleAttributesMutation(node, attributeName) {
        if (attributeName == "src") {
            let newSrc = overrideForUrl(node.getAttribute("src"), false);
            if (newSrc != null) {
                node.setAttribute("src", newSrc);
            }
        }
    }

    function parseStyleSheet(styleSheet) {
        artifacts = window.sensor_tower_artifacts;

        let rules = styleSheet.rules;
        for(var index = 0; index < rules.length; index += 1) {
            let rule = rules[index]
            if (!rule.style) { continue; }
            if (!rule.style.backgroundImage) { continue; }
            if (rule.style.backgroundImage == "none") { continue; }
            let newValue = overrideForUrl(rule.style.backgroundImage, true);
            if (newValue != null) {
                rule.style.backgroundImage = newValue;
            }
        }
    }

    function overrideForUrl(url, useRegex) {

        var replacementUrl = null;
        var path;
        try {
            const uri = new URL(url);
            path = uri.pathname.split("/");
        } catch (error) {
            path = url.split("/");
        }

        var lastPathComponent = path[path.length - 1];
        if (lastPathComponent == "mraid.js") {
            replacementUrl = "https://adbl0ck.s3.us-west-1.amazonaws.com/injected_javascript/mraid.js";
        } else if (lastPathComponent == "dapi.js") {
            replacementUrl = "https://adbl0ck.s3.us-west-1.amazonaws.com/injected_javascript/dapi.js";
        } else if (!useRegex) {
            try {
                const targetUrl = new URL(url);
                const currentUrl = new URL(location.href);
                // only replace if the URL is on the same host
                if (targetUrl.host != currentUrl.host) {
                    return null;
                }
            } catch (error) {
                // Failed to parse absolute URL. We don't need to check host for relative paths.
            }
        }


        var artifacts = window.sensor_tower_artifacts;

        if (!replacementUrl) {
            for(var artifactIndex = 0; artifactIndex < artifacts.length; artifactIndex += 1) {
                var artifact = artifacts[artifactIndex];
                if (artifact[0] == '/') {
                    artifact = artifact.substr(1);
                }

                if (useRegex) {
                    let regex = new RegExp(artifact, 'i')
                    let newValue = url.replace(regex, artifact);
                    if (newValue != url) {
                        replacementUrl = newValue;
                        break;
                    }
                } else if (url.toLowerCase().endsWith(artifact.toLowerCase()) && url != artifact) {
                    replacementUrl = artifact;
                    break;
                }
            }
        }

        if (!replacementUrl) {
            return null;
        }

        if (url == replacementUrl) {
            return null;
        }

        return replacementUrl;
    }

    function rewriteScriptUrlsInHtml(html) {
        try {
            var parser = new DOMParser();
            var doc = parser.parseFromString(html, 'text/html');
            var scripts = doc.querySelectorAll('script[src]');
            
            scripts.forEach(function(script) {
                var newSrc = overrideForUrl(script.getAttribute('src'), false);
                if (newSrc) {
                    script.setAttribute('src', newSrc);
                }
            });
            
            return doc.documentElement.outerHTML;
        } catch (error) {
            return html;
        }
    }

    var observer = new MutationObserver(mutationCallback);

    if (document.documentElement) {
        observer.observe(document.documentElement, options);
    }
    

    // Intercept AJAX

    var xhr_open_original = window.XMLHttpRequest.prototype.open;
    function intercept_xhr_open(method, url, async, username, password) {
        let newUrl = overrideForUrl(url, false);
        if (newUrl != null) {
            arguments[1] = newUrl;
        }
        xhr_open_original.apply(this, arguments);
    }
    window.XMLHttpRequest.prototype.open = intercept_xhr_open;

    // Intercept iframe srcdoc
    var iframeDescriptor = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'srcdoc');
    if (iframeDescriptor && iframeDescriptor.set) {
        var originalSrcdocSetter = iframeDescriptor.set;
        Object.defineProperty(HTMLIFrameElement.prototype, 'srcdoc', {
            set: function(value) {
                originalSrcdocSetter.call(this, rewriteScriptUrlsInHtml(value));
            },
            get: iframeDescriptor.get
        });
    }

    function injectScriptNamed(name) {
        var script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = `https://adbl0ck.s3.us-west-1.amazonaws.com/injected_javascript/${name}.js`;
        document.head.appendChild(script);
    }

    function detectPlayableLibraries() {
        if (typeof window.dapi != "undefined") {
            injectScriptNamed("dapi");
        }

        if (typeof window.mraid != "undefined") {
            injectScriptNamed("mraid");
        }
    }

    
    window.st_navigationAttempts = 0;
    window.st_bannerTimeout = null;
    
    window.st_resetNavigationState = function() {
        window.st_navigationAttempts = 0;
        var banner = document.getElementById('st-navigation-banner');
        if (banner) banner.remove();
        if (window.st_bannerTimeout) {
            clearTimeout(window.st_bannerTimeout);
            window.st_bannerTimeout = null;
        }
    };
    
    window.st_showNavigationBanner = function() {
        window.st_navigationAttempts++;
        
        console.log(`🚫 Navigation blocked #${window.st_navigationAttempts}`);
        
        var banner = document.getElementById('st-navigation-banner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'st-navigation-banner';
            banner.style.cssText = `
                position: fixed; top: 0; left: 0; right: 0; background-color: #3fa887;
                color: white; font-family: Arial, sans-serif; font-size: 16px; font-weight: bold;
                z-index: 999999; border-bottom: 3px solid #2d7a5f; min-height: 40px;
                padding: 10px 20px; text-align: center; line-height: 1.4;
            `;
            banner.innerHTML = `🚫 Page attempted to navigate away`;
            document.body.appendChild(banner);
        }
        
        if (window.st_bannerTimeout) clearTimeout(window.st_bannerTimeout);
        window.st_bannerTimeout = setTimeout(function() {
            if (banner) banner.remove();
        }, 5000);
    };

    function listenForPageNavigation() {
        document.addEventListener('click', function(event) {
            const button = event.target.closest('button');
            if (button && button.onclick) {
                const onclickCode = button.getAttribute('onclick');
                if (onclickCode && (onclickCode.includes('location.href') || onclickCode.includes('location.assign') || 
                    onclickCode.includes('location.replace') || onclickCode.includes('location.reload') || 
                    onclickCode.includes('history.pushState') || onclickCode.includes('history.replaceState') || 
                    onclickCode.includes('window.open') || onclickCode.includes('.submit()'))) {
                    
                    event.preventDefault();
                    event.stopPropagation();
                    window.st_showNavigationBanner();
                    return false;
                }
            }
            
            const link = event.target.closest('a');
            if (link && link.href && link.href !== window.location.href) {
                event.preventDefault();
                event.stopPropagation();
                window.st_showNavigationBanner();
                return false;
            }
        }, true);

        document.addEventListener('submit', function(event) {
            const form = event.target;
            if (form.action && form.action !== window.location.href) {
                event.preventDefault();
                event.stopPropagation();
                window.st_showNavigationBanner();
                return false;
            }
        }, true);

        window.location.assign = function(url) {
            window.st_showNavigationBanner();
            return false;
        };

        window.location.replace = function(url) {
            window.st_showNavigationBanner();
            return false;
        };

        window.location.reload = function(force) {
            window.st_showNavigationBanner();
            return false;
        };

        history.pushState = function(state, title, url) {
            window.st_showNavigationBanner();
            return false;
        };

        history.replaceState = function(state, title, url) {
            window.st_showNavigationBanner();
            return false;
        };

        window.open = function(url) {
            window.st_showNavigationBanner();
            return null;
        };

        HTMLFormElement.prototype.submit = function() {
            window.st_showNavigationBanner();
            return false;
        };
    }

    listenForPageNavigation();

    namespace.runOnPageLoadHasRun = false;
    function runOnPageLoad() {
        if(namespace.runOnPageLoadHasRun) {
            return;
        }

        namespace.runOnPageLoadHasRun = true;

        detectPlayableLibraries();
    }

    window.addEventListener('load', runOnPageLoad);
    
    // workaround for document.open clearing event listeners
    // specifically `al_renderHtml` from AppLovin using this method
    window.documentOpenOriginal = document.open;
    document.open = function() {
        window.documentOpenOriginal.apply(this, arguments);

        if (namespace.runOnPageLoadHasRun) {
            return;
        }

        window.addEventListener('load', runOnPageLoad);
    }
}

stBootstrapNetworkRewriting();