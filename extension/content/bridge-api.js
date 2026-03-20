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
     * API guide — read this first to choose the right method.
     * Agents: call this to understand available methods before making changes.
     */
    help() {
      return {
        overview: 'Vibe Annotations API — record visual design changes as annotations. A coding agent will later read these annotations and implement them in source code. You handle the visual preview, the coding agent handles the source files.',
        workflow: {
          step1: 'Assess the requested changes — split them into global styling vs component-level edits vs structural changes.',
          step2: 'Apply global/theme CSS with createStyleAnnotation (fast — just write CSS with generic selectors).',
          step3: 'Apply component-level CSS/text tweaks with createAnnotation (target by simple selector — the API auto-captures full element context).',
          step4: 'For structural changes (add/remove elements, reorder layout), use createAnnotation with comment only — describe what the coding agent should do, do NOT attempt DOM surgery.',
        },
        methods: {
          createStyleAnnotation: {
            when: 'Global/broad CSS: themes, colors, typography, spacing resets, animations, pseudo-elements — anything targeting body, html, :root, tag selectors, or multiple elements.',
            signature: 'createStyleAnnotation(css, { comment })',
            example: 'createStyleAnnotation("body { background: #0a0a0a; font-family: \'Courier New\', monospace; } h1, h2 { color: #33ff33; } button { border: 1px solid #33ff33; }", { comment: "Retro CRT theme: dark background, monospace font, green accents" })',
            note: 'Group related rules into one call. This is your fastest tool — use it liberally.'
          },
          createAnnotation: {
            when: 'Single-component edits: change one heading, restyle one button, update specific text. Also use for structural change requests (with comment only, no cssChanges).',
            signature: 'createAnnotation(selector, { comment, cssChanges, textChange })',
            examples: [
              'createAnnotation(".hero h1", { comment: "Bigger heading", cssChanges: { fontSize: "48px" }, textChange: "New Title" })',
              'createAnnotation(".pricing-section", { comment: "Add a third pricing tier card between Pro and Enterprise, matching the existing card design" })'
            ],
            note: 'Use simple selectors (tag, class, id). Do NOT trace CSS module hashes or source files — the API captures element context automatically and the coding agent resolves source mapping from the codebase.'
          },
          getAnnotations: { when: 'Read all annotations on this page.', signature: 'getAnnotations()' },
          deleteAnnotation: { when: 'Remove an annotation by ID.', signature: 'deleteAnnotation(id)' },
          status: { when: 'Check if extension and server are active.', signature: 'status()' }
        },
        important: [
          'Do NOT spend time resolving CSS module hashes, tracing source files, or figuring out build tooling. The coding agent has access to the codebase and handles all source mapping.',
          'Use simple, generic selectors — "h1", ".hero", "button.primary". The API auto-captures classes, parent chain, and source hints.',
          'For structural DOM changes (add/remove/reorder elements), just describe the change in the comment. Do not manipulate the DOM beyond CSS and text edits.',
          'Group related global CSS rules into a single createStyleAnnotation call instead of annotating elements one by one.',
          'Write descriptive comments — they are the primary signal the coding agent uses to understand intent.'
        ]
      };
    },

    /**
     * Create an annotation on a SINGLE element and apply changes to the DOM.
     * For global/broad CSS changes (body, html, themes, resets), use createStyleAnnotation() instead.
     * Preferred: pass changes via cssChanges/textChange — the API applies them AND records originals.
     * Fallback: if you already modified inline styles, the API will auto-detect them.
     *
     * @param {string} selector - CSS selector for the target element (not body/html — use createStyleAnnotation for those)
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
     * USE THIS for broad design changes: themes, resets, global overrides, body/html styles.
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
