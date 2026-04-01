import { create } from 'zustand';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Client {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

// Prefix used to tag imported dreams in their waking_life_context field
export const CLIENT_PREFIX = '[Client:';
export function clientPrefix(name: string) { return `${CLIENT_PREFIX} ${name}]`; }

// Extract client name from a waking_life_context string, returns null if not present
export function extractClientName(wakingLifeContext: string | null | undefined): string | null {
  if (!wakingLifeContext) return null;
  const match = wakingLifeContext.match(/^\[Client:\s*(.+?)\]/);
  return match ? match[1].trim() : null;
}

const STORAGE_KEY = 'analyst_clients';
const MODE_KEY    = 'analyst_mode_enabled';
const FILTER_KEY  = 'analyst_active_client';

function loadClients(): Client[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveClients(clients: Client[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
}

// ── Store ─────────────────────────────────────────────────────────────────────

interface AnalystState {
  analystMode: boolean;
  clients: Client[];
  activeClientId: string | null;  // null = show all

  setAnalystMode: (enabled: boolean) => void;
  addClient: (name: string, color: string) => Client;
  removeClient: (id: string) => void;
  setActiveClient: (id: string | null) => void;
}

export const useAnalystStore = create<AnalystState>((set, get) => ({
  analystMode:    localStorage.getItem(MODE_KEY) === 'true',
  clients:        loadClients(),
  activeClientId: localStorage.getItem(FILTER_KEY) ?? null,

  setAnalystMode: (enabled) => {
    localStorage.setItem(MODE_KEY, String(enabled));
    set({ analystMode: enabled });
  },

  addClient: (name, color) => {
    const client: Client = {
      id:        crypto.randomUUID(),
      name:      name.trim(),
      color,
      createdAt: new Date().toISOString(),
    };
    const clients = [...get().clients, client];
    saveClients(clients);
    set({ clients });
    return client;
  },

  removeClient: (id) => {
    // If the deleted client is active, clear the filter
    if (get().activeClientId === id) {
      localStorage.removeItem(FILTER_KEY);
      set({ activeClientId: null });
    }
    const clients = get().clients.filter((c) => c.id !== id);
    saveClients(clients);
    set({ clients });
  },

  setActiveClient: (id) => {
    if (id) localStorage.setItem(FILTER_KEY, id);
    else     localStorage.removeItem(FILTER_KEY);
    set({ activeClientId: id });
  },
}));
