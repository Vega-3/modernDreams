import { create } from 'zustand';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DreamSeries {
  id: string;
  name: string;
  dreamIds: string[];
  interpretation: string;
  createdAt: string;
}

// ── Storage ───────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'dream_series_v1';

function load(): DreamSeries[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function save(series: DreamSeries[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(series));
}

// ── Store ─────────────────────────────────────────────────────────────────────

interface SeriesState {
  series: DreamSeries[];
  createSeries: (name: string) => DreamSeries;
  deleteSeries: (id: string) => void;
  addDreamToSeries: (seriesId: string, dreamId: string) => void;
  removeDreamFromSeries: (seriesId: string, dreamId: string) => void;
  setInterpretation: (seriesId: string, interpretation: string) => void;
  renameSeries: (seriesId: string, name: string) => void;
}

export const useSeriesStore = create<SeriesState>((set, get) => ({
  series: load(),

  createSeries: (name) => {
    const entry: DreamSeries = {
      id: crypto.randomUUID(),
      name: name.trim(),
      dreamIds: [],
      interpretation: '',
      createdAt: new Date().toISOString(),
    };
    const series = [...get().series, entry];
    save(series);
    set({ series });
    return entry;
  },

  deleteSeries: (id) => {
    const series = get().series.filter((s) => s.id !== id);
    save(series);
    set({ series });
  },

  addDreamToSeries: (seriesId, dreamId) => {
    const series = get().series.map((s) => {
      if (s.id !== seriesId || s.dreamIds.includes(dreamId)) return s;
      return { ...s, dreamIds: [...s.dreamIds, dreamId] };
    });
    save(series);
    set({ series });
  },

  removeDreamFromSeries: (seriesId, dreamId) => {
    const series = get().series.map((s) => {
      if (s.id !== seriesId) return s;
      return { ...s, dreamIds: s.dreamIds.filter((id) => id !== dreamId) };
    });
    save(series);
    set({ series });
  },

  setInterpretation: (seriesId, interpretation) => {
    const series = get().series.map((s) =>
      s.id === seriesId ? { ...s, interpretation } : s
    );
    save(series);
    set({ series });
  },

  renameSeries: (seriesId, name) => {
    const series = get().series.map((s) =>
      s.id === seriesId ? { ...s, name: name.trim() } : s
    );
    save(series);
    set({ series });
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Given a list of dreams and a co-occurrence threshold, suggest candidate series
 * based on tag overlap. Returns groups of dream IDs that share enough tags.
 */
export function suggestSeriesFromDreams(
  dreams: Array<{ id: string; tags: Array<{ id: string }> }>,
  threshold = 0.35,
): string[][] {
  if (dreams.length < 2) return [];

  // Build adjacency by Jaccard similarity of tag sets
  const tagSets = dreams.map((d) => new Set(d.tags.map((t) => t.id)));
  const groups: string[][] = [];
  const used = new Set<number>();

  for (let i = 0; i < dreams.length; i++) {
    if (used.has(i)) continue;
    const group = [dreams[i].id];
    used.add(i);
    for (let j = i + 1; j < dreams.length; j++) {
      if (used.has(j)) continue;
      const a = tagSets[i];
      const b = tagSets[j];
      const intersection = [...a].filter((t) => b.has(t)).length;
      const union = new Set([...a, ...b]).size;
      if (union === 0) continue;
      const jaccard = intersection / union;
      if (jaccard >= threshold) {
        group.push(dreams[j].id);
        used.add(j);
      }
    }
    if (group.length >= 2) groups.push(group);
  }

  return groups;
}
