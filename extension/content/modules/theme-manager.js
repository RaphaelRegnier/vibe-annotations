// Applies --v-* dark theme tokens on the shadow host
// Dark-only — no light mode, no theme cycling

var VibeThemeManager = (() => {
  const darkTokens = {
    'v-surface': '#0C0E12',
    'v-surface-1': '#191D24',
    'v-text-primary': '#fcfcfd',
    'v-text-secondary': '#9AA4B2',
    'v-outline': '#ffffff0d',
    'v-outline-highlight': '#ffffff26',
    'v-accent': '#d97757',
    'v-on-accent': '#ffffff',
    'v-surface-hover': '#fcfcfd14',
    'v-secondary-btn-bg': '#ffffff0d',
    'v-textarea-bg': '#ffffff0d',
    'v-warning': '#f79009',
    'v-on-warning': '#ffffff',
    'v-warning-container': '#f7900914',
    'v-on-warning-container': '#f79009',
    'v-danger': '#dc2626',
    'v-danger-hover': '#dc26261a',
    'v-highlight': '#3b82f6',
    'v-badge-bg': '#6b7280',
    'v-tooltip-bg': '#1f2937'
  };

  function apply() {
    const root = VibeShadowHost.getRoot();
    if (!root) return;

    const host = root.host;
    for (const [key, value] of Object.entries(darkTokens)) {
      host.style.setProperty(`--${key}`, value);
    }

    VibeEvents.emit('theme:changed', 'dark');
  }

  function init() {
    apply();
  }

  // Backwards-compat stubs
  function getEffective() { return 'dark'; }
  function getPreference() { return 'dark'; }
  function setPreference() {}

  return { init, apply, getEffective, getPreference, setPreference };
})();
