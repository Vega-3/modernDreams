import { create } from 'zustand';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Archetype {
  id: string;
  name: string;
  color: string;
  description: string;
  dreamIndicators: string;
  linkedTagIds: string[];
}

// ── Pre-seeded archetypes from ARCHETYPES.md ──────────────────────────────────

const SEED_ARCHETYPES: Omit<Archetype, 'linkedTagIds'>[] = [
  {
    id: 'archetype-self',
    name: 'The Self',
    color: '#FFD700',
    description: 'The central archetype — the totality of the psyche, both conscious and unconscious. Represents wholeness and the goal of individuation.',
    dreamIndicators: 'Mandalas, circles, quaternity symbols, luminous figures, encounters with gods or the cosmos.',
  },
  {
    id: 'archetype-shadow',
    name: 'The Shadow',
    color: '#2a2a2a',
    description: 'Everything in the personality the ego has refused to acknowledge — not purely negative, but unlived. Carries both repressed darkness and unrealised potential.',
    dreamIndicators: 'Dark pursuer, sinister double, criminal or outcast figure, trickster energy.',
  },
  {
    id: 'archetype-anima-animus',
    name: 'The Anima / Animus',
    color: '#FF00FF',
    description: 'The inner feminine in a man\'s psyche (Anima); the inner masculine in a woman\'s psyche (Animus). Soul figures — bridges to the unconscious.',
    dreamIndicators: 'Recurring opposite-sex figures (lover, guide, witch, enchantress, hero, sage), relationships that feel fated.',
  },
  {
    id: 'archetype-persona',
    name: 'The Persona',
    color: '#DC143C',
    description: 'The mask worn for the world — the social identity constructed for public consumption. Dreams signal Persona crises when the gap between mask and authentic self widens.',
    dreamIndicators: 'Clothes falling off, wearing a mask or uniform, social embarrassment, performing for an audience.',
  },
  {
    id: 'archetype-hero',
    name: 'The Hero',
    color: '#C0C0C0',
    description: 'The archetype of the ego\'s struggle against unconscious forces and external obstacles. Represents the developmental impulse — leaving home, confronting the monster, returning transformed.',
    dreamIndicators: 'Quests, battles with monsters, rescuing others, overcoming impossible obstacles.',
  },
  {
    id: 'archetype-great-mother',
    name: 'The Great Mother',
    color: '#FF69B4',
    description: 'The feminine principle of nourishment, fertility, transformation, and devouring darkness. Appears as protective mother but also as devouring witch.',
    dreamIndicators: 'Mother figures (benevolent or terrifying), earth, ocean, caves, cauldrons, gardens, ancient women.',
  },
  {
    id: 'archetype-wise-old-man',
    name: 'The Wise Old Man',
    color: '#4169E1',
    description: 'The archetype of meaning, spirit, and depth — the inner guide who appears as a sage, guru, prophet, or elder bearing counsel.',
    dreamIndicators: 'Aged guide, hermit, prophet, wizard, teacher, physician, grandfather figure.',
  },
  {
    id: 'archetype-trickster',
    name: 'The Trickster',
    color: '#FF8C00',
    description: 'The archetype of disruption, transformation through chaos, and the reversal of order. Overturns hierarchies and exposes the absurdity of convention.',
    dreamIndicators: 'Clown, fool, shapeshifter, joker, animal that speaks, impossible physical comedy.',
  },
  {
    id: 'archetype-child',
    name: 'The Child',
    color: '#87CEEB',
    description: 'The archetype of new beginnings, potentiality, and the future. Represents the Self in its nascent form and signals the emergence of new psychological possibility.',
    dreamIndicators: 'Miraculous or endangered infant, a gifted child, a child who should not exist, rebirth symbols.',
  },
  {
    id: 'archetype-maiden',
    name: 'The Maiden / Kore',
    color: '#90EE90',
    description: 'The archetype of innocence, receptivity, and transformation through descent. The soul not yet fully claimed — often appears at the threshold of major psychological initiation.',
    dreamIndicators: 'Young innocent woman in danger, a girl in unknown territory, abduction theme, a figure passing through darkness.',
  },
  {
    id: 'archetype-father',
    name: 'The Father',
    color: '#006400',
    description: 'The archetype that structures reality, establishes law, and sets the world in order. The principle of logos — differentiation, language, and authority.',
    dreamIndicators: 'Authority figures, kings, judges, God, law, institutional structures, the sky and sun.',
  },
  {
    id: 'archetype-lover',
    name: 'The Lover',
    color: '#8B0000',
    description: 'The archetype of relationship, connection, beauty, and passion. Governs the capacity for deep connection to people, art, nature, and meaning itself.',
    dreamIndicators: 'Romantic encounters, intense beauty, passionate creative work, union with another, erotic imagery.',
  },
];

