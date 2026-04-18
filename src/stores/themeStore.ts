import { create } from 'zustand';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ThemeId = 'mementos' | 'base' | 'clarity' | 'neon' | 'bauhaus' | 'greco';

// 'themeDefault' lets the active theme's CSS govern body font without any
// override from the user preference layer.  Switching themes auto-resets to
// this value so the incoming theme's typography takes full effect.
export type FontFamily = 'themeDefault' | 'system' | 'serif' | 'mono' | 'humanist';

// Single source of truth for font stacks — used by ThemeProvider (CSS rules)
// and SettingsPage (inline style previews).  'themeDefault' resolves to
// 'inherit' so the preview falls through to whatever the theme CSS sets.
export const FONT_STACKS: Record<FontFamily, string> = {
  themeDefault: 'inherit',
  system:       'system-ui, -apple-system, sans-serif',
  humanist:     'Seravek, "Gill Sans Nova", Ubuntu, Calibri, "DejaVu Sans", source-sans-pro, sans-serif',
  serif:        'Georgia, "Times New Roman", serif',
  mono:         '"Courier New", Courier, monospace',
};

// Category keys mirror TagCategory from tauri.ts — defined here to avoid a
// cross-layer import while keeping tagPalette fully typed.
export type TagCategoryKey = 'location' | 'person' | 'symbolic' | 'emotive' | 'custom';

export interface ThemeConfig {
  id: ThemeId;
  label: string;
  description: string;
  /** Font auto-selected when the theme is activated. */
  defaultFont: FontFamily;
  backgroundImageCss: string;
  iconStrokeWidth: number;
  baseFontSize: string;
  /** Human-readable name of the title / display font. */
  primaryFontLabel: string;
  /** Human-readable name of the body / prose font. */
  secondaryFontLabel: string;
  /** Hex colour per tag category — applied to DB tags via the Settings button. */
  tagPalette: Record<TagCategoryKey, string>;
  /** 4 representative hex colours shown as swatches in the theme selector. */
  previewSwatches: string[];
}

