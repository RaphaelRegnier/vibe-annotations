// Dark-only theme manager — tokens are defined in styles.js (:host rules).
// This module just emits the theme event; no inline style overrides needed.

var VibeThemeManager = (() => {
  function init() {
    VibeEvents.emit('theme:changed', 'dark');
  }

  function apply() { init(); }
  function getEffective() { return 'dark'; }
  function getPreference() { return 'dark'; }
  function setPreference() {}

  return { init, apply, getEffective, getPreference, setPreference };
})();
