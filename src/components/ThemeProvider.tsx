import { useEffect } from 'react';
import { useThemeStore, THEME_CONFIGS, FONT_STACKS, type FontFamily } from '@/stores/themeStore';
import { useTagStore } from '@/stores/tagStore';
import { updateTag } from '@/lib/tauri';

// ── Theme CSS definitions ─────────────────────────────────────────────────────

// "Mementos" is the Persona 5 maximalist theme (default, defined in globals.css).
// Selecting it removes any variable overrides so globals.css takes full effect.

// "Base" — minimal indigo dark theme.  Overrides all Persona 5 design tokens.
// Includes body font-family so the theme is fully self-contained regardless of
// the user's font preference setting.
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
  font-family: Seravek, "Gill Sans Nova", Ubuntu, Calibri, "DejaVu Sans", source-sans-pro, sans-serif;
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
svg[class*="lucide"] { stroke-width: 1.75; }

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

/* ── Persona 5 font override — use humanist stack for brand/title text ───── */
.font-p5 {
  font-family: Seravek, "Gill Sans Nova", Ubuntu, Calibri, "DejaVu Sans", source-sans-pro, sans-serif;
  text-transform: none;
  letter-spacing: normal;
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
  font-family: Georgia, "Times New Roman", serif;
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
/* ── Persona 5 font override — use Georgia for brand/title text ──────────── */
.font-p5 {
  font-family: Georgia, "Times New Roman", serif;
  text-transform: none;
  letter-spacing: normal;
}
::-webkit-scrollbar-thumb { background: hsl(var(--border)); }
::-webkit-scrollbar-thumb:hover { background: hsl(var(--muted-foreground)); }
`.trim();

// "Neon Noir" — near-black with vivid cyan/magenta accents, monospace type
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
  font-family: "Courier New", Courier, monospace;
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
header { border-bottom: 1px solid hsl(180 100% 50% / 0.25); }
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
/* ── Persona 5 font override — use monospace for brand/title text ─────────── */
.font-p5 {
  font-family: "Courier New", Courier, monospace;
  text-transform: none;
  letter-spacing: 0.05em;
}
::-webkit-scrollbar-thumb { background: hsl(180 50% 18%); }
::-webkit-scrollbar-thumb:hover { background: hsl(180 100% 50% / 0.4); }
`.trim();

// "Bauhaus" — De Stijl geometry: Mondrian primaries, flat planes, Josefin Sans,
// zero ornament.  Inspired by the Bauhaus / De Stijl movements: every line has
// a structural purpose, colour blocks replace gradients, type is geometric and
// all-caps where it labels UI regions.
const BAUHAUS_THEME_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Josefin+Sans:wght@400;600;700&display=swap');

:root {
  /* Near-black with warm undertone — Mondrian's background */
  --background: 0 0% 8%;
  --foreground: 0 0% 95%;
  --card: 0 0% 11%;
  --card-foreground: 0 0% 95%;
  --popover: 0 0% 14%;
  --popover-foreground: 0 0% 95%;
  /* Primary: Mondrian red #E63329 */
  --primary: 3 79% 53%;
  --primary-foreground: 0 0% 100%;
  /* Secondary: Mondrian blue #2D4EA3 */
  --secondary: 223 57% 41%;
  --secondary-foreground: 0 0% 100%;
  --muted: 0 0% 16%;
  --muted-foreground: 0 0% 58%;
  --accent: 0 0% 18%;
  --accent-foreground: 0 0% 95%;
  --destructive: 0 84% 60%;
  --destructive-foreground: 0 0% 100%;
  --border: 0 0% 22%;
  --input: 0 0% 16%;
  --ring: 3 79% 53%;
  /* Zero radius — Bauhaus uses only rectilinear geometry */
  --radius: 0rem;
  --accent-line: hsl(3 79% 53%);
}

body {
  font-family: 'Josefin Sans', 'Futura', 'Century Gothic', sans-serif;
  font-size: 1rem;
  line-height: 1.5;
  letter-spacing: 0.02em;
}

/* Josefin Sans uppercase geometry for all structural labels */
h1, h2, h3 {
  font-family: 'Josefin Sans', sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.tiptap h1 {
  font-size: 1.75rem; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.1em;
}
.tiptap h2 { font-size: 1.375rem; font-weight: 600; text-transform: uppercase; }
.tiptap h3 { font-size: 1.125rem; font-weight: 600; text-transform: uppercase; }

/* Mondrian "Composition No. II" grid — layered CSS gradients, same technique
   as the Mementos concentric rings.  Semi-transparent colour blocks tint the
   dark base; sharp-stop gradients cut the De Stijl black ruled lines. */
.journal-rings-bg {
  background-color: hsl(0 0% 8%);
  background-image:
    /* Red field — upper right, refs the dominant red mass in Composition No. II */
    linear-gradient(hsl(3 79% 53% / 0.52), hsl(3 79% 53% / 0.52)),
    /* Blue field — lower left */
    linear-gradient(hsl(223 57% 41% / 0.50), hsl(223 57% 41% / 0.50)),
    /* Yellow sliver — narrow strip at the far right below the horizontal rule */
    linear-gradient(hsl(47 96% 52% / 0.48), hsl(47 96% 52% / 0.48)),
    /* Primary vertical rule (thick) at ~62% from left */
    linear-gradient(
      90deg,
      transparent           calc(62% - 5px),
      #040404               calc(62% - 5px),
      #040404               calc(62% + 5px),
      transparent           calc(62% + 5px)
    ),
    /* Secondary vertical rule (thin) at ~34% */
    linear-gradient(
      90deg,
      transparent           calc(34% - 3px),
      #040404               calc(34% - 3px),
      #040404               calc(34% + 3px),
      transparent           calc(34% + 3px)
    ),
    /* Primary horizontal rule (thick) at ~57% from top */
    linear-gradient(
      transparent           calc(57% - 5px),
      #040404               calc(57% - 5px),
      #040404               calc(57% + 5px),
      transparent           calc(57% + 5px)
    ),
    /* Secondary horizontal rule (thin) at ~20% */
    linear-gradient(
      transparent           calc(20% - 3px),
      #040404               calc(20% - 3px),
      #040404               calc(20% + 3px),
      transparent           calc(20% + 3px)
    );
  background-size:
    36% 59%,      /* red field:   36 wide × 59 tall */
    30% 41%,      /* blue field:  30 wide × 41 tall */
     7% 41%,      /* yellow sliver: 7 wide × 41 tall */
    100% 100%, 100% 100%,   /* vertical rules: full viewport */
    100% 100%, 100% 100%;   /* horizontal rules: full viewport */
  background-position:
    64%   0%,     /* red:    anchored to top-right corner */
     0% 100%,     /* blue:   anchored to bottom-left corner */
    92%  59%,     /* yellow: right edge, below horizontal rule */
    0 0, 0 0, 0 0, 0 0;
  background-repeat: no-repeat;
}

svg[class*="lucide"] { stroke-width: 2; }

/* Geometric card: thick red left bar, single neutral border — structural, not decorative */
.dream-card {
  border-radius: 0;
  border: 1px solid hsl(0 0% 22%);
  border-left: 4px solid hsl(3 79% 53%);
  clip-path: none;
  box-shadow: none;
}
.dream-card:hover {
  /* Mondrian yellow on hover — colour signals state */
  border-left-color: hsl(47 96% 52%);
  background: hsl(0 0% 14%);
  box-shadow: none;
}

/* Nav: red accent bar, no rounding */
.nav-item-active {
  border-left: 3px solid hsl(3 79% 53%) !important;
  border-radius: 0 !important;
  background: hsl(3 79% 53% / 0.1) !important;
  color: hsl(3 79% 53%) !important;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

/* Header: thick Mondrian red bottom line — structural separator */
header { border-bottom: 3px solid hsl(3 79% 53%); }
header::after { display: none; }

.section-title {
  font-family: 'Josefin Sans', sans-serif;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: hsl(0 0% 58%);
}
.section-title::before { display: none; }

/* Tags: rectangular, uppercase, Josefin */
.tag-badge {
  border-radius: 0;
  font-family: 'Josefin Sans', sans-serif;
  font-size: 0.65rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 600;
}

/* Dialogs: no Persona 5 left-bar decoration */
[role="dialog"] [data-radix-dialog-title]::before,
[role="dialog"] .dialog-title::before { display: none; }

/* Buttons: no Persona 5 top accent */
button[data-variant="default"], .btn-primary { border-top: none; }

/* ── Persona 5 font override — use Josefin Sans for brand/title text ──────── */
.font-p5 {
  font-family: 'Josefin Sans', 'Futura', 'Century Gothic', sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.12em;
}

::-webkit-scrollbar-thumb { background: hsl(0 0% 26%); }
::-webkit-scrollbar-thumb:hover { background: hsl(3 79% 53%); }
`.trim();

// "Greco-Roman" — classical antiquity: Cinzel display capitals,
// Cormorant Garamond body, warm black ground with gold accents.
// Restraint over decoration — thin lines, measured spacing, gold
// used sparingly as in ancient illuminated manuscripts.
const GRECO_THEME_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400;1,600&display=swap');

:root {
  /* Warm near-black — like vellum left in a dark library */
  --background: 36 25% 5%;
  --foreground: 40 30% 88%;
  --card: 36 20% 8%;
  --card-foreground: 40 30% 88%;
  --popover: 36 20% 10%;
  --popover-foreground: 40 30% 88%;
  /* Gold: #C5973B */
  --primary: 40 55% 50%;
  --primary-foreground: 36 25% 5%;
  --secondary: 36 15% 16%;
  --secondary-foreground: 40 30% 80%;
  --muted: 36 15% 14%;
  --muted-foreground: 40 20% 52%;
  --accent: 36 15% 18%;
  --accent-foreground: 40 30% 88%;
  --destructive: 0 65% 48%;
  --destructive-foreground: 0 0% 100%;
  /* Warm gold-tinted border — like aged ink on parchment */
  --border: 40 28% 20%;
  --input: 36 15% 14%;
  --ring: 40 55% 50%;
  /* No rounding — classical architecture uses right angles */
  --radius: 0rem;
  --accent-line: hsl(40 55% 50%);
}

body {
  font-family: 'Cormorant Garamond', Georgia, 'Times New Roman', serif;
  font-size: 1.125rem;
  line-height: 1.8;
  letter-spacing: 0.01em;
}

/* Cinzel for display and navigation — Roman capitals */
h1, h2, h3 {
  font-family: 'Cinzel', Georgia, serif;
  letter-spacing: 0.04em;
}

.tiptap h1 {
  font-size: 2rem; font-weight: 600;
  font-family: 'Cinzel', serif; letter-spacing: 0.06em;
}
.tiptap h2 { font-size: 1.5rem; font-weight: 600; font-family: 'Cinzel', serif; }
.tiptap h3 { font-size: 1.25rem; font-weight: 600; font-family: 'Cinzel', serif; }

/* Subtle warm gradient — like candlelight on stone */
.journal-rings-bg {
  background:
    radial-gradient(ellipse at 50% 0%, hsl(40 55% 50% / 0.04) 0%, transparent 55%),
    hsl(36 25% 5%);
}

svg[class*="lucide"] { stroke-width: 1.5; }

/* Classical card: thin gold left rule — like a manuscript ruling line */
.dream-card {
  border-radius: 0;
  border: 1px solid hsl(40 28% 20%);
  border-left: 2px solid hsl(40 55% 50% / 0.55);
  clip-path: none;
  box-shadow: inset 0 0 0 1px hsl(40 55% 50% / 0.04);
}
.dream-card:hover {
  border-left-color: hsl(40 55% 50%);
  background: hsl(36 20% 10%);
  box-shadow: 0 2px 20px hsl(40 55% 50% / 0.07),
              inset 0 0 0 1px hsl(40 55% 50% / 0.08);
}

/* Nav: gold left rule, Cinzel typography */
.nav-item-active {
  border-left: 2px solid hsl(40 55% 50%) !important;
  border-radius: 0 !important;
  background: hsl(40 55% 50% / 0.08) !important;
  color: hsl(40 55% 50%) !important;
  font-family: 'Cinzel', serif;
  font-weight: 600;
  letter-spacing: 0.04em;
}

/* Header: thin gold rule beneath — like a chapter heading separator */
header { border-bottom: 1px solid hsl(40 28% 20%); }
header::after { display: none; }

/* Section titles: Cinzel small-caps */
.section-title {
  font-family: 'Cinzel', serif;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: hsl(40 55% 50% / 0.75);
}
.section-title::before { display: none; }

/* Tags: rectangular, Cormorant */
.tag-badge {
  border-radius: 0;
  font-family: 'Cormorant Garamond', serif;
  font-size: 0.875rem;
  letter-spacing: 0.04em;
  font-weight: 400;
  text-transform: none;
}

[role="dialog"] [data-radix-dialog-title]::before,
[role="dialog"] .dialog-title::before { display: none; }

button[data-variant="default"], .btn-primary { border-top: none; }

/* ── Persona 5 font override — use Cinzel for brand/title text ───────────── */
.font-p5 {
  font-family: 'Cinzel', Georgia, serif;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

::-webkit-scrollbar-thumb { background: hsl(40 28% 20%); }
::-webkit-scrollbar-thumb:hover { background: hsl(40 55% 50% / 0.45); }
`.trim();

// fontRule — returns a CSS string for the body font-family override, or '' for
// themeDefault (which means "let the theme CSS govern — no override needed").
const fontRule = (family: FontFamily): string => {
  if (family === 'themeDefault') return '';
  return `body { font-family: ${FONT_STACKS[family]}; }`;
};

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
  const { fetchTags } = useTagStore();

  // Auto-apply the theme's tag colour palette whenever the active theme changes.
  // Tags read via getState() (non-reactive) so this effect only fires on theme
  // switch, not on every tag mutation.
  useEffect(() => {
    const { tags } = useTagStore.getState();
    if (!tags.length) return;

    const palette = THEME_CONFIGS[activeTheme].tagPalette;
    (async () => {
      for (const tag of tags) {
        const color = palette[tag.category as keyof typeof palette];
        if (color && color !== tag.color) {
          await updateTag({ ...tag, color });
        }
      }
      await fetchTags();
    })();
  // fetchTags is stable (store action), safe to omit from deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTheme]);

  // Apply / remove theme variables whenever the selection changes
  useEffect(() => {
    switch (activeTheme) {
      case 'base':    upsertStyle(THEME_STYLE_ID, BASE_THEME_CSS);    break;
      case 'clarity': upsertStyle(THEME_STYLE_ID, CLARITY_THEME_CSS); break;
      case 'neon':    upsertStyle(THEME_STYLE_ID, NEON_THEME_CSS);    break;
      case 'bauhaus': upsertStyle(THEME_STYLE_ID, BAUHAUS_THEME_CSS); break;
      case 'greco':   upsertStyle(THEME_STYLE_ID, GRECO_THEME_CSS);   break;
      default:
        // Mementos: globals.css is the source of truth — no override needed
        removeStyle(THEME_STYLE_ID);
    }
  }, [activeTheme]);

  // Apply font override — 'themeDefault' removes any prior override so the
  // theme's own body font-family rule takes effect uncontested.
  useEffect(() => {
    const css = fontRule(fontFamily);
    if (css) {
      upsertStyle(FONT_STYLE_ID, css);
    } else {
      removeStyle(FONT_STYLE_ID);
    }
  }, [fontFamily]);

  // Mementos has no theme CSS, so inject its icon stroke-width separately.
  // All other themes include their stroke-width rule in their CSS block.
  useEffect(() => {
    if (activeTheme === 'mementos') {
      upsertStyle('app-icon-override',
        `svg[class*="lucide"] { stroke-width: ${themeConfig.iconStrokeWidth}; }`);
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
