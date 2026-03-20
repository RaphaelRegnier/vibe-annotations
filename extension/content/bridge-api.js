// Page-world bridge API for Claude Chrome integration
// Runs in "world": "MAIN" so window.__vibeAnnotations is accessible to javascript_tool
// Communicates with the content script (isolated world) via CustomEvents

(function () {
  'use strict';

  if (window.__vibeAnnotations) return; // Already injected

  const TIMEOUT = 5000;
  let reqId = 0;

  function request(method, args) {
    return new Promise((resolve, reject) => {
      const id = '__vibe_' + (++reqId) + '_' + Date.now();
      const timer = setTimeout(() => {
        document.removeEventListener('vibe-bridge:response', handler);
        reject(new Error('Vibe Annotations: request timed out'));
      }, TIMEOUT);

      function handler(e) {
        if (e.detail?.id !== id) return;
        document.removeEventListener('vibe-bridge:response', handler);
        clearTimeout(timer);
        if (e.detail.error) reject(new Error(e.detail.error));
        else resolve(e.detail.result);
      }

      document.addEventListener('vibe-bridge:response', handler);
      document.dispatchEvent(new CustomEvent('vibe-bridge:request', {
        detail: { id, method, args }
      }));
    });
  }

  window.__vibeAnnotations = {
    /**
     * Create an annotation on an element and apply changes to the DOM.
     * Preferred: pass changes via cssChanges/textChange — the API applies them AND records originals.
     * Fallback: if you already modified inline styles, the API will auto-detect them.
     *
     * @param {string} selector - CSS selector for the target element
     * @param {Object} options
     * @param {string} [options.comment] - Description of the change
     * @param {Object} [options.cssChanges] - camelCase CSS prop → value map, e.g. { fontSize: '48px', color: '#ff0000' }
     * @param {string} [options.textChange] - New text content for the element
     * @returns {Promise<{ id: string, success: boolean }>}
     */
    createAnnotation(selector, options = {}) {
      return request('createAnnotation', { selector, ...options });
    },

    /**
     * Create a stylesheet annotation — CSS rules applied globally via <style> injection.
     * Use for broad design changes (themes, resets, global overrides) instead of per-element annotations.
     * Rules persist across reloads and are transmitted to coding agents alongside element annotations.
     *
     * @param {string} css - Raw CSS rules, e.g. "body { background: #0d0d0d; } h1 { font-size: 48px; }"
     * @param {Object} [options]
     * @param {string} [options.comment] - Description of the stylesheet changes
     * @returns {Promise<{ id: string, success: boolean }>}
     */
    createStyleAnnotation(css, options = {}) {
      return request('createStyleAnnotation', { css, ...options });
    },

    /**
     * Get all annotations for the current page.
     * @returns {Promise<Array>} Annotations with id, selector, comment, pending_changes, element_context
     */
    getAnnotations() {
      return request('getAnnotations');
    },

    /**
     * Delete an annotation by ID.
     * @param {string} id - Annotation ID
     * @returns {Promise<{ success: boolean }>}
     */
    deleteAnnotation(id) {
      return request('deleteAnnotation', { id });
    },

    /**
     * Check extension and server status.
     * @returns {Promise<{ extension: boolean, server: boolean }>}
     */
    status() {
      return request('status');
    }
  };
})();
