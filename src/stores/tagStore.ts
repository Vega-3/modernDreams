import { create } from 'zustand';
import type { Tag, CreateTagInput, UpdateTagInput } from '@/lib/tauri';
import * as api from '@/lib/tauri';

interface TagState {
  tags: Tag[];
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchTags: () => Promise<void>;
  createTag: (input: CreateTagInput) => Promise<Tag>;
  updateTag: (input: UpdateTagInput) => Promise<Tag>;
  deleteTag: (id: string) => Promise<void>;
  getTagsByCategory: (category: string) => Tag[];
}

export const useTagStore = create<TagState>((set, get) => ({
  tags: [],
  isLoading: false,
  error: null,

  fetchTags: async () => {
    set({ isLoading: true, error: null });
    try {
      const tags = await api.getTags();
      set({ tags, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  createTag: async (input) => {
    set({ isLoading: true, error: null });
    try {
      const tag = await api.createTag(input);
      set((state) => ({
        tags: [...state.tags, tag],
        isLoading: false,
      }));
      return tag;
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  updateTag: async (input) => {
    set({ isLoading: true, error: null });
    try {
      const tag = await api.updateTag(input);
      set((state) => ({
        tags: state.tags.map((t) => (t.id === tag.id ? tag : t)),
        isLoading: false,
      }));
      return tag;
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  deleteTag: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await api.deleteTag(id);
      set((state) => ({
        tags: state.tags.filter((t) => t.id !== id),
        isLoading: false,
      }));
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  getTagsByCategory: (category) => {
    return get().tags.filter((t) => t.category === category);
  },
}));
