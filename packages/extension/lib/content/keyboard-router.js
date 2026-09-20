// Centralized keyboard router and event isolation manager.
// Intercepts window capture-phase keyboard events from document_start,
// owns keyboard routing by annotation-session lifecycle, and drains exit-key sequences.
// Session cleanup (blur, page hiding, overlay closure, initialization failure,
// destruction) is idempotent and never leaves the page with stale key ownership.
// One Annotate session is shared by every controllable frame of a tab: the frame
// whose user action starts a state owns the local state machine, peers mirror the
// session so keyboard ownership follows focus into them, and any exit releases all.

import VibeEvents from './event-bus.js';
import VibeAPI from './api-bridge.js';
import VibeShadowHost from './shadow-host.js';
import VibeInspectionMode from './inspection-mode.js';
import { shouldTriggerHotkey } from './hotkey.js';
import { SESSION_SYNC, SESSION_STATES, ACTIVE_SESSION_STATES } from '../session-protocol.js';

export const SessionState = SESSION_STATES;

let currentState = SessionState.IDLE;
let customShortcut = null;
let initialized = false;
let isRecordingShortcut = false;
let activePopoverForTesting = null;

// --- Cross-frame session sync state ---
// Identifies this document to the background so a hello can tell "the frame that
// owned the session is still alive" apart from "its document was replaced".
const sessionNonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
// This frame mirrors a session whose state machine lives in another frame of the tab.
let mirroredSession = false;
// True while a remote state is being applied: applying it must never be reported
// back as a local transition (that would clobber the owning frame's state).
let applyingRemoteState = false;
let sessionMessageListener = null;
// This frame's own UI exists (entrypoints/content/index.js finished booting). A
// session mirrored at document_start owns the keyboard immediately but can only
// drive the overlay once there is an overlay to drive.
let uiReady = false;

const isMac = typeof navigator !== 'undefined' && navigator.platform?.toUpperCase().indexOf('MAC') >= 0;
const DEFAULT_SHORTCUT = {
  key: ',',
  ctrlKey: !isMac,
  metaKey: isMac,
  shiftKey: true,
  altKey: false,
};

function getActiveShortcut() {
  return customShortcut || DEFAULT_SHORTCUT;
}

function dispatchInternalUIEvent(e, target) {
  if (!e.isTrusted || e._isVibeInternal || !target || typeof target.dispatchEvent !== 'function') return;
  try {
    const synthetic = new KeyboardEvent(e.type, {
      key: e.key,
      code: e.code,
      repeat: e.repeat,
      isComposing: e.isComposing,
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey,
      altKey: e.altKey,
      metaKey: e.metaKey,
      bubbles: true,
      composed: false,
    });
    synthetic._isVibeInternal = true;
    target.dispatchEvent(synthetic);
  } catch (_) {}
}

// Tracking sets for physically pressed keys and drained exit sequences
const pressedCodes = new Set();
const pressedKeys = new Set();
let drainingCodes = new Set();
let drainingKeys = new Set();

// Keys the session consumed whose release was lost to a blur. The eventual
// release still belongs to the consumed keystroke and must not reach the host,
// but a new full press of the same key is a fresh keystroke and supersedes it.
const pendingReleaseCodes = new Set();
const pendingReleaseKeys = new Set();

// Element currently receiving IME composition text inside the extension UI
let composingTarget = null;

function getEventTarget() {
  return typeof window !== 'undefined' ? window : null;
}

let shortcutStorageListener = null;
let sessionEventsSubscribed = false;

function onShortcutStorageChanged(changes, ns) {
  if (ns === 'local' && changes.vibeCustomShortcut) {
    customShortcut = changes.vibeCustomShortcut.newValue || null;
  }
}

function onInspectionStart() {
  setSessionState(SessionState.SELECTION);
}

function onInspectionStop() {
  setSessionState(SessionState.IDLE);
}

function onElementSelected() {
  setSessionState(SessionState.WAITING);
}

function onAnnotationEdit() {
  if (VibeInspectionMode.isActive()) {
    setSessionState(SessionState.WAITING);
  }
}

