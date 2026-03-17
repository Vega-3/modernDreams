import { useState } from 'react';
import { FolderOpen, Upload, Check, KeyRound } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { exportToObsidian } from '@/lib/tauri';

export function SettingsPage() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('anthropic_api_key') ?? '');
  const [apiKeySaved, setApiKeySaved] = useState(false);

  const saveApiKey = () => {
    localStorage.setItem('anthropic_api_key', apiKey.trim());
    setApiKeySaved(true);
    setTimeout(() => setApiKeySaved(false), 2000);
  };

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
      setExportResult({
        success: true,
        count: result.exported_count,
        path: result.vault_path,
      });
    } catch (error) {
      setExportResult({
        success: false,
        error: String(error),
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Anthropic API Key */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Anthropic API Key
          </CardTitle>
          <CardDescription>
            Required for AI-powered handwriting transcription. Your key is stored locally in the
            browser and is only sent directly to Anthropic's API.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder="sk-ant-api03-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
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
          </div>
          <p className="text-xs text-muted-foreground">
            Get your API key at{' '}
            <span className="font-medium">console.anthropic.com</span>. The key is used for
            handwriting transcription (Scan Handwriting button in the Journal).
          </p>
        </CardContent>
      </Card>

      {/* Obsidian Export */}
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
              C:\Users\globo\Desktop\Dreams\vault\
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

      {/* About */}
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
              <li>- Rich text dream editor with tag mentions</li>
              <li>- 5 tag categories for comprehensive organization</li>
              <li>- Calendar view for temporal patterns</li>
              <li>- Network graph for relationship visualization</li>
              <li>- Full-text search across all dreams</li>
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
