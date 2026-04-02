import { useRef, useState } from 'react';
import { Briefcase, Plus, Trash2, Upload, Users, User, FolderOpen, FileText, Check } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useAnalystStore, clientPrefix } from '@/stores/analystStore';
import { useDreamStore } from '@/stores/dreamStore';
import type { CreateDreamInput } from '@/lib/tauri';

// ── Colour palette for new clients ───────────────────────────────────────────

const CLIENT_COLORS = [
  '#a855f7', '#3b82f6', '#22c55e', '#f59e0b',
  '#f43f5e', '#06b6d4', '#8b5cf6', '#10b981',
];

// ── Dream file parser ─────────────────────────────────────────────────────────

interface ParsedDream {
  title: string;
  content: string;
  date: string;
}

function parseTextFile(filename: string, content: string): ParsedDream {
  // Derive title from filename (strip extension, convert underscores/hyphens)
  const baseName = filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
  const title = baseName.charAt(0).toUpperCase() + baseName.slice(1);

  // Look for an optional date on the first line (YYYY-MM-DD)
  const lines = content.split(/\r?\n/);
  const dateMatch = lines[0].match(/^(\d{4}-\d{2}-\d{2})/);
  const date  = dateMatch ? dateMatch[1] : format(new Date(), 'yyyy-MM-dd');
  const body  = dateMatch ? lines.slice(1).join('\n').trim() : content.trim();

  return { title, content: body, date };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AnalystPage() {
  const {
    analystMode, setAnalystMode,
    clients, addClient, removeClient,
  } = useAnalystStore();

  const { createDream, fetchDreams } = useDreamStore();

  // ── New-client form ──────────────────────────────────────────────────────
  const [newName,  setNewName]  = useState('');
  const [newColor, setNewColor] = useState(CLIENT_COLORS[0]);

  const handleAddClient = () => {
    if (!newName.trim()) return;
    addClient(newName, newColor);
    setNewName('');
  };

  // ── Bulk import state ────────────────────────────────────────────────────
  const [importClientId, setImportClientId] = useState<string>('');
  const [importFiles,    setImportFiles]    = useState<File[]>([]);
  const [importStatus,   setImportStatus]   = useState<'idle' | 'importing' | 'done' | 'error'>('idle');
  const [importCount,    setImportCount]    = useState(0);
  const [importError,    setImportError]    = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setImportFiles(files);
    setImportStatus('idle');
  };

  const handleImport = async () => {
    if (!importClientId || importFiles.length === 0) return;

    const client = clients.find((c) => c.id === importClientId);
    if (!client) return;

    setImportStatus('importing');
    setImportCount(0);
    setImportError('');

    let count = 0;
    try {
      for (const file of importFiles) {
        const text = await file.text();
        const parsed = parseTextFile(file.name, text);

        const input: CreateDreamInput = {
          title:                parsed.title,
          content_html:         `<p>${parsed.content.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`,
          content_plain:        parsed.content,
          dream_date:           parsed.date,
          is_lucid:             false,
          mood_rating:          null,
          clarity_rating:       null,
          // Prepend client tag to waking_life_context so we can filter later
          waking_life_context:  clientPrefix(client.name),
          analysis_notes:       null,
          tag_ids:              [],
          word_tag_associations: [],
        };

        await createDream(input);
        count++;
        setImportCount(count);
      }

      await fetchDreams();
      setImportStatus('done');
      setImportFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setImportError(String(err));
      setImportStatus('error');
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl space-y-6">

      {/* ── Mode toggle ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Analyst Mode
          </CardTitle>
          <CardDescription>
            Enable to manage multiple clients' dream journals and import dreams in bulk.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch
              id="analyst-mode"
              checked={analystMode}
              onCheckedChange={setAnalystMode}
            />
            <Label htmlFor="analyst-mode" className="flex items-center gap-2 cursor-pointer">
              {analystMode
                ? <><Briefcase className="h-4 w-4 text-primary" /> Analyst (multi-client)</>
                : <><User        className="h-4 w-4" /> Personal</>
              }
            </Label>
          </div>

          {!analystMode && (
            <p className="text-sm text-muted-foreground">
              You are in personal mode. Enable Analyst mode to manage client journals and bulk-import dreams.
            </p>
          )}
        </CardContent>
      </Card>

      {analystMode && (
        <>
          {/* ── Client management ──────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Clients
              </CardTitle>
              <CardDescription>
                Add clients to associate their dream entries with a specific person.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Client list */}
              {clients.length === 0 ? (
                <p className="text-sm text-muted-foreground">No clients yet. Add one below.</p>
              ) : (
                <div className="space-y-2">
                  {clients.map((client) => (
                    <div
                      key={client.id}
                      className="flex items-center justify-between rounded-md border px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: client.color }}
                        />
                        <span className="text-sm font-medium">{client.name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => removeClient(client.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <Separator />

              {/* Add client form */}
              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <Label htmlFor="client-name" className="text-xs">Client name</Label>
                  <Input
                    id="client-name"
                    placeholder="e.g. John D."
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddClient()}
                    className="h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="client-color" className="text-xs">Colour</Label>
                  <div className="flex gap-1">
                    {CLIENT_COLORS.slice(0, 4).map((c) => (
                      <button
                        key={c}
                        onClick={() => setNewColor(c)}
                        className="h-8 w-8 rounded border-2 transition-all"
                        style={{
                          backgroundColor: c,
                          borderColor: newColor === c ? 'white' : 'transparent',
                        }}
                      />
                    ))}
                  </div>
                </div>
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={handleAddClient}
                  disabled={!newName.trim()}
                >
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ── Bulk import ─────────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5" />
                Bulk Dream Import
              </CardTitle>
              <CardDescription>
                Import multiple plain-text dream files for a client. Each file becomes one dream entry.
                Optionally start the first line with a date (YYYY-MM-DD) to set the dream date.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {clients.length === 0 ? (
                <p className="text-sm text-muted-foreground">Add a client above before importing.</p>
              ) : (
                <>
                  {/* Client selector */}
                  <div className="space-y-1">
                    <Label htmlFor="import-client" className="text-xs">Client</Label>
                    <select
                      id="import-client"
                      value={importClientId}
                      onChange={(e) => setImportClientId(e.target.value)}
                      className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="">Select a client…</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* File picker */}
                  <div className="space-y-1">
                    <Label className="text-xs">Dream files (.txt)</Label>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <FileText className="h-4 w-4" />
                        Choose files
                      </Button>
                      {importFiles.length > 0 && (
                        <span className="text-sm text-muted-foreground self-center">
                          {importFiles.length} file{importFiles.length !== 1 ? 's' : ''} selected
                        </span>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".txt,text/plain"
                      multiple
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                  </div>

                  {/* File list preview */}
                  {importFiles.length > 0 && (
                    <div className="rounded-md border bg-muted/30 p-2 max-h-32 overflow-y-auto space-y-0.5">
                      {importFiles.map((f) => (
                        <div key={f.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <FileText className="h-3 w-3 flex-shrink-0" />
                          {f.name}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Import button */}
                  <div className="flex items-center gap-3">
                    <Button
                      onClick={handleImport}
                      disabled={!importClientId || importFiles.length === 0 || importStatus === 'importing'}
                      className="gap-1.5"
                    >
                      {importStatus === 'importing' ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                          Importing {importCount}/{importFiles.length}…
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4" />
                          Import Dreams
                        </>
                      )}
                    </Button>

                    {importStatus === 'done' && (
                      <span className="flex items-center gap-1.5 text-sm text-green-500">
                        <Check className="h-4 w-4" />
                        Imported {importCount} dream{importCount !== 1 ? 's' : ''}
                      </span>
                    )}
                    {importStatus === 'error' && (
                      <span className="text-sm text-destructive">{importError}</span>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Imported dreams are tagged with the selected client's name in the Waking Life
                    Context field. Use the client filter button in the header to view only that
                    client's dreams.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
