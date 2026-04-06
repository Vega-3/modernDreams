import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
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
  SpellCheck,
  Wand2,
  ImagePlus,
  X,
  Brain,
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
import { TagHighlight } from './TagHighlightExtension';
import type { TagRef, MarkSource } from './TagHighlightExtension';
import { cn } from '@/lib/utils';
import { useDreamStore } from '@/stores/dreamStore';
import { useUIStore } from '@/stores/uiStore';
import { useTagStore } from '@/stores/tagStore';
import { useArchetypeStore } from '@/stores/archetypeStore';
import { useAnalystStore, clientPrefix } from '@/stores/analystStore';
import type { Tag, WordTagAssociation } from '@/lib/tauri';
import { analyzeDream } from '@/lib/tauri';
import type { Editor } from '@tiptap/core';

const DRAFT_KEY = 'dreams_new_dream_draft';

interface EditorDraft {
  title: string;
  dreamDate: string;
  isLucid: boolean;
  moodRating: number | null;
  clarityRating: number | null;
  selectedTagIds: string[];
  wakingLifeContext: string;
  contentHtml: string;
  savedAt: string;
}

// Abbreviations after which the next word should NOT be capitalised.
// These are common title/measurement abbreviations that end with a period.
const ABBREV_PATTERN = /\b(?:Mr|Mrs|Ms|Dr|Prof|St|Jr|Sr|vs|etc|e\.g|i\.e|approx|dept|govt|Corp|Inc|Ltd|Vol|No|Apt|Ave|Blvd|Rd)\.\s*$/i;

/**
 * Context-aware grammar and spelling fixes.
 *
 * Processes text nodes extracted from HTML.  Improvements over the original:
 * - "wont" only → "won't" when NOT immediately followed by "to" (preserves the
 *   formal adjective "wont to do").
 * - Capitalisation after sentence-ending punctuation is suppressed when the
 *   preceding word is a known abbreviation (Dr., Mr., etc.).
 * - Common one-character typos corrected (teh→the, recieve→receive, etc.).
 * - Repeated punctuation collapsed (... is preserved; ,, → ,).
 * - Smart apostrophe normalisation (curly → straight for editing clarity).
 * - Double-space collapse.
 * - Standalone "i" → "I".
 */
