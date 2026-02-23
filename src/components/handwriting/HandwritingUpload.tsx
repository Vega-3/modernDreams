import { useState, useCallback } from 'react';
import { Upload, Image, X, FileText, Loader2 } from 'lucide-react';
import { createWorker, Worker } from 'tesseract.js';
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

    const files = Array.from(e.dataTransfer.files).filter((file) =>
      file.type.startsWith('image/')
    );
    addFiles(files);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files).filter((file) =>
        file.type.startsWith('image/')
      );
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
      if (image) {
        URL.revokeObjectURL(image.preview);
      }
      return prev.filter((img) => img.id !== id);
    });
  };

  const preprocessImage = async (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const img = new window.Image();

      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;

        // Draw original image
        ctx.drawImage(img, 0, 0);

        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Convert to grayscale and apply threshold (similar to OpenCV preprocessing)
        for (let i = 0; i < data.length; i += 4) {
          // Grayscale conversion
          const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

          // Threshold (invert for better OCR on dark text)
          const threshold = 150;
          const value = gray < threshold ? 0 : 255;

          data[i] = value;     // R
          data[i + 1] = value; // G
          data[i + 2] = value; // B
          // Alpha stays the same
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };

      img.src = URL.createObjectURL(file);
    });
  };

  const processImages = async () => {
    if (images.length === 0) return;

    setIsProcessing(true);
    setProcessingProgress(0);

    let worker: Worker | null = null;

    try {
      // Create Tesseract worker
      worker = await createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            // Update progress for current image
          }
        },
      });

      const totalImages = images.length;
      const updatedImages = [...images];

      for (let i = 0; i < totalImages; i++) {
        const image = updatedImages[i];

        // Update status to processing
        updatedImages[i] = { ...image, status: 'processing' };
        setImages([...updatedImages]);

        try {
          // Preprocess the image
          const processedDataUrl = await preprocessImage(image.file);

          // Recognize text
          const { data: { text } } = await worker.recognize(processedDataUrl);

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
        setProcessingProgress(((i + 1) / totalImages) * 100);
      }

      // All done - pass results to parent
      const successfulResults = updatedImages
        .filter((img) => img.status === 'done' && img.recognizedText)
        .map((img) => ({
          text: img.recognizedText!,
          imagePreview: img.preview,
        }));

      if (successfulResults.length > 0) {
        onImagesProcessed(successfulResults);
      }
    } catch (error) {
      console.error('OCR Error:', error);
    } finally {
      if (worker) {
        await worker.terminate();
      }
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    // Clean up previews
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
            Upload images of handwritten dream entries. The text will be recognized and you can review it before saving.
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
                        <span className="text-xs text-red-400">Error</span>
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

          {/* Progress bar */}
          {isProcessing && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Processing images...</span>
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
                Processing...
              </>
            ) : (
              <>
                <Image className="h-4 w-4 mr-2" />
                Recognize Text ({images.length})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
