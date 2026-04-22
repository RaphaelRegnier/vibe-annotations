// Vibe Annotations content-script entrypoint.
//
// TODO (wxt-migration follow-up): port the 14 modules under modules/content/ from
// IIFEs with top-level `var VibeXxx = …` globals to proper ES modules with
// `export default`. The original orchestrator body is preserved at
// modules/content/orchestrator.js.pre-wxt as a reference — once modules expose
// `export default`, re-import them here, call their init()s, and restore the
// body. For now this stub only verifies the manifest shape end-to-end.

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
  allFrames: true,
  runAt: 'document_idle',
  cssInjectionMode: 'manual',
  async main() {
    // eslint-disable-next-line no-console
    console.log('[Vibe] content entrypoint loaded (stub — module port pending)');
  },
});
