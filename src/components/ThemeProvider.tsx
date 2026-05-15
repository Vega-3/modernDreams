import { useEffect } from 'react';
import { useThemeStore, THEME_CONFIGS, FONT_STACKS, type FontFamily } from '@/stores/themeStore';
import { useTagStore } from '@/stores/tagStore';
import { updateTag } from '@/lib/tauri';

// ── Theme CSS definitions ─────────────────────────────────────────────────────

// "Greco-Roman" is the default theme (set in themeStore.ts).
// "Mementos" is the Persona 5 maximalist theme — selecting it removes any variable
// overrides so globals.css takes full effect.

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
/* Full indigo border box — rounded to match the soft minimal aesthetic */
.dream-card {
  border-radius: 0.75rem !important;
  border: 2px solid hsl(239 84% 67% / 0.45) !important;
  border-left-width: 2px !important;
  border-left-color: hsl(239 84% 67% / 0.45) !important;
  clip-path: none !important;
  box-shadow: none;
}
.dream-card:hover {
  border-color: hsl(239 84% 67% / 0.9) !important;
  border-left-color: hsl(239 84% 67% / 0.9) !important;
  background: hsl(var(--accent));
  box-shadow: 0 0 0 1px hsl(239 84% 67% / 0.15), 0 4px 16px hsl(239 84% 67% / 0.1);
}

/* ── Logo ────────────────────────────────────────────────────────────────── */
.logo-mark { color: hsl(239 84% 67%); }

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
/* Full black border box — slightly rounded, high contrast for readability */
.dream-card {
  border-radius: 0.5rem !important;
  border: 2px solid hsl(0 0% 5%) !important;
  border-left-width: 2px !important;
  border-left-color: hsl(0 0% 5%) !important;
  clip-path: none !important;
  box-shadow: none;
}
.dream-card:hover {
  border-color: hsl(0 0% 0%) !important;
  border-left-color: hsl(0 0% 0%) !important;
  background: hsl(var(--accent));
  box-shadow: 0 2px 12px hsl(0 0% 0% / 0.14);
}
.logo-mark { color: hsl(0 0% 5%); }
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
/* Full cyan border box — near-sharp corners for the terminal aesthetic */
.dream-card {
  border-radius: 0.125rem !important;
  border: 1.5px solid hsl(180 100% 50% / 0.55) !important;
  border-left-width: 1.5px !important;
  border-left-color: hsl(180 100% 50% / 0.55) !important;
  clip-path: none !important;
  box-shadow: none;
}
.dream-card:hover {
  border-color: hsl(180 100% 50%) !important;
  border-left-color: hsl(180 100% 50%) !important;
  background: hsl(240 15% 9%);
  box-shadow: 0 0 18px hsl(180 100% 50% / 0.18),
              0 0 0 1px hsl(180 100% 50% / 0.08);
}
.logo-mark { color: hsl(180 100% 50%); }
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

// "Bauhaus" — De Stijl geometry: Mondrian primaries, Bebas Neue bold display,
// flat planes, zero ornament.  Light mode — warm linen canvas with opaque
// primary-colour blocks and thick black ruled lines, faithful to
// Mondrian's Composition No. II (1930).
const BAUHAUS_THEME_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Josefin+Sans:wght@400;600;700&display=swap');

:root {
  /* Light mode — warm off-white, like Mondrian's primed linen canvas */
  --background: 45 30% 96%;
  --foreground: 0 0% 6%;
  --card: 0 0% 100%;
  --card-foreground: 0 0% 6%;
  --popover: 0 0% 100%;
  --popover-foreground: 0 0% 6%;
  /* Primary: punchy Mondrian red #E3120B */
  --primary: 3 95% 45%;
  --primary-foreground: 0 0% 100%;
  /* Secondary: deep Mondrian blue #1C3E8A */
  --secondary: 225 68% 32%;
  --secondary-foreground: 0 0% 100%;
  --muted: 0 0% 91%;
  --muted-foreground: 0 0% 40%;
  --accent: 45 20% 92%;
  --accent-foreground: 0 0% 6%;
  --destructive: 0 84% 42%;
  --destructive-foreground: 0 0% 100%;
  /* Dark borders — the Mondrian grid line aesthetic */
  --border: 0 0% 15%;
  --input: 0 0% 94%;
  --ring: 3 95% 45%;
  /* Zero radius — Bauhaus uses only rectilinear geometry */
  --radius: 0rem;
  --accent-line: hsl(3 95% 45%);
}

body {
  font-family: 'Josefin Sans', 'Futura', 'Century Gothic', sans-serif;
  font-size: 1rem;
  line-height: 1.5;
  letter-spacing: 0.02em;
}

/* Bebas Neue for all structural display — the bold geometric Bauhaus display face */
h1, h2, h3 {
  font-family: 'Bebas Neue', 'Josefin Sans', sans-serif;
  letter-spacing: 0.06em;
}

.tiptap h1 {
  font-size: 2.25rem; font-weight: 400;
  font-family: 'Bebas Neue', sans-serif; letter-spacing: 0.1em;
}
.tiptap h2 {
  font-size: 1.625rem; font-weight: 400;
  font-family: 'Bebas Neue', sans-serif; letter-spacing: 0.08em;
}
.tiptap h3 {
  font-size: 1.25rem; font-weight: 400;
  font-family: 'Bebas Neue', sans-serif; letter-spacing: 0.06em;
}

