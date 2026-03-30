import { create } from 'zustand';
import type { Client, CreateClientInput } from '@/lib/tauri';
import * as api from '@/lib/tauri';

interface ClientState {
  clients: Client[];
  activeClientId: string | null; // null = personal journal
  isLoading: boolean;
  error: string | null;

  fetchClients: () => Promise<void>;
  createClient: (input: CreateClientInput) => Promise<Client>;
  deleteClient: (id: string) => Promise<void>;
  setActiveClient: (id: string | null) => void;
}

export const useClientStore = create<ClientState>((set) => ({
  clients: [],
  activeClientId: null,
  isLoading: false,
  error: null,

  fetchClients: async () => {
    set({ isLoading: true, error: null });
    try {
      const clients = await api.getClients();
      set({ clients, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  createClient: async (input) => {
    set({ isLoading: true, error: null });
    try {
      const client = await api.createClient(input);
      set((state) => ({
        clients: [...state.clients, client].sort((a, b) => a.name.localeCompare(b.name)),
        isLoading: false,
      }));
      return client;
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  deleteClient: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await api.deleteClient(id);
      set((state) => ({
        clients: state.clients.filter((c) => c.id !== id),
        activeClientId: state.activeClientId === id ? null : state.activeClientId,
        isLoading: false,
      }));
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  setActiveClient: (id) => set({ activeClientId: id }),
}));
