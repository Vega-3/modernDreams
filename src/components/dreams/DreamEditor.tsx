import { useState, useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
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
} from 'lucide-react';
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
  DialogFooter,
} from '@/components/ui/dialog';
import { TagPicker } from '@/components/tags/TagPicker';
import { cn } from '@/lib/utils';
import { useDreamStore } from '@/stores/dreamStore';
import { useUIStore } from '@/stores/uiStore';
import { useTagStore } from '@/stores/tagStore';
import type { Tag } from '@/lib/tauri';

// Grammar fixes applied only to text nodes between HTML tags.
// Only unambiguous single-solution corrections are applied.
function applyGrammarFixes(html: string): string {
  return html.replace(/>([^<]+)</g, (_, text: string) => {
    let t = text;
    // Collapse multiple spaces
    t = t.replace(/  +/g, ' ');
    // Standalone lowercase "i" → "I"
    t = t.replace(/\bi\b/g, 'I');
    // Common contractions missing apostrophes
    const contractions: [RegExp, string][] = [
      [/\bdont\b/gi, "don't"],
      [/\bcant\b/gi, "can't"],
      [/\bwont\b/gi, "won't"],
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
    ];
    for (const [pattern, replacement] of contractions) {
      t = t.replace(pattern, replacement);
    }
    // Capitalise first letter after sentence-ending punctuation
    t = t.replace(/([.!?]\s+)([a-z])/g, (_, punct, letter) => punct + letter.toUpperCase());
    // Capitalise the very first character of the text node
    if (t.length > 0 && /[a-z]/.test(t[0])) {
      t = t[0].toUpperCase() + t.slice(1);
    }
    return '>' + t + '<';
  });
}

export function DreamEditor() {
  const { editorOpen, editingDreamId, closeEditor } = useUIStore();
  const { dreams, createDream, updateDream } = useDreamStore();
  const allTags = useTagStore((state) => state.tags);

  const [title, setTitle] = useState('');
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [dreamDate, setDreamDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isLucid, setIsLucid] = useState(false);
  const [moodRating, setMoodRating] = useState<number | null>(null);
  const [clarityRating, setClarityRating] = useState<number | null>(null);
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const editingDream = editingDreamId ? dreams.find((d) => d.id === editingDreamId) : null;

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
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'tiptap min-h-[200px] focus:outline-none',
      },
    },
  });

  // Load existing dream data when editing
  useEffect(() => {
    if (editingDream && editor) {
      setTitle(editingDream.title);
      setDreamDate(editingDream.dream_date);
      setIsLucid(editingDream.is_lucid);
      setMoodRating(editingDream.mood_rating);
      setClarityRating(editingDream.clarity_rating);
      setSelectedTags(editingDream.tags);
      editor.commands.setContent(editingDream.content_html);
    } else if (!editingDreamId && editor) {
      setTitle('');
      setDreamDate(format(new Date(), 'yyyy-MM-dd'));
      setIsLucid(false);
      setMoodRating(null);
      setClarityRating(null);
      setSelectedTags([]);
      editor.commands.setContent('');
    }
  }, [editingDream, editingDreamId, editor]);

  const handleSave = async () => {
    if (!editor || !title.trim()) return;

    setIsSaving(true);
    try {
      const contentHtml = editor.getHTML();
      const contentPlain = editor.getText();

      if (editingDreamId) {
        await updateDream({
          id: editingDreamId,
          title: title.trim(),
          content_html: contentHtml,
          content_plain: contentPlain,
          dream_date: dreamDate,
          is_lucid: isLucid,
          mood_rating: moodRating,
          clarity_rating: clarityRating,
          tag_ids: selectedTags.map((t) => t.id),
        });
      } else {
        await createDream({
          title: title.trim(),
          content_html: contentHtml,
          content_plain: contentPlain,
          dream_date: dreamDate,
          is_lucid: isLucid,
          mood_rating: moodRating,
          clarity_rating: clarityRating,
          tag_ids: selectedTags.map((t) => t.id),
        });
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
    if (matched.length > 0) {
      setSelectedTags([...selectedTags, ...matched]);
    }
  };

  const handleGrammarFix = () => {
    if (!editor) return;
    const fixed = applyGrammarFixes(editor.getHTML());
    editor.commands.setContent(fixed, false);
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
    <Dialog open={editorOpen} onOpenChange={(open) => !open && closeEditor()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingDreamId ? 'Edit Dream' : 'New Dream Entry'}</DialogTitle>
        </DialogHeader>

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
            <TagPicker selectedTags={selectedTags} onTagsChange={setSelectedTags} />
          </div>

          {/* Editor toolbar */}
          <div className="space-y-2">
            <Label>Content</Label>
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
              </div>
              <div className="p-4">
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
  );
}
