# Dreams - Dream Tracker Application

A full-stack desktop application for dream analysis with rich tagging, calendar views, network graph visualization, and Obsidian vault integration.

## Technology Stack

- **Desktop Framework**: Tauri 2.0
- **Frontend**: React 18 + TypeScript + Vite
- **Database**: SQLite + FTS5 (full-text search)
- **Rich Text Editor**: TipTap (with image support)
- **AI Transcription**: Anthropic Claude Haiku (two-stage handwriting transcription pipeline)
- **Graph Visualization**: Cytoscape.js
- **Calendar**: FullCalendar
- **UI Components**: shadcn/ui + Tailwind CSS
- **State Management**: Zustand

## Features

- **Dream Journal**: Rich text editor for recording dreams with tags
- **Tag System**: 5 categories (Location, Person, Symbolic, Emotive, Custom)
- **Calendar View**: View dreams by date with month/week views
- **Graph View**: Network visualization of dream-tag relationships with edge contraction (hiding dreams directly connects co-occurring tags)
- **Theme Analysis**: Cross-tag pattern analysis with custom notes per tag
- **Full-text Search**: Quick search across all dreams (Ctrl+K)
- **Obsidian Export**: Export to Obsidian vault with wikilinks and Dataview support
- **Handwriting Scan**: Import handwritten dream notes using a two-stage Claude AI pipeline — raw transcription followed by English translation, with auto tag matching
- **Grammar Fix**: One-click toolbar button that corrects common grammar issues (contractions, capitalisation, double spaces)
- **Auto-match Tags**: Scans the dream text and automatically applies any tags whose name appears in the content
- **Inline Images**: Attach and embed images directly into dream entries via the toolbar
- **Guide**: A built-in guide page that loads `public/GUIDE.md` — edit that file to document your own journalling workflow
- **Analyst Mode**: Multi-client dream management for professional analysts — manage client profiles, bulk-import dreams from text files, and filter the journal by client
- **Visual Customization**: Switch themes, change fonts, inject custom CSS, and batch-update tag colours via palette upload — all from Settings → Appearance

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- [Rust](https://rustup.rs/) (latest stable)
- [Tauri CLI](https://tauri.app/v1/guides/getting-started/prerequisites)

## Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run in development mode:
   ```bash
   npm run tauri dev
   ```

3. Build for production:
   ```bash
   npm run tauri build
   ```

## Project Structure

```
dreams/
├── src-tauri/           # Rust backend
│   ├── src/
│   │   ├── commands/    # IPC handlers (dreams, tags, search, obsidian)
│   │   ├── db/          # SQLite database and migrations
│   │   └── models/      # Data structures
│   └── Cargo.toml
│
├── src/                 # React frontend
│   ├── components/
│   │   ├── ui/          # shadcn/ui components
│   │   ├── layout/      # Sidebar, Header
│   │   ├── dreams/      # Editor, List, Cards
│   │   ├── tags/        # Picker, Badge
│   │   ├── calendar/    # FullCalendar wrapper
│   │   ├── graph/       # Cytoscape wrapper
│   │   ├── search/      # Search dialog
│   │   └── ThemeProvider.tsx  # Runtime theme/font/CSS injection
│   ├── pages/           # Page components
│   ├── stores/          # Zustand stores (incl. themeStore)
│   ├── hooks/           # Custom hooks
│   └── lib/             # Utilities
│
├── package.json
└── tailwind.config.js
```

## AI Handwriting Transcription

The **Scan Handwriting** button (Journal header) lets you import photos of handwritten dream notes
using Claude AI instead of the previous Windows OCR engine.

### How it works

1. **Upload** one or more images of handwritten notes (PNG, JPEG, etc.).
2. **Stage 1 — Transcription**: Each image is sent to `claude-haiku-4-5-20251001` with a vision
   prompt. Claude reads the handwriting and produces a raw transcript, preserving the original
   language, abbreviations, and line breaks.
3. **Stage 2 — English translation**: The raw transcript is sent to a second Claude Haiku call
   (text-only, cheaper) which translates and refines it into clear, fluent English.
4. **Review**: The preview dialog shows both versions. You can toggle between them with the
   **English Translation / Raw Transcript** buttons. Switching versions automatically re-runs tag
   matching on the selected content.
5. **Save**: Choose the version you prefer (or edit the text freely) and save as a dream entry.

### Setup

1. Get an API key from [console.anthropic.com](https://console.anthropic.com).
2. Open **Settings → Anthropic API Key**, paste your key, and click **Save**.

The key is stored in browser localStorage and is sent only to Anthropic's API endpoint.

## Guide

The **Guide** page (sidebar → Guide) displays `public/GUIDE.md`. Edit that file with your own notes on:

- How to record dreams effectively
- Your personal tagging conventions
- Tips for using the handwriting scanner
- Any other workflow notes

## Graph View

The Graph page visualises dream–tag relationships as a force-directed network. Use the group
toggles (top-left) to show or hide Dreams, or any of the five tag categories.

### Edge contraction when hiding dreams

When the **Dreams** group is hidden, the view performs an *edge contraction* on all dream
nodes: any two tags that appeared together in at least one dream are connected directly. This
matches the expected graph-theory behaviour (contracting degree-1 vertices) described in the
original design.

With dreams visible, direct tag–tag edges are only drawn when two tags co-occur in **2 or
more** dreams (to avoid clutter). With dreams hidden, all co-occurrences (≥ 1 shared dream)
produce a direct edge.

## Graph Theory Analysis

The **Graph** page includes a collapsible statistics panel (right side) that performs
network analysis on the tag co-occurrence graph for any chosen date window.

### How it works

1. **Date range selection** — A *From / To* date picker (centred in the toolbar) scopes
   the analysis to dreams that fall within that window.
2. **Subgraph construction** — All dreams in the window are fetched along with their tags,
   forming a bipartite dream–tag graph.
3. **Vertex contraction** — Every dream node is contracted: for each pair of tags that
   share a dream, an edge is added (or its weight incremented by 1). The result is a
   **weighted undirected tag co-occurrence network** represented as an adjacency matrix
   `W[i][j]` = number of shared dreams.
4. **Python analysis** — The adjacency matrix is passed to `src-python/graph_analysis.py`,
   which computes four families of statistics and returns the top 5 for each.

### Metrics

| Metric | Formula | Meaning |
|---|---|---|
| **Order** | `Σⱼ 𝟙[W[i][j] > 0]` | Distinct tag neighbours (unweighted degree) |
| **Strength** | `Σⱼ W[i][j]` | Total co-occurrence weight (weighted degree) |
| **Weighted Centrality** | `s(i) / Σₖ s(k)` | Node's share of total graph weight; in \[0, 1\] |
| **Strongest Edge** | `W[i][j]` | Highest co-occurrence count between any two tags |

### Requirements

- **Python 3** must be installed and on `PATH` (`python` or `python3`).
  No third-party packages are needed — the script uses only the standard library (`json`, `sys`).

### Files

```
src-python/
├── graph_analysis.py   # Python math engine
└── GRAPHTHEORY.md      # Formula reference
src-tauri/resources/
└── graph_analysis.py   # Compiled into the binary via include_str!
```

## Analyst Mode

The **Analyst** page (sidebar → Analyst) provides tools for professionals managing multiple clients' dream journals.

### Features

- **Mode toggle**: Switch between Personal and Analyst mode at any time.
- **Client management**: Add and remove named clients, each with a colour identifier.
- **Bulk import**: Select one or more `.txt` files per client to import as dream entries. Each file becomes one dream; if the first line is a `YYYY-MM-DD` date it is used as the dream date, otherwise today's date is applied.
- **Client filter**: When clients exist, a filter button appears in the header (left of the search button). Select a client to show only their dreams in the Journal; click the × badge to return to the full view.

### How client tagging works

Imported dreams are tagged by prepending `[Client: Name]` to the dream's Waking Life Context field. This means:
- Client attribution persists in the database without schema changes.
- Hand-edited dreams can be manually attributed to a client by adding the same prefix.
- The search dialog can find client-specific dreams by searching for `[Client: Name]`.

## Keyboard Shortcuts

- `Ctrl+K` - Open search dialog

## Database

The SQLite database is stored in the app data directory:
- Windows: `%APPDATA%/com.dreams.app/dreams.db`
- macOS: `~/Library/Application Support/com.dreams.app/dreams.db`
- Linux: `~/.local/share/com.dreams.app/dreams.db`

## Obsidian Export

Dreams can be exported to an Obsidian vault. The target path is configured in the Rust backend and is displayed in **Settings → Obsidian Export**.

The export creates:
- Dream files organized by year/month
- Tag files organized by category
- YAML frontmatter with metadata
- Wikilinks for navigation
- Dataview queries for related dreams

## Visual Customization

The **Settings → Appearance** section provides a full suite of visual controls that apply immediately without restarting:

### Themes

Two built-in themes:

| Theme | Description |
|---|---|
| **Mementos** (default) | Persona 5 maximalist — deep blacks, vivid purple, angular cards, sharp typography |
| **Base Theme** | Clean minimal dark — indigo accent colour, rounded corners, no decorative extras |

Switching themes overrides the CSS custom properties (`--primary`, `--background`, etc.) defined in `globals.css` by injecting a `<style>` tag at runtime. Selecting Mementos removes the override, restoring the base stylesheet as the source of truth.

### Fonts

Four font families to choose from: **System UI**, **Humanist**, **Serif**, and **Monospace**. The selected font is applied as a live body override.

### Custom CSS

Paste any CSS into the textarea or upload a `.css` file as a template. Changes are applied after a short debounce (400 ms) and injected after the theme styles, so custom rules override everything. Clear the field to remove all custom styles.

### Tag Colour Palettes

Upload a JSON file to batch-assign colours to tags:

```json
{
  "Flying": "#a855f7",
  "Ocean":  "#3b82f6",
  "Chase":  "#f43f5e"
}
```

Keys are matched against tag names (falling back to tag IDs). Matched tags are updated in the database; unmatched keys are silently ignored.

## Design

The default UI uses a **Persona 5-inspired** dark aesthetic: deep blacks, vivid purple as the primary
colour, sharp angular corners, and maximalist accents throughout. Key design tokens are
defined in `src/styles/globals.css` using CSS custom properties on `:root`.

Notable visual elements (Mementos theme):
- Dream cards have a thick left purple accent stripe and a top-right polygon clip corner.
- Active sidebar items show a bold left border and elevated weight.
- The header uses an uppercase bold title and a right-edge gradient accent line.
- Dialog titles carry a left-rule purple bar for strong visual hierarchy.

## License

MIT
