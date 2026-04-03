import { DreamList } from '@/components/dreams/DreamList';
import { HandwritingUpload } from '@/components/handwriting/HandwritingUpload';
import { HandwritingPreview } from '@/components/handwriting/HandwritingPreview';
import { useUIStore } from '@/stores/uiStore';
import { useDreamStore } from '@/stores/dreamStore';



export function JournalPage() {
  const {
    editorOpen,
    handwritingUploadOpen,
    closeHandwritingUpload,
    handwritingPreviewOpen,
    closeHandwritingPreview,
    recognizedDreams,
    setRecognizedDreams,
    openHandwritingPreview,
  } = useUIStore();

  const { fetchDreams } = useDreamStore();

  const handleImagesProcessed = (
    results: { rawTranscript: string; englishTranscript: string; imagePreview: string }[],
  ) => {
    if (results.length === 0) {
      // All images failed — just close the upload dialog; errors are shown there.
      closeHandwritingUpload();
      return;
    }
    setRecognizedDreams(results);
    closeHandwritingUpload();
    openHandwritingPreview();
  };

  const handlePreviewClose = () => {
    closeHandwritingPreview();
    // Refresh the dream list to show newly added dreams
    fetchDreams();
  };

  return (
    /* Negative margin bleeds the background flush to the edges of <main>;
       inner padding restores the normal content offset. */
    <div className="journal-rings-bg -m-6 p-6" style={{ minHeight: 'calc(100vh - 3.5rem)' }}>
      <DreamList />
      <HandwritingUpload
        open={handwritingUploadOpen}
        onClose={closeHandwritingUpload}
        onImagesProcessed={handleImagesProcessed}
      />
      <HandwritingPreview
        open={handwritingPreviewOpen}
        onClose={handlePreviewClose}
        recognizedDreams={recognizedDreams}
      />
    </div>
  );
}
