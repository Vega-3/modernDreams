import { invoke } from '@tauri-apps/api/core';

export interface Dream {
  id: string;
  title: string;
  content_html: string;
  content_plain: string;
  dream_date: string;
  created_at: string;
  updated_at: string;
  is_lucid: boolean;
  mood_rating: number | null;
  clarity_rating: number | null;
  meaningfulness_rating: number | null;
  waking_life_context: string | null;
  analysis_notes: string | null;
  tags: Tag[];
}

export interface Tag {
  id: string;
  name: string;
  category: TagCategory;
  color: string;
  description: string | null;
  usage_count: number;
  aliases: string[];
  emotive_subcategory?: string | null;
}

export type TagCategory = 'location' | 'person' | 'symbolic' | 'emotive' | 'custom';

export interface WordTagAssociation {
  tag_id: string;
  word: string;
  /** 0-based index of the block (paragraph / heading / list item) the word
   *  lives in.  Used by the graph builder to weight same-paragraph co-occurrences
   *  more strongly than dream-level co-occurrences. */
  paragraph_index: number;
  /** 'manual' = user selected the text; 'auto' = auto-match or AI Tag applied it. */
  source?: 'manual' | 'auto';
}

export interface TagWordUsage {
  dream_id: string;
  dream_title: string;
  dream_date: string;
  word: string;
  source?: 'manual' | 'auto';
}

export interface CreateDreamInput {
  title: string;
  content_html: string;
  content_plain: string;
  dream_date: string;
  is_lucid: boolean;
  mood_rating: number | null;
  clarity_rating: number | null;
  meaningfulness_rating: number | null;
  waking_life_context: string | null;
  analysis_notes: string | null;
  tag_ids: string[];
  word_tag_associations: WordTagAssociation[];
}

export interface UpdateDreamInput extends CreateDreamInput {
  id: string;
}

export interface CreateTagInput {
  name: string;
  category: TagCategory;
  color: string;
  description: string | null;
  aliases: string[];
  emotive_subcategory?: string | null;
}

export interface UpdateTagInput extends CreateTagInput {
  id: string;
}

export interface SearchQuery {
  query: string;
  category_filter: TagCategory | null;
  is_lucid_filter: boolean | null;
  date_from: string | null;
  date_to: string | null;
}

export interface SearchResult {
  dreams: Dream[];
  total: number;
}

export interface ExportResult {
  exported_count: number;
  vault_path: string;
}

// Dream commands
export const getDreams = () => invoke<Dream[]>('get_dreams');
export const getDream = (id: string) => invoke<Dream | null>('get_dream', { id });
export const createDream = (input: CreateDreamInput) => invoke<Dream>('create_dream', { input });
export const updateDream = (input: UpdateDreamInput) => invoke<Dream>('update_dream', { input });
export const deleteDream = (id: string) => invoke<void>('delete_dream', { id });
export const addTagToDream = (dreamId: string, tagId: string) =>
  invoke<void>('add_tag_to_dream', { dreamId, tagId });

// Tag commands
export const getTags = () => invoke<Tag[]>('get_tags');
export const getTag = (id: string) => invoke<Tag | null>('get_tag', { id });
export const createTag = (input: CreateTagInput) => invoke<Tag>('create_tag', { input });
export const updateTag = (input: UpdateTagInput) => invoke<Tag>('update_tag', { input });
export const deleteTag = (id: string) => invoke<void>('delete_tag', { id });
export const getTagWordAssociations = (tagId: string) =>
  invoke<TagWordUsage[]>('get_tag_word_associations', { tagId });

// Search commands
export const searchDreams = (query: SearchQuery) => invoke<SearchResult>('search_dreams', { query });

// Obsidian commands
export const exportToObsidian = () => invoke<ExportResult>('export_to_obsidian');
export const getObsidianPath = () => invoke<string>('get_obsidian_path');

// OCR commands (legacy — kept for reference, replaced by Claude AI below)
export const recognizeHandwriting = (imageBase64: string) =>
  invoke<string>('recognize_handwriting', { imageBase64 });

// Claude AI handwriting transcription
export interface TranscriptionResult {
  raw_transcript: string;
  english_transcript: string;
}