function onPopoverOpened() {
  if (currentState === SessionState.WAITING) {
    setSessionState(SessionState.EDITING);
  }
}

function onPopoverDismissed({ reEnableInspection } = {}) {
  setSessionState(reEnableInspection ? SessionState.SELECTION : SessionState.IDLE);
}

function onPopoverCancelled() {
  setSessionState(VibeInspectionMode.isActive() ? SessionState.SELECTION : SessionState.IDLE);
}

function onShortcutRecordingStart() {
  isRecordingShortcut = true;
}

function onShortcutRecordingStop() {
  isRecordingShortcut = false;
}

// The overlay disappeared: whatever the user was annotating is over, so the
// session must not keep ownership (or an editor) alive behind a hidden UI.
function onOverlayClosed() {
  terminateSession();
}

function subscribeSessionEvents() {
  if (sessionEventsSubscribed) return;
  sessionEventsSubscribed = true;

  VibeEvents.on('inspection:start', onInspectionStart);
  VibeEvents.on('inspection:started', onInspectionStart);
  VibeEvents.on('inspection:stop', onInspectionStop);
  VibeEvents.on('inspection:stopped', onInspectionStop);
  VibeEvents.on('inspection:elementClicked', onElementSelected);
  VibeEvents.on('annotation:edit', onAnnotationEdit);
  VibeEvents.on('popover:opened', onPopoverOpened);
  VibeEvents.on('popover:dismissed', onPopoverDismissed);
  VibeEvents.on('popover:cancelled', onPopoverCancelled);
  VibeEvents.on('shortcut:recording:start', onShortcutRecordingStart);
  VibeEvents.on('shortcut:recording:stop', onShortcutRecordingStop);
  VibeEvents.on('overlay:closed', onOverlayClosed);
}

function unsubscribeSessionEvents() {
  if (!sessionEventsSubscribed) return;
  sessionEventsSubscribed = false;

  VibeEvents.off('inspection:start', onInspectionStart);
  VibeEvents.off('inspection:started', onInspectionStart);
  VibeEvents.off('inspection:stop', onInspectionStop);
  VibeEvents.off('inspection:stopped', onInspectionStop);
  VibeEvents.off('inspection:elementClicked', onElementSelected);
  VibeEvents.off('annotation:edit', onAnnotationEdit);
  VibeEvents.off('popover:opened', onPopoverOpened);
  VibeEvents.off('popover:dismissed', onPopoverDismissed);
  VibeEvents.off('popover:cancelled', onPopoverCancelled);
  VibeEvents.off('shortcut:recording:start', onShortcutRecordingStart);
  VibeEvents.off('shortcut:recording:stop', onShortcutRecordingStop);
  VibeEvents.off('overlay:closed', onOverlayClosed);
}

function attachKeyboardListeners(target) {
  target.addEventListener('keydown', onKeyDown, true);
  target.addEventListener('keyup', onKeyUp, true);
  target.addEventListener('keypress', onKeyPress, true);
  target.addEventListener('compositionstart', onCompositionStart, true);
  target.addEventListener('compositionend', onCompositionEnd, true);
  target.addEventListener('blur', onBlur);
}

function detachKeyboardListeners(target) {
  target.removeEventListener('keydown', onKeyDown, true);
  target.removeEventListener('keyup', onKeyUp, true);
  target.removeEventListener('keypress', onKeyPress, true);
  target.removeEventListener('compositionstart', onCompositionStart, true);
  target.removeEventListener('compositionend', onCompositionEnd, true);
  target.removeEventListener('blur', onBlur);
}

// How this content script was installed relative to page parsing, so callers can
// tell full early-listener protection apart from a runtime injection. The router
// owns window capture events before parse-time host listeners only when the
// browser injected the script at document_start; chrome.scripting.executeScript
// into an already-loaded page runs after those listeners are registered and the
// background marks that case with LATE_INJECTION_FLAG.
const CONTENT_SCRIPT_WORLD = 'ISOLATED';
const LATE_INJECTION_FLAG = '__VIBE_LATE_INJECTION';
let installationEvidence = null;

