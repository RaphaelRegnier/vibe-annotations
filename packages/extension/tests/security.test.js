import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { serverFetch, pairServer, attachmentDataUrl } from '../lib/background/server-fetch.js';
import { captureSenderTab } from '../lib/background/capture.js';
import { shouldTriggerHotkey } from '../lib/content/hotkey.js';

test('closed-shadow inputs still suppress custom hotkeys while typing', () => {
  const shortcut = { key: 'k', ctrlKey: true };
  const event = { key: 'k', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, target: { tagName: 'DIV' } };
  assert.equal(shouldTriggerHotkey(event, shortcut), true);
  assert.equal(shouldTriggerHotkey(event, shortcut, { tagName: 'TEXTAREA' }), false);
  assert.equal(shouldTriggerHotkey(event, shortcut, { tagName: 'INPUT' }), false);
});

test('authenticated background requests keep credentials off URLs and reject redirects', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let token;
  let calls = 0;
  globalThis.chrome = { storage: { session: { get: async () => ({ pairingToken: token }) } } };
  globalThis.fetch = async (url, init) => {
    calls++;
    assert.equal(new URL(url).origin, 'http://127.0.0.1:3846');
    assert.equal(url.includes(token), false);
    assert.equal(init.headers.get('Authorization'), `Bearer ${token}`);
    assert.equal(init.redirect, 'error');
    return new Response('{}');
  };
  await assert.rejects(serverFetch('/api/annotations'), /Pair the server/);
  assert.equal(calls, 0);
  token = 'a'.repeat(64);
  await assert.rejects(serverFetch('https://attacker.example/'), /Invalid annotation server URL/);
  assert.equal(calls, 0);
  await serverFetch('/api/annotations', { headers: { 'Content-Type': 'application/json' } });
  assert.equal(calls, 1);
});

test('pairing validates tokens and never saves rejected credentials', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let saved;
  let calls = 0;
  globalThis.chrome = { storage: { session: { set: async value => { saved = value; } } } };
  globalThis.fetch = async url => {
    calls++;
    return url.endsWith('/health')
      ? new Response('{"authentication":"bearer"}')
      : new Response('{}', { status: 401 });
  };
  await assert.rejects(pairServer('wrong'), /64-character/);
  assert.equal(calls, 0);
  await assert.rejects(pairServer('a'.repeat(64)), /Pairing failed/);
  assert.equal(saved, undefined);
  globalThis.fetch = async url => new Response(url.endsWith('/health') ? '{"authentication":"bearer"}' : '{}');
  await pairServer('b'.repeat(64));
  assert.deepEqual(saved, { pairingToken: 'b'.repeat(64) });
});

test('attachment reads return only raster image bytes to the page', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.chrome = { storage: { session: { get: async () => ({ pairingToken: 'a'.repeat(64) }) } } };
  globalThis.fetch = async () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/png' } });
  assert.equal(await attachmentDataUrl('pin', 'image'), 'data:image/png;base64,AQID');
  globalThis.fetch = async () => new Response('<svg/>', { headers: { 'Content-Type': 'image/svg+xml' } });
  await assert.rejects(attachmentDataUrl('pin', 'image'), /Unsupported image type/);
});

