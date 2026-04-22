// Lightweight pub/sub event bus for inter-module communication.

const listeners = new Map();

const VibeEvents = {
  on(event, fn) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(fn);
  },

  off(event, fn) {
    const fns = listeners.get(event);
    if (fns) fns.delete(fn);
  },

  emit(event, data) {
    const fns = listeners.get(event);
    if (fns) fns.forEach((fn) => fn(data));
  },

  once(event, fn) {
    const wrapper = (data) => {
      fn(data);
      VibeEvents.off(event, wrapper);
    };
    VibeEvents.on(event, wrapper);
  },
};

export default VibeEvents;

/** Full display path: pathname + search + hash (supports hash routers & query params). */
export const vibeLocationPath = (loc) =>
  (loc.pathname || '/') + (loc.search || '') + (loc.hash || '') || '/';
