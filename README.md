# Dreams

A local-first desktop app for dream journaling, depth psychology, and pattern analysis.
Rich tagging, AI-assisted analysis, graph visualization, and full privacy — your data never leaves your machine.

**[dreams-landing.vercel.app](https://dreams-landing.vercel.app)** · [Download latest release](https://github.com/Vega-3/modernDreams/releases/latest)

---

## Download

| Platform | Installer |
|----------|-----------|
| **Windows** 10+ | `.msi` installer |
| **macOS** 12+ | `.dmg` (universal — Intel + Apple Silicon) |
| **Linux** (Ubuntu/Debian) | `.deb` package · `.AppImage` |

All builds are attached to each [GitHub Release](https://github.com/Vega-3/modernDreams/releases). AI features require an [Anthropic API key](https://console.anthropic.com) (optional, pay-as-you-go).

---

## Features

### Journaling
- Rich text editor (TipTap) with images, headings, bold/italic, lists
- Tag system with five categories: Location, Characters, Symbolic, Emotive, Custom
- Inline word-level tagging — highlight any phrase and assign one or more tags
- Draft auto-save to localStorage; restore banner on next open if the app closes unexpectedly
- Lucid dream toggle, mood/clarity/meaningfulness ratings, waking life context

### Analysis
- **Theme Analysis** — cross-tag pattern view with custom notes per tag
- **Graph View** — force-directed network of dream–tag co-occurrence; edge contraction collapses dreams to reveal direct tag relationships
- **Constellation View** — concentric tag orbit centred on a selected tag, ordered by association strength
- **Dream Series** — group related dreams into named series with a horizontal timeline and symbolic tag evolution grid
- **Graph theory metrics** — degree, strength, weighted centrality, and strongest-edge statistics per tag

### AI (requires Anthropic API key)
- **Voice Capture** — record yourself describing a dream; two-stage Claude Sonnet pipeline transcribes and refines the spoken text into a journal entry
- **Handwriting Scan** — two-stage Claude Haiku pipeline: raw transcription then English translation, with auto tag matching
- **AI Analyse** — suggests tags from your library and generates Jungian theme notes for the current dream
- **AI Tag** — applies inline highlights for matched tags across the full dream text

### Organisation
- **Full-text Search** (`Ctrl+K`) across all dream entries
- **Calendar View** — month/week view of entries by date
- **Jungian Archetypes** — 12 archetypes seeded from a reference document; link tags to archetypes, assign per dream
- **Guide page** — built-in binder with a journalling guide, Archetypes reference, and Sleep & REM science

### Professional Mode
- Multi-client library — strict personal/professional separation
- Bulk import from `.txt` files; each file becomes one dream entry
- Client filter in the journal header
- Per-dream client attribution stored in the Waking Life Context field

### Appearance
- Four themes: **Mementos** (default), **Base**, **Clarity** (accessibility), **Neon Noir**
- Font picker, custom CSS injection, custom background image, tag colour palette upload

---

## Database

SQLite, stored locally — never synced to any server.

| Platform | Path |
|----------|------|
| Windows | `%APPDATA%\com.dreamtracker.desktop\dreams.db` |
| macOS | `~/Library/Application Support/com.dreamtracker.desktop/dreams.db` |
| Linux | `~/.local/share/com.dreamtracker.desktop/dreams.db` |

---

## For Developers

### Prerequisites

| | |
|---|---|
| **All platforms** | Rust (stable), Node.js 20+, npm |
| **Linux / Ubuntu** | `libwebkit2gtk-4.1-dev libappindicator3-dev build-essential libssl-dev` |
| **Windows** | WebView2 Runtime, Microsoft C++ Build Tools |
| **macOS** | Xcode Command Line Tools |
| **Graph stats** | Python 3 on `PATH` (optional; standard library only) |

### Run locally

```bash
npm install
npm run tauri dev
```

### Build an installer

```bash
npm run tauri build
```

Outputs platform-specific installers to `src-tauri/target/release/bundle/`.

### Project structure

```
dreams/
├── crates/
│   ├── dreams-core/     # Platform-independent Rust backend (DB, AI, graph, search)
│   └── dreams-ffi/      # C ABI shim — cdylib/staticlib for future mobile targets
├── src-tauri/           # Tauri 2 desktop wrapper; Windows OCR lives here
├── src/                 # React 18 + TypeScript frontend
│   ├── components/      # ui/, dreams/, tags/, graph/, calendar/, layout/
│   ├── pages/           # One file per sidebar page
│   ├── stores/          # Zustand (dream, tag, archetype, analyst, ui, theme)
│   └── lib/             # tauri.ts API client, utils
├── src-python/          # Graph analysis script (called as subprocess)
├── public/              # GUIDE.md, ARCHETYPES.md
├── scripts/             # release.sh
└── .github/workflows/   # release.yml — cross-platform CI/CD
```

### Architecture note — mobile readiness

- `dreams-core` has zero Tauri dependencies; it links into any Rust host.
- `dreams-ffi` exposes a JSON-dispatch `extern "C"` surface (`dreams_call`) with the same method names as the Tauri `invoke()` layer, so the TypeScript client can target either backend with a one-line swap.
- Windows OCR is isolated to `src-tauri/` and gated with `#[cfg(target_os = "windows")]`.

---

## Release process

To cut a new release (bumps version, tags git, builds all three platforms via CI, and deploys the landing page to Vercel):

```bash
bash scripts/release.sh 0.2.0 "Short description of what changed"
```

What the script does:
1. Bumps the version in `Cargo.toml`, `src-tauri/tauri.conf.json`, and `package.json`
2. Creates a git commit and tag (`v0.2.0`)
3. Pushes to `origin` — triggers the GitHub Actions release build
4. Calls `~/Desktop/dreams-landing/deploy.sh` to update the Vercel landing page

GitHub Actions (`.github/workflows/release.yml`) then runs three parallel jobs on `ubuntu-22.04`, `windows-latest`, and `macos-latest`, building the platform installers and attaching them to a GitHub Release draft.

### Version files (always kept in sync by the script)

| File | Field |
|------|-------|
| `Cargo.toml` | `[workspace.package] version` |
| `src-tauri/tauri.conf.json` | `"version"` |
| `package.json` | `"version"` |

---

## License

MIT
