import { create } from 'zustand';
import type { Dream, CreateDreamInput, UpdateDreamInput } from '@/lib/tauri';
import * as api from '@/lib/tauri';

interface DreamState {
  dreams: Dream[];
  selectedDream: Dream | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchDreams: () => Promise<void>;
  selectDream: (dream: Dream | null) => void;
  createDream: (input: CreateDreamInput) => Promise<Dream>;
  updateDream: (input: UpdateDreamInput) => Promise<Dream>;
  deleteDream: (id: string) => Promise<void>;
}

export const useDreamStore = create<DreamState>((set, get) => ({
  dreams: [],
  selectedDream: null,
  isLoading: false,
  error: null,

  fetchDreams: async () => {
    set({ isLoading: true, error: null });
    try {
      const dreams = await api.getDreams();
      set({ dreams, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  selectDream: (dream) => {
    set({ selectedDream: dream });
  },

  createDream: async (input) => {
    set({ isLoading: true, error: null });
    try {
      const dream = await api.createDream(input);
      set((state) => ({
        dreams: [dream, ...state.dreams],
        isLoading: false,
      }));
      return dream;
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  updateDream: async (input) => {
    set({ isLoading: true, error: null });
    try {
      const dream = await api.updateDream(input);
      set((state) => ({
        dreams: state.dreams.map((d) => (d.id === dream.id ? dream : d)),
        selectedDream: state.selectedDream?.id === dream.id ? dream : state.selectedDream,
        isLoading: false,
      }));
      return dream;
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  deleteDream: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await api.deleteDream(id);
      set((state) => ({
        dreams: state.dreams.filter((d) => d.id !== id),
        selectedDream: state.selectedDream?.id === id ? null : state.selectedDream,
        isLoading: false,
      }));
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },
}));
