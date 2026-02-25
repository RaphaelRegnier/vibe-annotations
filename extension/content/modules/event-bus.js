// Lightweight pub/sub event bus for inter-module communication
console.log('[Vibe V2] event-bus.js loaded');

var VibeEvents = (() => {
  const listeners = new Map();

  return {
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
      if (fns) fns.forEach(fn => fn(data));
    },

    once(event, fn) {
      const wrapper = (data) => {
        fn(data);
        this.off(event, wrapper);
      };
      this.on(event, wrapper);
    }
  };
})();