function captureInstallationEvidence() {
  const runAt = typeof document !== 'undefined' && document.readyState ? document.readyState : 'unknown';
  const lateInjection = typeof window !== 'undefined' && window[LATE_INJECTION_FLAG] === true;
  const installedAt = typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : 0;

  return {
    world: CONTENT_SCRIPT_WORLD,
    runAt,
    installedAt,
    lateInjection,
    earlyCapture: runAt === 'loading' && !lateInjection,
  };
}

function init() {
  if (initialized) return;
  initialized = true;

  // Recorded once per page: teardown and re-init must not rewrite the fact that
  // this page's injection was early (or late).
  if (!installationEvidence) installationEvidence = captureInstallationEvidence();

  const target = getEventTarget();
  if (target && target.addEventListener) {
    attachKeyboardListeners(target);
    target.addEventListener('pagehide', onPageHide);
    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('visibilitychange', onVisibilityChange);
    }
  }

  // Load shortcut and subscribe to changes
  if (VibeAPI && VibeAPI.getCustomShortcut) {
    VibeAPI.getCustomShortcut().then((s) => { customShortcut = s; }).catch(() => {});
  }

  if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    shortcutStorageListener = onShortcutStorageChanged;
    chrome.storage.onChanged.addListener(shortcutStorageListener);
  }

  // Synchronize state with annotation lifecycle events
  subscribeSessionEvents();

  // Cross-frame session coordination. The listener must exist before the hello
  // resolves, so a session that is already active in the tab reaches this frame
  // even if it loads in the middle of one.
  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    sessionMessageListener = onSessionSyncMessage;
    chrome.runtime.onMessage.addListener(sessionMessageListener);
  }
  requestSessionSync();
}

// Release every key the session still believes is held or owned. Used when an
// event that would deliver the release cannot reach the page anymore.
function clearHeldKeyData() {
  pressedCodes.clear();
  pressedKeys.clear();
  drainingCodes = new Set();
  drainingKeys = new Set();
  pendingReleaseCodes.clear();
  pendingReleaseKeys.clear();
  composingTarget = null;
}

// Focus left the page: released keys may never be reported. Keep consumed exit
// keys owned so their stray release cannot hit the host, while a new press of
// the same key supersedes the stale entry (see handlePendingReleaseEvent).
// Ownership itself survives: a page that regains focus keeps its session, and
// A12 requires "returning, re-entering, or exiting" to stay safe.
function onFocusLoss() {
  pressedCodes.clear();
  pressedKeys.clear();

  for (const code of drainingCodes) pendingReleaseCodes.add(code);
  for (const key of drainingKeys) pendingReleaseKeys.add(key);
  drainingCodes = new Set();
  drainingKeys = new Set();

  composingTarget = null;
}

// The document is going away. A frame that owns the tab's session has to report it,
// because nothing else can observe that its state machine disappeared; a frame that
// only mirrors another frame's session drops its own copy silently, so a subframe
// navigating or being removed cannot end a session the rest of the tab is using (A15).
function onPageHide() {
  if (isSessionOwner()) terminateSession();
  else applyAsRemote(() => terminateSession());
  clearHeldKeyData();
}

function onVisibilityChange() {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') onFocusLoss();
}

function isSessionActive() {
  return currentState !== SessionState.IDLE || VibeInspectionMode.isActive();
}

// This frame's transitions are the authoritative ones: it is in an active state
// without mirroring a state machine that lives in another frame.
function isSessionOwner() {
  return isActiveState(currentState) && !mirroredSession;
}

// End the Annotate session: close any open editor, hand DOM focus back to the
// page, stop inspection and release keyboard ownership. Idempotent, and safe to
// call from any state. Ends the tab's shared session everywhere it applies: the
// transition is published, so peer frames release their mirrored protection too.
function terminateSession() {
  if (!isSessionActive()) return false;

  VibeEvents.emit('popover:requestDismiss', { reEnableInspection: false });
  setSessionState(SessionState.IDLE);

  // Focus inside a (possibly hidden) extension UI would keep swallowing keys,
  // so hand it back before the session's ownership is released.
  const root = VibeShadowHost.getRoot?.();
  if (root && root.activeElement && typeof root.activeElement.blur === 'function') {
    root.activeElement.blur();
  }

  VibeEvents.emit('inspection:stop');
  return true;
}

