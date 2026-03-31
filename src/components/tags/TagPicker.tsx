import { useState, useMemo } from 'react';
import { Check, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TagBadge } from './TagBadge';
import { TagApplyDialog } from './TagApplyDialog';
import { cn, getCategoryColor } from '@/lib/utils';
import { findMatchingDreams } from '@/lib/tagUtils';
import { useTagStore } from '@/stores/tagStore';
import { useDreamStore } from '@/stores/dreamStore';
import type { Tag, TagCategory, Dream } from '@/lib/tauri';

interface TagPickerProps {
  selectedTags: Tag[];
  onTagsChange: (tags: Tag[]) => void;
}

const categories: { id: TagCategory; label: string }[] = [
  { id: 'location', label: 'Location' },
  { id: 'person', label: 'Person' },
  { id: 'symbolic', label: 'Symbolic' },
  { id: 'emotive', label: 'Emotive' },
  { id: 'custom', label: 'Custom' },
];

export function TagPicker({ selectedTags, onTagsChange }: TagPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [newTagCategory, setNewTagCategory] = useState<TagCategory>('custom');
  const { tags, createTag } = useTagStore();
  const { dreams, fetchDreams } = useDreamStore();

  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [pendingTag, setPendingTag] = useState<Tag | null>(null);
  const [matchingDreams, setMatchingDreams] = useState<Dream[]>([]);

  const filteredTags = useMemo(() => {
    if (!search) return tags;
    const lower = search.toLowerCase();
    return tags.filter(
      (t) =>
        t.name.toLowerCase().includes(lower) ||
        t.aliases.some((a) => a.toLowerCase().includes(lower)),
    );
  }, [tags, search]);

  const groupedTags = useMemo(() => {
    const groups: Record<TagCategory, Tag[]> = {
      location: [],
      person: [],
      symbolic: [],
      emotive: [],
      custom: [],
    };
    filteredTags.forEach((tag) => {
      groups[tag.category].push(tag);
    });
    return groups;
  }, [filteredTags]);

  const isSelected = (tag: Tag) => selectedTags.some((t) => t.id === tag.id);

  const toggleTag = (tag: Tag) => {
    if (isSelected(tag)) {
      onTagsChange(selectedTags.filter((t) => t.id !== tag.id));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
  };

  const handleCreateTag = async () => {
    if (!search.trim()) return;
    try {
      const newTag = await createTag({
        name: search.trim(),
        category: newTagCategory,
        color: getCategoryColor(newTagCategory),
        description: null,
        aliases: [],
      });
      onTagsChange([...selectedTags, newTag]);
      setSearch('');
      setOpen(false);

      // Ensure dreams are loaded, then scan for matches
      let currentDreams = dreams;
      if (currentDreams.length === 0) {
        await fetchDreams();
        currentDreams = useDreamStore.getState().dreams;
      }
      const matches = findMatchingDreams(newTag, currentDreams);
      if (matches.length > 0) {
        setMatchingDreams(matches);
        setPendingTag(newTag);
        setApplyDialogOpen(true);
      }
    } catch (error) {
      console.error('Failed to create tag:', error);
    }
  };

  const showCreateOption =
    search && !tags.some((t) => t.name.toLowerCase() === search.toLowerCase());

  return (
    <>
      <div className="space-y-2">
        {/* Selected tags */}
        <div className="flex flex-wrap gap-2 min-h-[32px]">
          {selectedTags.map((tag) => (
            <TagBadge key={tag.id} tag={tag} size="sm" onRemove={() => toggleTag(tag)} />
          ))}
        </div>

        {/* Picker button */}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Add tags
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            <div className="p-2 border-b">
              <Input
                placeholder="Search or create tag..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8"
              />
            </div>

            <ScrollArea className="h-64">
              <div className="p-2 space-y-4">
                {/* Create new tag option */}
                {showCreateOption && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground px-2">Create new tag</p>
                    <div className="flex gap-1 flex-wrap px-2">
                      {categories.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setNewTagCategory(cat.id)}
                          className={cn(
                            'px-2 py-1 text-xs rounded-md transition-colors',
                            newTagCategory === cat.id
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-secondary hover:bg-accent',
                          )}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>
                    <Button size="sm" className="w-full gap-2" onClick={handleCreateTag}>
                      <Plus className="h-4 w-4" />
                      Create "{search}"
                    </Button>
                  </div>
                )}

                {/* Existing tags by category */}
                {categories.map((category) => {
                  const categoryTags = groupedTags[category.id];
                  if (categoryTags.length === 0) return null;

                  return (
                    <div key={category.id}>
                      <p className="text-xs text-muted-foreground px-2 mb-1">{category.label}</p>
                      <div className="space-y-1">
                        {categoryTags.map((tag) => (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => toggleTag(tag)}
                            className={cn(
                              'flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm hover:bg-accent transition-colors',
                            )}
                          >
                            <span
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: tag.color }}
                            />
                            <span className="flex-1 text-left">{tag.name}</span>
                            {tag.aliases.length > 0 && (
                              <span className="text-xs text-muted-foreground truncate max-w-[80px]">
                                +{tag.aliases.length} alias{tag.aliases.length !== 1 ? 'es' : ''}
                              </span>
                            )}
                            {isSelected(tag) && (
                              <Check className="h-4 w-4 text-primary flex-shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
      </div>

      <TagApplyDialog
        open={applyDialogOpen}
        onOpenChange={setApplyDialogOpen}
        tag={pendingTag}
        matchingDreams={matchingDreams}
        onApplied={fetchDreams}
        variant="new"
      />
    </>
  );
}
