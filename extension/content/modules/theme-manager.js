// Applies --v-* theme tokens on the shadow host
// Reads preference from chrome.storage, listens for system + storage changes

var VibeThemeManager = (() => {
  const themes = {
    light: {
      'v-surface': '#f8f9fc',
      'v-surface-1': '#fcfcfd',
      'v-text-primary': '#0c111b',
      'v-text-secondary': '#697586',
      'v-outline': '#00000014',
      'v-outline-highlight': '#00000028',
      'v-accent': '#d97757',
      'v-on-accent': '#ffffff',
      'v-surface-hover': '#0d0f1c14',
      'v-secondary-btn-bg': '#0000000d',
      'v-textarea-bg': '#0000000d',
      'v-warning': '#f79009',
      'v-on-warning': '#ffffff',
      'v-warning-container': '#f7900919',
      'v-on-warning-container': '#93370c',
      'v-danger': '#dc2626',
      'v-danger-hover': '#dc26260d',
      'v-highlight': '#2563eb',
      'v-badge-bg': '#4b5563',
      'v-tooltip-bg': '#111827'
    },
    dark: {
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
    }
  };

  let preference = 'system'; // 'system' | 'light' | 'dark'

  function getEffective() {
    if (preference === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return preference;
  }

  function apply() {
    const root = VibeShadowHost.getRoot();
    if (!root) return;

    const host = root.host;
    const tokens = themes[getEffective()];
    for (const [key, value] of Object.entries(tokens)) {
      host.style.setProperty(`--${key}`, value);
    }

    VibeEvents.emit('theme:changed', getEffective());
  }

  async function init() {
    // Load preference
    try {
      const result = await chrome.storage.local.get(['themePreference']);
      preference = result.themePreference || 'system';
    } catch (e) {
      preference = 'system';
    }

    apply();

    // Listen for storage changes (user changes theme in popup)
    chrome.storage.onChanged.addListener((changes, ns) => {
      if (ns === 'local' && changes.themePreference) {
        preference = changes.themePreference.newValue || 'system';
        apply();
      }
    });

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (preference === 'system') apply();
    });
  }

  function getPreference() {
    return preference;
  }

  async function setPreference(pref) {
    preference = pref;
    await chrome.storage.local.set({ themePreference: pref });
    apply();
  }

  return { init, apply, getEffective, getPreference, setPreference };
})();
