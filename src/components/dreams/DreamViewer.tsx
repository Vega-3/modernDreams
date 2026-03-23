import { Sparkles, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { TagBadge } from '@/components/tags/TagBadge';
import type { Dream } from '@/lib/tauri';

interface DreamViewerProps {
  dream: Dream;
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
}

export function DreamViewer({ dream, open, onClose, onEdit }: DreamViewerProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle className="text-xl">{dream.title}</DialogTitle>
            {dream.is_lucid && <Sparkles className="h-5 w-5 text-primary flex-shrink-0" />}
          </div>
          <p className="text-sm text-muted-foreground">
            {format(new Date(dream.dream_date), 'EEEE, MMMM d, yyyy')}
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Tags */}
          {dream.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {dream.tags.map((tag) => (
                <TagBadge key={tag.id} tag={tag} />
              ))}
            </div>
          )}

          {/* Dream content with inline highlights */}
          <div
            className="tiptap prose dark:prose-invert max-w-none text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: dream.content_html }}
          />

          {/* Waking life context */}
          {dream.waking_life_context && (
            <div className="border-t pt-4 space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Waking Life Context
              </p>
              <p className="text-sm text-muted-foreground italic">{dream.waking_life_context}</p>
            </div>
          )}

          {/* Ratings */}
          {(dream.mood_rating || dream.clarity_rating) && (
            <div className="flex gap-4 text-xs text-muted-foreground border-t pt-3">
              {dream.mood_rating && <span>Mood: {dream.mood_rating}/10</span>}
              {dream.clarity_rating && <span>Clarity: {dream.clarity_rating}/10</span>}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={onEdit}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
