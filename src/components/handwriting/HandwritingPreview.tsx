import { useState, useEffect } from 'react';
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Check, ChevronLeft, ChevronRight, Save, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { TagPicker } from '@/components/tags/TagPicker';
import { TagHighlight, TAG_HIGHLIGHT } from '@/components/dreams/TagHighlightExtension';
import type { TagRef } from '@/components/dreams/TagHighlightExtension';
import { cn, sortByName } from '@/lib/utils';
import { useDreamStore } from '@/stores/dreamStore';
import { useTagStore } from '@/stores/tagStore';
import type { Tag, WordTagAssociation } from '@/lib/tauri';

function extractWordTagAssociations(editor: ReturnType<typeof useEditor>): WordTagAssociation[] {
  if (!editor) return [];
  const associations: WordTagAssociation[] = [];
  const seen = new Set<string>();
  // Handwriting preview has no paragraph structure — all words share paragraph_index 0.
  editor.state.doc.descendants((node) => {
    if (!node.isText) return;
    node.marks.forEach((mark) => {
      if (mark.type.name === TAG_HIGHLIGHT && node.text) {
        const word = node.text.trim();
        if (!word) return;
        const tags: TagRef[] = mark.attrs.tags ?? [];
        tags.forEach(({ tagId }) => {
          if (tagId) {
            const key = `${tagId}:${word.toLowerCase()}`;
            if (!seen.has(key)) {
              seen.add(key);
              associations.push({ tag_id: tagId, word, paragraph_index: 0 });
            }
          }
        });
      }
    });
  });
  return associations;
}

interface RecognizedDream {
  rawTranscript: string;
  englishTranscript: string;
  imagePreview: string;
}

interface HandwritingPreviewProps {
  open: boolean;
  onClose: () => void;
  recognizedDreams: RecognizedDream[];
}

type TranscriptChoice = 'raw' | 'english';

interface DreamFormData {
  title: string;
  content: string;
  dreamDate: string;
  isLucid: boolean;
  moodRating: number | null;
  clarityRating: number | null;
  tags: Tag[];
  selectedTranscript: TranscriptChoice;
}

function generateTitle(text: string): string {
  const firstLine = text.split('\n')[0].trim();
  if (firstLine.length <= 50) {
    return firstLine || 'Untitled Dream';
  }
  return firstLine.substring(0, 47) + '...';
}

function buildFormData(
  dreams: RecognizedDream[],
  allTags: Tag[],
): DreamFormData[] {
  return dreams.map((dream) => {
    const content = dream.englishTranscript || dream.rawTranscript;
    return {
      title: generateTitle(content),
      content,
      dreamDate: format(new Date(), 'yyyy-MM-dd'),
      isLucid: false,
      moodRating: null,
      clarityRating: null,
      tags: autoMatchTags(content, [], allTags),
      selectedTranscript: 'english' as TranscriptChoice,
    };
  });
}

/** Run tag auto-matching against dream content. */
function autoMatchTags(content: string, existing: Tag[], allTags: Tag[]): Tag[] {
  const lower = content.toLowerCase();
  const matched = allTags.filter(
    (tag) =>
      !existing.some((t) => t.id === tag.id) &&
      (lower.includes(tag.name.toLowerCase()) ||
        tag.aliases.some((alias) => lower.includes(alias.toLowerCase()))),
  );
  return [...existing, ...matched];
}

