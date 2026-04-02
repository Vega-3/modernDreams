import { useState, useEffect, useRef } from 'react';
import {
  FolderOpen, Upload, Check, KeyRound, Loader2, X, AlertCircle,
  Palette, FileCode, SwatchBook,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { exportToObsidian, getObsidianPath, verifyApiKey, updateTag } from '@/lib/tauri';
import { friendlyApiError } from '@/lib/apiError';
import { useThemeStore, type ThemeId, type FontFamily } from '@/stores/themeStore';
import { useTagStore } from '@/stores/tagStore';

// ── Theme display metadata ────────────────────────────────────────────────────

const THEMES: { id: ThemeId; label: string; description: string }[] = [
  {
    id: 'mementos',
    label: 'Mementos',
    description: 'Bold Persona 5 aesthetic — angular cards, vivid purple accents, maximalist energy.',
  },
  {
    id: 'base',
    label: 'Base Theme',
    description: 'Clean minimal dark theme with indigo accents and soft rounded corners.',
  },
];

const FONTS: { id: FontFamily; label: string; preview: string }[] = [
  { id: 'system',   label: 'System UI',  preview: 'The quick brown fox' },
  { id: 'humanist', label: 'Humanist',   preview: 'The quick brown fox' },
  { id: 'serif',    label: 'Serif',      preview: 'The quick brown fox' },
  { id: 'mono',     label: 'Monospace',  preview: 'The quick brown fox' },
];

const FONT_STACK: Record<FontFamily, string> = {
  system:   'system-ui, -apple-system, sans-serif',
  humanist: 'Seravek, "Gill Sans Nova", Ubuntu, Calibri, sans-serif',
  serif:    'Georgia, "Times New Roman", serif',
  mono:     '"Courier New", Courier, monospace',
};

export function SettingsPage() {
  const [vaultPath, setVaultPath] = useState<string>('');

  // Load the Obsidian vault path from the Tauri backend on mount
  useEffect(() => {
    getObsidianPath().then(setVaultPath).catch(() => {});
  }, []);

  // ── API Key ──────────────────────────────────────────────────────────────
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('anthropic_api_key') ?? '');
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [testState, setTestState] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [testError, setTestError] = useState('');

  const saveApiKey = () => {
    localStorage.setItem('anthropic_api_key', apiKey.trim());
    setApiKeySaved(true);
    setTestState('idle');
    setTimeout(() => setApiKeySaved(false), 2000);
  };

  const handleTestKey = async () => {
    const key = apiKey.trim();
    if (!key) return;
    setTestState('testing');
    setTestError('');
    try {
      await verifyApiKey(key);
      setTestState('ok');
    } catch (err) {
      setTestState('error');
      setTestError(friendlyApiError(String(err)));
    }
  };

  // ── Obsidian export ──────────────────────────────────────────────────────
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{
    success: boolean;
    count?: number;
    path?: string;
    error?: string;
  } | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setExportResult(null);
    try {
      const result = await exportToObsidian();
      setExportResult({ success: true, count: result.exported_count, path: result.vault_path });
    } catch (error) {
      setExportResult({ success: false, error: String(error) });
    } finally {
      setIsExporting(false);
    }
  };

  // ── Appearance ───────────────────────────────────────────────────────────
  const { activeTheme, fontFamily, customCss, setTheme, setFontFamily, setCustomCss } = useThemeStore();
  const [localCss, setLocalCss] = useState(customCss);
  const cssFileRef = useRef<HTMLInputElement>(null);

  // Apply custom CSS changes after a short debounce
  useEffect(() => {
    const t = setTimeout(() => setCustomCss(localCss), 400);
    return () => clearTimeout(t);
  }, [localCss, setCustomCss]);

  const handleCssFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then((text) => {
      setLocalCss(text);
      setCustomCss(text);
    });
    // Reset so the same file can be re-uploaded after edits
    e.target.value = '';
  };

  // ── Tag palette upload ───────────────────────────────────────────────────
  const { tags, fetchTags } = useTagStore();
  const paletteFileRef = useRef<HTMLInputElement>(null);
  const [paletteStatus, setPaletteStatus] = useState<'idle' | 'applying' | 'done' | 'error'>('idle');
  const [paletteMessage, setPaletteMessage] = useState('');

  const handlePaletteUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setPaletteStatus('applying');
    setPaletteMessage('');

    try {
      const raw = await file.text();
      // Expected format: { "tag name": "#hexcolor", ... }
      const palette: Record<string, string> = JSON.parse(raw);
      let updated = 0;

      for (const tag of tags) {
        const color = palette[tag.name] ?? palette[tag.id];
        if (!color) continue;
        await updateTag({ ...tag, color });
        updated++;
      }

      await fetchTags();
      setPaletteStatus('done');
      setPaletteMessage(`Updated ${updated} tag${updated !== 1 ? 's' : ''}.`);
    } catch (err) {
      setPaletteStatus('error');
      setPaletteMessage(String(err));
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl space-y-6">

      {/* ── Appearance ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Appearance
          </CardTitle>
          <CardDescription>
            Choose a theme, font, and optionally inject your own CSS.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Theme selector */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Theme</p>
            <div className="grid grid-cols-2 gap-3">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={[
                    'rounded-md border p-3 text-left transition-all',
                    activeTheme === t.id
                      ? 'border-primary bg-primary/10 ring-1 ring-primary'
                      : 'border-border hover:bg-accent',
                  ].join(' ')}
                >
                  <p className="text-sm font-semibold">{t.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Font selector */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Font</p>
            <div className="grid grid-cols-2 gap-2">
              {FONTS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFontFamily(f.id)}
                  className={[
                    'rounded-md border px-3 py-2 text-left transition-all',
                    fontFamily === f.id
                      ? 'border-primary bg-primary/10 ring-1 ring-primary'
                      : 'border-border hover:bg-accent',
                  ].join(' ')}
                >
                  <p className="text-xs text-muted-foreground">{f.label}</p>
                  <p
                    className="text-sm mt-0.5"
                    style={{ fontFamily: FONT_STACK[f.id] }}
                  >
                    {f.preview}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Custom CSS */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium flex items-center gap-1.5">
                <FileCode className="h-4 w-4" />
                Custom CSS
              </p>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-7 text-xs"
                onClick={() => cssFileRef.current?.click()}
              >
                <Upload className="h-3 w-3" />
                Upload template
              </Button>
              <input
                ref={cssFileRef}
                type="file"
                accept=".css,text/css"
                className="hidden"
                onChange={handleCssFileUpload}
              />
            </div>
            <Textarea
              value={localCss}
              onChange={(e) => setLocalCss(e.target.value)}
              placeholder={`/* Your custom CSS here — applied on top of the active theme */\n\n.dream-card { border-radius: 8px; }`}
              className="font-mono text-xs h-36 resize-y"
            />
            <p className="text-xs text-muted-foreground">
              Changes are applied live. Upload a <code>.css</code> file to load it as a template,
              then edit freely. Clear the field to remove custom styles.
            </p>
          </div>

          <Separator />

          {/* Tag palette upload */}
          <div className="space-y-2">
            <p className="text-sm font-medium flex items-center gap-1.5">
              <SwatchBook className="h-4 w-4" />
              Tag Colour Palette
            </p>
            <p className="text-xs text-muted-foreground">
              Upload a JSON file mapping tag names to hex colours to batch-update tag colours.
              Format: <code className="bg-muted px-1 rounded">{"{ \"tag name\": \"#hexcolor\" }"}</code>
            </p>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  setPaletteStatus('idle');
                  setPaletteMessage('');
                  paletteFileRef.current?.click();
                }}
                disabled={paletteStatus === 'applying'}
              >
                {paletteStatus === 'applying' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Upload palette
              </Button>
              <input
                ref={paletteFileRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={handlePaletteUpload}
              />
              {paletteStatus === 'done' && (
                <span className="flex items-center gap-1.5 text-sm text-green-500">
                  <Check className="h-4 w-4" />
                  {paletteMessage}
                </span>
              )}
              {paletteStatus === 'error' && (
                <span className="text-sm text-destructive">{paletteMessage}</span>
              )}
            </div>
          </div>

        </CardContent>
      </Card>

      {/* ── Anthropic API Key ────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Anthropic API Key
          </CardTitle>
          <CardDescription>
            Required for AI-powered handwriting transcription. Your key is stored locally and only
            sent directly to Anthropic's API.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder="sk-ant-api03-..."
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setTestState('idle');
              }}
              onKeyDown={(e) => e.key === 'Enter' && saveApiKey()}
            />
            <Button onClick={saveApiKey} disabled={!apiKey.trim()}>
              {apiKeySaved ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Saved
                </>
              ) : (
                'Save'
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleTestKey}
              disabled={!apiKey.trim() || testState === 'testing'}
            >
              {testState === 'testing' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Test'
              )}
            </Button>
          </div>

          {testState === 'ok' && (
            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <Check className="h-4 w-4" />
              API key is valid and working.
            </div>
          )}
          {testState === 'error' && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                <X className="h-4 w-4" />
                API key test failed
              </div>
              <p className="text-sm text-destructive/80">{testError}</p>
            </div>
          )}

          <div className="rounded-md bg-amber-500/10 border border-amber-500/20 p-3 flex gap-2 text-sm text-amber-700 dark:text-amber-400">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium">API credits are separate from Claude.ai subscriptions</p>
              <p>
                A Claude.ai Pro/Team plan does not include API access. You need to add credits at{' '}
                <span className="font-medium">console.anthropic.com/settings/billing</span> to use
                this feature.
              </p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Get your API key at <span className="font-medium">console.anthropic.com</span>. Used for
            handwriting transcription (Scan Handwriting button in the Journal).
          </p>
        </CardContent>
      </Card>

      {/* ── Obsidian Export ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Obsidian Export
          </CardTitle>
          <CardDescription>
            Export your dreams to an Obsidian vault for advanced note-taking and graph visualization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/50 p-4">
            <p className="text-sm font-medium mb-2">Export Location</p>
            <code className="text-sm text-muted-foreground">
              {vaultPath || 'Loading…'}
            </code>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">What gets exported:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>- All dreams as Markdown files with YAML frontmatter</li>
              <li>- Tags organized by category with backlinks</li>
              <li>- Wikilinks for easy navigation</li>
              <li>- Dataview-compatible metadata for queries</li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Vault Structure:</p>
            <pre className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
{`vault/
├── Dreams/
│   └── 2025/
│       └── 01-January/
│           └── 2025-01-15-dream-title.md
├── Tags/
│   ├── Locations/
│   ├── People/
│   ├── Symbolic/
│   └── Emotive/
└── _index.md`}
            </pre>
          </div>

          <Separator />

          <div className="flex items-center gap-4">
            <Button onClick={handleExport} disabled={isExporting}>
              {isExporting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Exporting...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Export to Obsidian
                </>
              )}
            </Button>

            {exportResult && (
              <div
                className={`flex items-center gap-2 text-sm ${
                  exportResult.success ? 'text-green-500' : 'text-destructive'
                }`}
              >
                {exportResult.success ? (
                  <>
                    <Check className="h-4 w-4" />
                    Exported {exportResult.count} dreams
                  </>
                ) : (
                  <span>{exportResult.error}</span>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── About ────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>About Dreams</CardTitle>
          <CardDescription>Version 0.1.0</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Dreams is a local-first dream journal application for recording, tagging, and analyzing
            your dreams. Built with Tauri, React, and SQLite.
          </p>

          <div className="space-y-2">
            <p className="text-sm font-medium">Features:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>- Rich text dream editor with tag mentions and grammar fixes</li>
              <li>- 5 tag categories for comprehensive organization</li>
              <li>- Calendar view for temporal patterns</li>
              <li>- Network graph with physics simulation and deep analytics</li>
              <li>- Theme Analysis page with per-tag notes</li>
              <li>- Analyst mode for multi-client dream management</li>
              <li>- Visual customization with theme switching and custom CSS</li>
              <li>- Full-text search across all dreams</li>
              <li>- Handwriting scan via Claude AI</li>
              <li>- Obsidian vault export</li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Keyboard Shortcuts:</p>
            <div className="text-sm text-muted-foreground space-y-1">
              <div className="flex justify-between">
                <span>Open search</span>
                <kbd className="px-2 py-0.5 bg-muted rounded text-xs">Ctrl+K</kbd>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