// Detach everything and forget all session state. Idempotent; init() can run
// again afterwards without duplicating listeners or commands.
function teardown() {
  // A frame that fails to boot must release only itself: its own failure is no
  // reason to end the session the rest of the tab is sharing.
  applyAsRemote(() => terminateSession());
  unsubscribeSessionEvents();

  const target = getEventTarget();
  if (initialized && target && target.removeEventListener) {
    detachKeyboardListeners(target);
    target.removeEventListener('pagehide', onPageHide);
    if (typeof document !== 'undefined' && document.removeEventListener) {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    }
  }
  if (shortcutStorageListener && typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    chrome.storage.onChanged.removeListener(shortcutStorageListener);
  }
  if (sessionMessageListener && typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.removeListener(sessionMessageListener);
  }

  initialized = false;
  shortcutStorageListener = null;
  sessionMessageListener = null;
  customShortcut = null;
  isRecordingShortcut = false;
  activePopoverForTesting = null;
  currentState = SessionState.IDLE;
  mirroredSession = false;
  uiReady = false;
  clearHeldKeyData();
}

// --- Cross-frame session coordination ---

function isActiveState(state) {
  return ACTIVE_SESSION_STATES.includes(state);
}

function sendRuntimeMessage(message) {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return Promise.resolve(null);
  try {
    return chrome.runtime.sendMessage(message).catch(() => null);
  } catch (_) {
    return Promise.resolve(null);
  }
}

// Publish the session evidence on the shadow host: the one node the page world and
// the E2E suite can read, and the honest record of whether this frame is protected.
function publishSessionEvidence() {
  const host = VibeShadowHost.getHost?.();
  if (!host || typeof host.setAttribute !== 'function') return;
  host.setAttribute('data-vibe-session-state', currentState);
  host.setAttribute('data-vibe-session-mirror', String(mirroredSession));
}

// The single place that changes ownership. A local transition is announced to the
// coordinator, which relays it to the other frames of the tab; a remote state is
// applied inside applyAsRemote() and therefore never announced back.
function setSessionState(next) {
  const changed = currentState !== next;
  currentState = next;
  if (next === SessionState.IDLE) mirroredSession = false;
  if (!changed) return;
  publishSessionEvidence();
  if (!applyingRemoteState) {
    sendRuntimeMessage({ action: SESSION_SYNC.STATE, state: next, nonce: sessionNonce });
  }
}

function applyAsRemote(fn) {
  applyingRemoteState = true;
  try {
    fn();
  } finally {
    applyingRemoteState = false;
  }
}

// A session is active in another frame: own the keyboard here as well, so moving
// focus into this frame cannot leak shortcuts. Isolation starts immediately (the
// frame consumes keys from this moment); the overlay it should be annotating with
// follows once this frame's UI has booted.
function applyRemoteSessionState(remoteState, ownerNonce = null) {
  if (!initialized) return;
  // The coordinator echoes a transition back to the tab; the frame that produced it
  // runs the authoritative state machine and must not treat its own echo as remote.
  if (ownerNonce && ownerNonce === sessionNonce) return;

  if (!isActiveState(remoteState)) {
    mirroredSession = false;
    if (currentState === SessionState.IDLE) return;
    applyAsRemote(() => terminateSession());
    publishSessionEvidence();
    return;
  }

  mirroredSession = true;
  activateMirroredSession();
}

