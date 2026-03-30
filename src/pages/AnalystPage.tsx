import { useEffect, useState, useRef } from 'react';
import {
  Users,
  Plus,
  Trash2,
  Upload,
  Key,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  BookOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { useClientStore } from '@/stores/clientStore';
import { useDreamStore } from '@/stores/dreamStore';
import { importClientDreams, verifyApiKey } from '@/lib/tauri';
import type { ImportDreamInput } from '@/lib/tauri';

// ── AI parsing helpers ────────────────────────────────────────────────────────

interface ParsedDream {
  title: string;
  content: string;
  date: string;
  selected: boolean;
}

/**
 * Use the Claude API (text-only) to split a raw multi-dream text file into
 * individual dream entries, each with a title, date, and content.
 */
async function parseFileWithClaude(
  text: string,
  apiKey: string,
): Promise<ParsedDream[]> {
  const prompt = `You are given the text of a dream journal file that may contain one or many dream entries.
Split the content into individual dreams. For each dream extract:
- title: a short descriptive title (5 words or fewer, infer from content if absent)
- date: the date in YYYY-MM-DD format (use today's date "${new Date().toISOString().slice(0, 10)}" if unknown)
- content: the full dream narrative as plain text

Return ONLY valid JSON in this exact format with no extra commentary:
[{"title":"...","date":"YYYY-MM-DD","content":"..."}]

Journal text:
${text.slice(0, 12000)}`;

  const body = {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  };

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const rawText: string =
    data?.content?.find((c: { type: string }) => c.type === 'text')?.text ?? '';

  // Extract the JSON array from the response
  const jsonMatch = rawText.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Could not parse AI response as JSON array');

  const parsed: { title: string; date: string; content: string }[] = JSON.parse(jsonMatch[0]);
  return parsed.map((d) => ({ ...d, selected: true }));
}

// ── Component ─────────────────────────────────────────────────────────────────

type Step = 'setup' | 'clients' | 'import-select' | 'import-preview';

export function AnalystPage() {
  const { clients, fetchClients, createClient, deleteClient, setActiveClient, activeClientId } =
    useClientStore();
  const { fetchDreams, dreams } = useDreamStore();

  const [step, setStep] = useState<Step>('setup');
  const [apiKey, setApiKey] = useState('');
  const [apiKeyStatus, setApiKeyStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle');
  const [apiKeyError, setApiKeyError] = useState('');
  const [useCase, setUseCase] = useState<'self' | 'clients'>('self');

  // New client dialog
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientNotes, setNewClientNotes] = useState('');

  // Import flow
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importClientId, setImportClientId] = useState<string>('');
  const [isParsingFiles, setIsParsingFiles] = useState(false);
  const [parseError, setParseError] = useState('');
  const [parsedDreams, setParsedDreams] = useState<ParsedDream[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<string>('');

  useEffect(() => {
    fetchClients();
    // Load API key from localStorage if previously saved
    const stored = localStorage.getItem('anthropic_api_key');
    if (stored) setApiKey(stored);
  }, [fetchClients]);

  // ── Setup step ────────────────────────────────────────────────────────────

  const handleVerifyKey = async () => {
    if (!apiKey.trim()) return;
    setApiKeyStatus('checking');
    setApiKeyError('');
    try {
      await verifyApiKey(apiKey.trim());
      localStorage.setItem('anthropic_api_key', apiKey.trim());
      setApiKeyStatus('ok');
    } catch (e) {
      setApiKeyStatus('error');
      setApiKeyError(String(e));
    }
  };

  const handleSetupContinue = () => {
    if (useCase === 'self') {
      setActiveClient(null);
      setStep('clients');
    } else {
      setStep('clients');
    }
  };

  // ── Client management ─────────────────────────────────────────────────────

  const handleCreateClient = async () => {
    if (!newClientName.trim()) return;
    try {
      await createClient({
        name: newClientName.trim(),
        notes: newClientNotes.trim() || null,
      });
      setNewClientName('');
      setNewClientNotes('');
      setNewClientOpen(false);
    } catch (e) {
      console.error('Failed to create client:', e);
    }
  };

  const handleDeleteClient = async (id: string, name: string) => {
    if (confirm(`Delete client "${name}"? All their dreams will also be deleted.`)) {
      await deleteClient(id);
      if (activeClientId === id) setActiveClient(null);
    }
  };

  // ── Import flow ───────────────────────────────────────────────────────────

  const openImport = (clientId: string) => {
    setImportClientId(clientId);
    setParsedDreams([]);
    setParseError('');
    setImportResult('');
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const currentApiKey = apiKey || localStorage.getItem('anthropic_api_key') || '';
    if (!currentApiKey) {
      setParseError('Please enter your Anthropic API key in the Setup tab first.');
      setStep('import-preview');
      e.target.value = '';
      return;
    }

    setIsParsingFiles(true);
    setParseError('');
    setStep('import-preview');

    try {
      const allParsed: ParsedDream[] = [];
      for (const file of files) {
        const text = await file.text();
        const parsed = await parseFileWithClaude(text, currentApiKey);
        allParsed.push(...parsed);
      }
      setParsedDreams(allParsed);
    } catch (err) {
      setParseError(String(err));
    } finally {
      setIsParsingFiles(false);
      e.target.value = '';
    }
  };

  const toggleParsedDream = (index: number) => {
    setParsedDreams((prev) =>
      prev.map((d, i) => (i === index ? { ...d, selected: !d.selected } : d))
    );
  };

  const handleImport = async () => {
    const toImport = parsedDreams.filter((d) => d.selected);
    if (toImport.length === 0) return;

    setIsImporting(true);
    try {
      const payload: ImportDreamInput[] = toImport.map((d) => ({
        client_id: importClientId,
        title: d.title,
        content_html: `<p>${d.content.replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br>')}</p>`,
        content_plain: d.content,
        dream_date: d.date,
      }));

      const count = await importClientDreams(payload);
      await fetchDreams();
      setImportResult(`Successfully imported ${count} dream${count !== 1 ? 's' : ''}.`);
      setParsedDreams([]);
    } catch (err) {
      setParseError(String(err));
    } finally {
      setIsImporting(false);
    }
  };

  // ── Client stats ──────────────────────────────────────────────────────────

  const dreamCountForClient = (clientId: string) =>
    dreams.filter((d) => d.client_id === clientId).length;

  const personalDreamCount = dreams.filter((d) => d.client_id === null).length;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Page header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Analyst Mode</h2>
        <p className="text-muted-foreground mt-1">
          Manage multiple clients' dream journals and run cross-client analysis.
        </p>
      </div>

      <Separator />

      {/* Hidden file input for batch import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.md,.text"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Setup card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Setup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Use case</Label>
            <div className="flex gap-3">
              <Button
                variant={useCase === 'self' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setUseCase('self')}
              >
                Personal journal
              </Button>
              <Button
                variant={useCase === 'clients' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setUseCase('clients')}
              >
                Managing clients
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {useCase === 'self'
                ? 'All dreams belong to you. The client system is hidden in the main journal.'
                : 'Each client gets their own dream folder. You can analyse all clients together in the graph.'}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="api-key">Anthropic API Key</Label>
            <div className="flex gap-2">
              <Input
                id="api-key"
                type="password"
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); setApiKeyStatus('idle'); }}
                placeholder="sk-ant-..."
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={handleVerifyKey}
                disabled={!apiKey.trim() || apiKeyStatus === 'checking'}
              >
                {apiKeyStatus === 'checking' ? 'Checking...' : 'Verify'}
              </Button>
            </div>
            {apiKeyStatus === 'ok' && (
              <p className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle className="h-3.5 w-3.5" /> Key verified and saved
              </p>
            )}
            {apiKeyStatus === 'error' && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" /> {apiKeyError}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Used to parse imported text files into structured dream entries.
            </p>
          </div>

          <Button onClick={handleSetupContinue} className="gap-2">
            Continue to Clients
            <ChevronRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      {/* Clients list */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Clients
            </CardTitle>
            <Button size="sm" onClick={() => setNewClientOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              New Client
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Personal journal entry */}
          <div
            className={`flex items-center justify-between rounded-lg border p-3 cursor-pointer transition-colors ${
              activeClientId === null ? 'border-primary bg-primary/5' : 'hover:bg-accent'
            }`}
            onClick={() => setActiveClient(null)}
          >
            <div className="flex items-center gap-3">
              <BookOpen className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium text-sm">Personal Journal</p>
                <p className="text-xs text-muted-foreground">{personalDreamCount} dreams</p>
              </div>
            </div>
            {activeClientId === null && (
              <span className="text-xs text-primary font-medium">Active</span>
            )}
          </div>

          {clients.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No clients yet. Add a client to start tracking their dreams separately.
            </p>
          ) : (
            clients.map((client) => (
              <div
                key={client.id}
                className={`flex items-center justify-between rounded-lg border p-3 cursor-pointer transition-colors ${
                  activeClientId === client.id ? 'border-primary bg-primary/5' : 'hover:bg-accent'
                }`}
                onClick={() => setActiveClient(client.id)}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Users className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{client.name}</p>
                    {client.notes && (
                      <p className="text-xs text-muted-foreground truncate">{client.notes}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {dreamCountForClient(client.id)} dreams
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                  {activeClientId === client.id && (
                    <span className="text-xs text-primary font-medium">Active</span>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      openImport(client.id);
                    }}
                  >
                    <Upload className="h-3 w-3" />
                    Import
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteClient(client.id, client.name);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Import preview */}
      {(step === 'import-preview' || parsedDreams.length > 0 || isParsingFiles || importResult) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Import Preview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isParsingFiles && (
              <p className="text-sm text-muted-foreground animate-pulse">
                Parsing files with AI… this may take a moment.
              </p>
            )}

            {parseError && (
              <div className="flex items-start gap-2 text-destructive text-sm rounded-md border border-destructive/30 bg-destructive/5 p-3">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{parseError}</span>
              </div>
            )}

            {importResult && (
              <div className="flex items-center gap-2 text-green-600 text-sm rounded-md border border-green-500/30 bg-green-500/5 p-3">
                <CheckCircle className="h-4 w-4 flex-shrink-0" />
                <span>{importResult}</span>
              </div>
            )}

            {parsedDreams.length > 0 && (
              <>
                <p className="text-sm text-muted-foreground">
                  AI found <strong>{parsedDreams.length}</strong> dream{parsedDreams.length !== 1 ? 's' : ''}.
                  Deselect any you don't want to import.
                </p>

                <div className="space-y-2 max-h-80 overflow-y-auto border rounded-md p-2">
                  {parsedDreams.map((dream, i) => (
                    <label
                      key={i}
                      className="flex items-start gap-3 py-2 px-2 rounded hover:bg-accent cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={dream.selected}
                        onChange={() => toggleParsedDream(i)}
                        className="mt-0.5 rounded flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{dream.title}</p>
                        <p className="text-xs text-muted-foreground">{dream.date}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {dream.content}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleImport}
                    disabled={isImporting || parsedDreams.filter((d) => d.selected).length === 0}
                  >
                    {isImporting
                      ? 'Importing…'
                      : `Import ${parsedDreams.filter((d) => d.selected).length} dream${parsedDreams.filter((d) => d.selected).length !== 1 ? 's' : ''}`}
                  </Button>
                  <Button variant="outline" onClick={() => setParsedDreams([])}>
                    Cancel
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* New client dialog */}
      <Dialog open={newClientOpen} onOpenChange={setNewClientOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Client</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="client-name">Name</Label>
              <Input
                id="client-name"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                placeholder="Client name or pseudonym..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client-notes">Notes (optional)</Label>
              <Textarea
                id="client-notes"
                value={newClientNotes}
                onChange={(e) => setNewClientNotes(e.target.value)}
                placeholder="Any relevant background information..."
                className="min-h-[80px] resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewClientOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateClient} disabled={!newClientName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
