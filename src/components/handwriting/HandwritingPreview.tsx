import { useState, useEffect } from 'react';
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
import { useDreamStore } from '@/stores/dreamStore';
import type { Tag } from '@/lib/tauri';

interface RecognizedDream {
  text: string;
  imagePreview: string;
}

interface HandwritingPreviewProps {
  open: boolean;
  onClose: () => void;
  recognizedDreams: RecognizedDream[];
}

interface DreamFormData {
  title: string;
  content: string;
  dreamDate: string;
  isLucid: boolean;
  moodRating: number | null;
  clarityRating: number | null;
  tags: Tag[];
}

function generateTitle(text: string): string {
  const firstLine = text.split('\n')[0].trim();
  if (firstLine.length <= 50) {
    return firstLine || 'Untitled Dream';
  }
  return firstLine.substring(0, 47) + '...';
}

function buildFormData(dreams: RecognizedDream[]): DreamFormData[] {
  return dreams.map((dream) => ({
    title: generateTitle(dream.text),
    content: dream.text,
    dreamDate: format(new Date(), 'yyyy-MM-dd'),
    isLucid: false,
    moodRating: null,
    clarityRating: null,
    tags: [],
  }));
}

export function HandwritingPreview({ open, onClose, recognizedDreams }: HandwritingPreviewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [formData, setFormData] = useState<DreamFormData[]>(() => buildFormData(recognizedDreams));
  const [savedCount, setSavedCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const { createDream } = useDreamStore();

  // Reinitialise state whenever the dialog opens with a fresh set of recognised dreams
  useEffect(() => {
    if (open && recognizedDreams.length > 0) {
      setFormData(buildFormData(recognizedDreams));
      setCurrentIndex(0);
      setSavedCount(0);
    }
  }, [open, recognizedDreams]);

  const currentDream = recognizedDreams[currentIndex];
  // Bug fix: formData is initialised from [] on first mount (recognizedDreams isn't populated
  // yet). Fall back to building it fresh from recognizedDreams on the first render so the
  // Dialog can open immediately without waiting for the useEffect to fire.
  const resolvedFormData =
    formData.length === recognizedDreams.length ? formData : buildFormData(recognizedDreams);
  const currentForm = resolvedFormData[currentIndex];
  const totalDreams = recognizedDreams.length;

  const updateCurrentForm = (updates: Partial<DreamFormData>) => {
    setFormData(() => {
      const newData = [...resolvedFormData];
      newData[currentIndex] = { ...newData[currentIndex], ...updates };
      return newData;
    });
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < totalDreams - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleSaveCurrent = async () => {
    if (!currentForm || !currentForm.title.trim() || !currentForm.content.trim()) return;

    setIsSaving(true);
    try {
      await createDream({
        title: currentForm.title.trim(),
        content_html: `<p>${currentForm.content.replace(/\n/g, '</p><p>')}</p>`,
        content_plain: currentForm.content,
        dream_date: currentForm.dreamDate,
        is_lucid: currentForm.isLucid,
        mood_rating: currentForm.moodRating,
        clarity_rating: currentForm.clarityRating,
        tag_ids: currentForm.tags.map((t) => t.id),
      });

      setSavedCount((prev) => prev + 1);

      // Move to next or close if this was the last one
      if (currentIndex < totalDreams - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        // All done
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
    try {
      for (let i = 0; i < resolvedFormData.length; i++) {
        const form = resolvedFormData[i];
        if (!form.title.trim() || !form.content.trim()) continue;

        await createDream({
          title: form.title.trim(),
          content_html: `<p>${form.content.replace(/\n/g, '</p><p>')}</p>`,
          content_plain: form.content,
          dream_date: form.dreamDate,
          is_lucid: form.isLucid,
          mood_rating: form.moodRating,
          clarity_rating: form.clarityRating,
          tag_ids: form.tags.map((t) => t.id),
        });
      }

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

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Review Recognized Dream</DialogTitle>
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

          {/* Recognized text editor */}
          <div className="space-y-2">
            <Label htmlFor="content">Recognized Text (edit as needed)</Label>
            <textarea
              id="content"
              value={currentForm.content}
              onChange={(e) => updateCurrentForm({ content: e.target.value })}
              className="w-full h-48 p-3 rounded-md border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Recognized dream content..."
            />
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
