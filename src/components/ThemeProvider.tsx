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

// "Clarity" — high-contrast greyscale theme for maximum readability / accessibility
const CLARITY_THEME_CSS = `
:root {
  --background: 0 0% 97%;
  --foreground: 0 0% 5%;
  --card: 0 0% 100%;
  --card-foreground: 0 0% 5%;
  --popover: 0 0% 100%;
  --popover-foreground: 0 0% 5%;
  --primary: 0 0% 12%;
  --primary-foreground: 0 0% 98%;
  --secondary: 0 0% 90%;
  --secondary-foreground: 0 0% 10%;
  --muted: 0 0% 92%;
  --muted-foreground: 0 0% 38%;
  --accent: 0 0% 88%;
  --accent-foreground: 0 0% 10%;
  --destructive: 0 72% 45%;
  --destructive-foreground: 0 0% 100%;
  --border: 0 0% 78%;
  --input: 0 0% 88%;
  --ring: 0 0% 20%;
  --radius: 0.75rem;
  --accent-line: hsl(0 0% 20%);
}
body {
  font-size: 1.125rem;
  line-height: 1.8;
  letter-spacing: 0.01em;
}
.tiptap h1 { font-size: 2rem; font-weight: 700; }
.tiptap h2 { font-size: 1.5rem; font-weight: 600; }
.tiptap h3 { font-size: 1.2rem; font-weight: 600; }
.journal-rings-bg { background: hsl(0 0% 97%); }
svg[class*="lucide"] { stroke-width: 2; }
.dream-card {
  border-radius: var(--radius);
  border: 2px solid hsl(var(--border));
  border-left: none;
  clip-path: none;
  box-shadow: none;
}
.dream-card:hover {
  border-color: hsl(var(--foreground) / 0.4);
  background: hsl(var(--accent));
  box-shadow: 0 2px 8px hsl(0 0% 0% / 0.08);
}
.nav-item-active {
  border-left: none !important;
  border-radius: calc(var(--radius) - 2px);
  background: hsl(var(--primary)) !important;
  color: hsl(var(--primary-foreground)) !important;
  font-weight: 700;
}
header::after { display: none; }
.section-title {
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: hsl(var(--muted-foreground));
}
.section-title::before { display: none; }
.tag-badge {
  border-radius: var(--radius);
  font-size: 0.8rem;
  letter-spacing: normal;
  text-transform: none;
  font-weight: 600;
}
button, [role="button"] { min-height: 2.5rem; }
[role="dialog"] [data-radix-dialog-title]::before,
[role="dialog"] .dialog-title::before { display: none; }
::-webkit-scrollbar-thumb { background: hsl(var(--border)); }
::-webkit-scrollbar-thumb:hover { background: hsl(var(--muted-foreground)); }
`.trim();

// "Neon Noir" — modern high-contrast dark theme with cyan/magenta accents
const NEON_THEME_CSS = `
:root {
  --background: 240 15% 3%;
  --foreground: 180 5% 95%;
  --card: 240 15% 6%;
  --card-foreground: 180 5% 95%;
  --popover: 240 15% 8%;
  --popover-foreground: 180 5% 95%;
  --primary: 180 100% 50%;
  --primary-foreground: 240 15% 3%;
  --secondary: 300 80% 50%;
  --secondary-foreground: 240 15% 3%;
  --muted: 240 15% 12%;
  --muted-foreground: 180 10% 60%;
  --accent: 240 15% 14%;
  --accent-foreground: 180 5% 95%;
  --destructive: 0 100% 60%;
  --destructive-foreground: 0 0% 100%;
  --border: 180 50% 18%;
  --input: 240 15% 12%;
  --ring: 180 100% 50%;
  --radius: 0.25rem;
  --accent-line: hsl(180 100% 50%);
}
body {
  font-size: 1rem;
  line-height: 1.6;
  letter-spacing: 0.02em;
}
.tiptap h1 { font-size: 1.75rem; font-weight: 700; color: hsl(180 100% 70%); }
.tiptap h2 { font-size: 1.375rem; font-weight: 600; color: hsl(300 80% 70%); }
.tiptap h3 { font-size: 1.125rem; font-weight: 600; }
.journal-rings-bg {
  background:
    radial-gradient(ellipse at 0% 100%, hsl(300 80% 50% / 0.06) 0%, transparent 55%),
    radial-gradient(ellipse at 100% 0%, hsl(180 100% 50% / 0.05) 0%, transparent 55%),
    hsl(240 15% 3%);
}
svg[class*="lucide"] { stroke-width: 1.5; }
.dream-card {
  border-radius: var(--radius);
  border: 1px solid hsl(180 50% 18%);
  border-left: 3px solid hsl(180 100% 50% / 0.6);
  clip-path: none;
  box-shadow: none;
}
.dream-card:hover {
  border-left-color: hsl(180 100% 50%);
  background: hsl(240 15% 9%);
  box-shadow: 0 0 16px hsl(180 100% 50% / 0.08);
}
.nav-item-active {
  border-left: 2px solid hsl(180 100% 50%) !important;
  border-radius: 0 !important;
  background: hsl(180 100% 50% / 0.08) !important;
  color: hsl(180 100% 60%) !important;
  font-weight: 700;
}
header {
  border-bottom: 1px solid hsl(180 100% 50% / 0.25);
}
header::after { display: none; }
.section-title {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: hsl(180 100% 50% / 0.7);
}
.section-title::before { display: none; }
.tag-badge {
  border-radius: var(--radius);
  font-size: 0.7rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  font-weight: 700;
}
[role="dialog"] [data-radix-dialog-title]::before,
[role="dialog"] .dialog-title::before { display: none; }
::-webkit-scrollbar-thumb { background: hsl(180 50% 18%); }
::-webkit-scrollbar-thumb:hover { background: hsl(180 100% 50% / 0.4); }
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
    } else if (activeTheme === 'clarity') {
      upsertStyle(THEME_STYLE_ID, CLARITY_THEME_CSS);
    } else if (activeTheme === 'neon') {
      upsertStyle(THEME_STYLE_ID, NEON_THEME_CSS);
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