// ── Storage keys ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'archetypes_v1';
const DREAM_MAP_KEY = 'archetype_dream_map_v1';

function loadArchetypes(): Archetype[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initializeArchetypes();
    const stored: Archetype[] = JSON.parse(raw);
    // Merge: ensure all seed archetypes exist (in case new ones were added)
    const storedIds = new Set(stored.map((a) => a.id));
    const missing = SEED_ARCHETYPES.filter((s) => !storedIds.has(s.id)).map((s) => ({
      ...s,
      linkedTagIds: [],
    }));
    return [...stored, ...missing];
  } catch {
    return initializeArchetypes();
  }
}

function initializeArchetypes(): Archetype[] {
  const archetypes = SEED_ARCHETYPES.map((s) => ({ ...s, linkedTagIds: [] }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(archetypes));
  return archetypes;
}

function saveArchetypes(archetypes: Archetype[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(archetypes));
}

// dreamArchetypeMap: Record<dreamId, archetypeId[]>
type DreamArchetypeMap = Record<string, string[]>;

function loadDreamMap(): DreamArchetypeMap {
  try {
    const raw = localStorage.getItem(DREAM_MAP_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveDreamMap(map: DreamArchetypeMap) {
  localStorage.setItem(DREAM_MAP_KEY, JSON.stringify(map));
}

// ── Store ─────────────────────────────────────────────────────────────────────

interface ArchetypeState {
  archetypes: Archetype[];
  dreamArchetypeMap: DreamArchetypeMap;

  // Tag linking
  linkTagToArchetype: (archetypeId: string, tagId: string) => void;
  unlinkTagFromArchetype: (archetypeId: string, tagId: string) => void;

  // Dream-archetype direct application
  setDreamArchetypes: (dreamId: string, archetypeIds: string[]) => void;
  getDreamArchetypes: (dreamId: string) => Archetype[];

  // Helpers
  getArchetypeForTag: (tagId: string) => Archetype | null;
  getArchetypesByDreamActivity: () => Array<{ archetype: Archetype; dreamCount: number }>;
}

export const useArchetypeStore = create<ArchetypeState>((set, get) => ({
  archetypes: loadArchetypes(),
  dreamArchetypeMap: loadDreamMap(),

  linkTagToArchetype: (archetypeId, tagId) => {
    const archetypes = get().archetypes.map((a) => {
      if (a.id !== archetypeId) return a;
      if (a.linkedTagIds.includes(tagId)) return a;
      return { ...a, linkedTagIds: [...a.linkedTagIds, tagId] };
    });
    saveArchetypes(archetypes);
    set({ archetypes });
  },

  unlinkTagFromArchetype: (archetypeId, tagId) => {
    const archetypes = get().archetypes.map((a) => {
      if (a.id !== archetypeId) return a;
      return { ...a, linkedTagIds: a.linkedTagIds.filter((id) => id !== tagId) };
    });
    saveArchetypes(archetypes);
    set({ archetypes });
  },

  setDreamArchetypes: (dreamId, archetypeIds) => {
    const map = { ...get().dreamArchetypeMap, [dreamId]: archetypeIds };
    saveDreamMap(map);
    set({ dreamArchetypeMap: map });
  },

  getDreamArchetypes: (dreamId) => {
    const ids = get().dreamArchetypeMap[dreamId] ?? [];
    return get().archetypes.filter((a) => ids.includes(a.id));
  },

  getArchetypeForTag: (tagId) => {
    return get().archetypes.find((a) => a.linkedTagIds.includes(tagId)) ?? null;
  },

  getArchetypesByDreamActivity: () => {
    const map = get().dreamArchetypeMap;
    const counts = new Map<string, number>();
    for (const ids of Object.values(map)) {
      for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return get().archetypes.map((a) => ({
      archetype: a,
      dreamCount: counts.get(a.id) ?? 0,
    }));
  },
}));