// Mirror an active session into this frame. The mirrored state is assignment rather
// than a transition: it is applied silently and never announced back (that would
// make two frames fight over the tab's session), which is also why the state is
// written here directly instead of through setSessionState.
function activateMirroredSession() {
  if (!initialized || !mirroredSession) return;

  // This frame's own transient state survives: the remote signal only says that a
  // session exists, and an editor open in another frame is not this frame's editor.
  if (currentState === SessionState.IDLE) currentState = SessionState.SELECTION;
  publishSessionEvidence();

  // Without a UI there is nothing to drive yet; onUiReady() finishes the mirror.
  if (!uiReady || VibeInspectionMode.isActive()) return;
  applyAsRemote(() => VibeEvents.emit('inspection:start'));
}

// This frame's UI exists now (entrypoints/content/index.js → bootNormal). A session
// mirrored at document_start still has to activate the local overlay — cursor,
// hover and click-to-annotate — so the user can annotate from this frame too.
// Frames without a UI publish nothing, which keeps "no shadow host" an honest
// record that this frame is not represented as protected.
function onUiReady() {
  uiReady = true;
  if (!initialized) return;
  if (mirroredSession) activateMirroredSession();
  else publishSessionEvidence();
}

function onSessionSyncMessage(request) {
  if (!request || request.action !== SESSION_SYNC.REMOTE_STATE) return;
  applyRemoteSessionState(request.state, request.ownerNonce);
}

// Ask the background which session the tab is in, so a frame that loads while a
// session is active joins it instead of leaking shortcuts.
function requestSessionSync() {
  sendRuntimeMessage({ action: SESSION_SYNC.HELLO, nonce: sessionNonce }).then((response) => {
    if (!response || !response.state) return;
    applyRemoteSessionState(response.state, response.ownerNonce);
  });
}

function isOurUI(e) {
  const path = e.composedPath ? e.composedPath() : [];
  const host = VibeShadowHost.getHost?.();
  return !!(host && path.includes(host));
}

function isOurEditable(e) {
  if (!isOurUI(e)) return false;
  const target = getDeepestTarget(e);
  if (!target) return false;
  return target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable;
}

function getDeepestTarget(e) {
  const path = e.composedPath ? e.composedPath() : [];
  return path[0] || e.target || null;
}

function onCompositionStart(e) {
  composingTarget = getDeepestTarget(e);
}

function onCompositionEnd() {
  composingTarget = null;
}

function isEventFromComposingTarget(e) {
  if (!composingTarget) return false;
  const path = e.composedPath ? e.composedPath() : [];
  return path.length ? path.includes(composingTarget) : e.target === composingTarget;
}

// Keys owned by an active IME composition (candidate confirm/cancel/navigate).
// They must not run session commands and are blocked from reaching the host,
// while their default action is consumed so they cannot edit the text on their
// own. Modifier combinations stay available as explicit session commands (save
// shortcut, mode toggle hotkey).
const IME_PROCESS_KEY_CODE = 229;

function isCompositionKey(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  if (e.isComposing === true) return true;
  // Browsers without isComposing report candidate keys as the "Process" key (229)
  if (e.keyCode === IME_PROCESS_KEY_CODE || e.key === 'Process') return true;
  return isEventFromComposingTarget(e);
}

// Isolate a composition-owned key from the host and suppress its session command.
function consumeCompositionKey(e) {
  e.preventDefault();
  e.stopImmediatePropagation();
}

function trackKeyDown(e) {
  if (e.code) pressedCodes.add(e.code);
  if (e.key) pressedKeys.add(e.key);
}

function trackKeyUp(e) {
  if (e.code) pressedCodes.delete(e.code);
  if (e.key) pressedKeys.delete(e.key);
}

function onBlur() {
  onFocusLoss();
}

const MODIFIER_MAP = {
  Control: { active: (e) => e.ctrlKey, codes: ['ControlLeft', 'ControlRight'] },
  Shift: { active: (e) => e.shiftKey, codes: ['ShiftLeft', 'ShiftRight'] },
  Alt: { active: (e) => e.altKey, codes: ['AltLeft', 'AltRight'] },
  Meta: { active: (e) => e.metaKey, codes: ['MetaLeft', 'MetaRight'] },
};

