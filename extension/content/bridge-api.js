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
          step1: 'Call getAnnotations() first to see what already exists — avoid duplicates.',
          step2: 'Assess the requested changes — split them into global styling vs component-level edits vs structural changes.',
          step3: 'Apply global/theme CSS with createStyleAnnotation (one call for all related rules).',
          step4: 'Apply component-level CSS/text tweaks with createAnnotation (target by simple selector — the API auto-captures full element context).',
          step5: 'For text changes, use textChange param — CSS cannot change text content.',
          step6: 'For structural changes (add/remove elements, reorder layout), use createAnnotation with comment only — describe what the coding agent should do, do NOT attempt DOM surgery.',
        },
        methods: {
          createStyleAnnotation: {
            when: 'Global/broad CSS only: themes, color palettes, typography, spacing resets, animations — anything targeting :root, body, tag selectors, or many elements at once.',
            signature: 'createStyleAnnotation(css, { comment })',
            example: 'createStyleAnnotation(":root { --primary: #0066FF; --primary-hover: #0052CC; } button, .btn { background-color: var(--primary); } button:hover, .btn:hover { background-color: var(--primary-hover); }", { comment: "Blue primary color rebrand" })',
            note: 'Group ALL related rules into ONE call. Do not create multiple stylesheet annotations for the same theme — update or delete the old one first.'
          },
          createAnnotation: {
            when: 'Single-element edits: restyle one button, change one heading\'s text, tweak one card\'s layout. Use cssChanges for inline property overrides, textChange for text content, and css only when that specific element needs pseudo-elements or :hover states.',
            signature: 'createAnnotation(selector, { comment, cssChanges, textChange, css })',
            params: {
              selector: 'CSS selector targeting ONE element — e.g. ".hero h1", "#signup-btn"',
              comment: 'Describe the intent for the coding agent (required for structural changes)',
              cssChanges: 'Inline CSS overrides as { camelCase: "value" } — e.g. { fontSize: "48px", color: "#ff0000" }',
              textChange: 'New text content — the ONLY way to change text. CSS cannot do this.',
              css: 'Raw CSS rules ONLY for pseudo-elements (::before, ::after), states (:hover, :focus), or @media on this element. Do NOT use this for simple property changes — use cssChanges instead.'
            },
            examples: [
              'createAnnotation(".hero h1", { comment: "Bigger heading", cssChanges: { fontSize: "48px" }, textChange: "New Title" })',
              'createAnnotation(".pricing-section", { comment: "Add a third pricing tier card between Pro and Enterprise, matching the existing card design" })',
              'createAnnotation(".cta-btn", { comment: "Hover glow + larger padding", cssChanges: { padding: "16px 32px" }, css: ".cta-btn:hover { box-shadow: 0 0 20px gold; }" })'
            ],
            note: 'Use simple selectors (tag, class, id). Do NOT trace CSS module hashes or source files — the API captures element context automatically.'
          },
          getAnnotations: { when: 'Read existing annotations BEFORE creating new ones — prevents duplicates.', signature: 'getAnnotations()' },
          deleteAnnotation: { when: 'Remove an annotation by ID. Use this to clean up before replacing with an updated version.', signature: 'deleteAnnotation(id)' },
          exportAnnotations: { when: 'Export all annotations as a portable JSON object.', signature: 'exportAnnotations(scope?)', example: 'exportAnnotations("project")' },
          status: { when: 'Check if extension and server are active.', signature: 'status()' }
        },
        rules: [
          'ALWAYS call getAnnotations() first to check for existing annotations. If one already covers what you need, delete it before creating an updated replacement. Never stack duplicate annotations.',
          'To change text content, you MUST use createAnnotation with textChange. CSS cannot change text — a stylesheet annotation with a comment is not a text change.',
          'Use cssChanges (inline overrides) for simple property changes on a single element. Only use the css param when you need pseudo-elements, :hover/:focus, or @media for that element.',
          'Use createStyleAnnotation for broad/global CSS only. If you are targeting a specific element, use createAnnotation instead.',
          'Group related global CSS into ONE createStyleAnnotation call. Do not split a color theme across multiple annotations.',
          'Avoid !important — it creates specificity wars. Use precise selectors instead.',
          'Avoid wildcard attribute selectors like [class*="button"] — they match unrelated elements. Use the actual class names visible in the DOM.',
          'Write descriptive comments — they are the primary signal the coding agent uses to understand intent.',
          'Do NOT trace CSS module hashes, source files, or build tooling. The coding agent has the codebase and handles source mapping.',
          'For structural DOM changes (add/remove/reorder elements), describe the change in the comment. Do not manipulate the DOM.'
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
     * @param {string} [options.css] - Raw CSS rules string for pseudo-elements, :hover/:focus, @media, transitions, etc. Injected as a companion <style> tag.
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
     * Export all annotations as a portable JSON object (same format as the file export).
     * Use this to grab the full export data programmatically — then save to a file or send elsewhere.
     * @param {string} [scope='project'] - 'page' for current page only, 'project' for all from this site
     * @returns {Promise<Object>} Full export envelope with metadata + annotations array
     */
    exportAnnotations(scope = 'project') {
      return request('exportAnnotations', { scope });
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
