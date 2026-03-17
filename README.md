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
- **Graph View**: Network visualization of dream-tag relationships
- **Full-text Search**: Quick search across all dreams (Ctrl+K)
- **Obsidian Export**: Export to Obsidian vault with wikilinks and Dataview support
- **Handwriting Scan**: Import handwritten dream notes using a two-stage Claude AI pipeline — raw transcription followed by English translation, with auto tag matching
- **Grammar Fix**: One-click toolbar button that corrects common grammar issues (contractions, capitalisation, double spaces)
- **Auto-match Tags**: Scans the dream text and automatically applies any tags whose name appears in the content
- **Inline Images**: Attach and embed images directly into dream entries via the toolbar
- **Guide**: A built-in guide page that loads `public/GUIDE.md` — edit that file to document your own journalling workflow

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
│   │   └── search/      # Search dialog
│   ├── pages/           # Page components
│   ├── stores/          # Zustand stores
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

## Keyboard Shortcuts

- `Ctrl+K` - Open search dialog

## Database

The SQLite database is stored in the app data directory:
- Windows: `%APPDATA%/com.dreams.app/dreams.db`
- macOS: `~/Library/Application Support/com.dreams.app/dreams.db`
- Linux: `~/.local/share/com.dreams.app/dreams.db`

## Obsidian Export

Dreams can be exported to an Obsidian vault at:
```
C:\Users\globo\Desktop\Dreams\vault\
```

The export creates:
- Dream files organized by year/month
- Tag files organized by category
- YAML frontmatter with metadata
- Wikilinks for navigation
- Dataview queries for related dreams

## License

MIT
