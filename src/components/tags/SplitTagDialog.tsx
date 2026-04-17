import { useState, useEffect, useId } from 'react';
import { Plus, Scissors, Trash2, CheckCircle2, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getTagWordAssociations, getDream, updateDream } from '@/lib/tauri';
import type { Tag, WordTagAssociation } from '@/lib/tauri';
import { useTagStore } from '@/stores/tagStore';
import { useDreamStore } from '@/stores/dreamStore';

const ARCHETYPE_TAG_PREFIX = 'arch:';

const PRESET_COLORS = [
  '#22c55e', '#3b82f6', '#a855f7', '#f43f5e', '#f59e0b',
  '#14b8a6', '#ec4899', '#8b5cf6', '#f97316', '#06b6d4',
  '#84cc16', '#de0615', '#d946ef', '#ef4444', '#eab308',
  '#10b981',
];

interface SubTagDraft {
  localId: string;
  name: string;
  color: string;
}

interface SplitTagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tag: Tag | null;
  onSplit: () => void;
}

// ── HTML helpers ────────────────────────────────────────────────────────────────

/**
 * Walk the dream HTML, find every span that references `originalTagId`,
 * and either:
 *  - replace it with the sub-tag that owns the span's word, or
 *  - drop the reference (deleteOriginal && no sub-tag owns the word), or
 *  - keep it unchanged (keep original && no sub-tag owns the word).
 *
 * Returns the updated HTML and the re-extracted word-tag associations.
 */
function updateTagRefsInHtml(
  html: string,
  originalTag: Tag,
  wordToSubTag: Map<string, Tag>,
  deleteOriginal: boolean,
): { newHtml: string; associations: WordTagAssociation[] } {
  const parsed = new DOMParser().parseFromString(html, 'text/html');

  for (const span of Array.from(parsed.querySelectorAll('span[data-tags]'))) {
    const raw = span.getAttribute('data-tags');
    if (!raw) continue;
    try {
      const refs: Array<{ tagId: string; tagColor: string; tagName: string }> = JSON.parse(raw);
      if (!refs.some((r) => r.tagId === originalTag.id)) continue;

      const spanWord = (span.textContent ?? '').trim().toLowerCase();
      const subTag = wordToSubTag.get(spanWord);

      let newRefs = refs.filter((r) => r.tagId !== originalTag.id);

      if (subTag) {
        newRefs = [...newRefs, { tagId: subTag.id, tagColor: subTag.color, tagName: subTag.name }];
      } else if (!deleteOriginal) {
        newRefs = refs; // restore original — word is unassigned and we keep the tag
      }
      // deleteOriginal && no subTag → newRefs already excludes original

      if (newRefs.length === 0) {
        span.parentNode?.replaceChild(parsed.createTextNode(span.textContent ?? ''), span);
      } else {
        span.setAttribute('data-tags', JSON.stringify(newRefs));
      }
    } catch {
      /* malformed JSON — skip */
    }
  }

  // Re-extract associations from modified DOM.
  const associations: WordTagAssociation[] = [];
  const seen = new Set<string>();
  let paragraphIndex = 0;
  for (const block of Array.from(parsed.body.children)) {
    for (const span of Array.from(block.querySelectorAll('span[data-tags]'))) {
      const raw = span.getAttribute('data-tags');
      const source = (span.getAttribute('data-source') ?? 'manual') as 'manual' | 'auto';
      const spanWord = (span.textContent ?? '').trim();
      if (!raw || !spanWord) continue;
      try {
        const refs: Array<{ tagId: string }> = JSON.parse(raw);
        for (const { tagId } of refs) {
          if (tagId.startsWith(ARCHETYPE_TAG_PREFIX)) continue;
          const key = `${tagId}:${spanWord.toLowerCase()}:${paragraphIndex}:${source}`;
          if (!seen.has(key)) {
            seen.add(key);
            associations.push({ tag_id: tagId, word: spanWord, paragraph_index: paragraphIndex, source });
          }
        }
      } catch { /* ignore */ }
    }
    paragraphIndex++;
  }

  return { newHtml: parsed.body.innerHTML, associations };
}

