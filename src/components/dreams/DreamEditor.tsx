import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import { Extension, InputRule } from '@tiptap/core';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Undo,
  Redo,
  Sparkles,
  Wand2,
  ImagePlus,
  X,
  Brain,
  Tags,
} from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { TagPicker } from '@/components/tags/TagPicker';
import { TagHighlight, TAG_HIGHLIGHT } from './TagHighlightExtension';
import type { TagRef, MarkSource } from './TagHighlightExtension';
import { cn, sortByName } from '@/lib/utils';
import { useDreamStore } from '@/stores/dreamStore';
import { useUIStore } from '@/stores/uiStore';
import { useTagStore } from '@/stores/tagStore';
import { useArchetypeStore } from '@/stores/archetypeStore';
import { useAnalystStore, clientPrefix } from '@/stores/analystStore';
import type { Tag, WordTagAssociation } from '@/lib/tauri';
import { analyzeDream, aiTagDream } from '@/lib/tauri';
import type { Editor } from '@tiptap/core';

const DRAFT_KEY = 'dreams_new_dream_draft';
const getEditBackupKey = (id: string) => `dreams_edit_backup_${id}`;

/**
 * TipTap Extension that converts [[tag_name]] typed inline into a TagHighlight
 * mark. Uses a ref so the tag list is always current without recreating the editor.
 */
function makeInlineTagExtension(allTagsRef: React.MutableRefObject<Tag[]>) {
  return Extension.create({
    name: 'inlineTagInput',
    addInputRules() {
      const markName = TAG_HIGHLIGHT;
      return [
        new InputRule({
          find: /\[\[([^\]]+)\]\]$/,
          handler({ state, range, match }) {
            const tagName = match[1]?.trim();
            if (!tagName) return;
            const tag = allTagsRef.current.find(
              (t) => t.name.toLowerCase() === tagName.toLowerCase(),
            );
            if (!tag) return;
            const markType = state.schema.marks[markName];
            if (!markType) return;
            const { tr } = state;
            tr.replaceWith(range.from, range.to, state.schema.text(tag.name));
            tr.addMark(
              range.from,
              range.from + tag.name.length,
              markType.create({
                tags: [{ tagId: tag.id, tagColor: tag.color, tagName: tag.name }],
                source: 'manual',
              }),
            );
            tr.removeStoredMark(markType);
            // Dispatch is handled by TipTap's InputRule system
          },
        }),
      ];
    },
  });
}

// Prefix used to store archetype refs in the tagHighlight mark alongside regular tags.
// Must be filtered out when extracting word-tag associations (see extractWordTagAssociations).
const ARCHETYPE_TAG_PREFIX = 'arch:';

interface EditorDraft {
  title: string;
  dreamDate: string;
  isLucid: boolean;
  moodRating: number | null;
  clarityRating: number | null;
  meaningfulnessRating: number | null;
  selectedTagIds: string[];
  wakingLifeContext: string;
  contentHtml: string;
  savedAt: string;
}


function extractWordTagAssociations(editor: Editor): WordTagAssociation[] {
  const associations: WordTagAssociation[] = [];
  const seen = new Set<string>();
  let paragraphIndex = 0;
  editor.state.doc.forEach((blockNode) => {
    blockNode.descendants((node) => {
      if (!node.isText) return;
      node.marks.forEach((mark) => {
        if (mark.type.name === TAG_HIGHLIGHT && node.text) {
          const source = (mark.attrs.source as MarkSource) ?? 'manual';
          const word = node.text.trim();
          if (!word) return;
          const tags: TagRef[] = mark.attrs.tags ?? [];
          tags.forEach(({ tagId }) => {
            if (tagId && !tagId.startsWith(ARCHETYPE_TAG_PREFIX)) {
              const key = `${tagId}:${word.toLowerCase()}:${paragraphIndex}:${source}`;
              if (!seen.has(key)) {
                seen.add(key);
                associations.push({ tag_id: tagId, word, paragraph_index: paragraphIndex, source });
              }
            }
          });
        }
      });
    });
    paragraphIndex++;
  });
  return associations;
}

/**
 * TipTap command that removes one tag from all tagHighlight marks in [from, to].
 * Pass from=0, to=doc.content.size to operate on the whole document.
 *
 * Using the command API (not editor.view.dispatch) keeps the transaction inside
 * TipTap's reconciliation layer and prevents uncaught errors in React's cycle.
 */
function makeRemoveTagCommand(tagId: string, from: number, to: number) {
  return ({ tr, state }: { tr: import('@tiptap/pm/state').Transaction; state: import('@tiptap/pm/state').EditorState }) => {
    const markType = state.schema.marks[TAG_HIGHLIGHT];
    if (!markType) return false;

    let changed = false;
    state.doc.nodesBetween(from, to, (node, pos) => {
      if (!node.isText) return;
      node.marks.forEach((mark) => {
        if (mark.type !== markType) return;
        const existingTags: TagRef[] = mark.attrs.tags ?? [];
        if (!existingTags.some((t) => t.tagId === tagId)) return;

        const newTags = existingTags.filter((t) => t.tagId !== tagId);
        tr.removeMark(pos, pos + node.nodeSize, markType);
        if (newTags.length > 0) {
          tr.addMark(pos, pos + node.nodeSize, markType.create({ ...mark.attrs, tags: newTags }));
        }
        changed = true;
      });
    });

    return changed;
  };
}

