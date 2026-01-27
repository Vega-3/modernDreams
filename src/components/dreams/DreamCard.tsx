import { Sparkles, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TagBadge } from '@/components/tags/TagBadge';
import { truncateText } from '@/lib/utils';
import { useUIStore } from '@/stores/uiStore';
import { useDreamStore } from '@/stores/dreamStore';
import type { Dream } from '@/lib/tauri';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';

// Inline dropdown menu components
const DropdownMenuRoot = DropdownMenuPrimitive.Root;
const DropdownMenuTriggerPrimitive = DropdownMenuPrimitive.Trigger;
const DropdownMenuContentPrimitive = DropdownMenuPrimitive.Content;
const DropdownMenuItemPrimitive = DropdownMenuPrimitive.Item;

interface DreamCardProps {
  dream: Dream;
}

export function DreamCard({ dream }: DreamCardProps) {
  const { openEditor } = useUIStore();
  const { deleteDream } = useDreamStore();

  const handleEdit = () => {
    openEditor(dream.id);
  };

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this dream?')) {
      await deleteDream(dream.id);
    }
  };

  return (
    <Card className="hover:bg-accent/50 transition-colors cursor-pointer" onClick={handleEdit}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg">{dream.title}</h3>
              {dream.is_lucid && <Sparkles className="h-4 w-4 text-primary" />}
            </div>
            <p className="text-sm text-muted-foreground">
              {format(new Date(dream.dream_date), 'EEEE, MMMM d, yyyy')}
            </p>
          </div>

          <DropdownMenuRoot>
            <DropdownMenuTriggerPrimitive asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTriggerPrimitive>
            <DropdownMenuContentPrimitive
              className="z-50 min-w-[8rem] rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
              align="end"
            >
              <DropdownMenuItemPrimitive
                className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer rounded-sm hover:bg-accent focus:bg-accent outline-none"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEdit();
                }}
              >
                <Pencil className="h-4 w-4" />
                Edit
              </DropdownMenuItemPrimitive>
              <DropdownMenuItemPrimitive
                className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer rounded-sm hover:bg-accent focus:bg-accent outline-none text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete();
                }}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </DropdownMenuItemPrimitive>
            </DropdownMenuContentPrimitive>
          </DropdownMenuRoot>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <p className="text-muted-foreground text-sm">{truncateText(dream.content_plain, 200)}</p>

        {dream.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {dream.tags.slice(0, 5).map((tag) => (
              <TagBadge key={tag.id} tag={tag} size="sm" />
            ))}
            {dream.tags.length > 5 && (
              <span className="text-xs text-muted-foreground self-center">
                +{dream.tags.length - 5} more
              </span>
            )}
          </div>
        )}

        {(dream.mood_rating || dream.clarity_rating) && (
          <div className="flex gap-4 text-xs text-muted-foreground">
            {dream.mood_rating && <span>Mood: {dream.mood_rating}/10</span>}
            {dream.clarity_rating && <span>Clarity: {dream.clarity_rating}/10</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
