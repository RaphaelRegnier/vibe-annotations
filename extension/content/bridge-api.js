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
     * Create an annotation on an element.
     * @param {string} selector - CSS selector for the target element
     * @param {Object} options
     * @param {string} [options.comment] - Description of the change
     * @param {Object} [options.cssChanges] - camelCase CSS prop → value map, e.g. { fontSize: '48px' }
     * @param {string} [options.textChange] - New text content for the element
     * @returns {Promise<{ id: string, success: boolean }>}
     */
    createAnnotation(selector, options = {}) {
      return request('createAnnotation', { selector, ...options });
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