/**
 * TipTap command that removes a tag from the single highlighted span nearest to
 * `nearPos`.  This is used for the hover-X button: posAtDOM can give slightly
 * inexact positions for mark-rendered spans, so searching for the closest node
 * is more reliable than a strict nodesBetween(from, to) range check.
 */
function makeRemoveTagAtSpanCommand(tagId: string, nearPos: number) {
  return ({ tr, state }: { tr: import('@tiptap/pm/state').Transaction; state: import('@tiptap/pm/state').EditorState }) => {
    const markType = state.schema.marks[TAG_HIGHLIGHT];
    if (!markType) return false;

    // Find the text node with this tagId that is closest to nearPos.
    type BestMatch = { pos: number; nodeSize: number; attrs: Record<string, unknown> };
    let bestMatch: BestMatch | null = null;
    let bestDist = Infinity;

    state.doc.descendants((node, pos) => {
      if (!node.isText) return;
      node.marks.forEach((mark) => {
        if (mark.type !== markType) return;
        const tags: TagRef[] = (mark.attrs.tags as TagRef[]) ?? [];
        if (!tags.some((t) => t.tagId === tagId)) return;
        // Distance: how far the nearest edge of [pos, pos+size] is from nearPos.
        const dist = Math.max(0, pos - nearPos, nearPos - (pos + node.nodeSize));
        if (dist < bestDist) {
          bestDist = dist;
          bestMatch = { pos, nodeSize: node.nodeSize, attrs: mark.attrs as Record<string, unknown> };
        }
      });
    });

    if (!bestMatch) return false;
    const { pos: bestPos, nodeSize: bestNodeSize, attrs: bestAttrs } = bestMatch as BestMatch;

    const existingTags: TagRef[] = (bestAttrs.tags as TagRef[]) ?? [];
    const newTags = existingTags.filter((t) => t.tagId !== tagId);
    tr.removeMark(bestPos, bestPos + bestNodeSize, markType);
    if (newTags.length > 0) {
      tr.addMark(bestPos, bestPos + bestNodeSize, markType.create({ ...bestAttrs, tags: newTags }));
    }

    return true;
  };
}

function removeTagMarksFromEditor(editor: Editor, tagId: string) {
  if (!editor || (editor as Editor & { isDestroyed?: boolean }).isDestroyed) return;
  try {
    const docSize = editor.state.doc.content.size;
    if (docSize === 0) return;
    editor.chain()
      .command(makeRemoveTagCommand(tagId, 0, docSize))
      .run();
  } catch (e) {
    console.warn('Failed to remove tag marks:', e);
  }
}