function beginDrain(e) {
  // Transfer currently pressed keys/codes to draining sets
  drainingCodes = new Set(pressedCodes);
  drainingKeys = new Set(pressedKeys);
  if (e.code) drainingCodes.add(e.code);
  if (e.key) drainingKeys.add(e.key);

  // Include modifier releases if modifiers were active during exit
  for (const [key, { active, codes }] of Object.entries(MODIFIER_MAP)) {
    if (active(e)) {
      drainingKeys.add(key);
      for (const code of codes) drainingCodes.add(code);
    }
  }
}

function isDraining(e) {
  if (drainingCodes.size === 0 && drainingKeys.size === 0) return false;
  return drainingCodes.has(e.code) || drainingKeys.has(e.key);
}

function handleDrainingEvent(e) {
  if (!isDraining(e)) return false;

  // Consume repeating keydowns, keypress, and keyup belonging to exit sequence
  e.preventDefault();
  e.stopImmediatePropagation();

  if (e.type === 'keyup') {
    if (e.code) drainingCodes.delete(e.code);
    if (e.key) drainingKeys.delete(e.key);

    const mod = MODIFIER_MAP[e.key];
    if (mod) {
      for (const code of mod.codes) drainingCodes.delete(code);
    }
  }

  return true;
}

function matchesPendingRelease(e) {
  return (!!e.code && pendingReleaseCodes.has(e.code)) || (!!e.key && pendingReleaseKeys.has(e.key));
}

function forgetPendingRelease(e) {
  if (e.code) pendingReleaseCodes.delete(e.code);
  if (e.key) pendingReleaseKeys.delete(e.key);

  const mod = MODIFIER_MAP[e.key];
  if (mod) {
    for (const code of mod.codes) pendingReleaseCodes.delete(code);
  }
}

// Releases lost to a blur (A12): a stray keyup for a key the session consumed
// stays owned, while a new keydown of the same key is a fresh keystroke that
// supersedes the stale entry and is routed normally.
function handlePendingReleaseEvent(e) {
  if (e.type === 'keydown') {
    if (matchesPendingRelease(e)) forgetPendingRelease(e);
    return false;
  }

  if (e.type === 'keyup' && matchesPendingRelease(e)) {
    e.preventDefault();
    e.stopImmediatePropagation();
    forgetPendingRelease(e);
    return true;
  }

  return false;
}

function onKeyDown(e) {
  trackKeyDown(e);
  dispatchKeyboardEvent(e);
}

function onKeyUp(e) {
  trackKeyUp(e);
  dispatchKeyboardEvent(e);
}

function onKeyPress(e) {
  dispatchKeyboardEvent(e);
}

function dispatchKeyboardEvent(e) {
  // 1. Drain exit/confirmation key sequence if active
  if (handleDrainingEvent(e)) {
    return;
  }

  // 2. Own releases whose keyup was lost to a blur, and let a fresh press supersede them
  if (handlePendingReleaseEvent(e)) {
    return;
  }

  // 3. Route event according to annotation session state
  switch (currentState) {
    case SessionState.IDLE:
      handleIdle(e);
      break;

    case SessionState.SELECTION:
      handleSelection(e);
      break;

    case SessionState.WAITING:
      handleWaiting(e);
      break;

    case SessionState.EDITING:
      handleEditing(e);
      break;
  }
}

