import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { applyTagToDreams, type DreamMatch } from '@/lib/tagUtils';
import type { Tag } from '@/lib/tauri';

interface TagApplyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tag: Tag | null;
  matchingDreams: DreamMatch[];
  /** Called after a successful apply so the parent can refresh dream state. */
  onApplied: () => Promise<void>;
  /** Heading variant: 'new' for freshly created tags, 'updated' for edits. */
  variant?: 'new' | 'updated';
}

export function TagApplyDialog({
  open,
  onOpenChange,
  tag,
  matchingDreams,
  onApplied,
  variant = 'new',
}: TagApplyDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isApplying, setIsApplying] = useState(false);

  // Re-initialise selection (all selected) whenever the dialog opens
  useEffect(() => {
    if (open) {
      setSelectedIds(new Set(matchingDreams.map((m) => m.dream.id)));
      setIsApplying(false);
    }
  }, [open, matchingDreams]);

  const toggle = (dreamId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(dreamId)) next.delete(dreamId); else next.add(dreamId);
      return next;
    });
  };

  const handleApply = async () => {
    if (!tag) return;
    setIsApplying(true);
    try {
      await applyTagToDreams(selectedIds, matchingDreams, tag.id);
      await onApplied();
    } catch (error) {
      console.error('Failed to apply tag to dreams:', error);
    } finally {
      setIsApplying(false);
      onOpenChange(false);
    }
  };

  const title =
    variant === 'updated'
      ? 'Apply updated tag to existing dreams?'
      : 'Apply tag to existing dreams?';

  const description =
    variant === 'updated'
      ? `The tag "${tag?.name}" (including its aliases) now matches ${matchingDreams.length} dream${matchingDreams.length !== 1 ? 's' : ''} that don't have it yet. Select which to update:`
      : `The tag "${tag?.name}" matches text in ${matchingDreams.length} existing dream${matchingDreams.length !== 1 ? 's' : ''}. Select the ones you'd like to tag:`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">{description}</p>
          <div className="space-y-1 max-h-72 overflow-y-auto border rounded-md p-2">
            {matchingDreams.map((m) => (
              <label
                key={m.dream.id}
                className="flex items-start gap-2 py-1.5 px-1 rounded hover:bg-accent cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(m.dream.id)}
                  onChange={() => toggle(m.dream.id)}
                  className="rounded mt-0.5 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium truncate">{m.dream.title}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{m.dream.dream_date}</span>
                  </div>
                  {m.snippet && (
                    <SnippetText snippet={m.snippet} term={m.matchedTerm} />
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Skip
          </Button>
          <Button onClick={handleApply} disabled={isApplying || selectedIds.size === 0}>
            {isApplying
              ? 'Applying…'
              : `Apply to ${selectedIds.size} dream${selectedIds.size !== 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Snippet renderer ──────────────────────────────────────────────────────────

/**
 * Renders the snippet with the matched term highlighted.
 * Splits on the first case-insensitive occurrence to preserve original casing.
 */
function SnippetText({ snippet, term }: { snippet: string; term: string }) {
  const idx = snippet.toLowerCase().indexOf(term.toLowerCase());
  if (idx === -1) {
    return <p className="text-xs text-muted-foreground italic mt-0.5 truncate">{snippet}</p>;
  }

  const before = snippet.slice(0, idx);
  const match  = snippet.slice(idx, idx + term.length);
  const after  = snippet.slice(idx + term.length);

  return (
    <p className="text-xs text-muted-foreground italic mt-0.5 truncate">
      {before}
      <mark className="not-italic bg-primary/20 text-foreground rounded-sm px-0.5">
        {match}
      </mark>
      {after}
    </p>
  );
}