export function HandwritingPreview({ open, onClose, recognizedDreams }: HandwritingPreviewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [formData, setFormData] = useState<DreamFormData[]>([]);
  const [savedCount, setSavedCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const { createDream } = useDreamStore();
  const { tags: allTags } = useTagStore();

  const editor = useEditor({
    extensions: [StarterKit, TagHighlight],
    content: '',
    editorProps: {
      attributes: { class: 'tiptap min-h-[180px] p-3 focus:outline-none text-sm' },
    },
  });

  // Reinitialise state whenever the dialog opens with a fresh set of recognised dreams
  useEffect(() => {
    if (open && recognizedDreams.length > 0) {
      const initialForms = buildFormData(recognizedDreams, allTags);
      setFormData(initialForms);
      setCurrentIndex(0);
      setSavedCount(0);
      editor?.commands.setContent(`<p>${(initialForms[0]?.content ?? '').replace(/\n/g, '</p><p>')}</p>`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, recognizedDreams]);

  // Sync editor content when navigating between dreams
  useEffect(() => {
    if (!editor || formData.length === 0) return;
    const form = formData[currentIndex];
    if (form) {
      editor.commands.setContent(`<p>${form.content.replace(/\n/g, '</p><p>')}</p>`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  const currentDream = recognizedDreams[currentIndex];
  const resolvedFormData =
    formData.length === recognizedDreams.length ? formData : buildFormData(recognizedDreams, allTags);
  const currentForm = resolvedFormData[currentIndex];
  const totalDreams = recognizedDreams.length;

  const updateCurrentForm = (updates: Partial<DreamFormData>) => {
    setFormData((prev) => {
      const newData = [...prev];
      newData[currentIndex] = { ...newData[currentIndex], ...updates };
      return newData;
    });
  };

  /** Switch between raw / English transcript, update content, and re-run tag matching. */
  const handleTranscriptSwitch = (choice: TranscriptChoice) => {
    const content =
      choice === 'raw'
        ? currentDream.rawTranscript
        : currentDream.englishTranscript;
    const newTags = autoMatchTags(content, [], allTags);
    updateCurrentForm({
      selectedTranscript: choice,
      content,
      title: generateTitle(content),
      tags: newTags,
    });
    editor?.commands.setContent(`<p>${content.replace(/\n/g, '</p><p>')}</p>`);
  };

  const handlePrevious = () => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  };

  const handleNext = () => {
    if (currentIndex < totalDreams - 1) setCurrentIndex(currentIndex + 1);
  };

  const handleSaveCurrent = async () => {
    if (!currentForm || !currentForm.title.trim() || !currentForm.content.trim()) return;

    const contentHtml = editor ? editor.getHTML() : `<p>${currentForm.content.replace(/\n/g, '</p><p>')}</p>`;
    const contentPlain = editor ? editor.getText() : currentForm.content;
    const wordTagAssociations = extractWordTagAssociations(editor);

    setIsSaving(true);
    try {
      await createDream({
        title: currentForm.title.trim(),
        content_html: contentHtml,
        content_plain: contentPlain,
        dream_date: currentForm.dreamDate,
        is_lucid: currentForm.isLucid,
        mood_rating: currentForm.moodRating,
        clarity_rating: currentForm.clarityRating,
        tag_ids: currentForm.tags.map((t) => t.id),
        word_tag_associations: wordTagAssociations,
      });

      setSavedCount((prev) => prev + 1);

      if (currentIndex < totalDreams - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        handleClose();
      }
    } catch (error) {
      console.error('Failed to save dream:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    const editorAssociations = extractWordTagAssociations(editor);
    try {
      await Promise.all(
        resolvedFormData.map((form, i) => {
          if (!form.title.trim() || !form.content.trim()) return Promise.resolve();
          return createDream({
            title: form.title.trim(),
            content_html: `<p>${form.content.replace(/\n/g, '</p><p>')}</p>`,
            content_plain: form.content,
            dream_date: form.dreamDate,
            is_lucid: form.isLucid,
            mood_rating: form.moodRating,
            clarity_rating: form.clarityRating,
            tag_ids: form.tags.map((t) => t.id),
            word_tag_associations: i === currentIndex ? editorAssociations : [],
          });
        })
      );
      handleClose();
    } catch (error) {
      console.error('Failed to save dreams:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkip = () => {
    if (currentIndex < totalDreams - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      handleClose();
    }
  };

  const handleClose = () => {
    setCurrentIndex(0);
    setSavedCount(0);
    onClose();
  };

  if (!currentDream || !currentForm) {
    return null;
  }

  const hasRaw = currentDream.rawTranscript.trim().length > 0;
  const hasEnglish = currentDream.englishTranscript.trim().length > 0;

  const activeTags: TagRef[] = editor
    ? (editor.state.selection.$from.marks().find((m) => m.type.name === TAG_HIGHLIGHT)?.attrs.tags ?? [])
    : [];

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Review Transcribed Dream</DialogTitle>
          <DialogDescription>
            Dream {currentIndex + 1} of {totalDreams}
            {savedCount > 0 && ` (${savedCount} saved)`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 gap-6 py-4">
            {/* Left side - Image preview */}
            <div className="space-y-3">
              <Label>Original Image</Label>
              <div className="border rounded-lg overflow-hidden bg-muted">
                <img
                  src={currentDream.imagePreview}
                  alt="Handwritten dream"
                  className="w-full max-h-[300px] object-contain"
                />
              </div>
            </div>

            {/* Right side - Edit form */}
            <div className="space-y-4">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={currentForm.title}
                  onChange={(e) => updateCurrentForm({ title: e.target.value })}
                  placeholder="Enter dream title..."
                />
              </div>

              {/* Date and Lucid toggle */}
              <div className="flex gap-4 items-center">
                <div className="space-y-2 flex-1">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={currentForm.dreamDate}
                    onChange={(e) => updateCurrentForm({ dreamDate: e.target.value })}
                  />
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <Switch
                    id="lucid"
                    checked={currentForm.isLucid}
                    onCheckedChange={(checked) => updateCurrentForm({ isLucid: checked })}
                  />
                  <Label htmlFor="lucid" className="flex items-center gap-1 cursor-pointer">
                    <Sparkles className="h-4 w-4" />
                    Lucid
                  </Label>
                </div>
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <Label>Tags</Label>
                <TagPicker
                  selectedTags={currentForm.tags}
                  onTagsChange={(tags) => updateCurrentForm({ tags })}
                />
              </div>
            </div>
          </div>

          {/* Transcript selector */}
          {(hasRaw || hasEnglish) && (
            <div className="space-y-2">
              <Label>Transcript Version</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleTranscriptSwitch('english')}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm transition-colors ${
                    currentForm.selectedTranscript === 'english'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background hover:bg-muted border-input'
                  }`}
                  disabled={!hasEnglish}
                >
                  English Translation
                </button>
                <button
                  type="button"
                  onClick={() => handleTranscriptSwitch('raw')}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm transition-colors ${
                    currentForm.selectedTranscript === 'raw'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background hover:bg-muted border-input'
                  }`}
                  disabled={!hasRaw}
                >
                  Raw Transcript
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Switching versions auto-updates tags. You can still edit the text below.
              </p>
            </div>
          )}

          {/* Content editor */}
          <div className="space-y-2 mt-4">
            <Label>Content (edit as needed)</Label>
            <div className="rounded-md border bg-background relative">
              {editor && currentForm.tags.length > 0 && (
                <BubbleMenu
                  editor={editor}
                  tippyOptions={{ duration: 100, placement: 'top' }}
                  shouldShow={({ from, to }) => from !== to}
                >
                  <div className="flex gap-1 bg-popover border rounded-md shadow-lg p-1.5 flex-wrap max-w-xs">
                    {sortByName(currentForm.tags).map((tag) => {
                      const isActive = activeTags.some((t) => t.tagId === tag.id);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            const { from, to } = editor.state.selection;
                            const existingMark = editor.state.doc
                              .rangeHasMark(from, to, editor.schema.marks[TAG_HIGHLIGHT])
                              ? editor.state.doc.resolve(from).marks().find((m) => m.type.name === TAG_HIGHLIGHT)
                              : null;
                            const currentTags: TagRef[] = existingMark?.attrs.tags ?? [];
                            const newTags = isActive
                              ? currentTags.filter((t) => t.tagId !== tag.id)
                              : [...currentTags, { tagId: tag.id, tagColor: tag.color, tagName: tag.name }];
                            if (newTags.length === 0) {
                              editor.chain().focus().unsetMark(TAG_HIGHLIGHT).run();
                            } else {
                              editor.chain().focus().setMark(TAG_HIGHLIGHT, { tags: newTags }).run();
                            }
                          }}
                          className={cn(
                            'px-2 py-0.5 rounded text-xs font-medium transition-all border',
                            isActive && 'ring-2 ring-offset-1 ring-current'
                          )}
                          style={{
                            backgroundColor: tag.color + '26',
                            color: tag.color,
                            borderColor: tag.color,
                          }}
                        >
                          {tag.name}
                        </button>
                      );
                    })}
                  </div>
                </BubbleMenu>
              )}
              <EditorContent editor={editor} />
              {currentForm.tags.length > 0 && (
                <p className="px-3 pb-2 text-xs text-muted-foreground">
                  Select text to tag individual words
                </p>
              )}
            </div>
          </div>

          {/* Mood and Clarity sliders */}
          <div className="grid grid-cols-2 gap-6 pt-4">
            <div className="space-y-3">
              <div className="flex justify-between">
                <Label>Mood</Label>
                <span className="text-sm text-muted-foreground">
                  {currentForm.moodRating !== null ? currentForm.moodRating : '-'}
                </span>
              </div>
              <Slider
                value={currentForm.moodRating !== null ? [currentForm.moodRating] : [5]}
                onValueChange={(v) => updateCurrentForm({ moodRating: v[0] })}
                min={1}
                max={10}
                step={1}
              />
            </div>
            <div className="space-y-3">
              <div className="flex justify-between">
                <Label>Clarity</Label>
                <span className="text-sm text-muted-foreground">
                  {currentForm.clarityRating !== null ? currentForm.clarityRating : '-'}
                </span>
              </div>
              <Slider
                value={currentForm.clarityRating !== null ? [currentForm.clarityRating] : [5]}
                onValueChange={(v) => updateCurrentForm({ clarityRating: v[0] })}
                min={1}
                max={10}
                step={1}
              />
            </div>
          </div>
        </div>

        <Separator className="my-4" />

        <DialogFooter className="flex-shrink-0">
          <div className="flex justify-between w-full">
            {/* Navigation */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={handlePrevious}
                disabled={currentIndex === 0 || isSaving}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleNext}
                disabled={currentIndex === totalDreams - 1 || isSaving}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={handleSkip} disabled={isSaving}>
                Skip
              </Button>
              <Button variant="outline" onClick={handleClose} disabled={isSaving}>
                Cancel
              </Button>
              {totalDreams > 1 && (
                <Button variant="secondary" onClick={handleSaveAll} disabled={isSaving}>
                  <Save className="h-4 w-4 mr-2" />
                  Save All
                </Button>
              )}
              <Button onClick={handleSaveCurrent} disabled={isSaving || !currentForm.title.trim()}>
                <Check className="h-4 w-4 mr-2" />
                {currentIndex === totalDreams - 1 ? 'Save & Finish' : 'Save & Next'}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
