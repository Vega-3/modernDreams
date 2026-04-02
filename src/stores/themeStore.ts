import { create } from 'zustand';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ThemeId = 'mementos' | 'base';

export type FontFamily = 'system' | 'serif' | 'mono' | 'humanist';

interface ThemeState {
  activeTheme: ThemeId;
  fontFamily: FontFamily;
  customCss: string;

  setTheme: (theme: ThemeId) => void;
  setFontFamily: (font: FontFamily) => void;
  setCustomCss: (css: string) => void;
}

const THEME_KEY  = 'appearance_theme';
const FONT_KEY   = 'appearance_font';
const CSS_KEY    = 'appearance_custom_css';

export const useThemeStore = create<ThemeState>((set) => ({
  activeTheme: (localStorage.getItem(THEME_KEY) as ThemeId | null) ?? 'mementos',
  fontFamily:  (localStorage.getItem(FONT_KEY)  as FontFamily | null) ?? 'system',
  customCss:   localStorage.getItem(CSS_KEY) ?? '',

  setTheme: (theme) => {
    localStorage.setItem(THEME_KEY, theme);
    set({ activeTheme: theme });
  },

  setFontFamily: (font) => {
    localStorage.setItem(FONT_KEY, font);
    set({ fontFamily: font });
  },

  setCustomCss: (css) => {
    localStorage.setItem(CSS_KEY, css);
    set({ customCss: css });
  },
}));
