import { useState, useCallback } from 'react';
import { Upload, Image, X, FileText, Loader2 } from 'lucide-react';
import { recognizeHandwriting } from '@/lib/tauri';
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
  recognizedText?: string;
  error?: string;
}

interface HandwritingUploadProps {
  open: boolean;
  onClose: () => void;
  onImagesProcessed: (results: { text: string; imagePreview: string }[]) => void;
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
        const text = await recognizeHandwriting(base64);

        updatedImages[i] = {
          ...image,
          status: 'done',
          recognizedText: text.trim(),
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
      .filter((img) => img.status === 'done' && img.recognizedText)
      .map((img) => ({
        text: img.recognizedText!,
        imagePreview: img.preview,
      }));

    // Always call the callback so the preview dialog opens (even if some images failed)
    onImagesProcessed(successfulResults.length > 0 ? successfulResults : []);

    setIsProcessing(false);
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
            Upload images of handwritten dream entries. Text is recognised using the Windows OCR
            engine, then you can review and edit before saving.
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

          {/* Per-image errors */}
          {images.some((img) => img.status === 'error') && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              {images
                .filter((img) => img.status === 'error')
                .map((img) => (
                  <p key={img.id}>
                    <span className="font-medium">{img.file.name}:</span>{' '}
                    {img.error ?? 'Unknown error'}
                  </p>
                ))}
            </div>
          )}

          {/* Progress bar */}
          {isProcessing && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Recognising text…</span>
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
                Processing…
              </>
            ) : (
              <>
                <Image className="h-4 w-4 mr-2" />
                Recognise Text ({images.length})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