test('screenshots require the sender tab to stay active and use no broad permission request', async () => {
  const sender = { tab: { id: 1, windowId: 2 }, frameId: 0 };
  const tab = { id: 1, url: 'http://localhost:3000/' };
  let captures = 0;
  let activationListener;
  let updateListener;
  globalThis.chrome = { tabs: {
    onActivated: { addListener: listener => { activationListener = listener; }, removeListener: () => { activationListener = null; } },
    onUpdated: { addListener: listener => { updateListener = listener; }, removeListener: () => { updateListener = null; } },
    query: async () => [tab],
    captureVisibleTab: async windowId => { assert.equal(windowId, 2); captures++; return 'data:image/png;base64,AQID'; },
  } };
  assert.equal(await captureSenderTab(sender), 'data:image/png;base64,AQID');
  await assert.rejects(captureSenderTab({ ...sender, frameId: 1 }), /top-level/);
  chrome.tabs.query = async () => [{ ...tab, id: 3 }];
  await assert.rejects(captureSenderTab(sender), /Activate/);
  assert.equal(captures, 1);
  let queries = 0;
  chrome.tabs.query = async () => [++queries === 1 ? tab : { ...tab, id: 3 }];
  await assert.rejects(captureSenderTab(sender), /discarded/);
  queries = 0;
  chrome.tabs.query = async () => [++queries === 1 ? tab : { ...tab, url: 'https://other.example/' }];
  await assert.rejects(captureSenderTab(sender), /discarded/);
  chrome.tabs.query = async () => [tab];
  chrome.tabs.captureVisibleTab = async () => {
    activationListener({ windowId: 2, tabId: 3 });
    activationListener({ windowId: 2, tabId: 1 });
    return 'data:image/png;base64,AQID';
  };
  await assert.rejects(captureSenderTab(sender), /discarded/);
  chrome.tabs.captureVisibleTab = async () => {
    updateListener(1, { status: 'loading' });
    return 'data:image/png;base64,AQID';
  };
  await assert.rejects(captureSenderTab(sender), /discarded/);
  chrome.tabs.captureVisibleTab = async () => { throw new Error('activeTab expired'); };
  await assert.rejects(captureSenderTab(sender), /extension icon/);
  assert.equal(activationListener, null);
  assert.equal(updateListener, null);
});

test('the MAIN-world bridge exposes only source inspection, never annotation commands', async () => {
  const listeners = new Map();
  const responses = [];
  const source = await readFile(new URL('../entrypoints/bridge.content.js', import.meta.url), 'utf8');
  const context = vm.createContext({
    defineContentScript: value => value,
    window: {},
    document: {
      addEventListener: (name, handler) => listeners.set(name, handler),
      dispatchEvent: event => responses.push(event),
    },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
  });
  vm.runInContext(source.replace('export default', 'globalThis.entrypoint ='), context);
  context.entrypoint.main();
  assert.equal(context.window.__vibeAnnotations, undefined);
  assert.equal(listeners.has('vibe-bridge:request'), false);
  listeners.get('vibe-bridge:main-request')({ detail: { id: 'probe', method: 'createAnnotation', args: {} } });
  assert.match(responses[0].detail.error, /Unknown main-world method/);
});

test('webpage content scripts cannot pair or replace the server credential', async () => {
  globalThis.defineBackground = value => value;
  let handler;
  globalThis.chrome = { runtime: {
    id: 'extension-id', getURL: path => `chrome-extension://extension-id/${path}`,
    onMessage: { addListener: callback => { handler = callback; } },
  } };
  const { VibeAnnotationsBackground } = await import('../entrypoints/background.js');
  const background = Object.create(VibeAnnotationsBackground.prototype);
  background.setupMessageListener();
  for (const sender of [
    { id: 'extension-id', url: 'http://localhost:3000/' },
    { id: 'other-extension', url: 'chrome-extension://extension-id/options.html' },
  ]) {
    let response;
    assert.equal(handler({ action: 'pairServer', token: 'c'.repeat(64) }, sender, result => { response = result; }), false);
    assert.equal(response.success, false);
    assert.match(response.error, /only available in extension Options/);
  }
});

test('site permission requests are limited to the requesting top-level origin', async () => {
  const { VibeAnnotationsBackground } = await import('../entrypoints/background.js');
  const background = Object.create(VibeAnnotationsBackground.prototype);
  background.enableSite = async () => {};
  let requested;
  globalThis.chrome = {
    permissions: { request: async value => { requested = value; return true; } },
    storage: { local: { get: async () => ({}), set: async () => {} } },
  };
  const sender = { url: 'https://example.com/page', frameId: 0 };
  await assert.rejects(background.requestSitePermission({ originPattern: '*://*/*', allSites: true }, sender));
  await assert.rejects(background.requestSitePermission({ originPattern: 'https://other.example/*' }, sender));
  await assert.rejects(background.requestSitePermission({ originPattern: 'https://example.com/*' }, { ...sender, frameId: 1 }));
  assert.equal(requested, undefined);
  assert.equal((await background.requestSitePermission({ originPattern: 'https://example.com/*' }, sender)).granted, true);
  assert.deepEqual(requested, { origins: ['https://example.com/*'] });
});
