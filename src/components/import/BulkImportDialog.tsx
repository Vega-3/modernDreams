import { useCallback, useEffect, useRef, useState } from 'react';
import { FolderOpen, Loader2, AlertCircle, CheckCircle2, Tag as TagIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Tag } from '@/lib/tauri';
import { useTagStore } from '@/stores/tagStore';
import { useUIStore, type ImportQueueItem } from '@/stores/uiStore';
import { parseFile, type ParsedFile } from '@/lib/fileImport';

// ── Types ─────────────────────────────────────────────────────────────────────

type FileStatus = 'pending' | 'parsing' | 'done' | 'error';

interface FileEntry {
  file: File;
  status: FileStatus;
  parsed?: ParsedFile;
}

interface BulkImportDialogProps {
  open: boolean;
  onClose: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ACCEPTED = '.txt,.md,.markdown,.docx,.pdf';

const EXT_ICON: Record<string, string> = {
  txt:      '📄',
  md:       '📝',
  markdown: '📝',
  docx:     '📘',
  pdf:      '📕',
};

function extIcon(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return EXT_ICON[ext] ?? '📄';
}

// ── Component ─────────────────────────────────────────────────────────────────

export function BulkImportDialog({ open, onClose }: BulkImportDialogProps) {
  const { tags, fetchTags } = useTagStore();
  const { startImportQueue } = useUIStore();

  const [entries, setEntries]     = useState<FileEntry[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load tags on open so auto-matching works even on first launch
  useEffect(() => { if (open) fetchTags(); }, [open, fetchTags]);

  // Reset when closed
  useEffect(() => {
    if (!open) {
      setEntries([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [open]);

  // ── File processing ────────────────────────────────────────────────────────

  const processFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    // Append new files (avoid duplicates by name)
    setEntries(prev => {
      const existing = new Set(prev.map(e => e.file.name));
      const fresh = files
        .filter(f => !existing.has(f.name))
        .map(f => ({ file: f, status: 'pending' as FileStatus }));
      return [...prev, ...fresh];
    });

    // Parse each new file, updating status as we go
    for (const file of files) {
      setEntries(prev => prev.map(e =>
        e.file.name === file.name ? { ...e, status: 'parsing' } : e
      ));

      const parsed = await parseFile(file, tags);

      setEntries(prev => prev.map(e =>
        e.file.name === file.name
          ? { ...e, status: parsed.error ? 'error' : 'done', parsed }
          : e
      ));
    }
  }, [tags]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(Array.from(e.target.files ?? []));
  };

  // ── Drag & drop ────────────────────────────────────────────────────────────

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    processFiles(Array.from(e.dataTransfer.files));
  };

  // ── Queue ──────────────────────────────────────────────────────────────────

  const readyEntries = entries.filter(e => e.status === 'done' && e.parsed && !e.parsed.error);

  const handleStartReview = () => {
    const items: ImportQueueItem[] = readyEntries.map(e => ({
      title:        e.parsed!.title,
      contentHtml:  e.parsed!.contentHtml,
      contentPlain: e.parsed!.contentPlain,
      date:         e.parsed!.date,
      tagIds:       e.parsed!.matchedTagIds,
    }));
    startImportQueue(items);
    onClose();
  };

  const removeEntry = (filename: string) => {
    setEntries(prev => prev.filter(e => e.file.name !== filename));
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const isParsing = entries.some(e => e.status === 'parsing' || e.status === 'pending');

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Import Dream Files</DialogTitle>
          <DialogDescription>
            Add .txt, .md, .docx, or .pdf files. Each opens in the editor pre-filled with its
            content and auto-matched tags — review and save one at a time.
          </DialogDescription>
        </DialogHeader>

        {/* Drop zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed',
            'px-6 py-8 cursor-pointer transition-colors select-none',
            isDragging
              ? 'border-primary bg-primary/10'
              : 'border-border hover:border-primary/50 hover:bg-muted/30',
          )}
        >
          <FolderOpen className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">Drop files here or click to browse</p>
          <p className="text-xs text-muted-foreground">.txt · .md · .docx · .pdf</p>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED}
            multiple
            className="hidden"
            onChange={handleFileInput}
          />
        </div>

        {/* File list */}
        {entries.length > 0 && (
          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            {entries.map(entry => (
              <FileRow
                key={entry.file.name}
                entry={entry}
                tags={tags}
                onRemove={() => removeEntry(entry.file.name)}
              />
            ))}
          </div>
        )}

        {/* Footer */}
        {entries.length > 0 && (
          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-muted-foreground">
              {readyEntries.length} of {entries.length} file{entries.length !== 1 ? 's' : ''} ready
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
              <Button
                size="sm"
                onClick={handleStartReview}
                disabled={readyEntries.length === 0 || isParsing}
                className="gap-1.5"
              >
                {isParsing
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <FolderOpen className="h-4 w-4" />
                }
                Start Review ({readyEntries.length})
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── FileRow sub-component ─────────────────────────────────────────────────────

function FileRow({
  entry,
  tags,
  onRemove,
}: {
  entry: FileEntry;
  tags: Tag[];
  onRemove: () => void;
}) {
  const { file, status, parsed } = entry;
  const matchedTags = (parsed?.matchedTagIds ?? [])
    .map(id => tags.find(t => t.id === id))
    .filter((t): t is Tag => t !== undefined);

  return (
    <div className="flex items-start gap-2 rounded-md border bg-card px-3 py-2">
      {/* Icon */}
      <span className="text-base mt-0.5 shrink-0">{extIcon(file.name)}</span>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{file.name}</p>

        {status === 'parsing' && (
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            <Loader2 className="h-3 w-3 animate-spin" /> Parsing…
          </p>
        )}

        {status === 'error' && (
          <p className="text-xs text-destructive flex items-center gap-1 mt-0.5">
            <AlertCircle className="h-3 w-3" />
            {parsed?.error ?? 'Failed to parse'}
          </p>
        )}

        {status === 'done' && parsed && (
          <div className="mt-0.5 space-y-1">
            <p className="text-xs text-muted-foreground truncate">
              <span className="text-foreground/70">{parsed.title}</span>
              <span className="mx-1">·</span>
              {parsed.date}
            </p>
            {matchedTags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                <TagIcon className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                {matchedTags.map((tag: Tag) => (
                  <Badge
                    key={tag.id}
                    variant="outline"
                    className="px-1.5 py-0 text-[10px] h-4"
                    style={{ borderColor: tag.color, color: tag.color }}
                  >
                    {tag.name}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Status / remove */}
      <div className="flex items-center gap-1 shrink-0 mt-0.5">
        {status === 'done' && !parsed?.error && (
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
        )}
        {status !== 'parsing' && (
          <button
            onClick={onRemove}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