// ── Component ───────────────────────────────────────────────────────────────────

export function SplitTagDialog({ open, onOpenChange, tag, onSplit }: SplitTagDialogProps) {
  const uid = useId();
  const { createTag, deleteTag, fetchTags } = useTagStore();
  const { dreams, fetchDreams } = useDreamStore();

  const [loadingAssocs, setLoadingAssocs] = useState(false);

  // Unique words: lowercase word → set of dream IDs that use it
  const [wordIndex, setWordIndex] = useState<Map<string, Set<string>>>(new Map());

  const [subTags, setSubTags] = useState<SubTagDraft[]>([]);
  // word (lowercase) → localId of the sub-tag it's assigned to
  const [assignments, setAssignments] = useState<Map<string, string>>(new Map());
  // which sub-tag card is "active" for click-to-assign
  const [activeSubTagId, setActiveSubTagId] = useState<string | null>(null);

  const [deleteOriginal, setDeleteOriginal] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Fetch word associations whenever the tag changes.
  useEffect(() => {
    if (!open || !tag) return;
    setWordIndex(new Map());
    setSubTags([]);
    setAssignments(new Map());
    setActiveSubTagId(null);
    setDeleteOriginal(false);
    setApplyError(null);
    setDone(false);

    setLoadingAssocs(true);
    getTagWordAssociations(tag.id)
      .then((assocs) => {
        // Build word → dream-ID set index
        const idx = new Map<string, Set<string>>();
        for (const a of assocs) {
          const w = a.word.toLowerCase();
          if (!idx.has(w)) idx.set(w, new Set());
          idx.get(w)!.add(a.dream_id);
        }
        setWordIndex(idx);
      })
      .catch(() => {})
      .finally(() => setLoadingAssocs(false));
  }, [open, tag]);

  const addSubTag = () => {
    const localId = `${uid}-${Date.now()}`;
    const color = PRESET_COLORS[subTags.length % PRESET_COLORS.length];
    const newSt: SubTagDraft = { localId, name: '', color };
    setSubTags((prev) => [...prev, newSt]);
    setActiveSubTagId(localId);
  };

  const removeSubTag = (localId: string) => {
    setSubTags((prev) => prev.filter((s) => s.localId !== localId));
    setAssignments((prev) => {
      const next = new Map(prev);
      for (const [w, sid] of next) {
        if (sid === localId) next.delete(w);
      }
      return next;
    });
    if (activeSubTagId === localId) {
      setActiveSubTagId(null);
    }
  };

  const toggleWordAssignment = (word: string) => {
    if (!activeSubTagId) return;
    setAssignments((prev) => {
      const next = new Map(prev);
      if (next.get(word) === activeSubTagId) {
        // Clicking an already-assigned word from active sub-tag unassigns it
        next.delete(word);
      } else {
        next.set(word, activeSubTagId);
      }
      return next;
    });
  };

  const wordsForSubTag = (localId: string): string[] =>
    Array.from(assignments.entries())
      .filter(([, sid]) => sid === localId)
      .map(([w]) => w);

  const canApply = subTags.length > 0 && subTags.every((s) => s.name.trim());

  const handleApply = async () => {
    if (!tag || !canApply) return;
    setIsApplying(true);
    setApplyError(null);

    try {
      // 1. Create new sub-tags in order. Use the assigned words as aliases.
      const localIdToCreated = new Map<string, Tag>();
      for (const st of subTags) {
        const stWords = wordsForSubTag(st.localId);
        const aliases = stWords.filter((w) => w.toLowerCase() !== st.name.trim().toLowerCase());
        const created = await createTag({
          name: st.name.trim(),
          category: tag.category,
          color: st.color,
          description: null,
          aliases,
          emotive_subcategory: tag.emotive_subcategory,
        });
        localIdToCreated.set(st.localId, created);
      }

      // 2. Build word (lowercase) → created Tag lookup
      const wordToSubTag = new Map<string, Tag>();
      for (const [word, localId] of assignments) {
        const ct = localIdToCreated.get(localId);
        if (ct) wordToSubTag.set(word, ct);
      }

      // 3. Load all dreams if needed, then find those with the original tag.
      let currentDreams = dreams;
      if (currentDreams.length === 0) {
        await fetchDreams();
        currentDreams = useDreamStore.getState().dreams;
      }
      const dreamsWithTag = currentDreams.filter((d) => d.tags.some((t) => t.id === tag.id));

      // 4. Update each dream.
      for (const summary of dreamsWithTag) {
        const dream = await getDream(summary.id);
        if (!dream) continue;

        // Determine which created sub-tags apply to this dream.
        const applicableSubTags: Tag[] = [];
        for (const st of subTags) {
          const ct = localIdToCreated.get(st.localId);
          if (!ct) continue;
          const stWords = [ct.name, ...ct.aliases];
          const applies = stWords.some((w) =>
            dream.content_plain.toLowerCase().includes(w.toLowerCase()),
          );
          if (applies) applicableSubTags.push(ct);
        }

        // Update inline HTML references.
        const { newHtml, associations: newAssocs } = updateTagRefsInHtml(
          dream.content_html,
          tag,
          wordToSubTag,
          deleteOriginal,
        );

        // Build new tag-ID list.
        let newTagIds = dream.tags.map((t) => t.id);
        if (deleteOriginal) {
          newTagIds = newTagIds.filter((id) => id !== tag.id);
        }
        for (const ct of applicableSubTags) {
          if (!newTagIds.includes(ct.id)) newTagIds.push(ct.id);
        }

        await updateDream({
          id: dream.id,
          title: dream.title,
          content_html: newHtml,
          content_plain: dream.content_plain,
          dream_date: dream.dream_date,
          is_lucid: dream.is_lucid,
          mood_rating: dream.mood_rating,
          clarity_rating: dream.clarity_rating,
          meaningfulness_rating: dream.meaningfulness_rating,
          waking_life_context: dream.waking_life_context,
          analysis_notes: dream.analysis_notes,
          tag_ids: newTagIds,
          word_tag_associations: newAssocs,
        });
      }

      // 5. Optionally delete the original tag.
      if (deleteOriginal) {
        await deleteTag(tag.id);
      }

      // 6. Refresh stores and close.
      await Promise.all([fetchTags(), fetchDreams()]);
      setDone(true);
      setTimeout(() => {
        onSplit();
        onOpenChange(false);
      }, 800);
    } catch (e) {
      console.error('Split failed:', e);
      setApplyError('Something went wrong while splitting the tag. Please try again.');
    } finally {
      setIsApplying(false);
    }
  };

  const sortedWords = Array.from(wordIndex.entries()).sort(
    (a, b) => b[1].size - a[1].size, // most-used first
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scissors className="h-4 w-4" />
            Split tag
            {tag && (
              <span
                className="ml-1 px-2 py-0.5 rounded text-sm font-semibold"
                style={{ backgroundColor: tag.color + '30', color: tag.color }}
              >
                {tag.name}
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            Group the words tagged in dreams into more specific sub-categories. Each group
            becomes a new tag and is applied to the dreams where those words appear.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-2 space-y-5">
          {/* ── Words panel ── */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Words tagged in dreams
              {sortedWords.length > 0 && (
                <span className="ml-1 font-normal">
                  — click a word to assign it to the selected sub-category
                </span>
              )}
            </Label>

            {loadingAssocs ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : sortedWords.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No words have been tagged inline for this tag yet. Inline-tag some words in the
                dream editor first, or use "Promote to inline tag" in the tag editor.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5 p-3 rounded-lg border bg-muted/30 min-h-[56px]">
                {sortedWords.map(([word, dreamIds]) => {
                  const assignedTo = assignments.get(word);
                  const ownerSubTag = subTags.find((s) => s.localId === assignedTo);
                  const isActiveOwner = assignedTo === activeSubTagId;

                  return (
                    <button
                      key={word}
                      type="button"
                      onClick={() => toggleWordAssignment(word)}
                      disabled={!activeSubTagId}
                      title={
                        ownerSubTag
                          ? `Assigned to "${ownerSubTag.name || 'unnamed'}"`
                          : activeSubTagId
                          ? 'Click to assign to selected sub-category'
                          : 'Select a sub-category first'
                      }
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border transition-all
                        disabled:cursor-not-allowed disabled:opacity-50
                        hover:enabled:scale-105 active:enabled:scale-95"
                      style={
                        ownerSubTag
                          ? {
                              backgroundColor: ownerSubTag.color + '30',
                              borderColor: ownerSubTag.color + (isActiveOwner ? 'cc' : '60'),
                              color: ownerSubTag.color,
                              outline: isActiveOwner ? `2px solid ${ownerSubTag.color}` : undefined,
                              outlineOffset: isActiveOwner ? '1px' : undefined,
                            }
                          : {
                              backgroundColor: 'transparent',
                              borderColor: 'hsl(var(--border))',
                              color: 'hsl(var(--foreground))',
                            }
                      }
                    >
                      {word}
                      <span className="opacity-60 text-[10px]">×{dreamIds.size}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Sub-categories panel ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Sub-categories to create
              </Label>
              <Button variant="outline" size="sm" onClick={addSubTag} className="h-7 text-xs gap-1">
                <Plus className="h-3 w-3" />
                Add sub-category
              </Button>
            </div>

            {subTags.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Click "Add sub-category" to start grouping the words above.
              </p>
            ) : (
              <div className="space-y-2">
                {subTags.map((st, idx) => {
                  const stWords = wordsForSubTag(st.localId);
                  const isActive = activeSubTagId === st.localId;
                  return (
                    <div
                      key={st.localId}
                      onClick={() => setActiveSubTagId(isActive ? null : st.localId)}
                      className="rounded-lg border p-3 cursor-pointer transition-all space-y-2"
                      style={{
                        borderColor: isActive ? st.color : undefined,
                        backgroundColor: isActive ? st.color + '10' : undefined,
                        outline: isActive ? `2px solid ${st.color}` : undefined,
                        outlineOffset: '1px',
                      }}
                    >
                      <div className="flex items-center gap-2">
                        {/* Color swatches */}
                        <div className="flex flex-wrap gap-1 shrink-0">
                          {PRESET_COLORS.slice(0, 8).map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSubTags((prev) =>
                                  prev.map((s) => (s.localId === st.localId ? { ...s, color: c } : s)),
                                );
                              }}
                              className="w-4 h-4 rounded-sm border-2 transition-all shrink-0"
                              style={{
                                backgroundColor: c,
                                borderColor: st.color === c ? 'white' : 'transparent',
                              }}
                            />
                          ))}
                        </div>

                        <Input
                          value={st.name}
                          onChange={(e) => {
                            e.stopPropagation();
                            setSubTags((prev) =>
                              prev.map((s) =>
                                s.localId === st.localId ? { ...s, name: e.target.value } : s,
                              ),
                            );
                          }}
                          onClick={(e) => e.stopPropagation()}
                          placeholder={`Sub-category ${idx + 1} name…`}
                          className="h-7 text-xs flex-1"
                        />

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeSubTag(st.localId);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      {/* Assigned words */}
                      {stWords.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {stWords.map((w) => (
                            <span
                              key={w}
                              className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                              style={{ backgroundColor: st.color + '25', color: st.color }}
                            >
                              {w}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-muted-foreground">
                          {isActive
                            ? 'Click words above to assign them here.'
                            : 'No words assigned — click this card to select it, then click words.'}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Options ── */}
          {subTags.length > 0 && (
            <div className="rounded-lg border p-3 space-y-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={deleteOriginal}
                  onChange={(e) => setDeleteOriginal(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">Remove original tag after splitting</span>
              </label>
              <p className="text-xs text-muted-foreground ml-5">
                If checked, the original "{tag?.name}" tag is deleted from all dreams and from the
                library. Dreams that don't match any sub-category will simply lose the original tag.
              </p>
            </div>
          )}

          {applyError && (
            <p className="text-xs text-destructive">{applyError}</p>
          )}
        </div>

        <DialogFooter className="pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isApplying}>
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            disabled={!canApply || isApplying || done}
            className="gap-1.5"
          >
            {done ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Done
              </>
            ) : isApplying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Applying…
              </>
            ) : (
              <>
                <Scissors className="h-4 w-4" />
                Apply Split
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
