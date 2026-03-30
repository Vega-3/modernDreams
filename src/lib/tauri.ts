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
  waking_life_context?: string | null;
  tags: Tag[];
  client_id: string | null;
}

export interface Client {
  id: string;
  name: string;
  notes: string | null;
  created_at: string;
}

export interface CreateClientInput {
  name: string;
  notes: string | null;
}

export interface ImportDreamInput {
  client_id: string;
  title: string;
  content_html: string;
  content_plain: string;
  dream_date: string;
}

export interface Tag {
  id: string;
  name: string;
  category: TagCategory;
  color: string;
  description: string | null;
  usage_count: number;
  aliases: string[];
}

export type TagCategory = 'location' | 'person' | 'symbolic' | 'emotive' | 'custom';

export interface WordTagAssociation {
  tag_id: string;
  word: string;
}

export interface TagWordUsage {
  dream_id: string;
  dream_title: string;
  dream_date: string;
  word: string;
}

export interface CreateDreamInput {
  title: string;
  content_html: string;
  content_plain: string;
  dream_date: string;
  is_lucid: boolean;
  mood_rating: number | null;
  clarity_rating: number | null;
  waking_life_context?: string | null;
  tag_ids: string[];
  word_tag_associations: WordTagAssociation[];
  client_id?: string | null;
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

export interface GraphStatsResult {
  dream_count: number;
  tag_count: number;
  /** Top-5 tags by unweighted degree (number of distinct neighbours) */
  top_order: GraphNodeStat[];
  /** Top-5 tags by strength (sum of all edge weights) */
  top_strength: GraphNodeStat[];
  /** Top-5 tags by normalised weighted centrality s(i)/Σs */
  top_centrality: GraphNodeStat[];
  /** Top-5 tag pairs by co-occurrence weight */
  top_edges: GraphEdgeStat[];
}

export const getGraphStats = (startDate: string, endDate: string) =>
  invoke<GraphStatsResult>('get_graph_stats', { startDate, endDate });

// ── Client / Analyst commands ─────────────────────────────────────────────────

export const getClients = () => invoke<Client[]>('get_clients');
export const createClient = (input: CreateClientInput) =>
  invoke<Client>('create_client', { input });
export const deleteClient = (id: string) => invoke<void>('delete_client', { id });
export const importClientDreams = (dreams: ImportDreamInput[]) =>
  invoke<number>('import_client_dreams', { dreams });