function handleIdle(e) {
  if (isRecordingShortcut) {
    return;
  }

  // Preserve UI event protection for independent edit entry points without assigning them unsupported whole-page session semantics
  if (isOurUI(e)) {
    if (e.type !== 'keydown') {
      e.stopImmediatePropagation();
      return;
    }

    // 0. IME composition keys belong to the editor: keep them away from the
    // host, run no command, and consume their default action so candidate
    // confirm/cancel keys cannot alter the editor text (the native composition
    // itself is driven by the IME, not by the key's default action).
    if (isCompositionKey(e)) {
      consumeCompositionKey(e);
      return;
    }

    // 1. Escape: dismiss popover without returning to selection mode
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      beginDrain(e);
      VibeEvents.emit('popover:requestDismiss', { reEnableInspection: false });
      return;
    }

    // 2. Save shortcut: Cmd/Ctrl + Enter
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      beginDrain(e);
      VibeEvents.emit('popover:requestSave');
      return;
    }

    // 3. Tab / Shift+Tab focus trap within popover
    if (e.key === 'Tab') {
      if (handleTabTrap(e)) {
        return;
      }
    }

    // 4. Other keys inside our UI (typing, arrows, steppers)
    e.stopImmediatePropagation();
    const path = e.composedPath ? e.composedPath() : [];
    const root = VibeShadowHost.getRoot?.();
    const target = path[0] || (root ? root.activeElement : null) || e.target;
    dispatchInternalUIEvent(e, target);
    return;
  }

  if (e.type !== 'keydown') return;

  // Check for global toggle shortcut
  if (shouldTriggerHotkey(e, getActiveShortcut())) {
    e.preventDefault();
    e.stopImmediatePropagation();
    setSessionState(SessionState.SELECTION);
    VibeEvents.emit('inspection:start');
  }
}

function exitSelectionMode(e) {
  if (currentState === SessionState.IDLE) return;

  // Publishing the transition is what releases the tab's other frames: an exit from
  // any frame ends the shared session, not just the protection in this one.
  setSessionState(SessionState.IDLE);
  beginDrain(e);

  // Blur any focused element inside extension Shadow DOM so focus doesn't stay trapped
  const root = VibeShadowHost.getRoot?.();
  if (root && root.activeElement) {
    root.activeElement.blur();
  }

  VibeEvents.emit('inspection:stop');
}

function handleSelection(e) {
  // Selection mode owns all keyboard events exclusively!
  e.preventDefault();
  e.stopImmediatePropagation();

  if (e.type !== 'keydown') {
    return;
  }

  // 1. Escape exits Annotate selection mode
  if (e.key === 'Escape') {
    exitSelectionMode(e);
    return;
  }

  // 2. Toggle hotkey exits Annotate selection mode
  if (shouldTriggerHotkey(e, getActiveShortcut())) {
    exitSelectionMode(e);
    return;
  }

  // 3. Arrow navigation and Enter confirmation
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter') {
    const handled = VibeInspectionMode.handleNavigationKey(e);
    if (e.key === 'Enter' && handled) {
      beginDrain(e);
    }
    return;
  }

  // All other keys (characters, Delete, Backspace, shortcuts) are consumed above
}

function handleWaiting(e) {
  // Waiting state during async context generation
  e.preventDefault();
  e.stopImmediatePropagation();

  if (e.type === 'keydown') {
    if (e.key === 'Escape' || shouldTriggerHotkey(e, getActiveShortcut())) {
      exitSelectionMode(e);
    }
  }
}

function getActivePopover() {
  if (activePopoverForTesting) return activePopoverForTesting;
  const root = VibeShadowHost.getRoot?.();
  return root?.querySelector?.('.vibe-popover') || null;
}

function handleTabTrap(e) {
  const popover = getActivePopover();
  if (!popover) return false;

  const selector = 'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const allFocusables = Array.from(popover.querySelectorAll(selector));
  const focusables = allFocusables.filter((el) => {
    if (typeof el.getClientRects === 'function') {
      return el.getClientRects().length > 0;
    }
    return el.offsetParent !== null;
  });

  if (focusables.length === 0) return false;

  const path = e.composedPath ? e.composedPath() : [];
  const root = VibeShadowHost.getRoot?.();
  const current = path[0] || (root ? root.activeElement : e.target);
  let index = focusables.indexOf(current);
  if (index === -1 && current) {
    index = focusables.findIndex((el) => el.contains?.(current));
  }

  if (e.shiftKey) {
    if (index <= 0) {
      e.preventDefault();
      e.stopImmediatePropagation();
      focusables[focusables.length - 1].focus();
      return true;
    }
    e.stopImmediatePropagation();
    return true;
  } else {
    if (index === focusables.length - 1 || index === -1) {
      e.preventDefault();
      e.stopImmediatePropagation();
      focusables[0].focus();
      return true;
    }
    e.stopImmediatePropagation();
    return true;
  }
}

