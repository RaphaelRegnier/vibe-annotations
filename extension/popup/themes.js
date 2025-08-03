// Theme system for Vibe Annotations Extension

class ThemeManager {
  constructor() {
    this.themes = {
      light: {
        surface: '#f8f9fc',
        'surface-1': '#fcfcfd',
        'text-primary': '#0c111b',
        'text-secondary': '#697586',
        outline: '#00000014',
        'outline-highlight': '#00000028',
        accent: '#d97757',
        'on-accent': '#ffffff',
        'surface-hover': '#0d0f1c14',
        'secondary-button-bg': '#0000000d',
        'textarea-bg': '#0000000d',
        warning: '#f79009',
        'on-warning': '#ffffff',
        'warning-container': '#f7900919',
        'on-warning-container': '#93370c'
      },
      dark: {
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
      }
    };
    
    this.currentTheme = 'system';
    this.init();
  }

  async init() {
    await this.loadThemePreference();
    this.applyTheme();
    this.setupMediaQueryListener();
  }

  async loadThemePreference() {
    try {
      const result = await chrome.storage.local.get(['themePreference']);
      this.currentTheme = result.themePreference || 'system';
    } catch (error) {
      console.error('Error loading theme preference:', error);
      this.currentTheme = 'system';
    }
  }

  async saveThemePreference(theme) {
    try {
      await chrome.storage.local.set({ themePreference: theme });
      this.currentTheme = theme;
      this.applyTheme();
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  }

  getEffectiveTheme() {
    if (this.currentTheme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return this.currentTheme;
  }

  applyTheme() {
    const effectiveTheme = this.getEffectiveTheme();
    const tokens = this.themes[effectiveTheme];
    
    // Apply CSS custom properties
    const root = document.documentElement;
    Object.entries(tokens).forEach(([key, value]) => {
      root.style.setProperty(`--theme-${key}`, value);
    });
    
    // Set data attribute for theme-specific styles
    document.body.setAttribute('data-theme', effectiveTheme);
  }

  setupMediaQueryListener() {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', () => {
      if (this.currentTheme === 'system') {
        this.applyTheme();
      }
    });
  }

  getCurrentTheme() {
    return this.currentTheme;
  }

  getAvailableThemes() {
    return ['system', 'light', 'dark'];
  }
}

// Export for use in popup.js
window.ThemeManager = ThemeManager;