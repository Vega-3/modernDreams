import { DreamList } from '@/components/dreams/DreamList';
import { DreamEditor } from '@/components/dreams/DreamEditor';
import { HandwritingUpload } from '@/components/handwriting/HandwritingUpload';
import { HandwritingPreview } from '@/components/handwriting/HandwritingPreview';
import { useUIStore } from '@/stores/uiStore';
import { useDreamStore } from '@/stores/dreamStore';

export function JournalPage() {
  const {
    handwritingUploadOpen,
    closeHandwritingUpload,
    handwritingPreviewOpen,
    closeHandwritingPreview,
    recognizedDreams,
    setRecognizedDreams,
    openHandwritingPreview,
  } = useUIStore();

  const { fetchDreams } = useDreamStore();

  const handleImagesProcessed = (results: { text: string; imagePreview: string }[]) => {
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
    <>
      <DreamList />
      <DreamEditor />
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
    </>
  );
}