function handleEditing(e) {
  if (e.type !== 'keydown') {
    // For keyup / keypress while editing in our UI:
    if (isOurUI(e)) {
      e.stopImmediatePropagation();
    } else {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
    return;
  }

  // 0. IME composition keys (candidate confirm/cancel/navigate) belong to the
  // editor: keep them away from the host, run no session command, and consume
  // their default action so they cannot alter the editor text on their own.
  // Explicit modifier commands (save shortcut, mode toggle) stay available.
  if (isOurUI(e) && isCompositionKey(e)) {
    consumeCompositionKey(e);
    return;
  }

  // 1. Toggle hotkey exits Annotate mode completely
  if (shouldTriggerHotkey(e, getActiveShortcut())) {
    e.preventDefault();
    e.stopImmediatePropagation();
    // Close the editor through the regular request channel, then release ownership.
    VibeEvents.emit('popover:requestDismiss', { reEnableInspection: false });
    exitSelectionMode(e);
    return;
  }

  // 2. Escape: editor-Esc close / continue-selection
  // Dismisses popover and returns to SELECTION mode. Event must NOT execute again in SELECTION mode!
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopImmediatePropagation();
    beginDrain(e);
    VibeEvents.emit('popover:requestDismiss', { reEnableInspection: true });
    return;
  }

  // 3. Save shortcut: Cmd/Ctrl + Enter
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    e.stopImmediatePropagation();
    beginDrain(e);
    VibeEvents.emit('popover:requestSave');
    return;
  }

  // 3.5. Tab / Shift+Tab focus trap within editing UI
  if (e.key === 'Tab') {
    if (handleTabTrap(e)) {
      return;
    }
  }

  // 4. Target is an editable element inside extension UI (e.g. comment textarea, raw css, css rules)
  if (isOurEditable(e)) {
    // Separate propagation blocking from default cancellation!
    // Block host listeners by stopping immediate propagation, but allow native editing by NOT preventing default.
    e.stopImmediatePropagation();
    const path = e.composedPath ? e.composedPath() : [];
    dispatchInternalUIEvent(e, path[0] || e.target);
    return;
  }

  // 6. Target is other extension UI element
  if (isOurUI(e)) {
    e.stopImmediatePropagation();
    const path = e.composedPath ? e.composedPath() : [];
    dispatchInternalUIEvent(e, path[0] || e.target);
    return;
  }

  // 7. Any key pressed outside our UI while editing is owned by the session
  e.preventDefault();
  e.stopImmediatePropagation();
}


function getState() {
  return currentState;
}

function getInstallEvidence() {
  return installationEvidence ? { ...installationEvidence } : null;
}

// Test hook: put this frame into a state without running the transition, so a
// scenario can start from an already-running local state machine.
function setState(state) {
  currentState = state;
}

function setCustomShortcutForTesting(shortcut) {
  customShortcut = shortcut;
}

function setActivePopoverForTesting(popover) {
  activePopoverForTesting = popover;
}

function resetForTesting() {
  currentState = SessionState.IDLE;
  pressedCodes.clear();
  pressedKeys.clear();
  drainingCodes.clear();
  drainingKeys.clear();
  pendingReleaseCodes.clear();
  pendingReleaseKeys.clear();
  composingTarget = null;
  customShortcut = null;
  isRecordingShortcut = false;
  activePopoverForTesting = null;
  installationEvidence = null;
  mirroredSession = false;
  applyingRemoteState = false;
  uiReady = false;
}

const VibeKeyboardRouter = {
  init,
  teardown,
  getState,
  getInstallEvidence,
  setState,
  terminateSession,
  onUiReady,
  setCustomShortcutForTesting,
  setActivePopoverForTesting,
  resetForTesting,
  onKeyDown,
  onKeyUp,
  onKeyPress,
  onCompositionStart,
  onCompositionEnd,
  onBlur,
  onPageHide,
  onVisibilityChange,
  SessionState,
};

export default VibeKeyboardRouter;

