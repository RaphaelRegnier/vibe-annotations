import test from 'node:test';
import assert from 'node:assert';

test('VibeKeyboardRouter unit tests', async (t) => {
  // Set up mock window and event system
  const listeners = { capture: {}, bubble: {} };
  globalThis.window = {
    addEventListener: (type, fn, capture = false) => {
      const phase = capture ? 'capture' : 'bubble';
      listeners[phase][type] = listeners[phase][type] || [];
      listeners[phase][type].push(fn);
    },
    removeEventListener: (type, fn, capture = false) => {
      const phase = capture ? 'capture' : 'bubble';
      if (listeners[phase][type]) {
        listeners[phase][type] = listeners[phase][type].filter((f) => f !== fn);
      }
    },
  };

  const { default: VibeEvents } = await import('../lib/content/event-bus.js');
  const { default: VibeInspectionMode } = await import('../lib/content/inspection-mode.js');
  const { default: VibeKeyboardRouter, SessionState } = await import('../lib/content/keyboard-router.js');

  VibeKeyboardRouter.init();

  function createSimulatedEvent({ type = 'keydown', key, code, repeat = false, ctrlKey = false, shiftKey = false, altKey = false, metaKey = false, isComposing = false, keyCode = 0, target = null, composedPath = null }) {
    let defaultPrevented = false;
    let immediatePropagationStopped = false;
    let propagationStopped = false;

    return {
      type,
      key,
      code: code || key,
      repeat,
      keyCode,
      isComposing,
      ctrlKey,
      shiftKey,
      altKey,
      metaKey,
      target,
      composedPath: composedPath ? () => composedPath : (target ? () => [target] : () => []),
      preventDefault: () => { defaultPrevented = true; },
      stopPropagation: () => { propagationStopped = true; },
      stopImmediatePropagation: () => {
        immediatePropagationStopped = true;
        propagationStopped = true;
      },
      get defaultPrevented() { return defaultPrevented; },
      get immediatePropagationStopped() { return immediatePropagationStopped; },
      get propagationStopped() { return propagationStopped; },
    };
  }

  function dispatch(e) {
    if (e.type === 'keydown') VibeKeyboardRouter.onKeyDown(e);
    else if (e.type === 'keyup') VibeKeyboardRouter.onKeyUp(e);
    else if (e.type === 'keypress') VibeKeyboardRouter.onKeyPress(e);
  }

  await t.test('Initial state is IDLE and does not consume ordinary keys', () => {
    VibeKeyboardRouter.resetForTesting();
    assert.strictEqual(VibeKeyboardRouter.getState(), SessionState.IDLE);

    const ev = createSimulatedEvent({ key: 'a', code: 'KeyA' });
    dispatch(ev);

    assert.strictEqual(ev.defaultPrevented, false, 'Ordinary key in IDLE must not be default-prevented');
    assert.strictEqual(ev.immediatePropagationStopped, false, 'Ordinary key in IDLE must not be stopped');
  });

  await t.test('Hotkey in IDLE triggers selection mode and is consumed', () => {
    VibeKeyboardRouter.resetForTesting();
    VibeKeyboardRouter.setCustomShortcutForTesting({ key: ',', ctrlKey: true, shiftKey: true });
    let started = false;
    const onStart = () => { started = true; };
    VibeEvents.on('inspection:start', onStart);

    // Ctrl+Shift+Comma is toggle hotkey
    const ev = createSimulatedEvent({ key: ',', code: 'Comma', ctrlKey: true, shiftKey: true });
    dispatch(ev);

    assert.strictEqual(ev.defaultPrevented, true);
    assert.strictEqual(ev.immediatePropagationStopped, true);
    assert.strictEqual(started, true);
    assert.strictEqual(VibeKeyboardRouter.getState(), SessionState.SELECTION);

    VibeEvents.off('inspection:start', onStart);
  });

  await t.test('SELECTION mode consumes all ordinary keys, characters, and host shortcuts', () => {
    VibeKeyboardRouter.resetForTesting();
    VibeKeyboardRouter.setState(SessionState.SELECTION);

    for (const key of ['a', 'Delete', 'Backspace', 'Tab', 'Enter']) {
      const ev = createSimulatedEvent({ key });
      dispatch(ev);
      assert.strictEqual(ev.defaultPrevented, true, `Key "${key}" must be default-prevented in SELECTION`);
      assert.strictEqual(ev.immediatePropagationStopped, true, `Key "${key}" must be stopped in SELECTION`);
    }

    // Host shortcut combination Ctrl+K
    const ctrlK = createSimulatedEvent({ key: 'k', code: 'KeyK', ctrlKey: true });
    dispatch(ctrlK);
    assert.strictEqual(ctrlK.defaultPrevented, true);
    assert.strictEqual(ctrlK.immediatePropagationStopped, true);
  });

  await t.test('Arrow keys and Enter dispatch to VibeInspectionMode in SELECTION mode', () => {
    VibeKeyboardRouter.resetForTesting();
    VibeKeyboardRouter.setState(SessionState.SELECTION);

    let navKey = null;
    const origHandler = VibeInspectionMode.handleNavigationKey;
    VibeInspectionMode.handleNavigationKey = (e) => { navKey = e.key; return true; };

    const upEv = createSimulatedEvent({ key: 'ArrowUp' });
    dispatch(upEv);
    assert.strictEqual(navKey, 'ArrowUp');
    assert.strictEqual(upEv.defaultPrevented, true);
    assert.strictEqual(upEv.immediatePropagationStopped, true);

    const downEv = createSimulatedEvent({ key: 'ArrowDown' });
    dispatch(downEv);
    assert.strictEqual(navKey, 'ArrowDown');

    const enterEv = createSimulatedEvent({ key: 'Enter' });
    dispatch(enterEv);
    assert.strictEqual(navKey, 'Enter');

    VibeInspectionMode.handleNavigationKey = origHandler;
  });

  await t.test('Escape in SELECTION mode exits and drains held repeats and final keyup', () => {
    VibeKeyboardRouter.resetForTesting();
    VibeKeyboardRouter.setState(SessionState.SELECTION);

    let stopped = false;
    const onStop = () => { stopped = true; };
    VibeEvents.on('inspection:stop', onStop);

    // 1. Initial Escape keydown exits selection
    const esc1 = createSimulatedEvent({ key: 'Escape', code: 'Escape', repeat: false });
    dispatch(esc1);
    assert.strictEqual(esc1.defaultPrevented, true);
    assert.strictEqual(esc1.immediatePropagationStopped, true);
    assert.strictEqual(stopped, true);
    assert.strictEqual(VibeKeyboardRouter.getState(), SessionState.IDLE);

    // 2. Held Escape produces repeated keydown while in IDLE — must be drained!
    const escRepeat = createSimulatedEvent({ key: 'Escape', code: 'Escape', repeat: true });
    dispatch(escRepeat);
    assert.strictEqual(escRepeat.defaultPrevented, true, 'Repeated Escape must be drained');
    assert.strictEqual(escRepeat.immediatePropagationStopped, true);

    // 3. Final keyup of Escape — must be drained and conclude the drain sequence
    const escUp = createSimulatedEvent({ type: 'keyup', key: 'Escape', code: 'Escape' });
    dispatch(escUp);
    assert.strictEqual(escUp.defaultPrevented, true, 'Escape keyup must be drained');
    assert.strictEqual(escUp.immediatePropagationStopped, true);

    // 4. Next fresh Escape keydown reaches host (A2)!
    const freshEsc = createSimulatedEvent({ key: 'Escape', code: 'Escape', repeat: false });
    dispatch(freshEsc);
    assert.strictEqual(freshEsc.defaultPrevented, false, 'Next fresh Escape must not be swallowed');
    assert.strictEqual(freshEsc.immediatePropagationStopped, false);

    VibeEvents.off('inspection:stop', onStop);
  });

  await t.test('Shortcut exit drains modifier releases, and unrelated new keys are immediately usable', () => {
    VibeKeyboardRouter.resetForTesting();
    VibeKeyboardRouter.setCustomShortcutForTesting({ key: ',', ctrlKey: true, shiftKey: true });
    VibeKeyboardRouter.setState(SessionState.SELECTION);

    // Press modifier keys down
    const ctrlDown = createSimulatedEvent({ key: 'Control', code: 'ControlLeft' });
    dispatch(ctrlDown);
    const shiftDown = createSimulatedEvent({ key: 'Shift', code: 'ShiftLeft' });
    dispatch(shiftDown);

    // Trigger toggle shortcut exit
    const commaDown = createSimulatedEvent({ key: ',', code: 'Comma', ctrlKey: true, shiftKey: true });
    dispatch(commaDown);
    assert.strictEqual(VibeKeyboardRouter.getState(), SessionState.IDLE);

    // Release comma
    const commaUp = createSimulatedEvent({ type: 'keyup', key: ',', code: 'Comma' });
    dispatch(commaUp);
    assert.strictEqual(commaUp.defaultPrevented, true, 'Trigger keyup must be drained');

    // Release shift
    const shiftUp = createSimulatedEvent({ type: 'keyup', key: 'Shift', code: 'ShiftLeft' });
    dispatch(shiftUp);
    assert.strictEqual(shiftUp.defaultPrevented, true, 'Modifier keyup must be drained');

    // Release control
    const ctrlUp = createSimulatedEvent({ type: 'keyup', key: 'Control', code: 'ControlLeft' });
    dispatch(ctrlUp);
    assert.strictEqual(ctrlUp.defaultPrevented, true, 'Modifier keyup must be drained');

    // Unrelated new key immediately reaches the page without swallowing!
    const keyA = createSimulatedEvent({ key: 'a', code: 'KeyA' });
    dispatch(keyA);
    assert.strictEqual(keyA.defaultPrevented, false, 'Unrelated key must reach host immediately');
    assert.strictEqual(keyA.immediatePropagationStopped, false);
  });

  const { default: VibeShadowHost } = await import('../lib/content/shadow-host.js');

  await t.test('Window blur resets any active drain state', () => {
    VibeKeyboardRouter.resetForTesting();
    VibeKeyboardRouter.setState(SessionState.SELECTION);

    // Escape down starts drain
    const esc1 = createSimulatedEvent({ key: 'Escape', code: 'Escape' });
    dispatch(esc1);
    assert.strictEqual(VibeKeyboardRouter.getState(), SessionState.IDLE);

    // Window blur occurs (e.g. user Alt+Tabs before releasing Escape)
    VibeKeyboardRouter.onBlur();

    // After blur, a new Escape keydown is not stuck in drain
    const escAfterBlur = createSimulatedEvent({ key: 'Escape', code: 'Escape' });
    dispatch(escAfterBlur);
    assert.strictEqual(escAfterBlur.defaultPrevented, false, 'Keys must not be stuck draining after blur');
  });

  await t.test('WAITING state isolates all keys, and Escape exits Annotate to IDLE', () => {
    VibeKeyboardRouter.resetForTesting();
    VibeKeyboardRouter.setState(SessionState.WAITING);

    // Ordinary keys in WAITING are prevented and stopped
    const ev = createSimulatedEvent({ key: 'a' });
    dispatch(ev);
    assert.strictEqual(ev.defaultPrevented, true, 'Ordinary key in WAITING must be default-prevented');
    assert.strictEqual(ev.immediatePropagationStopped, true, 'Ordinary key in WAITING must be stopped');

    let stopped = false;
    const onStop = () => { stopped = true; };
    VibeEvents.on('inspection:stop', onStop);

    // Escape in WAITING cancels waiting and exits to IDLE
    const escEv = createSimulatedEvent({ key: 'Escape', code: 'Escape' });
    dispatch(escEv);
    assert.strictEqual(escEv.defaultPrevented, true);
    assert.strictEqual(escEv.immediatePropagationStopped, true);
    assert.strictEqual(stopped, true, 'Escape in WAITING must trigger inspection:stop');
    assert.strictEqual(VibeKeyboardRouter.getState(), SessionState.IDLE, 'State must transition to IDLE');

    VibeEvents.off('inspection:stop', onStop);
  });

  await t.test('EDITING state: native typing separates propagation blocking from default cancellation', () => {
    VibeKeyboardRouter.resetForTesting();
    VibeKeyboardRouter.setState(SessionState.EDITING);

    const mockHost = { tagName: 'DIV', id: 'vibe-annotations-root' };
    const origGetHost = VibeShadowHost.getHost;
    VibeShadowHost.getHost = () => mockHost;

    const mockTextarea = { tagName: 'TEXTAREA', id: 'comment-textarea' };
    const composedPath = [mockTextarea, mockHost];

    // Typing a character in popover textarea
    const charEv = createSimulatedEvent({ key: 'a', code: 'KeyA', target: mockTextarea, composedPath });
    dispatch(charEv);
    assert.strictEqual(charEv.immediatePropagationStopped, true, 'Typing must stop propagation to host');
    assert.strictEqual(charEv.defaultPrevented, false, 'Typing must NOT be default-prevented (A6)');

    // Pressing Backspace in popover textarea
    const bsEv = createSimulatedEvent({ key: 'Backspace', code: 'Backspace', target: mockTextarea, composedPath });
    dispatch(bsEv);
    assert.strictEqual(bsEv.immediatePropagationStopped, true, 'Backspace must stop propagation to host');
    assert.strictEqual(bsEv.defaultPrevented, false, 'Backspace must NOT be default-prevented (A3, A6)');

    // Pressing Delete in popover textarea
    const delEv = createSimulatedEvent({ key: 'Delete', code: 'Delete', target: mockTextarea, composedPath });
    dispatch(delEv);
    assert.strictEqual(delEv.immediatePropagationStopped, true, 'Delete must stop propagation to host');
    assert.strictEqual(delEv.defaultPrevented, false, 'Delete must NOT be default-prevented (A6)');

    // Cursor navigation ArrowLeft
    const arrowEv = createSimulatedEvent({ key: 'ArrowLeft', code: 'ArrowLeft', target: mockTextarea, composedPath });
    dispatch(arrowEv);
    assert.strictEqual(arrowEv.immediatePropagationStopped, true, 'Arrow keys in editable must stop propagation');
    assert.strictEqual(arrowEv.defaultPrevented, false, 'Arrow keys in editable must NOT be default-prevented');

    VibeShadowHost.getHost = origGetHost;
  });

  await t.test('EDITING state: Escape closes editor once and returns to SELECTION without exiting selection', () => {
    VibeKeyboardRouter.resetForTesting();
    VibeKeyboardRouter.setState(SessionState.EDITING);

    const mockHost = { tagName: 'DIV', id: 'vibe-annotations-root' };
    const origGetHost = VibeShadowHost.getHost;
    VibeShadowHost.getHost = () => mockHost;

    let dismissed = false;
    let stopCount = 0;
    const onDismissRequest = ({ reEnableInspection } = {}) => {
      dismissed = true;
      if (reEnableInspection) {
        VibeEvents.emit('popover:dismissed', { reEnableInspection: true });
      }
    };
    VibeEvents.on('popover:requestDismiss', onDismissRequest);
    const onStop = () => { stopCount++; };
    VibeEvents.on('inspection:stop', onStop);

    const escEv = createSimulatedEvent({ key: 'Escape', code: 'Escape' });
    dispatch(escEv);

    assert.strictEqual(dismissed, true, 'Escape must emit popover:requestDismiss');
    assert.strictEqual(escEv.defaultPrevented, true);
    assert.strictEqual(escEv.immediatePropagationStopped, true);
    assert.strictEqual(stopCount, 0, 'Editor Esc must NOT trigger inspection:stop (A8)');
    assert.strictEqual(VibeKeyboardRouter.getState(), SessionState.SELECTION, 'State must return to SELECTION');

    VibeEvents.off('inspection:stop', onStop);
    VibeEvents.off('popover:requestDismiss', onDismissRequest);
    VibeShadowHost.getHost = origGetHost;
  });

  await t.test('EDITING state: Save shortcut triggers save once and does not execute in next state', () => {
    VibeKeyboardRouter.resetForTesting();
    VibeKeyboardRouter.setState(SessionState.EDITING);

    let saveRequested = 0;
    const onSave = () => { saveRequested++; };
    VibeEvents.on('popover:requestSave', onSave);

    const saveEv = createSimulatedEvent({ key: 'Enter', code: 'Enter', ctrlKey: true });
    dispatch(saveEv);

    assert.strictEqual(saveRequested, 1, 'Save shortcut must emit popover:requestSave once');
    assert.strictEqual(saveEv.defaultPrevented, true);
    assert.strictEqual(saveEv.immediatePropagationStopped, true);

    VibeEvents.off('popover:requestSave', onSave);
  });

  await t.test('EDITING state: IME composition keys are isolated from the host without closing the editor or saving', () => {
    VibeKeyboardRouter.resetForTesting();
    VibeKeyboardRouter.setState(SessionState.EDITING);

    const mockHost = { tagName: 'DIV', id: 'vibe-annotations-root' };
    const origGetHost = VibeShadowHost.getHost;
    VibeShadowHost.getHost = () => mockHost;

    const mockTextarea = { tagName: 'TEXTAREA', id: 'comment-textarea' };
    const composedPath = [mockTextarea, mockHost];

    let dismissed = 0;
    let saveRequested = 0;
    const onDismiss = () => { dismissed++; };
    const onSave = () => { saveRequested++; };
    VibeEvents.on('popover:requestDismiss', onDismiss);
    VibeEvents.on('popover:requestSave', onSave);

    // Candidate confirmation (Enter) while composing
    const enterEv = createSimulatedEvent({ key: 'Enter', keyCode: 229, isComposing: true, target: mockTextarea, composedPath });
    dispatch(enterEv);
    assert.strictEqual(enterEv.immediatePropagationStopped, true, 'Composing Enter must stay away from the host');
    assert.strictEqual(enterEv.defaultPrevented, true, 'Composing Enter must not alter the editor text');
    assert.strictEqual(saveRequested, 0, 'Composing Enter must not save');

    // Candidate cancellation (Escape) while composing
    const escEv = createSimulatedEvent({ key: 'Escape', code: 'Escape', keyCode: 229, isComposing: true, target: mockTextarea, composedPath });
    dispatch(escEv);
    assert.strictEqual(escEv.immediatePropagationStopped, true, 'Composing Escape must stay away from the host');
    assert.strictEqual(escEv.defaultPrevented, true, 'Composing Escape must not alter the editor text');
    assert.strictEqual(dismissed, 0, 'Composing Escape must not close the editor');
    assert.strictEqual(VibeKeyboardRouter.getState(), SessionState.EDITING, 'Composing Escape must not leave EDITING');

    // Candidate navigation (arrows) while composing must not step design inputs
    const arrowEv = createSimulatedEvent({ key: 'ArrowUp', isComposing: true, target: mockTextarea, composedPath });
    dispatch(arrowEv);
    assert.strictEqual(arrowEv.immediatePropagationStopped, true);
    assert.strictEqual(arrowEv.defaultPrevented, true);

    VibeEvents.off('popover:requestDismiss', onDismiss);
    VibeEvents.off('popover:requestSave', onSave);
    VibeShadowHost.getHost = origGetHost;
  });

  await t.test('EDITING state: composition ownership lasts until compositionend, then commands resume', () => {
    VibeKeyboardRouter.resetForTesting();
    VibeKeyboardRouter.setState(SessionState.EDITING);

    const mockHost = { tagName: 'DIV', id: 'vibe-annotations-root' };
    const origGetHost = VibeShadowHost.getHost;
    VibeShadowHost.getHost = () => mockHost;

    const mockTextarea = { tagName: 'TEXTAREA', id: 'comment-textarea' };
    const composedPath = [mockTextarea, mockHost];

    let dismissed = 0;
    const onDismiss = () => {
      dismissed++;
      VibeEvents.emit('popover:dismissed', { reEnableInspection: true });
    };
    VibeEvents.on('popover:requestDismiss', onDismiss);

    VibeKeyboardRouter.onCompositionStart({ composedPath: () => composedPath });

    // Key without isComposing while a composition session is active is still owned by the composition
    const escDuringSession = createSimulatedEvent({ key: 'Escape', code: 'Escape', target: mockTextarea, composedPath });
    dispatch(escDuringSession);
    assert.strictEqual(escDuringSession.immediatePropagationStopped, true);
    assert.strictEqual(dismissed, 0, 'Escape during the composition session must not close the editor');

    VibeKeyboardRouter.onCompositionEnd({ composedPath: () => composedPath });

    // Normal commands resume once the composition has ended
    const escAfter = createSimulatedEvent({ key: 'Escape', code: 'Escape', target: mockTextarea, composedPath });
    dispatch(escAfter);
    assert.strictEqual(dismissed, 1, 'Escape after compositionend must close the editor again');
    assert.strictEqual(escAfter.defaultPrevented, true);
    assert.strictEqual(VibeKeyboardRouter.getState(), SessionState.SELECTION);

    VibeEvents.off('popover:requestDismiss', onDismiss);
    VibeShadowHost.getHost = origGetHost;
  });

  await t.test('EDITING state: explicit modifier commands stay available during composition', () => {
    VibeKeyboardRouter.resetForTesting();
    VibeKeyboardRouter.setState(SessionState.EDITING);

    const mockHost = { tagName: 'DIV', id: 'vibe-annotations-root' };
    const origGetHost = VibeShadowHost.getHost;
    VibeShadowHost.getHost = () => mockHost;

    const mockTextarea = { tagName: 'TEXTAREA', id: 'comment-textarea' };
    const composedPath = [mockTextarea, mockHost];

    let saveRequested = 0;
    const onSave = () => { saveRequested++; };
    VibeEvents.on('popover:requestSave', onSave);

    VibeKeyboardRouter.onCompositionStart({ composedPath: () => composedPath });

    const saveEv = createSimulatedEvent({ key: 'Enter', code: 'Enter', ctrlKey: true, isComposing: true, target: mockTextarea, composedPath });
    dispatch(saveEv);
    assert.strictEqual(saveRequested, 1, 'Explicit save shortcut must still run during composition');
    assert.strictEqual(saveEv.defaultPrevented, true);

    VibeKeyboardRouter.onCompositionEnd({ composedPath: () => composedPath });

    VibeEvents.off('popover:requestSave', onSave);
    VibeShadowHost.getHost = origGetHost;
  });

  await t.test('IDLE state: composing keys in a standalone editor are isolated without dismissing or saving', () => {
    VibeKeyboardRouter.resetForTesting();
    assert.strictEqual(VibeKeyboardRouter.getState(), SessionState.IDLE);

    const mockHost = { tagName: 'DIV', id: 'vibe-annotations-root' };
    const origGetHost = VibeShadowHost.getHost;
    VibeShadowHost.getHost = () => mockHost;

    const mockTextarea = { tagName: 'TEXTAREA', id: 'comment-textarea' };
    const composedPath = [mockTextarea, mockHost];

    let dismissed = 0;
    const onDismiss = () => { dismissed++; };
    VibeEvents.on('popover:requestDismiss', onDismiss);

    const escEv = createSimulatedEvent({ key: 'Escape', code: 'Escape', isComposing: true, target: mockTextarea, composedPath });
    dispatch(escEv);
    assert.strictEqual(escEv.immediatePropagationStopped, true, 'Composing Escape must stay away from the host');
    assert.strictEqual(escEv.defaultPrevented, true, 'Composing Escape must not alter the editor text');
    assert.strictEqual(dismissed, 0, 'Composing Escape must not dismiss the standalone editor');
    assert.strictEqual(VibeKeyboardRouter.getState(), SessionState.IDLE);

    VibeEvents.off('popover:requestDismiss', onDismiss);
    VibeShadowHost.getHost = origGetHost;
  });

  await t.test('Window blur clears composition ownership so later keys resume normal commands', () => {
    VibeKeyboardRouter.resetForTesting();
    VibeKeyboardRouter.setState(SessionState.EDITING);

    const mockHost = { tagName: 'DIV', id: 'vibe-annotations-root' };
    const origGetHost = VibeShadowHost.getHost;
    VibeShadowHost.getHost = () => mockHost;

    const mockTextarea = { tagName: 'TEXTAREA', id: 'comment-textarea' };
    const composedPath = [mockTextarea, mockHost];

    let dismissed = 0;
    const onDismiss = () => {
      dismissed++;
      VibeEvents.emit('popover:dismissed', { reEnableInspection: true });
    };
    VibeEvents.on('popover:requestDismiss', onDismiss);

    VibeKeyboardRouter.onCompositionStart({ composedPath: () => composedPath });
    VibeKeyboardRouter.onBlur();

    const escEv = createSimulatedEvent({ key: 'Escape', code: 'Escape', target: mockTextarea, composedPath });
    dispatch(escEv);
    assert.strictEqual(dismissed, 1, 'Composition state must not survive a window blur');

    VibeEvents.off('popover:requestDismiss', onDismiss);
    VibeShadowHost.getHost = origGetHost;
  });

  await t.test('IDLE state: independent edit entry point in extension UI is isolated without whole-page session semantics', () => {
    VibeKeyboardRouter.resetForTesting();
    assert.strictEqual(VibeKeyboardRouter.getState(), SessionState.IDLE);

    const mockHost = { tagName: 'DIV', id: 'vibe-annotations-root' };
    const origGetHost = VibeShadowHost.getHost;
    VibeShadowHost.getHost = () => mockHost;

    const mockBtn = { tagName: 'BUTTON', className: 'vibe-shortcut-btn' };
    const composedPath = [mockBtn, mockHost];

    // Key pressed while focusing an extension toolbar element in IDLE
    const ev = createSimulatedEvent({ key: 'k', ctrlKey: true, target: mockBtn, composedPath });
    dispatch(ev);

    assert.strictEqual(ev.immediatePropagationStopped, true, 'Extension UI event in IDLE must stop propagation');
    assert.strictEqual(VibeKeyboardRouter.getState(), SessionState.IDLE, 'State must remain IDLE');

    VibeShadowHost.getHost = origGetHost;
  });

  await t.test('Independent edit lifecycle: annotation:edit when inspection inactive stays IDLE and does not transition to SELECTION on dismiss', () => {
    VibeKeyboardRouter.resetForTesting();
    assert.strictEqual(VibeKeyboardRouter.getState(), SessionState.IDLE);

    const origIsActive = VibeInspectionMode.isActive;
    VibeInspectionMode.isActive = () => false;

    // Trigger independent edit (e.g. badge click in IDLE)
    VibeEvents.emit('annotation:edit', { annotation: { id: 'test_1' } });
    assert.strictEqual(VibeKeyboardRouter.getState(), SessionState.IDLE, 'Must not transition to WAITING when inspection inactive');

    // Popover opens
    VibeEvents.emit('popover:opened');
    assert.strictEqual(VibeKeyboardRouter.getState(), SessionState.IDLE, 'Must remain IDLE for independent edit');

    // Popover dismissed with reEnableInspection: false (as annotation-popover will emit)
    VibeEvents.emit('popover:dismissed', { reEnableInspection: false });
    assert.strictEqual(VibeKeyboardRouter.getState(), SessionState.IDLE, 'Must remain IDLE when dismissed without active inspection');

    VibeInspectionMode.isActive = origIsActive;
  });

  await t.test('Shortcut recording suppresses global hotkey preemption', () => {
    VibeKeyboardRouter.resetForTesting();
    VibeKeyboardRouter.setCustomShortcutForTesting({ key: 'k', ctrlKey: true, shiftKey: true });
    assert.strictEqual(VibeKeyboardRouter.getState(), SessionState.IDLE);

    let startedCount = 0;
    const onStart = () => { startedCount++; };
    VibeEvents.on('inspection:start', onStart);

    // Enter shortcut recording mode
    VibeEvents.emit('shortcut:recording:start');

    // Pressing the configured hotkey during recording must NOT start inspection!
    const hotkeyEv = createSimulatedEvent({ key: 'k', ctrlKey: true, shiftKey: true });
    dispatch(hotkeyEv);

    assert.strictEqual(startedCount, 0, 'Global hotkey must NOT preempt shortcut recording');
    assert.strictEqual(VibeKeyboardRouter.getState(), SessionState.IDLE);

    // Stop shortcut recording mode
    VibeEvents.emit('shortcut:recording:stop');

    // Pressing the configured hotkey now triggers inspection
    const hotkeyEv2 = createSimulatedEvent({ key: 'k', ctrlKey: true, shiftKey: true });
    dispatch(hotkeyEv2);

    assert.strictEqual(startedCount, 1, 'Global hotkey must trigger inspection after recording stops');
    assert.strictEqual(VibeKeyboardRouter.getState(), SessionState.SELECTION);

    VibeEvents.off('inspection:start', onStart);
  });

  await t.test('EDITING state: Tab and Shift+Tab wrap within popover focusables and do not leak to host', () => {
    VibeKeyboardRouter.resetForTesting();
    VibeKeyboardRouter.setState(SessionState.EDITING);

    const mockHost = { tagName: 'DIV', id: 'vibe-annotations-root' };
    const origGetHost = VibeShadowHost.getHost;
    VibeShadowHost.getHost = () => mockHost;

    const firstBtn = { tagName: 'BUTTON', focusCount: 0, focus() { this.focusCount++; } };
    const lastBtn = { tagName: 'BUTTON', focusCount: 0, focus() { this.focusCount++; } };

    const mockPopover = {
      querySelectorAll(selector) {
        return [firstBtn, lastBtn];
      }
    };
    VibeKeyboardRouter.setActivePopoverForTesting?.(mockPopover);

    // Tab on last element wraps to first element
    const tabEv = createSimulatedEvent({
      key: 'Tab',
      shiftKey: false,
      target: lastBtn,
      composedPath: [lastBtn, mockPopover, mockHost],
    });
    dispatch(tabEv);

    assert.strictEqual(tabEv.defaultPrevented, true, 'Tab wrap must prevent default');
    assert.strictEqual(tabEv.immediatePropagationStopped, true, 'Tab wrap must stop propagation');
    assert.strictEqual(firstBtn.focusCount, 1, 'Tab on last element must focus first element');

    // Shift+Tab on first element wraps to last element
    const shiftTabEv = createSimulatedEvent({
      key: 'Tab',
      shiftKey: true,
      target: firstBtn,
      composedPath: [firstBtn, mockPopover, mockHost],
    });
    dispatch(shiftTabEv);

    assert.strictEqual(shiftTabEv.defaultPrevented, true, 'Shift+Tab wrap must prevent default');
    assert.strictEqual(shiftTabEv.immediatePropagationStopped, true, 'Shift+Tab wrap must stop propagation');
    assert.strictEqual(lastBtn.focusCount, 1, 'Shift+Tab on first element must focus last element');

    VibeKeyboardRouter.setActivePopoverForTesting?.(null);
    VibeShadowHost.getHost = origGetHost;
  });

  await t.test('Blur with a lost keyup keeps the consumed release owned while a fresh press is routed (A12)', () => {
    VibeKeyboardRouter.resetForTesting();
    VibeKeyboardRouter.setState(SessionState.SELECTION);

    // Held Esc exits Annotate; its keyup never arrives (window blurred)
    const escDown = createSimulatedEvent({ key: 'Escape', code: 'Escape' });
    dispatch(escDown);
    assert.strictEqual(VibeKeyboardRouter.getState(), SessionState.IDLE);

    VibeKeyboardRouter.onBlur();

    // The stray release of the consumed exit key is still owned by the session
    const staleUp = createSimulatedEvent({ type: 'keyup', key: 'Escape', code: 'Escape' });
    dispatch(staleUp);
    assert.strictEqual(staleUp.defaultPrevented, true, 'Stray release must stay owned by the session');
    assert.strictEqual(staleUp.immediatePropagationStopped, true, 'Stray release must not reach the host');

    // A new full press after the blur is a fresh keystroke, not a continuation
    const freshDown = createSimulatedEvent({ key: 'Escape', code: 'Escape' });
    dispatch(freshDown);
    assert.strictEqual(freshDown.defaultPrevented, false, 'Fresh press must not be swallowed by the stale release');
    assert.strictEqual(freshDown.immediatePropagationStopped, false);

    const freshUp = createSimulatedEvent({ type: 'keyup', key: 'Escape', code: 'Escape' });
    dispatch(freshUp);
    assert.strictEqual(freshUp.defaultPrevented, false, 'Release of the fresh press must be routed normally');
  });

  await t.test('Page hide terminates the session and releases keyboard ownership (A13)', () => {
    VibeKeyboardRouter.resetForTesting();
    VibeKeyboardRouter.setState(SessionState.WAITING);

    let dismissRequests = 0;
    let stopCount = 0;
    const onDismiss = () => { dismissRequests++; };
    const onStop = () => { stopCount++; };
    VibeEvents.on('popover:requestDismiss', onDismiss);
    VibeEvents.on('inspection:stop', onStop);

    VibeKeyboardRouter.onPageHide();

    assert.strictEqual(VibeKeyboardRouter.getState(), SessionState.IDLE, 'Page hide must end the session');
    assert.strictEqual(dismissRequests, 1, 'Any open editor must be closed exactly once');
    assert.strictEqual(stopCount, 1, 'Inspection must be stopped exactly once');

    // Keys are no longer consumed
    const ordinary = createSimulatedEvent({ key: 'a', code: 'KeyA' });
    dispatch(ordinary);
    assert.strictEqual(ordinary.defaultPrevented, false, 'Host must own its keyboard after page hide');
    assert.strictEqual(ordinary.immediatePropagationStopped, false);

    VibeEvents.off('popover:requestDismiss', onDismiss);
    VibeEvents.off('inspection:stop', onStop);
  });

  await t.test('Explicit overlay closure ends the session exactly once (A13)', () => {
    VibeKeyboardRouter.resetForTesting();
    VibeKeyboardRouter.setState(SessionState.SELECTION);

    let stopCount = 0;
    const onStop = () => { stopCount++; };
    VibeEvents.on('inspection:stop', onStop);

    VibeEvents.emit('overlay:closed');
    assert.strictEqual(VibeKeyboardRouter.getState(), SessionState.IDLE, 'Overlay closure must end the session');
    assert.strictEqual(stopCount, 1, 'Overlay closure must stop inspection once');

    // A repeated closure must not run a second teardown
    VibeEvents.emit('overlay:closed');
    assert.strictEqual(stopCount, 1, 'Repeated closure must not duplicate commands');
    assert.strictEqual(VibeKeyboardRouter.getState(), SessionState.IDLE);

    VibeEvents.off('inspection:stop', onStop);
  });

  await t.test('Page hidden clears held keys without releasing an active session (A13)', () => {
    VibeKeyboardRouter.resetForTesting();
    const previousDocument = typeof globalThis.document !== 'undefined' ? globalThis.document : null;
    globalThis.document = { visibilityState: 'hidden' };

    try {
      VibeKeyboardRouter.setState(SessionState.SELECTION);
      VibeKeyboardRouter.onVisibilityChange();
      assert.strictEqual(VibeKeyboardRouter.getState(), SessionState.SELECTION, 'A hidden page keeps its session');

      const consumed = createSimulatedEvent({ key: 'a', code: 'KeyA' });
      dispatch(consumed);
      assert.strictEqual(consumed.defaultPrevented, true, 'Selection still owns the keyboard');

      // Exit, then lose the release while the page is hidden
      const escDown = createSimulatedEvent({ key: 'Escape', code: 'Escape' });
      dispatch(escDown);
      VibeKeyboardRouter.onVisibilityChange();
      assert.strictEqual(VibeKeyboardRouter.getState(), SessionState.IDLE);

      const staleUp = createSimulatedEvent({ type: 'keyup', key: 'Escape', code: 'Escape' });
      dispatch(staleUp);
      assert.strictEqual(staleUp.defaultPrevented, true, 'The release lost to the hidden page stays owned');

      const freshDown = createSimulatedEvent({ key: 'Escape', code: 'Escape' });
      dispatch(freshDown);
      assert.strictEqual(freshDown.defaultPrevented, false, 'A fresh press is routed to the host');
    } finally {
      if (previousDocument) globalThis.document = previousDocument;
      else delete globalThis.document;
    }
  });

  await t.test('teardown is idempotent and re-init does not duplicate listeners or commands (A13)', () => {
    VibeKeyboardRouter.resetForTesting();
    VibeKeyboardRouter.setState(SessionState.SELECTION);

    VibeKeyboardRouter.teardown();
    VibeKeyboardRouter.teardown();

    assert.strictEqual(VibeKeyboardRouter.getState(), SessionState.IDLE, 'Teardown must release ownership');
    assert.strictEqual((listeners.capture.keydown || []).length, 0, 'Teardown must remove capture listeners');
    assert.strictEqual((listeners.bubble.blur || []).length, 0, 'Teardown must remove the blur listener');

    // Re-init registers exactly one set of listeners and one command per keystroke
    VibeKeyboardRouter.init();
    assert.strictEqual((listeners.capture.keydown || []).length, 1, 'Re-init must not duplicate capture listeners');

    VibeKeyboardRouter.setState(SessionState.SELECTION);
    let stopCount = 0;
    const onStop = () => { stopCount++; };
    VibeEvents.on('inspection:stop', onStop);

    dispatch(createSimulatedEvent({ key: 'Escape', code: 'Escape' }));
    assert.strictEqual(stopCount, 1, 'One exit keystroke must run exactly one command');

    VibeEvents.off('inspection:stop', onStop);
  });
});

