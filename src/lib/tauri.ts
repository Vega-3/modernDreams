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
  tags: Tag[];
}

export interface Tag {
  id: string;
  name: string;
  category: TagCategory;
  color: string;
  description: string | null;
  usage_count: number;
}

export type TagCategory = 'location' | 'person' | 'symbolic' | 'emotive' | 'custom';

export interface CreateDreamInput {
  title: string;
  content_html: string;
  content_plain: string;
  dream_date: string;
  is_lucid: boolean;
  mood_rating: number | null;
  clarity_rating: number | null;
  tag_ids: string[];
}

export interface UpdateDreamInput extends CreateDreamInput {
  id: string;
}

export interface CreateTagInput {
  name: string;
  category: TagCategory;
  color: string;
  description: string | null;
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

// Tag commands
export const getTags = () => invoke<Tag[]>('get_tags');
export const getTag = (id: string) => invoke<Tag | null>('get_tag', { id });
export const createTag = (input: CreateTagInput) => invoke<Tag>('create_tag', { input });
export const updateTag = (input: UpdateTagInput) => invoke<Tag>('update_tag', { input });
export const deleteTag = (id: string) => invoke<void>('delete_tag', { id });

// Search commands
export const searchDreams = (query: SearchQuery) => invoke<SearchResult>('search_dreams', { query });

// Obsidian commands
export const exportToObsidian = () => invoke<ExportResult>('export_to_obsidian');
export const getObsidianPath = () => invoke<string>('get_obsidian_path');
