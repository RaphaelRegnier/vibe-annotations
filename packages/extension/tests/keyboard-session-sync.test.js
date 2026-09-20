import test from 'node:test';
import assert from 'node:assert';

import { SESSION_SYNC } from '../lib/session-protocol.js';

// Cross-frame Annotate session synchronization (ticket #12).
// The router is the frame-local half of the coordination: it answers the
// coordinator's hello, publishes its own transitions, applies remote ones silently,
// and knows the difference between "my state machine" and "someone else's".

const SESSION_HELLO = SESSION_SYNC.HELLO;
const SESSION_STATE = SESSION_SYNC.STATE;
const SESSION_REMOTE_STATE = SESSION_SYNC.REMOTE_STATE;

function createChromeMock() {
  const state = {
    sent: [],
    listeners: [],
    helloResponse: { state: 'idle', ownerNonce: null },
  };

  globalThis.chrome = {
    runtime: {
      onMessage: {
        addListener(fn) { if (!state.listeners.includes(fn)) state.listeners.push(fn); },
        removeListener(fn) {
          const index = state.listeners.indexOf(fn);
          if (index !== -1) state.listeners.splice(index, 1);
        },
      },
      sendMessage(message) {
        state.sent.push(message);
        return Promise.resolve(state.helloResponse);
      },
    },
    storage: { onChanged: { addListener() {}, removeListener() {} } },
  };

  return state;
}

function createKeyEvent({ type = 'keydown', key, code }) {
  return {
    type,
    key,
    code: code || key,
    repeat: false,
    isComposing: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    metaKey: false,
    composedPath: () => [],
    preventDefault() {},
    stopPropagation() {},
    stopImmediatePropagation() {},
  };
}

