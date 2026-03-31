import { create } from 'zustand';

type View = 'dashboard' | 'journal' | 'calendar' | 'graph' | 'tags' | 'theme' | 'settings' | 'guide';

interface RecognizedDream {
  rawTranscript: string;
  englishTranscript: string;
  imagePreview: string;
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

  // Actions
  setView: (view: View) => void;
  toggleSidebar: () => void;
  openSearch: () => void;
  closeSearch: () => void;
  openEditor: (dreamId?: string) => void;
  closeEditor: () => void;
  openHandwritingUpload: () => void;
  closeHandwritingUpload: () => void;
  setRecognizedDreams: (dreams: RecognizedDream[]) => void;
  openHandwritingPreview: () => void;
  closeHandwritingPreview: () => void;
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

  setView: (view) => set({ currentView: view }),

  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  openSearch: () => set({ searchOpen: true }),
  closeSearch: () => set({ searchOpen: false }),

  openEditor: (dreamId) => set({ editorOpen: true, editingDreamId: dreamId || null }),
  closeEditor: () => set({ editorOpen: false, editingDreamId: null }),

  openHandwritingUpload: () => set({ handwritingUploadOpen: true }),
  closeHandwritingUpload: () => set({ handwritingUploadOpen: false }),

  setRecognizedDreams: (dreams) => set({ recognizedDreams: dreams }),

  openHandwritingPreview: () => set({ handwritingPreviewOpen: true }),
  closeHandwritingPreview: () => set({ handwritingPreviewOpen: false, recognizedDreams: [] }),
}));