export function DreamEditor() {
  const { editorOpen, editingDreamId, closeEditor, importQueue, importQueueIndex, advanceImportQueue } = useUIStore();
  const { dreams, createDream, updateDream } = useDreamStore();
  const allTags = useTagStore((state) => state.tags);
  const { archetypes, dreamArchetypeMap, setDreamArchetypes } = useArchetypeStore();
  const { analystMode, clients } = useAnalystStore();

  // Current import queue item (if any)
  const currentQueueItem = importQueue.length > 0 ? importQueue[importQueueIndex] : null;

  // Keep a live ref to allTags so the inline-tag InputRule always sees current tags
  const allTagsRef = useRef(allTags);
  useEffect(() => { allTagsRef.current = allTags; }, [allTags]);

  const [title, setTitle] = useState('');
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [dreamDate, setDreamDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isLucid, setIsLucid] = useState(false);
  const [moodRating, setMoodRating] = useState<number | null>(null);
  const [clarityRating, setClarityRating] = useState<number | null>(null);
  const [meaningfulnessRating, setMeaningfulnessRating] = useState<number | null>(null);
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const sortedSelectedTags = useMemo(() => sortByName(selectedTags), [selectedTags]);
  const [selectedArchetypeIds, setSelectedArchetypeIds] = useState<string[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [wakingLifeContext, setWakingLifeContext] = useState('');
  const [analysisNotes, setAnalysisNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [isAITagging, setIsAITagging] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const draftRestoredRef = useRef(false);

  // ── Hover-X inline tag removal ────────────────────────────────────────────
  // Tracks which tagged span is currently hovered so we can show a small X
  // overlay that removes the tag from just that block of text.
  const [tagHoverInfo, setTagHoverInfo] = useState<{
    rect: DOMRect;
    tags: TagRef[];
    from: number;
    to: number;
  } | null>(null);
  const tagHoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Intentionally NOT derived as a reactive variable — we only want to read the
  // dream snapshot when editingDreamId changes (editor opens/switches), not every
  // time the store updates after a save (which caused a double-load black-screen).
  const getDreamSnapshot = () =>
    editingDreamId ? dreams.find((d) => d.id === editingDreamId) ?? null : null;

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
      }),
      Placeholder.configure({
        placeholder: 'Describe your dream...',
      }),
      Image.configure({
        inline: false,
        allowBase64: true,
      }),
      TagHighlight,
      makeInlineTagExtension(allTagsRef),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'tiptap min-h-[200px] focus:outline-none',
      },
    },
  });

  // Load/reset the editor whenever it opens.
  // editorOpen in deps: ensures the reset branch runs when reopening a new-dream
  //   editor (editingDreamId stays null→null, so it would otherwise be skipped).
  // Early-return when !editorOpen: prevents setContent('') from firing during
  //   the dialog's exit animation, which caused a black-screen flash on close.
  useEffect(() => {
    // Only run when the editor is actually opening, not closing.
    if (!editorOpen) return;

    const editingDream = getDreamSnapshot();
    if (editingDream && editor) {
      setTitle(editingDream.title);
      setDreamDate(editingDream.dream_date);
      setIsLucid(editingDream.is_lucid);
      setMoodRating(editingDream.mood_rating);
      setClarityRating(editingDream.clarity_rating);
      setMeaningfulnessRating(editingDream.meaningfulness_rating ?? null);
      setSelectedTags(editingDream.tags);
      setSelectedArchetypeIds(dreamArchetypeMap[editingDream.id] ?? []);
      setWakingLifeContext(editingDream.waking_life_context || '');
      setAnalysisNotes(editingDream.analysis_notes || '');
      editor.commands.setContent(editingDream.content_html);
      draftRestoredRef.current = true;
    } else if (!editingDreamId && editor) {
      // Reset all fields when entering new-dream mode so that a previous
      // session's content never carries over into a fresh entry.
      draftRestoredRef.current = false;
      setSelectedTags([]);
      setSelectedArchetypeIds([]);
      setIsLucid(false);
      setMoodRating(null);
      setClarityRating(null);
      setMeaningfulnessRating(null);
      setAnalysisNotes('');

      // If a queue item is waiting, pre-fill from it
      if (currentQueueItem) {
        setTitle(currentQueueItem.title);
        setDreamDate(currentQueueItem.date);
        setSelectedClientId(currentQueueItem.clientId);
        setWakingLifeContext(clientPrefix(currentQueueItem.clientName));
        editor.commands.setContent(currentQueueItem.contentHtml);
        draftRestoredRef.current = true;
      } else {
        setTitle('');
        setDreamDate(format(new Date(), 'yyyy-MM-dd'));
        setIsLucid(false);
        setMoodRating(null);
        setClarityRating(null);
        setMeaningfulnessRating(null);
        setSelectedTags([]);
        setSelectedClientId('');
        setWakingLifeContext('');
        editor.commands.setContent('');
        // After clearing, offer to restore any previously saved draft
        try {
          const raw = localStorage.getItem(DRAFT_KEY);
          if (raw) {
            const draft: EditorDraft = JSON.parse(raw);
            if (draft.title || draft.contentHtml?.replace(/<[^>]+>/g, '').trim()) {
              setShowDraftBanner(true);
            }
          }
        } catch {
          // ignore malformed draft
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingDreamId, editor, editorOpen]);

  // Reset draftRestoredRef when editor closes
  useEffect(() => {
    if (!editorOpen) {
      draftRestoredRef.current = false;
      setShowDraftBanner(false);
    }
  }, [editorOpen]);

  // Auto-backup content while editing an existing dream (in case of crashes)
  const saveEditBackup = useCallback(() => {
    if (!editorOpen || !editingDreamId || !editor) return;
    try {
      localStorage.setItem(getEditBackupKey(editingDreamId), JSON.stringify({
        contentHtml: editor.getHTML(),
        title,
        analysisNotes,
        savedAt: new Date().toISOString(),
      }));
    } catch { /* ignore */ }
  }, [editorOpen, editingDreamId, editor, title, analysisNotes]);

  useEffect(() => {
    if (!editorOpen || !editingDreamId) return;
    const id = setTimeout(saveEditBackup, 2000);
    return () => clearTimeout(id);
  }, [saveEditBackup, editorOpen, editingDreamId]);

  // Auto-save draft to localStorage for new dreams (debounced via state)
  const saveDraft = useCallback(() => {
    if (!editorOpen || editingDreamId || !editor) return;
    try {
      const draft: EditorDraft = {
        title,
        dreamDate,
        isLucid,
        moodRating,
        clarityRating,
        meaningfulnessRating,
        selectedTagIds: selectedTags.map((t) => t.id),
        wakingLifeContext,
        contentHtml: editor.getHTML(),
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // ignore storage errors
    }
  }, [editorOpen, editingDreamId, editor, title, dreamDate, isLucid, moodRating, clarityRating, meaningfulnessRating, selectedTags, wakingLifeContext]);

  useEffect(() => {
    if (!editorOpen || editingDreamId) return;
    const id = setTimeout(saveDraft, 1000);
    return () => clearTimeout(id);
  }, [saveDraft, editorOpen, editingDreamId]);

  // Keep a stable ref so the editor.on('update') listener never needs to
  // be re-registered when saveDraft's dependencies change.
  const saveDraftRef = useRef(saveDraft);
  useEffect(() => { saveDraftRef.current = saveDraft; }, [saveDraft]);

  // Register the editor update handler exactly once per editor/session.
  useEffect(() => {
    if (!editor || !editorOpen || editingDreamId) return;
    const handler = () => saveDraftRef.current();
    editor.on('update', handler);
    return () => { editor.off('update', handler); };
  }, [editor, editorOpen, editingDreamId]);

  // Set up hover listener on the TipTap editor DOM to show the inline X button
  useEffect(() => {
    if (!editor || !editorOpen) return;

    const editorDom = editor.view.dom;

    const handleMouseOver = (e: MouseEvent) => {
      const span = (e.target as Element).closest('span[data-tags]') as HTMLElement | null;
      if (!span) return;

      const tagsAttr = span.getAttribute('data-tags');
      if (!tagsAttr) return;
      let tags: TagRef[] = [];
      try { tags = JSON.parse(tagsAttr); } catch { return; }
      if (tags.length === 0) return;

      if (tagHoverTimeoutRef.current) clearTimeout(tagHoverTimeoutRef.current);

      try {
        const domPos = editor.view.posAtDOM(span, 0);
        // Use textContent length to compute end position — posAtDOM(span, childCount)
        // can be unreliable for mark-rendered spans; text length is always exact.
        const textLen = span.textContent?.length ?? 0;
        const domPosEnd = domPos + textLen;
        const rect = span.getBoundingClientRect();
        setTagHoverInfo({ rect, tags, from: domPos, to: domPosEnd });
      } catch {
        // posAtDOM can fail if the span is outside the ProseMirror content
      }
    };

    const handleMouseOut = (e: MouseEvent) => {
      const related = e.relatedTarget as Element | null;
      // Don't hide if moving into the overlay button itself
      if (related?.closest('[data-tag-remove-overlay]')) return;
      tagHoverTimeoutRef.current = setTimeout(() => setTagHoverInfo(null), 120);
    };

    editorDom.addEventListener('mouseover', handleMouseOver);
    editorDom.addEventListener('mouseout', handleMouseOut);
    return () => {
      editorDom.removeEventListener('mouseover', handleMouseOver);
      editorDom.removeEventListener('mouseout', handleMouseOut);
      if (tagHoverTimeoutRef.current) clearTimeout(tagHoverTimeoutRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, editorOpen]);

  /** Remove a specific tag from just the hovered span.
   *
   * Uses makeRemoveTagAtSpanCommand (nearest-node search) rather than the strict
   * nodesBetween approach: posAtDOM can return slightly inexact positions for
   * mark-rendered spans, so anchoring by proximity is more reliable.
   */
  const handleRemoveTagFromSpan = (tagId: string) => {
    if (!editor || !tagHoverInfo) return;
    try {
      editor.chain()
        .command(makeRemoveTagAtSpanCommand(tagId, tagHoverInfo.from))
        .run();
    } catch (e) {
      console.warn('Failed to remove tag from span:', e);
    }
    setTagHoverInfo(null);
  };

  const restoreDraft = () => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw || !editor) return;
      const draft: EditorDraft = JSON.parse(raw);
      setTitle(draft.title || '');
      setDreamDate(draft.dreamDate || format(new Date(), 'yyyy-MM-dd'));
      setIsLucid(draft.isLucid || false);
      setMoodRating(draft.moodRating ?? null);
      setClarityRating(draft.clarityRating ?? null);
      setMeaningfulnessRating(draft.meaningfulnessRating ?? null);
      setWakingLifeContext(draft.wakingLifeContext || '');
      editor.commands.setContent(draft.contentHtml || '');
      // Restore tags by ID
      const restoredTags = allTags.filter((t) => draft.selectedTagIds?.includes(t.id));
      setSelectedTags(restoredTags);
      draftRestoredRef.current = true;
    } catch (e) {
      console.warn('Failed to restore draft from localStorage:', e);
      return;
    }
    setShowDraftBanner(false);
  };

  const discardDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    setShowDraftBanner(false);
    draftRestoredRef.current = true;
  };

  const handleSave = async () => {
    if (!editor || !title.trim()) return;

    setIsSaving(true);
    try {
      const contentHtml = editor.getHTML();
      const contentPlain = editor.getText();
      const wordTagAssociations = extractWordTagAssociations(editor);

      if (editingDreamId) {
        setDreamArchetypes(editingDreamId, selectedArchetypeIds);
        await updateDream({
          id: editingDreamId,
          title: title.trim(),
          content_html: contentHtml,
          content_plain: contentPlain,
          dream_date: dreamDate,
          is_lucid: isLucid,
          mood_rating: moodRating,
          clarity_rating: clarityRating,
          meaningfulness_rating: meaningfulnessRating,
          waking_life_context: wakingLifeContext.trim() || null,
          analysis_notes: analysisNotes.trim() || null,
          tag_ids: selectedTags.map((t) => t.id),
          word_tag_associations: wordTagAssociations,
        });
        try { localStorage.removeItem(getEditBackupKey(editingDreamId)); } catch { /* ignore */ }
      } else {
        // Derive waking_life_context: if a client is selected in professional mode,
        // prefix with client tag; otherwise use the raw textarea value.
        const clientName = analystMode && selectedClientId
          ? clients.find((c) => c.id === selectedClientId)?.name ?? null
          : null;
        const effectiveContext = clientName
          ? clientPrefix(clientName) + (wakingLifeContext.trim() ? ' ' + wakingLifeContext.trim() : '')
          : wakingLifeContext.trim() || null;

      const newDream = await createDream({
          title: title.trim(),
          content_html: contentHtml,
          content_plain: contentPlain,
          dream_date: dreamDate,
          is_lucid: isLucid,
          mood_rating: moodRating,
          clarity_rating: clarityRating,
          meaningfulness_rating: meaningfulnessRating,
          waking_life_context: effectiveContext,
          analysis_notes: analysisNotes.trim() || null,
          tag_ids: selectedTags.map((t) => t.id),
          word_tag_associations: wordTagAssociations,
        });
        setDreamArchetypes(newDream.id, selectedArchetypeIds);
        // Clear draft on successful save
        localStorage.removeItem(DRAFT_KEY);
        // Advance import queue if active (do this instead of closeEditor)
        if (importQueue.length > 0) {
          advanceImportQueue();
          return;
        }
      }
      closeEditor();
    } catch (error) {
      console.error('Failed to save dream:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      editor.chain().focus().setImage({ src }).run();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  /**
   * Single-pass doc traversal: for each text node, check ALL tags' search terms
   * in one pass and add 'auto' highlight marks for every match found.
   * O(doc_size × avg_terms_per_tag) instead of O(tags × doc_size).
   */
  const applyAutoHighlights = (tagsToHighlight: Tag[]) => {
    if (!editor || (editor as Editor & { isDestroyed?: boolean }).isDestroyed || tagsToHighlight.length === 0) return;
    const markType = editor.schema.marks[TAG_HIGHLIGHT];
    if (!markType) return;
    // Build search-term → tag map for efficient per-node lookup
    const termMap = new Map<string, Tag>();
    tagsToHighlight.forEach((tag) => {
      [tag.name, ...tag.aliases].forEach((s) => termMap.set(s.toLowerCase(), tag));
    });
    // Use chain().command() so the transaction goes through TipTap's full
    // reconciliation layer, preventing React/ProseMirror state de-sync.
    editor.chain()
      .command(({ tr, state }) => {
        let changed = false;
        state.doc.descendants((node, pos) => {
          if (!node.isText || !node.text) return;
          const lower = node.text.toLowerCase();
          termMap.forEach((tag, term) => {
            let idx = lower.indexOf(term);
            while (idx !== -1) {
              tr.addMark(
                pos + idx,
                pos + idx + term.length,
                markType.create({ tags: [{ tagId: tag.id, tagColor: tag.color, tagName: tag.name }], source: 'auto' }),
              );
              changed = true;
              idx = lower.indexOf(term, idx + 1);
            }
          });
        });
        // Keep auto-highlights outside undo stack so Ctrl+Z undoes typed text.
        tr.setMeta('addToHistory', false);
        return changed;
      })
      .run();
  };

  const handleAutoMatchTags = () => {
    if (!editor) return;
    const text = editor.getText().toLowerCase();
    const matched = allTags.filter(
      (tag) =>
        !selectedTags.some((t) => t.id === tag.id) &&
        (text.includes(tag.name.toLowerCase()) ||
          tag.aliases.some((alias) => text.includes(alias.toLowerCase())))
    );
    if (matched.length === 0) return;
    setSelectedTags([...selectedTags, ...matched]);
    applyAutoHighlights(matched);
  };

  const handleAIAnalysis = async () => {
    if (!editor) return;
    const dreamText = editor.getText().trim();
    if (!dreamText) return;

    const apiKey = localStorage.getItem('anthropic_api_key') ?? '';
    if (!apiKey.trim()) {
      setAnalysisError('No API key found. Add your Anthropic API key in Settings.');
      return;
    }

    setIsAnalysing(true);
    setAnalysisError(null);
    try {
      const tagsJson = JSON.stringify(
        allTags.map((t) => ({ id: t.id, name: t.name, category: t.category }))
      );
      const result = await analyzeDream(dreamText, tagsJson, apiKey);

      // 1. Match suggested tag names (case-insensitive) to existing tags
      const lowerIndex = new Map(allTags.map((t) => [t.name.toLowerCase(), t]));
      const aiMatched = result.suggested_tag_names
        .map((n) => lowerIndex.get(n.toLowerCase()))
        .filter((t): t is Tag => t !== undefined)
        .filter((t) => !selectedTags.some((s) => s.id === t.id));

      // 2. Run auto-match on the full dream text to catch additional tags
      const text = editor.getText().toLowerCase();
      const autoMatched = allTags.filter(
        (tag) =>
          !selectedTags.some((t) => t.id === tag.id) &&
          !aiMatched.some((t) => t.id === tag.id) &&
          (text.includes(tag.name.toLowerCase()) ||
            tag.aliases.some((alias) => text.includes(alias.toLowerCase())))
      );

      const allNewTags = [...aiMatched, ...autoMatched];
      const updatedTags = [...selectedTags, ...allNewTags];
      if (allNewTags.length > 0) {
        handleTagsChange(updatedTags);
      }

      // 3. Apply in-text highlights for all newly added tags (single-pass)
      applyAutoHighlights(allNewTags);

      // 4. Append theme suggestions to analysis notes
      if (result.theme_suggestions) {
        setAnalysisNotes((prev) =>
          prev.trim() ? `${prev.trim()}\n\n${result.theme_suggestions}` : result.theme_suggestions
        );
      }
    } catch (e) {
      setAnalysisError(String(e));
    } finally {
      setIsAnalysing(false);
    }
  };

  /**
   * AI Tag — asks Claude to identify which words/phrases in the dream correspond
   * to tags, then applies inline highlights for each match.
   * This is separate from AI Analyse (which provides theme notes).
   */
  const handleAITagging = async () => {
    if (!editor) return;
    const dreamText = editor.getText().trim();
    if (!dreamText) return;
    const apiKey = localStorage.getItem('anthropic_api_key') ?? '';
    if (!apiKey.trim()) {
      setAnalysisError('No API key found. Add your Anthropic API key in Settings.');
      return;
    }
    setIsAITagging(true);
    setAnalysisError(null);
    try {
      const tagsJson = JSON.stringify(allTags.map((t) => ({ id: t.id, name: t.name, aliases: t.aliases, category: t.category })));
      const result = await aiTagDream(dreamText, tagsJson, apiKey);
      // result.inline_tags: Array<{ text: string; tag_name: string }>
      const lowerIndex = new Map(allTags.map((t) => [t.name.toLowerCase(), t]));
      const matchedTagIds = new Set<string>();
      const tagsToHighlight: Tag[] = [];
      // Build per-phrase highlight entries
      const phraseTagPairs: Array<{ phrase: string; tag: Tag }> = [];
      result.inline_tags.forEach(({ text: phrase, tag_name }) => {
        const tag = lowerIndex.get(tag_name.toLowerCase());
        if (!tag) return;
        matchedTagIds.add(tag.id);
        phraseTagPairs.push({ phrase, tag });
        if (!tagsToHighlight.some((t) => t.id === tag.id)) tagsToHighlight.push(tag);
      });
      // Apply marks for each phrase exactly
      if (phraseTagPairs.length > 0 && !editor.isDestroyed) {
        const markType = editor.schema.marks[TAG_HIGHLIGHT];
        if (markType) {
          editor.chain()
            .command(({ tr, state }) => {
              let changed = false;
              phraseTagPairs.forEach(({ phrase, tag }) => {
                const lower = phrase.toLowerCase();
                state.doc.descendants((node, pos) => {
                  if (!node.isText || !node.text) return;
                  const nodeLower = node.text.toLowerCase();
                  let idx = nodeLower.indexOf(lower);
                  while (idx !== -1) {
                    tr.addMark(
                      pos + idx,
                      pos + idx + phrase.length,
                      markType.create({ tags: [{ tagId: tag.id, tagColor: tag.color, tagName: tag.name }], source: 'auto' }),
                    );
                    changed = true;
                    idx = nodeLower.indexOf(lower, idx + 1);
                  }
                });
              });
              tr.setMeta('addToHistory', false);
              return changed;
            })
            .run();
        }
      }
      // Add matched tags to selectedTags
      const newTags = tagsToHighlight.filter((t) => !selectedTags.some((s) => s.id === t.id));
      if (newTags.length > 0) {
        handleTagsChange([...selectedTags, ...newTags]);
      }
    } catch (e) {
      setAnalysisError(String(e));
    } finally {
      setIsAITagging(false);
    }
  };

  /** Handle tag list changes, removing editor marks for any removed tags. */
  const handleTagsChange = (newTags: Tag[]) => {
    // Flush draft to localStorage before touching editor state so content is
    // preserved even if the mark-removal triggers an unexpected re-render.
    if (editorOpen && !editingDreamId) saveDraft();

    if (editor) {
      const removedTags = selectedTags.filter((t) => !newTags.some((n) => n.id === t.id));
      removedTags.forEach((tag) => removeTagMarksFromEditor(editor, tag.id));
    }
    setSelectedTags(newTags);
  };

  /** Toggle a tagHighlight mark ref (tag or archetype) on the current selection. */
  const toggleMarkRef = useCallback((id: string, color: string, name: string) => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const existingMark = editor.state.doc
      .rangeHasMark(from, to, editor.schema.marks[TAG_HIGHLIGHT])
      ? editor.state.doc.resolve(from).marks().find((m) => m.type.name === TAG_HIGHLIGHT)
      : null;
    const current: TagRef[] = existingMark?.attrs.tags ?? [];
    const isActive = current.some((t) => t.tagId === id);
    const next = isActive ? current.filter((t) => t.tagId !== id) : [...current, { tagId: id, tagColor: color, tagName: name }];
    if (next.length === 0) {
      editor.chain().focus().unsetMark(TAG_HIGHLIGHT).run();
    } else {
      editor.chain().focus().setMark(TAG_HIGHLIGHT, { tags: next }).run();
    }
  }, [editor]);

  const ToolbarButton = ({
    onClick,
    isActive,
    children,
  }: {
    onClick: () => void;
    isActive?: boolean;
    children: React.ReactNode;
  }) => (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn('h-8 w-8', isActive && 'bg-accent')}
      onClick={onClick}
    >
      {children}
    </Button>
  );

  // Recompute only when the editor state changes (selection or content), not on every
  // unrelated React re-render (e.g. tagHoverInfo updates during mouse events).
  const activeTags = useMemo<TagRef[]>(
    () => editor?.state.selection.$from.marks().find((m) => m.type.name === TAG_HIGHLIGHT)?.attrs.tags ?? [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor?.state],
  );

  return (
    <>
    {/* Hover-X overlay — rendered in a portal so it sits above the dialog */}
    {tagHoverInfo && createPortal(
      <div
        data-tag-remove-overlay=""
        style={{
          position: 'fixed',
          left: tagHoverInfo.rect.right - 10,
          top: tagHoverInfo.rect.top - 10,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
        onMouseEnter={() => {
          if (tagHoverTimeoutRef.current) clearTimeout(tagHoverTimeoutRef.current);
        }}
        onMouseLeave={() => {
          tagHoverTimeoutRef.current = setTimeout(() => setTagHoverInfo(null), 120);
        }}
      >
        {tagHoverInfo.tags.map((tag) => (
          <button
            key={tag.tagId}
            title={`Remove "${tag.tagName}" from this text`}
            onClick={() => handleRemoveTagFromSpan(tag.tagId)}
            style={{ backgroundColor: tag.tagColor }}
            className="w-5 h-5 rounded-full flex items-center justify-center shadow-md opacity-90 hover:opacity-100 transition-opacity"
          >
            <X className="h-2.5 w-2.5 text-white" strokeWidth={3} />
          </button>
        ))}
      </div>,
      document.body
    )}
    <Dialog open={editorOpen} onOpenChange={(open) => !open && closeEditor()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingDreamId ? 'Edit Dream' : 'New Dream Entry'}</DialogTitle>
        </DialogHeader>

        {/* Draft restore banner */}
        {showDraftBanner && (
          <div className="flex items-center justify-between rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
            <span className="text-amber-700 dark:text-amber-400">
              You have an unsaved draft from a previous session.
            </span>
            <div className="flex gap-2 ml-3">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={restoreDraft}>
                Restore
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={discardDraft}>
                Discard
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-6 py-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter dream title..."
              className="text-lg"
            />
          </div>

          {/* Date and Lucid toggle */}
          <div className="flex flex-wrap gap-4 items-center">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={dreamDate}
                onChange={(e) => setDreamDate(e.target.value)}
                className="w-40"
              />
            </div>

            <div className="flex items-center gap-2 mt-6">
              <Switch id="lucid" checked={isLucid} onCheckedChange={setIsLucid} />
              <Label htmlFor="lucid" className="flex items-center gap-2 cursor-pointer">
                <Sparkles className="h-4 w-4" />
                Lucid Dream
              </Label>
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Tags</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAutoMatchTags}
                className="h-7 gap-1.5 text-xs"
                title="Scan dream text and apply matching tags"
              >
                <Wand2 className="h-3.5 w-3.5" />
                Auto-match
              </Button>
            </div>
            <TagPicker selectedTags={selectedTags} onTagsChange={handleTagsChange} currentDreamId={editingDreamId} />
          </div>

          {/* Client selector (professional mode, new dreams only) */}
          {analystMode && clients.length > 0 && !editingDreamId && (
            <div className="space-y-2">
              <Label htmlFor="dream-client">Client</Label>
              <select
                id="dream-client"
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Personal / no client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Queue progress indicator */}
          {importQueue.length > 0 && (
            <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-xs">
              <span className="text-primary font-medium">
                Import queue: {importQueueIndex + 1} of {importQueue.length}
              </span>
              <span className="text-muted-foreground ml-auto">Save to advance to next file</span>
            </div>
          )}

          {/* Archetypes */}
          <div className="space-y-2">
            <Label>Archetypes</Label>
            <div className="flex flex-wrap gap-1.5">
              {archetypes.map((archetype) => {
                const isActive = selectedArchetypeIds.includes(archetype.id);
                return (
                  <button
                    key={archetype.id}
                    type="button"
                    onClick={() =>
                      setSelectedArchetypeIds((prev) =>
                        isActive ? prev.filter((id) => id !== archetype.id) : [...prev, archetype.id]
                      )
                    }
                    className={cn(
                      'px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
                      isActive ? 'ring-2 ring-offset-1 ring-current' : 'opacity-60 hover:opacity-100'
                    )}
                    style={{
                      backgroundColor: archetype.color + '22',
                      color: archetype.color,
                      borderColor: archetype.color + '88',
                    }}
                    title={archetype.description}
                  >
                    {archetype.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Waking Life Context */}
          <div className="space-y-2">
            <Label htmlFor="waking-context">Waking Life Context</Label>
            <Textarea
              id="waking-context"
              value={wakingLifeContext}
              onChange={(e) => setWakingLifeContext(e.target.value)}
              placeholder="What was happening in your waking life around this time? (optional)"
              className="min-h-[80px] resize-none"
            />
          </div>

          {/* Editor toolbar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Content</Label>
              {selectedTags.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Select text to tag individual words
                </p>
              )}
            </div>
            <div className="border rounded-lg">
              <div className="flex items-center gap-1 p-2 border-b bg-muted/50 flex-wrap">
                <ToolbarButton
                  onClick={() => editor?.chain().focus().toggleBold().run()}
                  isActive={editor?.isActive('bold')}
                >
                  <Bold className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton
                  onClick={() => editor?.chain().focus().toggleItalic().run()}
                  isActive={editor?.isActive('italic')}
                >
                  <Italic className="h-4 w-4" />
                </ToolbarButton>
                <Separator orientation="vertical" className="h-6 mx-1" />
                <ToolbarButton
                  onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
                  isActive={editor?.isActive('heading', { level: 1 })}
                >
                  <Heading1 className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton
                  onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                  isActive={editor?.isActive('heading', { level: 2 })}
                >
                  <Heading2 className="h-4 w-4" />
                </ToolbarButton>
                <Separator orientation="vertical" className="h-6 mx-1" />
                <ToolbarButton
                  onClick={() => editor?.chain().focus().toggleBulletList().run()}
                  isActive={editor?.isActive('bulletList')}
                >
                  <List className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton
                  onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                  isActive={editor?.isActive('orderedList')}
                >
                  <ListOrdered className="h-4 w-4" />
                </ToolbarButton>
                <Separator orientation="vertical" className="h-6 mx-1" />
                <ToolbarButton onClick={() => editor?.chain().focus().undo().run()}>
                  <Undo className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton onClick={() => editor?.chain().focus().redo().run()}>
                  <Redo className="h-4 w-4" />
                </ToolbarButton>
                <Separator orientation="vertical" className="h-6 mx-1" />
                <ToolbarButton
                  onClick={() => imageInputRef.current?.click()}
                  isActive={false}
                >
                  <ImagePlus className="h-4 w-4" />
                </ToolbarButton>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageFile}
                />
                <Separator orientation="vertical" className="h-6 mx-1" />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={handleAIAnalysis}
                  disabled={isAnalysing || isAITagging}
                  title="Analyse dream with AI: suggests tags and theme notes"
                >
                  <Brain className="h-3.5 w-3.5" />
                  {isAnalysing ? 'Analysing…' : 'AI Analyse'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={handleAITagging}
                  disabled={isAITagging || isAnalysing}
                  title="AI Tag: apply inline highlights for matched tags. Use [[tag_name]] to tag manually."
                >
                  <Tags className="h-3.5 w-3.5" />
                  {isAITagging ? 'Tagging…' : 'AI Tag'}
                </Button>
              </div>
              {analysisError && (
                <div className="flex items-center justify-between border-b border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  <span>{analysisError}</span>
                  <button type="button" onClick={() => setAnalysisError(null)} className="ml-2 hover:opacity-70">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              <div className="p-4 relative">
                {editor && (selectedTags.length > 0 || archetypes.length > 0) && (
                  <BubbleMenu
                    editor={editor}
                    tippyOptions={{ duration: 100, placement: 'top' }}
                    shouldShow={({ from, to }) => from !== to}
                  >
                    <div className="flex flex-col gap-1 bg-popover border rounded-md shadow-lg p-1.5 max-w-sm">
                      {/* Tags row */}
                      {selectedTags.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {sortedSelectedTags.map((tag) => {
                            const isActive = activeTags.some((t) => t.tagId === tag.id);
                            return (
                              <button
                                key={tag.id}
                                type="button"
                                onMouseDown={(e) => { e.preventDefault(); toggleMarkRef(tag.id, tag.color, tag.name); }}
                                className={cn('px-2 py-0.5 rounded text-xs font-medium transition-all border', isActive && 'ring-2 ring-offset-1 ring-current')}
                                style={{ backgroundColor: tag.color + '26', color: tag.color, borderColor: tag.color }}
                              >
                                {tag.name}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {/* Archetypes row */}
                      {selectedTags.length > 0 && archetypes.length > 0 && (
                        <div className="border-t border-border/40 pt-1" />
                      )}
                      {archetypes.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {archetypes.map((arch) => {
                            const archTagId = `${ARCHETYPE_TAG_PREFIX}${arch.id}`;
                            const isActive = activeTags.some((t) => t.tagId === archTagId);
                            return (
                              <button
                                key={arch.id}
                                type="button"
                                title={arch.description}
                                onMouseDown={(e) => { e.preventDefault(); toggleMarkRef(archTagId, arch.color, arch.name); }}
                                className={cn('px-2 py-0.5 rounded text-[10px] font-medium transition-all border italic', isActive && 'ring-2 ring-offset-1 ring-current')}
                                style={{ backgroundColor: arch.color + '22', color: arch.color, borderColor: arch.color + '88' }}
                              >
                                {arch.name}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </BubbleMenu>
                )}
                <EditorContent editor={editor} />
              </div>
            </div>
          </div>

          {/* Mood, Clarity, and Meaningfulness sliders */}
          <div className="grid grid-cols-3 gap-6">
            <div className="space-y-3">
              <div className="flex justify-between">
                <Label>Mood</Label>
                <span className="text-sm text-muted-foreground">
                  {moodRating !== null ? moodRating : '-'}
                </span>
              </div>
              <Slider
                value={moodRating !== null ? [moodRating] : [5]}
                onValueChange={(v) => setMoodRating(v[0])}
                min={1}
                max={10}
                step={1}
              />
            </div>
            <div className="space-y-3">
              <div className="flex justify-between">
                <Label>Clarity</Label>
                <span className="text-sm text-muted-foreground">
                  {clarityRating !== null ? clarityRating : '-'}
                </span>
              </div>
              <Slider
                value={clarityRating !== null ? [clarityRating] : [5]}
                onValueChange={(v) => setClarityRating(v[0])}
                min={1}
                max={10}
                step={1}
              />
            </div>
            <div className="space-y-3">
              <div className="flex justify-between">
                <Label>Meaningfulness</Label>
                <span className="text-sm text-muted-foreground">
                  {meaningfulnessRating !== null ? meaningfulnessRating : '-'}
                </span>
              </div>
              <Slider
                value={meaningfulnessRating !== null ? [meaningfulnessRating] : [5]}
                onValueChange={(v) => setMeaningfulnessRating(v[0])}
                min={1}
                max={10}
                step={1}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={closeEditor}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !title.trim()}>
            {isSaving ? 'Saving...' : editingDreamId ? 'Update' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
