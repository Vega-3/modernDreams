import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { TagBadge } from '@/components/tags/TagBadge';
import { useTagStore } from '@/stores/tagStore';
import { getCategoryColor } from '@/lib/utils';
import { getTagWordAssociations } from '@/lib/tauri';
import type { Tag, TagCategory, TagWordUsage } from '@/lib/tauri';

const categories: { id: TagCategory; label: string }[] = [
  { id: 'location', label: 'Locations' },
  { id: 'person', label: 'People' },
  { id: 'symbolic', label: 'Symbolic' },
  { id: 'emotive', label: 'Emotive' },
  { id: 'custom', label: 'Custom' },
];

const presetColors = [
  '#22c55e', '#3b82f6', '#a855f7', '#f43f5e', '#f59e0b',
  '#14b8a6', '#ec4899', '#8b5cf6', '#f97316', '#06b6d4',
  '#84cc16', '#6366f1', '#d946ef', '#ef4444', '#eab308',
  '#10b981',
];

/** Parse a comma-separated aliases string into a trimmed, non-empty array. */
function parseAliasesInput(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function TagsPage() {
  const { tags, fetchTags, createTag, updateTag, deleteTag } = useTagStore();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<TagCategory>('location');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<TagCategory>('custom');
  const [color, setColor] = useState('#6366f1');
  const [description, setDescription] = useState('');
  // Comma-separated in the UI; converted to/from string[] on save/load
  const [aliases, setAliases] = useState('');
  const [wordAssociations, setWordAssociations] = useState<TagWordUsage[]>([]);
  const [loadingAssociations, setLoadingAssociations] = useState(false);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const filteredTags = tags.filter((tag) => {
    if (tag.category !== activeCategory) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      tag.name.toLowerCase().includes(q) ||
      tag.aliases.some((a) => a.toLowerCase().includes(q))
    );
  });

  const openEditor = async (tag?: Tag) => {
    if (tag) {
      setEditingTag(tag);
      setName(tag.name);
      setCategory(tag.category);
      setColor(tag.color);
      setDescription(tag.description || '');
      setAliases(tag.aliases.join(', '));
      // Fetch word associations for this tag
      setLoadingAssociations(true);
      try {
        const assocs = await getTagWordAssociations(tag.id);
        setWordAssociations(assocs);
      } catch {
        setWordAssociations([]);
      } finally {
        setLoadingAssociations(false);
      }
    } else {
      setEditingTag(null);
      setName('');
      setCategory(activeCategory);
      setColor(getCategoryColor(activeCategory));
      setDescription('');
      setAliases('');
      setWordAssociations([]);
    }
    setIsEditorOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;

    const parsedAliases = parseAliasesInput(aliases);

    try {
      if (editingTag) {
        await updateTag({
          id: editingTag.id,
          name: name.trim(),
          category,
          color,
          description: description.trim() || null,
          aliases: parsedAliases,
        });
      } else {
        await createTag({
          name: name.trim(),
          category,
          color,
          description: description.trim() || null,
          aliases: parsedAliases,
        });
      }
      setIsEditorOpen(false);
    } catch (error) {
      console.error('Failed to save tag:', error);
    }
  };

  const handleDelete = async (tag: Tag) => {
    if (confirm(`Delete tag "${tag.name}"? This will remove it from all dreams.`)) {
      await deleteTag(tag.id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tags..."
            className="pl-9"
          />
        </div>
        <Button onClick={() => openEditor()}>
          <Plus className="h-4 w-4 mr-2" />
          New Tag
        </Button>
      </div>

      {/* Category tabs */}
      <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as TagCategory)}>
        <TabsList>
          {categories.map((cat) => (
            <TabsTrigger key={cat.id} value={cat.id}>
              {cat.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {categories.map((cat) => (
          <TabsContent key={cat.id} value={cat.id} className="mt-4">
            {filteredTags.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No tags in this category yet
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredTags.map((tag) => (
                  <Card key={tag.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <TagBadge tag={tag} />
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditor(tag)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleDelete(tag)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {tag.description && (
                        <p className="text-sm text-muted-foreground mb-2">{tag.description}</p>
                      )}
                      {tag.aliases.length > 0 && (
                        <p className="text-xs text-muted-foreground mb-2">
                          Also matches:{' '}
                          <span className="italic">{tag.aliases.join(', ')}</span>
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Used in {tag.usage_count} dream{tag.usage_count !== 1 ? 's' : ''}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Tag editor dialog */}
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTag ? 'Edit Tag' : 'New Tag'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tag-name">Name</Label>
              <Input
                id="tag-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter tag name..."
              />
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <Button
                    key={cat.id}
                    variant={category === cat.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setCategory(cat.id);
                      setColor(getCategoryColor(cat.id));
                    }}
                  >
                    {cat.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {presetColors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className="w-8 h-8 rounded-md border-2 transition-all"
                    style={{
                      backgroundColor: c,
                      borderColor: color === c ? 'white' : 'transparent',
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tag-desc">Description (optional)</Label>
              <Input
                id="tag-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this tag represent?"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tag-aliases">Alternative words (optional)</Label>
              <Input
                id="tag-aliases"
                value={aliases}
                onChange={(e) => setAliases(e.target.value)}
                placeholder="e.g. flying, levitate, hover"
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated. The auto-match button in the dream editor will apply this tag when
                any of these words appear in the dream text.
              </p>
            </div>

            {/* Associated words (only shown when editing an existing tag) */}
            {editingTag && (
              <div className="space-y-2 border-t pt-4">
                <Label>Associated words in dreams</Label>
                {loadingAssociations ? (
                  <p className="text-xs text-muted-foreground">Loading...</p>
                ) : wordAssociations.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No words tagged yet. Select text in the dream editor and click this tag to
                    associate words.
                  </p>
                ) : (
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {wordAssociations.map((assoc, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span
                          className="font-medium px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor: editingTag.color + '26',
                            color: editingTag.color,
                          }}
                        >
                          {assoc.word}
                        </span>
                        <span className="text-muted-foreground truncate ml-2">
                          {assoc.dream_title}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditorOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!name.trim()}>
              {editingTag ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
