import { create } from 'zustand';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ThemeId = 'mementos' | 'base' | 'clarity' | 'neon';

export type FontFamily = 'system' | 'serif' | 'mono' | 'humanist';

// Single source of truth for font stacks — used by ThemeProvider (CSS rules)
// and SettingsPage (inline style previews).
export const FONT_STACKS: Record<FontFamily, string> = {
  system:   'system-ui, -apple-system, sans-serif',
  humanist: 'Seravek, "Gill Sans Nova", Ubuntu, Calibri, "DejaVu Sans", source-sans-pro, sans-serif',
  serif:    'Georgia, "Times New Roman", serif',
  mono:     '"Courier New", Courier, monospace',
};

/**
 * Per-theme configuration baked into the theme definition.
 * These defaults are applied when the theme is activated; users can still
 * override font and background through the Settings controls.
 */
export interface ThemeConfig {
  id: ThemeId;
  label: string;
  description: string;
  /** Default font applied when the theme is selected. */
  defaultFont: FontFamily;
  /** Optional CSS for a background image / gradient. Empty string = none. */
  backgroundImageCss: string;
  /** Lucide icon stroke-width: thinner for minimal themes, thicker for bold. */
  iconStrokeWidth: number;
  /** Base font-size scalar — '1rem' for normal, '0.9375rem' for compact (P5). */
  baseFontSize: string;
}

export const THEME_CONFIGS: Record<ThemeId, ThemeConfig> = {
  mementos: {
    id: 'mementos',
    label: 'Mementos',
    description: 'Bold Persona 5 aesthetic — angular cards, vivid red accents, maximalist energy.',
    defaultFont: 'system',
    backgroundImageCss: '',  // P5 rings are defined in globals.css .journal-rings-bg
    iconStrokeWidth: 2.5,
    baseFontSize: '0.9375rem',
  },
  base: {
    id: 'base',
    label: 'Base Theme',
    description: 'Clean minimal dark theme with indigo accents, soft corners, and subtle starfield.',
    defaultFont: 'humanist',
    backgroundImageCss: `
      radial-gradient(ellipse at 20% 50%, hsl(239 84% 67% / 0.04) 0%, transparent 60%),
      radial-gradient(ellipse at 80% 20%, hsl(270 60% 50% / 0.03) 0%, transparent 50%)
    `.trim(),
    iconStrokeWidth: 1.75,
    baseFontSize: '1rem',
  },
  clarity: {
    id: 'clarity',
    label: 'Clarity',
    description: 'High-contrast greyscale — large text, maximum readability, no visual clutter. Designed for comfort and accessibility.',
    defaultFont: 'serif',
    backgroundImageCss: '',
    iconStrokeWidth: 2,
    baseFontSize: '1.125rem',
  },
  neon: {
    id: 'neon',
    label: 'Neon Noir',
    description: 'Modern high-contrast dark theme — near-black background with vivid cyan and magenta accents, sharp edges.',
    defaultFont: 'mono',
    backgroundImageCss: '',
    iconStrokeWidth: 1.5,
    baseFontSize: '1rem',
  },
};

interface ThemeState {
  activeTheme: ThemeId;
  fontFamily: FontFamily;
  customCss: string;
  /** User-supplied background image URL (overrides theme default when set). */
  backgroundImageUrl: string;

  setTheme: (theme: ThemeId) => void;
  setFontFamily: (font: FontFamily) => void;
  setCustomCss: (css: string) => void;
  setBackgroundImageUrl: (url: string) => void;
}

const THEME_KEY  = 'appearance_theme';
const FONT_KEY   = 'appearance_font';
const CSS_KEY    = 'appearance_custom_css';
const BG_KEY     = 'appearance_background_url';

export const useThemeStore = create<ThemeState>((set) => ({
  activeTheme:        (localStorage.getItem(THEME_KEY) as ThemeId | null) ?? 'mementos',
  fontFamily:         (localStorage.getItem(FONT_KEY)  as FontFamily | null) ?? 'system',
  customCss:          localStorage.getItem(CSS_KEY) ?? '',
  backgroundImageUrl: localStorage.getItem(BG_KEY) ?? '',

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

  setBackgroundImageUrl: (url) => {
    localStorage.setItem(BG_KEY, url);
    set({ backgroundImageUrl: url });
  },
}));
