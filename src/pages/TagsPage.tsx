import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Search, Hash } from 'lucide-react';
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
import { TagApplyDialog } from '@/components/tags/TagApplyDialog';
import { useTagStore } from '@/stores/tagStore';
import { useDreamStore } from '@/stores/dreamStore';
import { getCategoryColor } from '@/lib/utils';
import { findMatchingDreams } from '@/lib/tagUtils';
import { getTagWordAssociations } from '@/lib/tauri';
import type { Tag, TagCategory, TagWordUsage, Dream } from '@/lib/tauri';

const categories: { id: TagCategory; label: string }[] = [
  { id: 'location', label: 'Locations' },
  { id: 'symbolic', label: 'Symbolic' },
  { id: 'emotive', label: 'Emotive' },
  { id: 'custom', label: 'Custom' },
  { id: 'person', label: 'Characters' },
];

const presetColors = [
  '#22c55e', '#3b82f6', '#a855f7', '#f43f5e', '#f59e0b',
  '#14b8a6', '#ec4899', '#8b5cf6', '#f97316', '#06b6d4',
  '#84cc16', '#de0615', '#d946ef', '#ef4444', '#eab308',
  '#10b981',
];

function parseAliasesInput(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const EMOTIVE_SUBCATEGORIES = [
  { id: 'positive', label: 'Positive', color: '#eab308' },
  { id: 'neutral', label: 'Neutral', color: '#f97316' },
  { id: 'negative', label: 'Negative', color: '#f43f5e' },
] as const;

export function TagsPage() {
  const { tags, fetchTags, createTag, updateTag, deleteTag } = useTagStore();
  const { dreams, fetchDreams } = useDreamStore();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<TagCategory>('location');
  const [activeEmotiveSubcategory, setActiveEmotiveSubcategory] = useState<string>('positive');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<TagCategory>('custom');
  const [emotiveSubcategory, setEmotiveSubcategory] = useState<string | null>(null);
  const [color, setColor] = useState('#de0615');
  const [description, setDescription] = useState('');
  const [aliases, setAliases] = useState('');
  const [wordAssociations, setWordAssociations] = useState<TagWordUsage[]>([]);
  const [loadingAssociations, setLoadingAssociations] = useState(false);

  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [pendingApplyTag, setPendingApplyTag] = useState<Tag | null>(null);
  const [matchingDreams, setMatchingDreams] = useState<Dream[]>([]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const filteredTags = tags.filter((tag) => {
    if (tag.category !== activeCategory) return false;
    if (activeCategory === 'emotive' && (tag.emotive_subcategory ?? 'negative') !== activeEmotiveSubcategory) return false;
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
      setEmotiveSubcategory(tag.emotive_subcategory ?? null);
      setColor(tag.color);
      setDescription(tag.description || '');
      setAliases(tag.aliases.join(', '));
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
      const initSubcat = activeCategory === 'emotive' ? activeEmotiveSubcategory : null;
      setEmotiveSubcategory(initSubcat);
      setColor(getCategoryColor(activeCategory, initSubcat));
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
        const oldTerms = new Set([
          editingTag.name.toLowerCase(),
          ...editingTag.aliases.map((a) => a.toLowerCase()),
        ]);
        const addedTerms = [name.trim(), ...parsedAliases]
          .map((s) => s.toLowerCase())
          .filter((t) => !oldTerms.has(t));

        const updatedTag = await updateTag({
          id: editingTag.id,
          name: name.trim(),
          category,
          color,
          description: description.trim() || null,
          aliases: parsedAliases,
          emotive_subcategory: category === 'emotive' ? emotiveSubcategory : null,
        });
        setIsEditorOpen(false);

        if (addedTerms.length > 0) {
          let currentDreams = dreams;
          if (currentDreams.length === 0) {
            await fetchDreams();
            currentDreams = useDreamStore.getState().dreams;
          }
          const matches = findMatchingDreams(updatedTag, currentDreams);
          if (matches.length > 0) {
            setMatchingDreams(matches);
            setPendingApplyTag(updatedTag);
            setApplyDialogOpen(true);
          }
        }
      } else {
        await createTag({
          name: name.trim(),
          category,
          color,
          description: description.trim() || null,
          aliases: parsedAliases,
          emotive_subcategory: category === 'emotive' ? emotiveSubcategory : null,
        });
        setIsEditorOpen(false);
      }
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
            placeholder="Search tags or aliases..."
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
            {/* Emotive sub-tabs */}
            {cat.id === 'emotive' && (
              <div className="flex gap-2 mb-4">
                {EMOTIVE_SUBCATEGORIES.map((sub) => (
                  <button
                    key={sub.id}
                    onClick={() => setActiveEmotiveSubcategory(sub.id)}
                    className="px-3 py-1 rounded-full text-xs font-medium border transition-all"
                    style={{
                      backgroundColor: activeEmotiveSubcategory === sub.id ? sub.color + '33' : 'transparent',
                      borderColor: sub.color,
                      color: sub.color,
                      fontWeight: activeEmotiveSubcategory === sub.id ? 700 : 400,
                    }}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>
            )}
            {filteredTags.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No tags in this category yet
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {filteredTags.map((tag) => (
                  <Card key={tag.id} className="flex flex-col min-h-[160px]">
                    <CardHeader className="pb-2 pt-3 px-3">
                      <div className="flex items-start justify-between gap-1">
                        <TagBadge tag={tag} />
                        <div className="flex gap-0.5 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEditor(tag)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => handleDelete(tag)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col justify-between px-3 pb-3">
                      <div className="space-y-2">
                        {tag.description && (
                          <p className="text-xs text-muted-foreground leading-snug line-clamp-2">
                            {tag.description}
                          </p>
                        )}
                        {tag.aliases.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                              <Hash className="h-2.5 w-2.5" />
                              Also matches
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {tag.aliases.map((alias) => (
                                <span
                                  key={alias}
                                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium"
                                  style={{
                                    backgroundColor: tag.color + '20',
                                    color: tag.color,
                                    border: `1px solid ${tag.color}40`,
                                  }}
                                >
                                  {alias}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-2">
                        {tag.usage_count} dream{tag.usage_count !== 1 ? 's' : ''}
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
                      const subcat = cat.id === 'emotive' ? (emotiveSubcategory ?? 'negative') : null;
                      setEmotiveSubcategory(subcat);
                      setColor(getCategoryColor(cat.id, subcat));
                    }}
                  >
                    {cat.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Emotive subcategory */}
            {category === 'emotive' && (
              <div className="space-y-2">
                <Label>Subcategory</Label>
                <div className="flex gap-2">
                  {EMOTIVE_SUBCATEGORIES.map((sub) => (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => {
                        setEmotiveSubcategory(sub.id);
                        setColor(sub.color);
                      }}
                      className="px-3 py-1 rounded-full text-xs font-medium border transition-all"
                      style={{
                        backgroundColor: emotiveSubcategory === sub.id ? sub.color + '33' : 'transparent',
                        borderColor: sub.color,
                        color: sub.color,
                        fontWeight: emotiveSubcategory === sub.id ? 700 : 400,
                      }}
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

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
                Comma-separated. Auto-match will apply this tag when any of these words appear.
                Adding new aliases will prompt you to apply to existing dreams.
              </p>
            </div>

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

      <TagApplyDialog
        open={applyDialogOpen}
        onOpenChange={setApplyDialogOpen}
        tag={pendingApplyTag}
        matchingDreams={matchingDreams}
        onApplied={fetchDreams}
        variant="updated"
      />
    </div>
  );
}
