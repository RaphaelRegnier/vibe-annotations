// Creates and manages the shadow DOM host for all Vibe UI

var VibeShadowHost = (() => {
  let hostEl = null;
  let shadowRoot = null;

  function init() {
    if (hostEl) return shadowRoot;

    hostEl = document.createElement('div');
    hostEl.id = 'vibe-annotations-root';
    hostEl.style.cssText = `
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      pointer-events: none !important;
      z-index: 2147483647 !important;
      overflow: visible !important;
    `;

    shadowRoot = hostEl.attachShadow({ mode: 'open' });

    // Inject styles synchronously
    const styleEl = document.createElement('style');
    styleEl.textContent = VIBE_STYLES;
    shadowRoot.appendChild(styleEl);

    document.body.appendChild(hostEl);

    return shadowRoot;
  }

  function getRoot() {
    return shadowRoot;
  }

  function getHost() {
    return hostEl;
  }

  function destroy() {
    if (hostEl && hostEl.parentNode) {
      hostEl.parentNode.removeChild(hostEl);
    }
    hostEl = null;
    shadowRoot = null;
  }

  function hide() {
    if (hostEl) hostEl.style.display = 'none';
    VibeAPI.saveOverlayHidden(true);
  }

  function show() {
    if (hostEl) hostEl.style.display = '';
    VibeAPI.saveOverlayHidden(false);
  }

  function isVisible() {
    return hostEl && hostEl.style.display !== 'none';
  }

  function toggle() {
    if (isVisible()) { hide(); } else { show(); }
  }

  return { init, getRoot, getHost, destroy, hide, show, isVisible, toggle };
})();