function applyGrammarFixes(html: string): string {
  // Collect all text-node spans so we can do cross-node context checks
  const parts: string[] = html.split(/(>[^<]*<)/g);

  // Two-pass: first collect plain text for context, then apply fixes per node
  return parts.map((part) => {
    // Only process text-node segments (between > and <)
    if (!part.startsWith('>') || !part.endsWith('<')) return part;

    let t = part.slice(1, -1); // strip surrounding > and <

    // ── 1. Normalise whitespace and smart punctuation ─────────────────────
    t = t.replace(/  +/g, ' ');
    t = t.replace(/[\u2018\u2019]/g, "'");  // curly single quotes → straight
    t = t.replace(/[\u201C\u201D]/g, '"');  // curly double quotes → straight
    t = t.replace(/,,/g, ',').replace(/\.\.\.\./g, '…');

    // ── 2. Standalone "i" → "I" ───────────────────────────────────────────
    t = t.replace(/\bi\b/g, 'I');

    // ── 3. Common typos (context-safe one-to-one substitutions) ──────────
    const typos: [RegExp, string][] = [
      [/\bteh\b/g, 'the'],
      [/\brecieve\b/gi, 'receive'],
      [/\bbelive\b/gi, 'believe'],
      [/\boccured\b/gi, 'occurred'],
      [/\bseperate\b/gi, 'separate'],
      [/\bdefinate(ly)?\b/gi, (_, s) => s ? 'definitely' : 'definite'],
      [/\bwierd\b/gi, 'weird'],
      [/\bthere fore\b/gi, 'therefore'],
      [/\bur\b/g, 'your'],        // casual shorthand (text node only)
    ];
    for (const [pattern, replacement] of typos) {
      t = t.replace(pattern, replacement as string);
    }

    // ── 4. Contractions with context ─────────────────────────────────────
    // "wont" as a contraction only when NOT followed by "to" (the formal adj)
    t = t.replace(/\bwont\b(?!\s+to\b)/gi, "won't");

    const contractions: [RegExp, string][] = [
      [/\bdont\b/gi, "don't"],
      [/\bcant\b/gi, "can't"],
      [/\bdidnt\b/gi, "didn't"],
      [/\bdoesnt\b/gi, "doesn't"],
      [/\bisnt\b/gi, "isn't"],
      [/\bwasnt\b/gi, "wasn't"],
      [/\bwerent\b/gi, "weren't"],
      [/\bwouldnt\b/gi, "wouldn't"],
      [/\bcouldnt\b/gi, "couldn't"],
      [/\bshouldnt\b/gi, "shouldn't"],
      [/\bhavent\b/gi, "haven't"],
      [/\bhasnt\b/gi, "hasn't"],
      [/\bhadnt\b/gi, "hadn't"],
      [/\bim\b/g, "I'm"],
      [/\bive\b/g, "I've"],
      [/\bId\b/g, "I'd"],
      [/\bIll\b/g, "I'll"],
    ];
    for (const [pattern, replacement] of contractions) {
      t = t.replace(pattern, replacement);
    }

    // ── 5. Capitalise after sentence-ending punctuation ───────────────────
    // Suppress if the preceding text ends with an abbreviation
    t = t.replace(/([.!?]\s+)([a-z])/g, (match, punct, letter, offset) => {
      const preceding = t.slice(0, offset);
      if (ABBREV_PATTERN.test(preceding)) return match; // abbreviation — don't capitalise
      return punct + letter.toUpperCase();
    });

    // ── 6. Capitalise the very first character of the text node ──────────
    if (t.length > 0 && /[a-z]/.test(t[0])) {
      t = t[0].toUpperCase() + t.slice(1);
    }

    return '>' + t + '<';
  }).join('');
}

