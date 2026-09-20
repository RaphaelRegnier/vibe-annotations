// Tab-level half of the cross-frame Annotate session protocol.
//
// Each frame runs its own keyboard state machine (lib/content/keyboard-router.js).
// This coordinator keeps the tab's single session record, so a frame that loads while
// the tab is annotating joins the session instead of leaking host shortcuts, and so a
// change or a release reported by one frame reaches the others.
//
// It is deliberately free of chrome APIs: the caller supplies `broadcast`, which
// delivers a session state to the frames of a tab that the extension is authorized to
// control. Unauthorized, restricted and non-injectable frames are therefore never told
// they are protected — they have no content script to receive the message.

import { SESSION_STATES, ACTIVE_SESSION_STATES } from '../session-protocol.js';

export default class SessionCoordinator {
  constructor({ broadcast }) {
    this.broadcast = broadcast;
    // tabId → { state, ownerFrameId, ownerNonce, frames: Map<frameId, nonce> }.
    // The per-frame nonces identify documents: they separate "the frame that owns the
    // session is still alive" from "its document was replaced by a new one in the same
    // frame slot", and let a frame recognize the echo of its own transition.
    this.tabs = new Map();
  }

  sessionFor(tabId) {
    let session = this.tabs.get(tabId);
    if (!session) {
      session = { state: SESSION_STATES.IDLE, ownerFrameId: null, ownerNonce: null, frames: new Map() };
      this.tabs.set(tabId, session);
    }
    return session;
  }

  // Record which document is currently living in a frame slot, and report the one it
  // replaced (if any).
  static noteFrame(session, frameId, nonce) {
    const knownNonce = session.frames.get(frameId);
    if (nonce) session.frames.set(frameId, nonce);
    return knownNonce;
  }

  isActive(state) {
    return ACTIVE_SESSION_STATES.includes(state);
  }

  // End the tab's session. Returns whether an active session was actually released.
  end(tabId) {
    const session = this.tabs.get(tabId);
    if (!session || !this.isActive(session.state)) return false;
    session.state = SESSION_STATES.IDLE;
    session.ownerFrameId = null;
    session.ownerNonce = null;
    return true;
  }

  forget(tabId) {
    this.tabs.delete(tabId);
  }

  // A frame's keyboard router boots (or its document is replaced) and asks which
  // session the tab is in.
  async hello(tabId, frameId, nonce) {
    const session = this.sessionFor(tabId);
    const knownNonce = SessionCoordinator.noteFrame(session, frameId, nonce);

    // A new top document means the tab navigated: no session survives that. Subframe
    // navigation is deliberately not a reset — a frame navigating inside a tab keeps
    // the session the rest of the tab is using.
    if (frameId === 0) {
      if (this.end(tabId)) await this.broadcast(tabId, SESSION_STATES.IDLE, null);
      return { state: SESSION_STATES.IDLE, ownerNonce: null };
    }

    // The document that owned the session was replaced by a new one in the same frame
    // slot. Release the tab instead of leaving peers protecting a dead owner.
    if (this.isActive(session.state) && session.ownerFrameId === frameId
      && knownNonce && nonce && knownNonce !== nonce) {
      this.end(tabId);
      await this.broadcast(tabId, SESSION_STATES.IDLE, null);
      return { state: SESSION_STATES.IDLE, ownerNonce: null };
    }

    return { state: session.state, ownerNonce: session.ownerNonce };
  }

  // A frame reports a transition of the shared session. The reporting frame becomes
  // the owner: its state machine is the one the user is driving right now.
  async report(tabId, frameId, nonce, state) {
    const session = this.sessionFor(tabId);
    SessionCoordinator.noteFrame(session, frameId, nonce);

    if (!this.isActive(state)) {
      // Stamp the release with the frame that reported it. That frame already released
      // locally, and the broadcast it causes can still be in flight while it starts a
      // new session; without the stamp it would apply its own stale release and tear
      // down the session it has just entered.
      if (this.end(tabId)) await this.broadcast(tabId, SESSION_STATES.IDLE, nonce);
      return;
    }

    const changed = session.state !== state || session.ownerFrameId !== frameId;
    session.state = state;
    session.ownerFrameId = frameId;
    session.ownerNonce = nonce;
    if (changed) await this.broadcast(tabId, state, nonce);
  }
}
