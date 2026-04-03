import { useEffect } from 'react';
import { useThemeStore, FONT_STACKS, type FontFamily } from '@/stores/themeStore';

// ── Theme CSS definitions ─────────────────────────────────────────────────────

// "Mementos" is the Persona 5 maximalist theme (default, defined in globals.css).
// Selecting it removes any variable overrides so globals.css takes full effect.

// "Base" is the original minimal indigo dark theme from before the graph release.
// It overrides the CSS variables and resets the Persona 5 design system extras.
const BASE_THEME_CSS = `
:root {
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

/* Reset Persona 5 design-system additions */
body { letter-spacing: normal; }

.dream-card {
  border-left: none;
  clip-path: none;
}
.dream-card:hover { border-left-color: unset; }

.nav-item-active {
  border-left: none !important;
}

header::after { display: none; }

.section-title {
  font-size: 0.875rem;
  font-weight: 600;
  letter-spacing: normal;
  text-transform: none;
  color: hsl(var(--foreground));
}
.section-title::before { display: none; }

[role="dialog"] [data-radix-dialog-title],
[role="dialog"] .dialog-title {
  padding-left: 0;
}
[role="dialog"] [data-radix-dialog-title]::before,
[role="dialog"] .dialog-title::before { display: none; }

.tag-badge {
  border-radius: var(--radius);
  font-size: 0.75rem;
  letter-spacing: normal;
  text-transform: none;
  font-weight: 500;
}

button[data-variant="default"],
.btn-primary { border-top: none; }

::-webkit-scrollbar-thumb { background: hsl(var(--border)); }
::-webkit-scrollbar-thumb:hover { background: hsl(var(--muted-foreground)); }
`.trim();

// Build font-family CSS rules from the shared FONT_STACKS source of truth
const fontRule = (family: FontFamily) => `body { font-family: ${FONT_STACKS[family]}; }`;

// ── IDs for injected style elements ──────────────────────────────────────────

const THEME_STYLE_ID  = 'app-theme-override';
const FONT_STYLE_ID   = 'app-font-override';
const CUSTOM_STYLE_ID = 'app-custom-css';

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
  const { activeTheme, fontFamily, customCss } = useThemeStore();

  // Apply / remove theme variables whenever the selection changes
  useEffect(() => {
    if (activeTheme === 'base') {
      upsertStyle(THEME_STYLE_ID, BASE_THEME_CSS);
    } else {
      // Mementos: globals.css is the source of truth — no override needed
      removeStyle(THEME_STYLE_ID);
    }
  }, [activeTheme]);

  // Apply font override
  useEffect(() => {
    upsertStyle(FONT_STYLE_ID, fontRule(fontFamily));
  }, [fontFamily]);

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