export const verifyApiKey = (apiKey: string) =>
  invoke<void>('verify_api_key', { apiKey });

export const transcribeHandwritingClaude = (
  imageBase64: string,
  imageMediaType: string,
  apiKey: string,
) =>
  invoke<TranscriptionResult>('transcribe_handwriting_claude', {
    imageBase64,
    imageMediaType,
    apiKey,
  });

// Claude AI dream analysis
export interface DreamAnalysisResult {
  suggested_tag_names: string[];
  theme_suggestions: string;
}

export const analyzeDream = (
  dreamText: string,
  availableTags: string,
  apiKey: string,
) =>
  invoke<DreamAnalysisResult>('analyze_dream', {
    dreamText,
    availableTags,
    apiKey,
  });

// ── AI inline tag detection ────────────────────────────────────────────────────

export interface InlineTagEntry {
  text: string;
  tag_name: string;
}

export interface InlineTagResult {
  inline_tags: InlineTagEntry[];
}

export const aiTagDream = (
  dreamText: string,
  availableTags: string,
  apiKey: string,
) =>
  invoke<InlineTagResult>('ai_tag_dream', {
    dreamText,
    availableTags,
    apiKey,
  });

// ── Word tag association management ───────────────────────────────────────────
export const deleteWordTagAssociation = (dreamId: string, tagId: string, word: string) =>
  invoke<void>('delete_word_tag_association', { dreamId, tagId, word });

// ── Graph theory analysis ─────────────────────────────────────────────────────

export interface GraphNodeStat {
  id: string;
  name: string;
  /** Integer for order/strength, float in [0,1] for centrality */
  value: number;
}

export interface GraphEdgeStat {
  source_id: string;
  source_name: string;
  target_id: string;
  target_name: string;
  weight: number;
}

export interface GraphEdgeAffinityStat {
  source_id: string;
  source_name: string;
  target_id: string;
  target_name: string;
  weight: number;
  /** Jaccard coefficient [0,1] — how exclusively the pair co-occurs */
  affinity: number;
}

export interface GraphEdgeLiftStat {
  source_id: string;
  source_name: string;
  target_id: string;
  target_name: string;
  weight: number;
  /** Lift = (w × D) / (N_i × N_j) — ratio of observed to expected co-occurrence */
  lift: number;
}

export interface GraphTriangle {
  a_id: string;
  a_name: string;
  b_id: string;
  b_name: string;
  c_id: string;
  c_name: string;
  /** Weakest edge in the triplet (lower bound on cohesion) */
  min_weight: number;
}

export interface GraphStatsResult {
  dream_count: number;
  tag_count: number;
  // Overview
  /** Top-5 tags by unweighted degree (number of distinct neighbours) */
  top_order: GraphNodeStat[];
  /** Top-5 tags by strength (sum of all edge weights) */
  top_strength: GraphNodeStat[];
  /** Top-5 tags by normalised weighted centrality s(i)/Σs */
  top_centrality: GraphNodeStat[];
  /** Top-5 tag pairs by co-occurrence weight */
  top_edges: GraphEdgeStat[];
  // Deep Analysis
  /** Pairs co-occurring ≥ 3 times, ranked by Jaccard affinity */
  significant_pairs: GraphEdgeAffinityStat[];
  /** Top-5 tags by local clustering coefficient */
  top_clustering: GraphNodeStat[];
  /** Top-5 tags by betweenness centrality (bridge nodes) */
  top_betweenness: GraphNodeStat[];
  /** Top-5 pairs (w ≥ 2) by co-occurrence lift over random chance */
  top_lift: GraphEdgeLiftStat[];
  /** Top-5 thematic triangles — triplets where all pairs co-occur ≥ 2 times */
  top_triangles: GraphTriangle[];
}

export const getGraphStats = (startDate: string, endDate: string) =>
  invoke<GraphStatsResult>('get_graph_stats', { startDate, endDate });

// Theme Analysis commands
export const getTagNotes = (tagId: string) =>
  invoke<string>('get_tag_notes', { tagId });
export const saveTagNotes = (tagId: string, notes: string) =>
  invoke<void>('save_tag_notes', { tagId, notes });
