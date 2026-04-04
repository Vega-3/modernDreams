import { useEffect } from 'react';
import { useThemeStore, THEME_CONFIGS, FONT_STACKS, type FontFamily } from '@/stores/themeStore';

// ── Theme CSS definitions ─────────────────────────────────────────────────────

// "Mementos" is the Persona 5 maximalist theme (default, defined in globals.css).
// Selecting it removes any variable overrides so globals.css takes full effect.

// "Base" is the original minimal indigo dark theme (visual layout at the time
// of commit 33167563).  It overrides ALL Persona 5 design-system elements and
// restores standard typographic scales, icon weights, and component geometry.
// The scope is intentionally broad — background, fonts, font-sizes, and icons
// are all specified here so the theme is fully self-contained.
const BASE_THEME_CSS = `
:root {
  /* ── Colour palette ──────────────────────────────────────────────────── */
  --background: 240 10% 4%;
  --foreground: 240 5% 92%;
  --card: 240 10% 8%;
  --card-foreground: 240 5% 92%;
  --popover: 240 10% 10%;
  --popover-foreground: 240 5% 92%;
  --primary: 239 84% 67%;
  --primary-foreground: 0 0% 100%;
  --secondary: 240 10% 14%;
  --secondary-foreground: 240 5% 92%;
  --muted: 240 10% 14%;
  --muted-foreground: 240 5% 65%;
  --accent: 240 10% 18%;
  --accent-foreground: 240 5% 92%;
  --destructive: 0 84% 60%;
  --destructive-foreground: 0 0% 100%;
  --border: 240 10% 18%;
  --input: 240 10% 18%;
  --ring: 239 84% 67%;
  --radius: 0.5rem;
  --accent-line: hsl(239 84% 67%);
}

/* ── Typography ──────────────────────────────────────────────────────────── */
body {
  letter-spacing: normal;
  font-size: 1rem;
  line-height: 1.6;
}

/* Standard TipTap heading scale (was compressed in Mementos) */
.tiptap h1 { font-size: 1.75rem; font-weight: 700; }
.tiptap h2 { font-size: 1.375rem; font-weight: 600; }
.tiptap h3 { font-size: 1.125rem; font-weight: 600; }

/* ── Background ──────────────────────────────────────────────────────────── */
/* Replace the Persona 5 radiating rings with a subtle dual-gradient */
.journal-rings-bg {
  background:
    radial-gradient(ellipse at 20% 50%, hsl(239 84% 67% / 0.04) 0%, transparent 60%),
    radial-gradient(ellipse at 80% 20%, hsl(270 60% 50% / 0.03) 0%, transparent 50%);
}

/* ── Icons ───────────────────────────────────────────────────────────────── */
/* Slightly thinner strokes for a cleaner minimal look */
svg[class*="lucide"] {
  stroke-width: 1.75;
}

/* ── Cards ───────────────────────────────────────────────────────────────── */
.dream-card {
  border-radius: var(--radius);
  border: 1px solid hsl(var(--border));
  border-left: none;
  clip-path: none;
  box-shadow: none;
}
.dream-card:hover {
  border-left-color: unset;
  background: hsl(var(--accent));
  box-shadow: 0 2px 12px hsl(var(--primary) / 0.08);
}

/* ── Navigation ──────────────────────────────────────────────────────────── */
.nav-item-active {
  border-left: none !important;
  border-radius: calc(var(--radius) - 2px);
  background: hsl(var(--primary) / 0.12) !important;
  color: hsl(var(--primary)) !important;
  font-weight: 600;
}

/* ── Header ──────────────────────────────────────────────────────────────── */
header::after { display: none; }

/* ── Section titles ──────────────────────────────────────────────────────── */
.section-title {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: hsl(var(--muted-foreground));
}
.section-title::before { display: none; }

/* ── Dialogs ─────────────────────────────────────────────────────────────── */
[role="dialog"] [data-radix-dialog-title],
[role="dialog"] .dialog-title {
  padding-left: 0;
}
[role="dialog"] [data-radix-dialog-title]::before,
[role="dialog"] .dialog-title::before { display: none; }

/* ── Tags ────────────────────────────────────────────────────────────────── */
.tag-badge {
  border-radius: var(--radius);
  font-size: 0.75rem;
  letter-spacing: normal;
  text-transform: none;
  font-weight: 500;
}

/* ── Buttons ─────────────────────────────────────────────────────────────── */
button[data-variant="default"],
.btn-primary { border-top: none; }

/* ── Scrollbar ───────────────────────────────────────────────────────────── */
::-webkit-scrollbar-thumb { background: hsl(var(--border)); }
::-webkit-scrollbar-thumb:hover { background: hsl(var(--muted-foreground)); }
`.trim();

// Build font-family CSS rules from the shared FONT_STACKS source of truth
const fontRule = (family: FontFamily) => `body { font-family: ${FONT_STACKS[family]}; }`;

// Build background-image CSS when the user provides a custom image URL
const bgImageRule = (url: string) =>
  `.journal-rings-bg { background-image: url("${url}"); background-size: cover; background-position: center; }`;

// ── IDs for injected style elements ──────────────────────────────────────────

const THEME_STYLE_ID  = 'app-theme-override';
const FONT_STYLE_ID   = 'app-font-override';
const CUSTOM_STYLE_ID = 'app-custom-css';
const BG_STYLE_ID     = 'app-background-override';

function upsertStyle(id: string, css: string) {
  let el = document.getElementById(id) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = css;
}

function removeStyle(id: string) {
  document.getElementById(id)?.remove();
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ThemeProvider() {
  const { activeTheme, fontFamily, customCss, backgroundImageUrl } = useThemeStore();
  const themeConfig = THEME_CONFIGS[activeTheme];

  // Apply / remove theme variables whenever the selection changes
  useEffect(() => {
    if (activeTheme === 'base') {
      upsertStyle(THEME_STYLE_ID, BASE_THEME_CSS);
    } else {
      // Mementos: globals.css is the source of truth — no override needed
      removeStyle(THEME_STYLE_ID);
    }
  }, [activeTheme]);

  // Apply font override — use user's explicit choice; if it's still the default
  // system font and the theme has a preferred font, apply the theme's default.
  useEffect(() => {
    upsertStyle(FONT_STYLE_ID, fontRule(fontFamily));
  }, [fontFamily]);

  // Apply icon stroke-width from theme config
  useEffect(() => {
    const strokeRule = `svg[class*="lucide"] { stroke-width: ${themeConfig.iconStrokeWidth}; }`;
    // Only inject for mementos (base theme already sets this in BASE_THEME_CSS)
    if (activeTheme === 'mementos') {
      upsertStyle('app-icon-override', strokeRule);
    } else {
      removeStyle('app-icon-override');
    }
  }, [activeTheme, themeConfig.iconStrokeWidth]);

  // Apply user-supplied background image override
  useEffect(() => {
    if (backgroundImageUrl.trim()) {
      upsertStyle(BG_STYLE_ID, bgImageRule(backgroundImageUrl.trim()));
    } else {
      removeStyle(BG_STYLE_ID);
    }
  }, [backgroundImageUrl]);

  // Apply custom CSS
  useEffect(() => {
    if (customCss.trim()) {
      upsertStyle(CUSTOM_STYLE_ID, customCss);
    } else {
      removeStyle(CUSTOM_STYLE_ID);
    }
  }, [customCss]);

  // ThemeProvider renders nothing — it only manages DOM side-effects
  return null;
}
