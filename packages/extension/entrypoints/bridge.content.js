// Page-world bridge API for coding-agent integration.
// Runs in the MAIN world so window.__vibeAnnotations is accessible to the page and to
// browser-automation tools. Communicates with the content-script (ISOLATED) world via
// CustomEvents handled in modules/content/bridge-handler.js.

export default defineContentScript({
  matches: [
    'http://localhost/*',
    'https://localhost/*',
    'http://127.0.0.1/*',
    'https://127.0.0.1/*',
    'http://0.0.0.0/*',
    'https://0.0.0.0/*',
    'http://*.local/*',
    'https://*.local/*',
    'http://*.test/*',
    'https://*.test/*',
    'http://*.localhost/*',
    'https://*.localhost/*',
    'file:///*',
  ],
  world: 'MAIN',
  runAt: 'document_start',
  main() {
    if (window.__vibeAnnotations) return;

    const TIMEOUT = 5000;
    let reqId = 0;

    function request(method, args) {
      return new Promise((resolve, reject) => {
        const id = '__vibe_' + ++reqId + '_' + Date.now();
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
        document.dispatchEvent(
          new CustomEvent('vibe-bridge:request', {
            detail: { id, method, args },
          }),
        );
      });
    }

    window.__vibeAnnotations = {
      help() {
        return {
          overview:
            'Vibe Annotations API — record visual design changes as annotations. A coding agent will later read these annotations and implement them in source code. You handle the visual preview, the coding agent handles the source files.',
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
              example:
                'createStyleAnnotation(":root { --primary: #0066FF; --primary-hover: #0052CC; } button, .btn { background-color: var(--primary); } button:hover, .btn:hover { background-color: var(--primary-hover); }", { comment: "Blue primary color rebrand" })',
              note: 'Group ALL related rules into ONE call. Do not create multiple stylesheet annotations for the same theme — update or delete the old one first.',
            },
            createAnnotation: {
              when: "Single-element edits: restyle one button, change one heading's text, tweak one card's layout. Use cssChanges for inline property overrides, textChange for text content, and css only when that specific element needs pseudo-elements or :hover states.",
              signature: 'createAnnotation(selector, { comment, cssChanges, textChange, css })',
              params: {
                selector: 'CSS selector targeting ONE element — e.g. ".hero h1", "#signup-btn"',
                comment: 'Describe the intent for the coding agent (required for structural changes)',
                cssChanges: 'Inline CSS overrides as { camelCase: "value" } — e.g. { fontSize: "48px", color: "#ff0000" }',
                textChange: 'New text content — the ONLY way to change text. CSS cannot do this.',
                css: 'Raw CSS rules ONLY for pseudo-elements (::before, ::after), states (:hover, :focus), or @media on this element. Do NOT use this for simple property changes — use cssChanges instead.',
              },
              examples: [
                'createAnnotation(".hero h1", { comment: "Bigger heading", cssChanges: { fontSize: "48px" }, textChange: "New Title" })',
                'createAnnotation(".pricing-section", { comment: "Add a third pricing tier card between Pro and Enterprise, matching the existing card design" })',
                'createAnnotation(".cta-btn", { comment: "Hover glow + larger padding", cssChanges: { padding: "16px 32px" }, css: ".cta-btn:hover { box-shadow: 0 0 20px gold; }" })',
              ],
              note: 'Use simple selectors (tag, class, id). Do NOT trace CSS module hashes or source files — the API captures element context automatically.',
            },
            getAnnotations: { when: 'Read existing annotations BEFORE creating new ones — prevents duplicates.', signature: 'getAnnotations()' },
            deleteAnnotation: { when: 'Remove an annotation by ID. Use this to clean up before replacing with an updated version.', signature: 'deleteAnnotation(id)' },
            exportAnnotations: { when: 'Export all annotations as a portable JSON object.', signature: 'exportAnnotations(scope?)', example: 'exportAnnotations("project")' },
            status: { when: 'Check if extension and server are active.', signature: 'status()' },
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
            'For structural DOM changes (add/remove/reorder elements), describe the change in the comment. Do not manipulate the DOM.',
          ],
        };
      },

      createAnnotation(selector, options = {}) {
        return request('createAnnotation', { selector, ...options });
      },

      createStyleAnnotation(css, options = {}) {
        return request('createStyleAnnotation', { css, ...options });
      },

      getAnnotations() {
        return request('getAnnotations');
      },

      exportAnnotations(scope = 'project') {
        return request('exportAnnotations', { scope });
      },

      deleteAnnotation(id) {
        return request('deleteAnnotation', { id });
      },

      status() {
        return request('status');
      },
    };
  },
});
