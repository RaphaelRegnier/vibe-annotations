// Theme system for Vibe Annotations Extension — dark only

class ThemeManager {
  constructor() {
    this.currentTheme = 'dark';
    this.init();
  }

  async init() {
    this.applyTheme();
  }

  applyTheme() {
    const tokens = {
      surface: '#0C0E12',
      'surface-1': '#191D24',
      'text-primary': '#fcfcfd',
      'text-secondary': '#9AA4B2',
      outline: '#ffffff0d',
      'outline-highlight': '#ffffff26',
      accent: '#d97757',
      'on-accent': '#ffffff',
      'surface-hover': '#fcfcfd14',
      'secondary-button-bg': '#ffffff0d',
      'textarea-bg': '#ffffff0d',
      warning: '#f79009',
      'on-warning': '#ffffff',
      'warning-container': '#f7900914',
      'on-warning-container': '#f79009'
    };

    const root = document.documentElement;
    Object.entries(tokens).forEach(([key, value]) => {
      root.style.setProperty(`--theme-${key}`, value);
    });

    document.body.setAttribute('data-theme', 'dark');
  }

  getEffectiveTheme() { return 'dark'; }
  getCurrentTheme() { return 'dark'; }
  getAvailableThemes() { return ['dark']; }
  async saveThemePreference() {}
}

window.ThemeManager = ThemeManager;