export const THEME_CONFIGS: Record<ThemeId, ThemeConfig> = {
  mementos: {
    id: 'mementos',
    label: 'Mementos',
    description: 'Bold Persona 5 aesthetic — angular cards, vivid red accents, maximalist energy.',
    defaultFont: 'themeDefault',
    backgroundImageCss: '',
    iconStrokeWidth: 2.5,
    baseFontSize: '0.9375rem',
    primaryFontLabel: 'Persona5 (custom display)',
    secondaryFontLabel: 'System UI',
    tagPalette: {
      location: '#22c55e',
      person:   '#3b82f6',
      symbolic: '#a855f7',
      emotive:  '#f43f5e',
      custom:   '#f59e0b',
    },
    previewSwatches: ['#de0615', '#ffffff', '#0a0a12', '#7a0a0a'],
  },

  base: {
    id: 'base',
    label: 'Base',
    description: 'Clean minimal dark theme — indigo accents, soft rounded cards, subtle depth.',
    defaultFont: 'themeDefault',
    backgroundImageCss: '',
    iconStrokeWidth: 1.75,
    baseFontSize: '1rem',
    primaryFontLabel: 'Humanist (system)',
    secondaryFontLabel: 'Humanist (system)',
    tagPalette: {
      location: '#4ade80',
      person:   '#60a5fa',
      symbolic: '#c084fc',
      emotive:  '#fb7185',
      custom:   '#fbbf24',
    },
    previewSwatches: ['#6366f1', '#8b5cf6', '#0f0f1a', '#252540'],
  },

  clarity: {
    id: 'clarity',
    label: 'Clarity',
    description: 'High-contrast light theme — large serif text, maximum readability, accessible.',
    defaultFont: 'themeDefault',
    backgroundImageCss: '',
    iconStrokeWidth: 2,
    baseFontSize: '1.125rem',
    primaryFontLabel: 'Georgia (serif)',
    secondaryFontLabel: 'Georgia (serif)',
    tagPalette: {
      location: '#166534',
      person:   '#1e40af',
      symbolic: '#6b21a8',
      emotive:  '#9f1239',
      custom:   '#92400e',
    },
    previewSwatches: ['#0d0d0d', '#f5f5f5', '#e0e0e0', '#4a4a4a'],
  },

  neon: {
    id: 'neon',
    label: 'Neon Noir',
    description: 'Near-black with vivid cyan and magenta accents, monospace type, sharp edges.',
    defaultFont: 'themeDefault',
    backgroundImageCss: '',
    iconStrokeWidth: 1.5,
    baseFontSize: '1rem',
    primaryFontLabel: 'Monospace (system)',
    secondaryFontLabel: 'Monospace (system)',
    tagPalette: {
      location: '#00d4aa',
      person:   '#00b4ff',
      symbolic: '#cc44ff',
      emotive:  '#ff2288',
      custom:   '#ffaa00',
    },
    previewSwatches: ['#00ffff', '#cc00ff', '#070710', '#1a1a3a'],
  },

  bauhaus: {
    id: 'bauhaus',
    label: 'Bauhaus',
    description: 'De Stijl geometry — Mondrian primary colours, flat planes, Josefin Sans, zero ornament.',
    defaultFont: 'themeDefault',
    backgroundImageCss: '',
    iconStrokeWidth: 2,
    baseFontSize: '1rem',
    primaryFontLabel: 'Josefin Sans (geometric)',
    secondaryFontLabel: 'Josefin Sans (geometric)',
    tagPalette: {
      location: '#2d4ea3',
      person:   '#e63329',
      symbolic: '#c4901a',
      emotive:  '#1e88e5',
      custom:   '#9e9e9e',
    },
    previewSwatches: ['#e63329', '#2d4ea3', '#f5c518', '#141414'],
  },

  greco: {
    id: 'greco',
    label: 'Greco-Roman',
    description: 'Classical antiquity — Cinzel capitals, Cormorant Garamond prose, black and gold.',
    defaultFont: 'themeDefault',
    backgroundImageCss: '',
    iconStrokeWidth: 1.5,
    baseFontSize: '1rem',
    primaryFontLabel: 'Cinzel (classical capitals)',
    secondaryFontLabel: 'Cormorant Garamond (elegant serif)',
    tagPalette: {
      location: '#c5973b',
      person:   '#a8a09a',
      symbolic: '#7b5ea7',
      emotive:  '#a0522d',
      custom:   '#708090',
    },
    previewSwatches: ['#c5973b', '#f5f0e8', '#0d0b08', '#4a3d25'],
  },
};

// ── Store ─────────────────────────────────────────────────────────────────────

interface ThemeState {
  activeTheme: ThemeId;
  fontFamily: FontFamily;
  customCss: string;
  backgroundImageUrl: string;

  setTheme: (theme: ThemeId) => void;
  setFontFamily: (font: FontFamily) => void;
  setCustomCss: (css: string) => void;
  setBackgroundImageUrl: (url: string) => void;
}

const THEME_KEY = 'appearance_theme';
const FONT_KEY  = 'appearance_font';
const CSS_KEY   = 'appearance_custom_css';
const BG_KEY    = 'appearance_background_url';

export const useThemeStore = create<ThemeState>((set) => ({
  activeTheme:        (localStorage.getItem(THEME_KEY) as ThemeId   | null) ?? 'mementos',
  fontFamily:         (localStorage.getItem(FONT_KEY)  as FontFamily | null) ?? 'themeDefault',
  customCss:          localStorage.getItem(CSS_KEY) ?? '',
  backgroundImageUrl: localStorage.getItem(BG_KEY)  ?? '',

  setTheme: (theme) => {
    localStorage.setItem(THEME_KEY, theme);
    // Reset font to 'themeDefault' on every theme switch so the incoming
    // theme's typography takes effect without the previous user override
    // fighting it.  The user can re-select a manual font after switching.
    localStorage.setItem(FONT_KEY, 'themeDefault');
    set({ activeTheme: theme, fontFamily: 'themeDefault' });
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
