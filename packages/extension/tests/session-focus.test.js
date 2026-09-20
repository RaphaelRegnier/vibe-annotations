import test from 'node:test';
import assert from 'node:assert';

function createElement(id, options = {}) {
  return {
    id,
    tagName: (options.tagName || 'DIV'),
    isConnected: options.isConnected !== false,
    disabled: false,
    focusCalls: [],
    focus(options) { this.focusCalls.push(options || null); },
    getClientRects() { return options.rects === 0 ? [] : [{}]; },
    contains() { return false; },
  };
}

test('VibeSessionFocus unit tests', async (t) => {
  const documentListeners = {};

  globalThis.document = {
    activeElement: null,
    body: { tagName: 'BODY' },
    documentElement: { tagName: 'HTML' },
    addEventListener: (type, fn) => {
      documentListeners[type] = documentListeners[type] || [];
      documentListeners[type].push(fn);
    },
    removeEventListener: (type, fn) => {
      documentListeners[type] = (documentListeners[type] || []).filter((f) => f !== fn);
    },
  };

  const { default: VibeEvents } = await import('../lib/content/event-bus.js');
  const { default: VibeShadowHost } = await import('../lib/content/shadow-host.js');
  const { default: VibeSessionFocus } = await import('../lib/content/session-focus.js');

  const vibeHost = createElement('vibe-annotations-root');
  const originalGetHost = VibeShadowHost.getHost;
  VibeShadowHost.getHost = () => vibeHost;

  function fireFocusIn(element) {
    for (const fn of [...(documentListeners.focusin || [])]) {
      fn({ composedPath: () => [element], target: element });
    }
  }

  function startSession() {
    document.activeElement = vibeHost;
    VibeEvents.emit('inspection:start');
  }

  function endSession() {
    document.activeElement = document.body;
    VibeEvents.emit('inspection:stopped');
  }

  VibeSessionFocus.init();

  await t.test('Restores the element focused before entry, without scrolling', () => {
    const hostInput = createElement('host-input', { tagName: 'INPUT' });
    fireFocusIn(hostInput);

    startSession();
    assert.strictEqual(hostInput.focusCalls.length, 0, 'Entry must not restore anything yet');

    endSession();
    assert.strictEqual(hostInput.focusCalls.length, 1, 'Exit must restore the original element');
    assert.deepStrictEqual(hostInput.focusCalls[0], { preventScroll: true });
  });

  await t.test('Restores a canvas element focused before entry', () => {
    const canvas = createElement('canvas-rect');
    fireFocusIn(canvas);

    startSession();
    endSession();
    assert.strictEqual(canvas.focusCalls.length, 1);
    assert.deepStrictEqual(canvas.focusCalls[0], { preventScroll: true });
  });

  await t.test('Does not restore an element that no longer exists', () => {
    const removed = createElement('removed', { isConnected: false });
    fireFocusIn(removed);

    startSession();
    endSession();
    assert.strictEqual(removed.focusCalls.length, 0, 'Detached elements must not be focused');
  });

  await t.test('Does not restore an element that cannot be focused', () => {
    const hidden = createElement('hidden', { rects: 0 });
    fireFocusIn(hidden);

    startSession();
    endSession();
    assert.strictEqual(hidden.focusCalls.length, 0, 'Zero-size/hidden elements must not be focused');
  });

  await t.test('Does not steal focus from a host element focused during the session', () => {
    const original = createElement('host-input');
    fireFocusIn(original);

    startSession();
    const programmatic = createElement('canvas-rect');
    document.activeElement = programmatic;

    VibeEvents.emit('inspection:stopped');
    assert.strictEqual(original.focusCalls.length, 0, 'Focus moved by the host must be respected');
  });

  await t.test('Treats focus inside the extension shadow root as our own UI', () => {
    const hostInput = createElement('host-input', { tagName: 'INPUT' });
    fireFocusIn(hostInput);

    // Entry moves focus to a control inside the extension's shadow root
    const shadowButton = createElement('', { tagName: 'BUTTON' });
    shadowButton.getRootNode = () => ({ host: vibeHost });
    document.activeElement = shadowButton;

    VibeEvents.emit('inspection:start');
    VibeEvents.emit('inspection:stopped');

    assert.strictEqual(hostInput.focusCalls.length, 1, 'Shadow-root focus must fall back to the original host element');
    assert.strictEqual(shadowButton.focusCalls.length, 0, 'A shadow control must never be captured as the restore target');
  });

  await t.test('Restores nothing when the page had no focus before entry', () => {
    VibeSessionFocus.teardown();
    VibeSessionFocus.init();

    startSession();
    endSession();

    assert.strictEqual(vibeHost.focusCalls.length, 0, 'Toolbar-only entry has no original element to restore');
  });

  await t.test('teardown removes focus tracking and session hooks', () => {
    VibeSessionFocus.teardown();
    assert.strictEqual((documentListeners.focusin || []).length, 0, 'Focus tracking must be removed');

    const late = createElement('host-input');
    fireFocusIn(late);
    startSession();
    endSession();
    assert.strictEqual(late.focusCalls.length, 0, 'Teardown must stop restoring focus');

    VibeSessionFocus.init();
  });

  VibeShadowHost.getHost = originalGetHost;
});