/* Mondrian "Composition No. II" — opaque primary blocks on linen white.
   Colour blocks are fully opaque (light mode); thick black rules divide the canvas. */
.journal-rings-bg {
  background-color: hsl(45 30% 96%);
  background-image:
    /* Red block — dominant upper-right mass */
    linear-gradient(#E3120B, #E3120B),
    /* Blue block — lower-left anchor */
    linear-gradient(#1C3E8A, #1C3E8A),
    /* Yellow sliver — narrow accent strip */
    linear-gradient(#FAD000, #FAD000),
    /* Primary vertical rule (thick) at ~62% from left */
    linear-gradient(
      90deg,
      transparent           calc(62% - 5px),
      #0A0A0A               calc(62% - 5px),
      #0A0A0A               calc(62% + 5px),
      transparent           calc(62% + 5px)
    ),
    /* Secondary vertical rule (thin) at ~33% */
    linear-gradient(
      90deg,
      transparent           calc(33% - 2.5px),
      #0A0A0A               calc(33% - 2.5px),
      #0A0A0A               calc(33% + 2.5px),
      transparent           calc(33% + 2.5px)
    ),
    /* Primary horizontal rule (thick) at ~57% from top */
    linear-gradient(
      transparent           calc(57% - 5px),
      #0A0A0A               calc(57% - 5px),
      #0A0A0A               calc(57% + 5px),
      transparent           calc(57% + 5px)
    ),
    /* Secondary horizontal rule (thin) at ~20% */
    linear-gradient(
      transparent           calc(20% - 2.5px),
      #0A0A0A               calc(20% - 2.5px),
      #0A0A0A               calc(20% + 2.5px),
      transparent           calc(20% + 2.5px)
    );
  background-size:
    36% 57%,    /* red:    upper-right mass */
    30% 43%,    /* blue:   lower-left anchor */
     7% 35%,    /* yellow: thin accent sliver */
    100% 100%, 100% 100%,
    100% 100%, 100% 100%;
  background-position:
    64%   0%,   /* red:    top-right corner */
     0% 100%,   /* blue:   bottom-left corner */
    92%  20%,   /* yellow: right side, upper area */
    0 0, 0 0, 0 0, 0 0;
  background-repeat: no-repeat;
}

svg[class*="lucide"] { stroke-width: 2; }

/* Bauhaus card: no outline — flat plane on flat canvas, zero ornament */
.dream-card {
  border-radius: 0 !important;
  border: none !important;
  border-left-width: 0 !important;
  border-left-color: transparent !important;
  clip-path: none !important;
  background: #ffffff;
  box-shadow: none;
}
.dream-card:hover {
  border-color: transparent !important;
  border-left-color: transparent !important;
  background: hsl(45 20% 96%);
  box-shadow: none;
}

.logo-mark { color: hsl(3 95% 45%); }
/* Nav: red accent bar, Bebas Neue, no rounding */
.nav-item-active {
  border-left: 4px solid hsl(3 95% 45%) !important;
  border-radius: 0 !important;
  background: hsl(3 95% 45% / 0.08) !important;
  color: hsl(3 95% 45%) !important;
  font-family: 'Bebas Neue', sans-serif;
  font-size: 0.95em;
  letter-spacing: 0.1em;
}

/* Header: thick red bottom rule — primary structural separator */
header { border-bottom: 4px solid hsl(3 95% 45%); }
header::after { display: none; }

.section-title {
  font-family: 'Bebas Neue', sans-serif;
  font-size: 0.85rem;
  font-weight: 400;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: hsl(0 0% 35%);
}
.section-title::before { display: none; }

/* Tags: rectangular, Josefin Sans uppercase */
.tag-badge {
  border-radius: 0;
  font-family: 'Josefin Sans', sans-serif;
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-weight: 700;
}

[role="dialog"] [data-radix-dialog-title]::before,
[role="dialog"] .dialog-title::before { display: none; }

button[data-variant="default"], .btn-primary { border-top: none; }

/* Bebas Neue for all brand/display text */
.font-p5 {
  font-family: 'Bebas Neue', 'Josefin Sans', sans-serif;
  letter-spacing: 0.12em;
}

::-webkit-scrollbar-track { background: hsl(45 15% 92%); }
::-webkit-scrollbar-thumb { background: hsl(0 0% 28%); }
::-webkit-scrollbar-thumb:hover { background: hsl(3 95% 45%); }
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

/* Classical double-rule left + fine gold top — manuscript ruled double-bar */
.dream-card {
  border-radius: 0 !important;
  border: 1px solid hsl(40 28% 20%) !important;
  border-left-width: 3px !important;
  border-left-color: hsl(40 55% 50% / 0.6) !important;
  border-left-style: double !important;
  border-top: 1px solid hsl(40 55% 50% / 0.3) !important;
  clip-path: none !important;
  box-shadow: none;
}
.dream-card:hover {
  border-left-color: hsl(40 55% 50%) !important;
  border-top-color: hsl(40 55% 50% / 0.7) !important;
  background: hsl(36 20% 10%);
  box-shadow: 0 2px 20px hsl(40 55% 50% / 0.07);
}

.logo-mark { color: hsl(40 55% 50%); }
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
