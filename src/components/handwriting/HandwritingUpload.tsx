import { useState, useCallback, useEffect } from 'react';
import { Upload, Image, X, FileText, Loader2 } from 'lucide-react';
import { transcribeHandwritingClaude } from '@/lib/tauri';
import { friendlyApiError } from '@/lib/apiError';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  rawTranscript?: string;
  englishTranscript?: string;
  error?: string;
}

interface HandwritingUploadProps {
  open: boolean;
  onClose: () => void;
  onImagesProcessed: (results: {
    rawTranscript: string;
    englishTranscript: string;
    imagePreview: string;
  }[]) => void;
}

/** Convert a File to a plain base64 string (no data-URL prefix). */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.split(',')[1]);
    };
    reader.onerror = reject;
  });
}

export function HandwritingUpload({ open, onClose, onImagesProcessed }: HandwritingUploadProps) {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);

  // Bug fix: Radix Dialog does NOT call onOpenChange when the `open` prop is changed
  // programmatically from the parent — only on user-initiated closes (Escape, backdrop).
  // So we must reset state here instead of relying on handleClose() being called.
  useEffect(() => {
    if (!open) {
      setImages((prev) => {
        prev.forEach((img) => URL.revokeObjectURL(img.preview));
        return [];
      });
      setProcessingProgress(0);
      setIsProcessing(false);
      setApiKeyMissing(false);
    }
  }, [open]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
    addFiles(files);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files).filter((f) => f.type.startsWith('image/'));
      addFiles(files);
    }
  };

  const addFiles = (files: File[]) => {
    const newImages: UploadedImage[] = files.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      preview: URL.createObjectURL(file),
      status: 'pending' as const,
    }));
    setImages((prev) => [...prev, ...newImages]);
  };

  const removeImage = (id: string) => {
    setImages((prev) => {
      const image = prev.find((img) => img.id === id);
      if (image) URL.revokeObjectURL(image.preview);
      return prev.filter((img) => img.id !== id);
    });
  };

  const processImages = async () => {
    if (images.length === 0) return;

    const apiKey = localStorage.getItem('anthropic_api_key') ?? '';
    if (!apiKey.trim()) {
      setApiKeyMissing(true);
      return;
    }
    setApiKeyMissing(false);
    setIsProcessing(true);
    setProcessingProgress(0);

    const total = images.length;
    const updatedImages = [...images];

    for (let i = 0; i < total; i++) {
      const image = updatedImages[i];

      updatedImages[i] = { ...image, status: 'processing' };
      setImages([...updatedImages]);

      try {
        const base64 = await fileToBase64(image.file);
        const mediaType = image.file.type || 'image/jpeg';
        const result = await transcribeHandwritingClaude(base64, mediaType, apiKey);

        updatedImages[i] = {
          ...image,
          status: 'done',
          rawTranscript: result.raw_transcript.trim(),
          englishTranscript: result.english_transcript.trim(),
        };
      } catch (error) {
        updatedImages[i] = {
          ...image,
          status: 'error',
          error: String(error),
        };
      }

      setImages([...updatedImages]);
      setProcessingProgress(((i + 1) / total) * 100);
    }

    const successfulResults = updatedImages
      .filter((img) => img.status === 'done')
      .map((img) => ({
        rawTranscript: img.rawTranscript ?? '',
        englishTranscript: img.englishTranscript ?? '',
        imagePreview: img.preview,
      }));

    setIsProcessing(false);

    // Only close and proceed to preview if at least one image succeeded.
    // If all failed, leave the dialog open so the error messages are visible.
    if (successfulResults.length > 0) {
      onImagesProcessed(successfulResults);
    }
  };

  const handleClose = () => {
    images.forEach((img) => URL.revokeObjectURL(img.preview));
    setImages([]);
    setProcessingProgress(0);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Upload Handwritten Dreams
          </DialogTitle>
          <DialogDescription>
            Upload images of handwritten dream entries. Claude AI transcribes the text and
            translates it to English — you can review both versions before saving.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Drop zone */}
          <div
            className={cn(
              'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
              dragActive ? 'border-primary bg-primary/10' : 'border-muted-foreground/25',
              isProcessing && 'pointer-events-none opacity-50'
            )}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-2">
              Drag and drop images here, or click to select
            </p>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              id="handwriting-upload"
              disabled={isProcessing}
            />
            <Button variant="outline" asChild disabled={isProcessing}>
              <label htmlFor="handwriting-upload" className="cursor-pointer">
                Select Images
              </label>
            </Button>
          </div>

          {/* Image previews */}
          {images.length > 0 && (
            <ScrollArea className="h-48">
              <div className="grid grid-cols-3 gap-3 p-1">
                {images.map((image) => (
                  <div
                    key={image.id}
                    className="relative group rounded-lg overflow-hidden border bg-muted"
                  >
                    <img
                      src={image.preview}
                      alt="Uploaded handwriting"
                      className="w-full h-24 object-cover"
                    />

                    {/* Status overlay */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      {image.status === 'pending' && (
                        <span className="text-xs text-white">Pending</span>
                      )}
                      {image.status === 'processing' && (
                        <Loader2 className="h-6 w-6 text-white animate-spin" />
                      )}
                      {image.status === 'done' && (
                        <span className="text-xs text-green-400">Done</span>
                      )}
                      {image.status === 'error' && (
                        <span className="text-xs text-red-400" title={image.error}>
                          Error
                        </span>
                      )}
                    </div>

                    {/* Remove button */}
                    {!isProcessing && (
                      <button
                        onClick={() => removeImage(image.id)}
                        className="absolute top-1 right-1 p-1 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {/* API key missing warning */}
          {apiKeyMissing && (
            <div className="rounded-md bg-amber-500/10 border border-amber-500/20 p-3 text-sm text-amber-600 dark:text-amber-400">
              No Anthropic API key configured. Please go to{' '}
              <strong>Settings → Anthropic API Key</strong> and add your key before transcribing.
            </div>
          )}

          {/* Per-image errors */}
          {images.some((img) => img.status === 'error') && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              {images
                .filter((img) => img.status === 'error')
                .map((img) => (
                  <p key={img.id}>
                    <span className="font-medium">{img.file.name}:</span>{' '}
                    {friendlyApiError(img.error ?? 'Unknown error')}
                  </p>
                ))}
            </div>
          )}

          {/* Progress bar */}
          {isProcessing && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Transcribing with Claude AI…</span>
                <span>{Math.round(processingProgress)}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${processingProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button
            onClick={processImages}
            disabled={images.length === 0 || isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Transcribing…
              </>
            ) : (
              <>
                <Image className="h-4 w-4 mr-2" />
                Transcribe ({images.length})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
