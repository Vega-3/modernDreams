import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { applyTagToDreams } from '@/lib/tagUtils';
import type { Tag, Dream } from '@/lib/tauri';

interface TagApplyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tag: Tag | null;
  matchingDreams: Dream[];
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
      setSelectedIds(new Set(matchingDreams.map((d) => d.id)));
      setIsApplying(false);
    }
  }, [open, matchingDreams]);

  const toggle = (dreamId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(dreamId)) next.delete(dreamId);
      else next.add(dreamId);
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
          <div className="space-y-1 max-h-60 overflow-y-auto border rounded-md p-2">
            {matchingDreams.map((dream) => (
              <label
                key={dream.id}
                className="flex items-center gap-2 py-1 px-1 rounded hover:bg-accent cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(dream.id)}
                  onChange={() => toggle(dream.id)}
                  className="rounded"
                />
                <span className="text-sm flex-1">{dream.title}</span>
                <span className="text-xs text-muted-foreground">{dream.dream_date}</span>
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