function extractWordTagAssociations(editor: Editor): WordTagAssociation[] {
  const associations: WordTagAssociation[] = [];
  // Iterate top-level block nodes to track paragraph index.
  // Each direct child of the document is a block (paragraph, heading, listItem, etc.)
  let paragraphIndex = 0;
  editor.state.doc.forEach((blockNode) => {
    blockNode.descendants((node) => {
      if (!node.isText) return;
      node.marks.forEach((mark) => {
        if (mark.type.name === 'tagHighlight' && node.text) {
          // Skip auto-applied marks — only persist manual associations
          if ((mark.attrs.source as MarkSource) === 'auto') return;
          const word = node.text.trim();
          if (!word) return;
          const tags: TagRef[] = mark.attrs.tags ?? [];
          tags.forEach(({ tagId }) => {
            // Skip archetype refs (stored as 'arch:<id>') — not word-tag associations
            if (tagId && !tagId.startsWith('arch:')) {
              associations.push({ tag_id: tagId, word, paragraph_index: paragraphIndex });
            }
          });
        }
      });
    });
    paragraphIndex++;
  });
  // Deduplicate by tag_id + word + paragraph_index
  const seen = new Set<string>();
  return associations.filter(({ tag_id, word, paragraph_index }) => {
    const key = `${tag_id}:${word.toLowerCase()}:${paragraph_index}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
    const markType = state.schema.marks['tagHighlight'];
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

function removeTagMarksFromEditor(editor: Editor, tagId: string) {
  try {
    editor.chain()
      .command(makeRemoveTagCommand(tagId, 0, editor.state.doc.content.size))
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

  const [title, setTitle] = useState('');
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [dreamDate, setDreamDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isLucid, setIsLucid] = useState(false);
  const [moodRating, setMoodRating] = useState<number | null>(null);
  const [clarityRating, setClarityRating] = useState<number | null>(null);
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const [selectedArchetypeIds, setSelectedArchetypeIds] = useState<string[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [wakingLifeContext, setWakingLifeContext] = useState('');
  const [analysisNotes, setAnalysisNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalysing, setIsAnalysing] = useState(false);
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
        selectedTagIds: selectedTags.map((t) => t.id),
        wakingLifeContext,
        contentHtml: editor.getHTML(),
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // ignore storage errors
    }
  }, [editorOpen, editingDreamId, editor, title, dreamDate, isLucid, moodRating, clarityRating, selectedTags, wakingLifeContext]);

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

  /** Remove a specific tag from just the hovered span (identified by its doc range). */
  const handleRemoveTagFromSpan = (tagId: string) => {
    if (!editor || !tagHoverInfo) return;
    try {
      editor.chain()
        .command(makeRemoveTagCommand(tagId, tagHoverInfo.from, tagHoverInfo.to))
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
      setWakingLifeContext(draft.wakingLifeContext || '');
      editor.commands.setContent(draft.contentHtml || '');
      // Restore tags by ID
      const restoredTags = allTags.filter((t) => draft.selectedTagIds?.includes(t.id));
      setSelectedTags(restoredTags);
      draftRestoredRef.current = true;
    } catch {
      // ignore
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
          waking_life_context: wakingLifeContext.trim() || null,
          analysis_notes: analysisNotes.trim() || null,
          tag_ids: selectedTags.map((t) => t.id),
          word_tag_associations: wordTagAssociations,
        });
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

  const handleAutoMatchTags = () => {
    if (!editor) return;
    const text = editor.getText().toLowerCase();
    const matched = allTags.filter(
      (tag) =>
        !selectedTags.some((t) => t.id === tag.id) &&
        (
          text.includes(tag.name.toLowerCase()) ||
          tag.aliases.some((alias) => text.includes(alias.toLowerCase()))
        )
    );
    if (matched.length === 0) return;

    setSelectedTags([...selectedTags, ...matched]);

    // Apply auto-highlight marks to each occurrence of the matched words
    const doc = editor.state.doc;
    const { tr } = editor.state;
    const markType = editor.schema.marks.tagHighlight;

    matched.forEach((tag) => {
      const searchTerms = [tag.name, ...tag.aliases].map((s) => s.toLowerCase());
      doc.descendants((node, pos) => {
        if (!node.isText || !node.text) return;
        const lower = node.text.toLowerCase();
        searchTerms.forEach((term) => {
          let idx = lower.indexOf(term);
          while (idx !== -1) {
            const from = pos + idx;
            const to = from + term.length;
            const autoMark = markType.create({ tags: [{ tagId: tag.id, tagColor: tag.color, tagName: tag.name }], source: 'auto' });
            tr.addMark(from, to, autoMark);
            idx = lower.indexOf(term, idx + 1);
          }
        });
      });
    });

    editor.view.dispatch(tr);
  };

  const handleGrammarFix = () => {
    if (!editor) return;
    const fixed = applyGrammarFixes(editor.getHTML());
    editor.commands.setContent(fixed, false);
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

      // 3. Apply in-text highlights for all newly added tags
      if (allNewTags.length > 0 && editor) {
        const doc = editor.state.doc;
        const { tr } = editor.state;
        const markType = editor.schema.marks.tagHighlight;
        allNewTags.forEach((tag) => {
          const searchTerms = [tag.name, ...tag.aliases].map((s) => s.toLowerCase());
          doc.descendants((node, pos) => {
            if (!node.isText || !node.text) return;
            const lower = node.text.toLowerCase();
            searchTerms.forEach((term) => {
              let idx = lower.indexOf(term);
              while (idx !== -1) {
                const from = pos + idx;
                const to = from + term.length;
                const autoMark = markType.create({
                  tags: [{ tagId: tag.id, tagColor: tag.color, tagName: tag.name }],
                  source: 'auto',
                });
                tr.addMark(from, to, autoMark);
                idx = lower.indexOf(term, idx + 1);
              }
            });
          });
        });
        editor.view.dispatch(tr);
      }

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
            <TagPicker selectedTags={selectedTags} onTagsChange={handleTagsChange} />
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
                <ToolbarButton onClick={handleGrammarFix} isActive={false}>
                  <SpellCheck className="h-4 w-4" />
                </ToolbarButton>
                <Separator orientation="vertical" className="h-6 mx-1" />
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
                  disabled={isAnalysing}
                  title="Analyse dream with AI: suggests tags and theme notes"
                >
                  <Brain className="h-3.5 w-3.5" />
                  {isAnalysing ? 'Analysing…' : 'AI Analyse'}
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
                          {[...selectedTags].sort((a, b) => a.name.localeCompare(b.name)).map((tag) => {
                            const activeMark = editor.state.selection.$from
                              .marks()
                              .find((m) => m.type.name === 'tagHighlight');
                            const activeTags: TagRef[] = activeMark?.attrs.tags ?? [];
                            const isActive = activeTags.some((t) => t.tagId === tag.id);
                            return (
                              <button
                                key={tag.id}
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  const { from, to } = editor.state.selection;
                                  const existingMark = editor.state.doc
                                    .rangeHasMark(from, to, editor.schema.marks.tagHighlight)
                                    ? editor.state.doc.resolve(from).marks().find((m) => m.type.name === 'tagHighlight')
                                    : null;
                                  const currentTags: TagRef[] = existingMark?.attrs.tags ?? [];
                                  const newTags = isActive
                                    ? currentTags.filter((t) => t.tagId !== tag.id)
                                    : [...currentTags, { tagId: tag.id, tagColor: tag.color, tagName: tag.name }];
                                  if (newTags.length === 0) {
                                    editor.chain().focus().unsetMark('tagHighlight').run();
                                  } else {
                                    editor.chain().focus().setMark('tagHighlight', { tags: newTags }).run();
                                  }
                                }}
                                className={cn(
                                  'px-2 py-0.5 rounded text-xs font-medium transition-all border',
                                  isActive && 'ring-2 ring-offset-1 ring-current'
                                )}
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
                            const activeMark = editor.state.selection.$from
                              .marks()
                              .find((m) => m.type.name === 'tagHighlight');
                            const activeTags: TagRef[] = activeMark?.attrs.tags ?? [];
                            const archTagId = `arch:${arch.id}`;
                            const isActive = activeTags.some((t) => t.tagId === archTagId);
                            return (
                              <button
                                key={arch.id}
                                type="button"
                                title={arch.description}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  const { from, to } = editor.state.selection;
                                  const existingMark = editor.state.doc
                                    .rangeHasMark(from, to, editor.schema.marks.tagHighlight)
                                    ? editor.state.doc.resolve(from).marks().find((m) => m.type.name === 'tagHighlight')
                                    : null;
                                  const currentTags: TagRef[] = existingMark?.attrs.tags ?? [];
                                  const newTags = isActive
                                    ? currentTags.filter((t) => t.tagId !== archTagId)
                                    : [...currentTags, { tagId: archTagId, tagColor: arch.color, tagName: arch.name }];
                                  if (newTags.length === 0) {
                                    editor.chain().focus().unsetMark('tagHighlight').run();
                                  } else {
                                    editor.chain().focus().setMark('tagHighlight', { tags: newTags }).run();
                                  }
                                }}
                                className={cn(
                                  'px-2 py-0.5 rounded text-[10px] font-medium transition-all border italic',
                                  isActive && 'ring-2 ring-offset-1 ring-current'
                                )}
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

          {/* Mood and Clarity sliders */}
          <div className="grid grid-cols-2 gap-6">
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
          </div>

          {/* Analysis Notes */}
          <div className="space-y-2">
            <Label htmlFor="analysis-notes">Analysis Notes</Label>
            <Textarea
              id="analysis-notes"
              placeholder="Patterns, symbols, interpretations, recurring themes…"
              value={analysisNotes}
              onChange={(e) => setAnalysisNotes(e.target.value)}
              className="resize-none"
              rows={3}
            />
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
