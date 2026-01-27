import { create } from 'zustand';

type View = 'dashboard' | 'journal' | 'calendar' | 'graph' | 'tags' | 'settings';

interface UIState {
  currentView: View;
  sidebarCollapsed: boolean;
  searchOpen: boolean;
  editorOpen: boolean;
  editingDreamId: string | null;

  // Actions
  setView: (view: View) => void;
  toggleSidebar: () => void;
  openSearch: () => void;
  closeSearch: () => void;
  openEditor: (dreamId?: string) => void;
  closeEditor: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  currentView: 'journal',
  sidebarCollapsed: false,
  searchOpen: false,
  editorOpen: false,
  editingDreamId: null,

  setView: (view) => set({ currentView: view }),

  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  openSearch: () => set({ searchOpen: true }),
  closeSearch: () => set({ searchOpen: false }),

  openEditor: (dreamId) => set({ editorOpen: true, editingDreamId: dreamId || null }),
  closeEditor: () => set({ editorOpen: false, editingDreamId: null }),
}));
