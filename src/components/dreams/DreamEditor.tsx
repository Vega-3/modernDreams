import { useState, useEffect, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  LinkIcon,
  Heading1,
  Heading2,
  Undo,
  Redo,
  Sparkles,
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
import type { Tag, Dream } from '@/lib/tauri';

export function DreamEditor() {
  const { editorOpen, editingDreamId, closeEditor } = useUIStore();
  const { dreams, createDream, updateDream } = useDreamStore();

  const [title, setTitle] = useState('');
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
      // Reset form for new dream
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
            <Label>Tags</Label>
            <TagPicker selectedTags={selectedTags} onTagsChange={setSelectedTags} />
          </div>

          {/* Editor toolbar */}
          <div className="space-y-2">
            <Label>Content</Label>
            <div className="border rounded-lg">
              <div className="flex items-center gap-1 p-2 border-b bg-muted/50">
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
