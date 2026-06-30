import { defineConfig } from 'wxt';

// Keep the same manifest shape the Chrome Web Store listing expects. WXT generates
// the actual manifest.json from this config plus discovered entrypoints.
export default defineConfig({
  srcDir: '.',
  outDir: '.output',
  webExt: {
    startUrls: ['http://localhost:3001'],
    keepProfileChanges: true,
  },
  manifest: {
    name: 'Vibe Annotations - Visual Feedback for AI Coding Agents',
    description:
      'Visual annotations for localhost dev projects. Send feedback to AI coding agents like Claude & Cursor via MCP.',
    author: 'Raphael Regnier - Spellbind Creative Studio',
    permissions: ['activeTab', 'storage', 'scripting'],
    optional_host_permissions: ['*://*/*'],
    host_permissions: [
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
    icons: {
      16: 'assets/icons/icon16.png',
      32: 'assets/icons/icon32.png',
      48: 'assets/icons/icon48.png',
      128: 'assets/icons/icon128.png',
    },
    action: {
      default_title: 'Vibe Annotations',
    },
    commands: {
      'toggle-annotate': {
        suggested_key: {
          default: 'Ctrl+Shift+Comma',
          mac: 'Command+Shift+Comma',
        },
        description: 'Toggle annotation mode',
      },
    },
    web_accessible_resources: [
      {
        resources: ['assets/fonts/InterVariable.woff2', 'assets/icons/icon-hq.png'],
        matches: ['<all_urls>'],
      },
    ],
  },
});
