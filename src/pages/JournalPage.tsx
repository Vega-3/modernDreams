import { DreamList } from '@/components/dreams/DreamList';
import { HandwritingUpload } from '@/components/handwriting/HandwritingUpload';
import { HandwritingPreview } from '@/components/handwriting/HandwritingPreview';
import { VoiceRecordDialog } from '@/components/voice/VoiceRecordDialog';
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
    voiceRecordOpen,
    closeVoiceRecord,
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
    <>
      <DreamList />
      <VoiceRecordDialog
        open={voiceRecordOpen}
        onClose={closeVoiceRecord}
        onDreamSaved={fetchDreams}
      />
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