test('VibeKeyboardRouter cross-frame session sync', async (t) => {
  globalThis.window = { addEventListener() {}, removeEventListener() {} };

  const chromeState = createChromeMock();
  const { default: VibeEvents } = await import('../lib/content/event-bus.js');
  const { default: VibeKeyboardRouter, SessionState } = await import('../lib/content/keyboard-router.js');

  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
  const reports = () => chromeState.sent.filter((m) => m.action === SESSION_STATE);
  const helloNonce = () => chromeState.sent.filter((m) => m.action === SESSION_HELLO).pop()?.nonce;

  // Deliver a message from the coordinator to this frame's listener, the way
  // chrome.tabs.sendMessage does for every frame of a tab.
  function deliverRemote(message) {
    for (const listener of [...chromeState.listeners]) listener(message, {}, () => {});
  }

  // Reset this frame to a freshly booted document that receives `helloResponse`.
  async function bootFrame(helloResponse = { state: 'idle', ownerNonce: null }) {
    VibeKeyboardRouter.teardown();
    VibeKeyboardRouter.resetForTesting();
    chromeState.sent.length = 0;
    chromeState.helloResponse = helloResponse;
    VibeKeyboardRouter.init();
    await flush();
  }

  await t.test('boots by asking the coordinator which session the tab is in', async () => {
    await bootFrame();

    const hello = chromeState.sent.find((m) => m.action === SESSION_HELLO);
    assert.ok(hello, 'A booting frame must ask the coordinator for the tab session');
    assert.ok(hello.nonce, 'The hello must identify this document');
    assert.strictEqual(VibeKeyboardRouter.getState(), SessionState.IDLE);
  });

  await t.test('a frame that loads mid-session joins it instead of leaking shortcuts', async () => {
    await bootFrame({ state: SessionState.SELECTION, ownerNonce: 'frame-that-owns-the-session' });

    assert.strictEqual(VibeKeyboardRouter.getState(), SessionState.SELECTION,
      'The loaded frame must own the keyboard immediately');
    assert.strictEqual(reports().length, 0,
      'Joining an existing session is not a local transition and must not be announced');
  });

  await t.test('a session mirrored before the UI exists activates its overlay once the UI is ready', async () => {
    await bootFrame({ state: SessionState.SELECTION, ownerNonce: 'other-frame' });

    let started = 0;
    const onStart = () => { started++; };
    VibeEvents.on('inspection:start', onStart);
    try {
      assert.strictEqual(started, 0, 'No overlay can be driven before the frame has one');

      VibeKeyboardRouter.onUiReady();
      assert.strictEqual(started, 1, 'The mirrored session must activate the frame overlay');
      assert.strictEqual(VibeKeyboardRouter.getState(), SessionState.SELECTION);

      VibeKeyboardRouter.onUiReady();
      assert.strictEqual(reports().length, 0, 'Activating a mirror never announces a transition');
    } finally {
      VibeEvents.off('inspection:start', onStart);
    }
  });

  await t.test('a local transition is published with this document\'s nonce', async () => {
    await bootFrame();

    VibeEvents.emit('inspection:start');

    const report = reports().pop();
    assert.strictEqual(VibeKeyboardRouter.getState(), SessionState.SELECTION);
    assert.ok(report, 'Entering the session locally must be published');
    assert.strictEqual(report.state, SessionState.SELECTION);
    assert.strictEqual(report.nonce, helloNonce(),
      'The report must carry the nonce that identifies this document as the owner');
  });

  await t.test('the coordinator\'s echo of this frame\'s own transition is ignored', async () => {
    await bootFrame();
    VibeEvents.emit('inspection:start');
    const ownNonce = helloNonce();
    chromeState.sent.length = 0;

    // Echo of our own selection, then of our own exit.
    deliverRemote({ action: SESSION_REMOTE_STATE, state: SessionState.SELECTION, ownerNonce: ownNonce });
    assert.strictEqual(VibeKeyboardRouter.getState(), SessionState.SELECTION,
      'A frame must not treat its own echo as a remote state');

    VibeEvents.emit('inspection:stop');
    const exitReport = reports().pop();
    assert.strictEqual(exitReport.state, SessionState.IDLE);

    deliverRemote({ action: SESSION_REMOTE_STATE, state: SessionState.SELECTION, ownerNonce: ownNonce });
    assert.strictEqual(VibeKeyboardRouter.getState(), SessionState.IDLE,
      'A frame that just exited must not resurrect its session from its own echo');
  });

  await t.test('a stale release caused by this frame\'s own exit cannot end a session it re-entered', async () => {
    await bootFrame();

    // Exit and immediately re-enter: the coordinator's release broadcast for the exit
    // is still in flight when the new session starts (a real user flow: Esc then click
    // Annotate again). The release is stamped with this document's nonce, so this frame
    // recognizes it as the consequence of its own superseded transition.
    VibeEvents.emit('inspection:start');
    VibeEvents.emit('inspection:stop');
    VibeEvents.emit('inspection:start');
    assert.strictEqual(VibeKeyboardRouter.getState(), SessionState.SELECTION);

    deliverRemote({ action: SESSION_REMOTE_STATE, state: SessionState.IDLE, ownerNonce: helloNonce() });
    assert.strictEqual(VibeKeyboardRouter.getState(), SessionState.SELECTION,
      'The in-flight release of a superseded local exit must not tear down the new session');

    // A release reported by another frame still ends it.
    deliverRemote({ action: SESSION_REMOTE_STATE, state: SessionState.IDLE, ownerNonce: 'other-frame' });
    assert.strictEqual(VibeKeyboardRouter.getState(), SessionState.IDLE);
  });

  await t.test('a remote state from another frame is applied silently and never echoed back', async () => {
    await bootFrame();
    chromeState.sent.length = 0;

    deliverRemote({ action: SESSION_REMOTE_STATE, state: SessionState.EDITING, ownerNonce: 'other-frame' });

    assert.strictEqual(VibeKeyboardRouter.getState(), SessionState.SELECTION,
      'A mirror owns the keyboard in selection while another frame edits');
    assert.strictEqual(reports().length, 0,
      'Applying a remote state must not be reported as a local transition');

    VibeKeyboardRouter.onUiReady();
    assert.strictEqual(reports().length, 0);
  });

  await t.test('leaving a mirrored session from this frame releases the whole tab', async () => {
    await bootFrame({ state: SessionState.SELECTION, ownerNonce: 'other-frame' });
    chromeState.sent.length = 0;

    VibeKeyboardRouter.onKeyDown(createKeyEvent({ key: 'Escape' }));

    assert.strictEqual(VibeKeyboardRouter.getState(), SessionState.IDLE);
    const report = reports().pop();
    assert.ok(report, 'Exiting from a mirrored frame must release the shared session');
    assert.strictEqual(report.state, SessionState.IDLE);
  });

  await t.test('a remote release ends the mirrored session without reporting it back', async () => {
    await bootFrame({ state: SessionState.SELECTION, ownerNonce: 'other-frame' });
    chromeState.sent.length = 0;

    deliverRemote({ action: SESSION_REMOTE_STATE, state: SessionState.IDLE, ownerNonce: null });

    assert.strictEqual(VibeKeyboardRouter.getState(), SessionState.IDLE);
    assert.strictEqual(reports().length, 0, 'Applying the release is not a local transition');
  });

  await t.test('page hide releases a mirror silently but reports when this frame owns the session', async () => {
    await bootFrame({ state: SessionState.SELECTION, ownerNonce: 'other-frame' });
    chromeState.sent.length = 0;

    VibeKeyboardRouter.onPageHide();
    assert.strictEqual(VibeKeyboardRouter.getState(), SessionState.IDLE);
    assert.strictEqual(reports().length, 0,
      'A mirror going away must not end the session the rest of the tab is using');

    // This frame drives the session itself: nothing else can observe it disappearing.
    await bootFrame();
    VibeEvents.emit('inspection:start');
    chromeState.sent.length = 0;

    VibeKeyboardRouter.onPageHide();
    assert.strictEqual(VibeKeyboardRouter.getState(), SessionState.IDLE);
    const report = reports().pop();
    assert.ok(report, 'The owner must report its release when its document goes away');
    assert.strictEqual(report.state, SessionState.IDLE);
  });

  await t.test('teardown drops the coordinator listener so a dead frame stays silent', async () => {
    await bootFrame({ state: SessionState.SELECTION, ownerNonce: 'other-frame' });
    assert.strictEqual(chromeState.listeners.length, 1);

    VibeKeyboardRouter.teardown();
    assert.strictEqual(chromeState.listeners.length, 0, 'Teardown must stop listening for session traffic');

    deliverRemote({ action: SESSION_REMOTE_STATE, state: SessionState.SELECTION, ownerNonce: 'other-frame' });
    assert.strictEqual(VibeKeyboardRouter.getState(), SessionState.IDLE);
  });
});
