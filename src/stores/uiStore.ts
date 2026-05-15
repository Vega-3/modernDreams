import { create } from 'zustand';

type View = 'dashboard' | 'journal' | 'calendar' | 'graph' | 'tags' | 'theme' | 'archetypes' | 'series' | 'analyst' | 'settings' | 'guide';

interface RecognizedDream {
  rawTranscript: string;
  englishTranscript: string;
  imagePreview: string;
}

export interface ImportQueueItem {
  title: string;
  contentHtml: string;
  contentPlain: string;
  date: string;
  /** Optional — only set in Professional mode imports. */
  clientId?: string;
  clientName?: string;
  /** Tag IDs auto-matched from file content at parse time. */
  tagIds?: string[];
}

interface UIState {
  currentView: View;
  sidebarCollapsed: boolean;
  searchOpen: boolean;
  editorOpen: boolean;
  editingDreamId: string | null;
  handwritingUploadOpen: boolean;
  handwritingPreviewOpen: boolean;
  recognizedDreams: RecognizedDream[];
  voiceRecordOpen: boolean;
  bulkImportOpen: boolean;

  // Bulk-import queue (professional mode)
  importQueue: ImportQueueItem[];
  importQueueIndex: number;

  // Actions
  setView: (view: View) => void;
  toggleSidebar: () => void;
  openSearch: () => void;
  closeSearch: () => void;
  openEditor: (dreamId?: string) => void;
  closeEditor: () => void;
  openHandwritingUpload: () => void;
  closeHandwritingUpload: () => void;
  openVoiceRecord: () => void;
  closeVoiceRecord: () => void;
  openBulkImport: () => void;
  closeBulkImport: () => void;
  setRecognizedDreams: (dreams: RecognizedDream[]) => void;
  openHandwritingPreview: () => void;
  closeHandwritingPreview: () => void;

  // Queue actions
  startImportQueue: (items: ImportQueueItem[]) => void;
  advanceImportQueue: () => void;
  clearImportQueue: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  currentView: 'journal',
  sidebarCollapsed: false,
  searchOpen: false,
  editorOpen: false,
  editingDreamId: null,
  handwritingUploadOpen: false,
  handwritingPreviewOpen: false,
  recognizedDreams: [],
  voiceRecordOpen: false,
  bulkImportOpen: false,
  importQueue: [],
  importQueueIndex: 0,

  setView: (view) => set({ currentView: view }),

  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  openSearch: () => set({ searchOpen: true }),
  closeSearch: () => set({ searchOpen: false }),

  openEditor: (dreamId) => set({ editorOpen: true, editingDreamId: dreamId || null }),
  closeEditor: () => set({ editorOpen: false, editingDreamId: null }),

  openHandwritingUpload: () => set({ handwritingUploadOpen: true }),
  closeHandwritingUpload: () => set({ handwritingUploadOpen: false }),

  openVoiceRecord: () => set({ voiceRecordOpen: true }),
  closeVoiceRecord: () => set({ voiceRecordOpen: false }),

  openBulkImport: () => set({ bulkImportOpen: true }),
  closeBulkImport: () => set({ bulkImportOpen: false }),

  setRecognizedDreams: (dreams) => set({ recognizedDreams: dreams }),

  openHandwritingPreview: () => set({ handwritingPreviewOpen: true }),
  closeHandwritingPreview: () => set({ handwritingPreviewOpen: false, recognizedDreams: [] }),

  startImportQueue: (items) => set({ importQueue: items, importQueueIndex: 0, editorOpen: items.length > 0 }),

  advanceImportQueue: () =>
    set((state) => {
      const next = state.importQueueIndex + 1;
      if (next < state.importQueue.length) {
        return { importQueueIndex: next, editorOpen: true };
      }
      return { importQueue: [], importQueueIndex: 0, editorOpen: false };
    }),

  clearImportQueue: () => set({ importQueue: [], importQueueIndex: 0 }),
}));
