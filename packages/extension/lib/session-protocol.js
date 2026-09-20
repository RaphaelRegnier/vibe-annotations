// Wire protocol for the tab-wide Annotate session, shared by the two halves that
// talk over it: the keyboard router that runs in every frame
// (lib/content/keyboard-router.js) and the coordinator that runs in the service
// worker (lib/background/session-coordinator.js, entrypoints/background.js).
//
// Dependency-free on purpose: the service worker must not pull in content-script
// modules, and both bundles need exactly these names.

// Message actions of the protocol.
export const SESSION_SYNC = {
  HELLO: 'vibeSessionHello',
  STATE: 'vibeSessionState',
  REMOTE_STATE: 'vibeSessionRemoteState',
};

// The states a frame's keyboard router can be in.
export const SESSION_STATES = {
  IDLE: 'idle',
  SELECTION: 'selection',
  WAITING: 'waiting',
  EDITING: 'editing',
};

// A frame in one of these states owns the keyboard for the Annotate session;
// the coordinator treats every other value as "no session".
export const ACTIVE_SESSION_STATES = [
  SESSION_STATES.SELECTION,
  SESSION_STATES.WAITING,
  SESSION_STATES.EDITING,
];
