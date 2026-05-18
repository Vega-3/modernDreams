import type { Tag, Dream } from '@/lib/tauri';
import { addTagToDream } from '@/lib/tauri';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DreamMatch {
  dream: Dream;
  /** Plain-text excerpt: up to 6 words before and after the first matched term. */
  snippet: string;
  /** The exact matched term (name or alias) as it appears in the text. */
  matchedTerm: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Extract up to `windowWords` words on each side of the first occurrence of
 * `term` in `text`, preserving original casing.  Adds ellipsis when the
 * surrounding text is truncated.
 */
function extractSnippet(text: string, term: string, windowWords = 6): string {
  const lower = text.toLowerCase();
  const idx   = lower.indexOf(term.toLowerCase());
  if (idx === -1) return '';

  const before     = text.slice(0, idx);
  const after      = text.slice(idx + term.length);
  const beforeWords = before.split(/\s+/).filter(Boolean);
  const afterWords  = after.split(/\s+/).filter(Boolean);

  const prefix = beforeWords.length > windowWords ? '…' : '';
  const suffix = afterWords.length  > windowWords ? '…' : '';

  const contextBefore = beforeWords.slice(-windowWords).join(' ');
  const contextAfter  = afterWords.slice(0, windowWords).join(' ');

  // Reconstruct with original-casing match term in the middle
  const matchText = text.slice(idx, idx + term.length);
  const parts = [prefix + contextBefore, matchText, contextAfter + suffix].filter(Boolean);
  return parts.join(' ');
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Return dreams that contain any of the tag's terms (name + aliases) but don't
 * already have the tag applied, together with a context snippet per dream.
 */
export function findMatchingDreams(tag: Tag, dreams: Dream[]): DreamMatch[] {
  const terms = [tag.name, ...tag.aliases];
  const results: DreamMatch[] = [];

  for (const dream of dreams) {
    if (dream.tags.some((t) => t.id === tag.id)) continue;

    const text = dream.content_plain;
    for (const term of terms) {
      if (text.toLowerCase().includes(term.toLowerCase())) {
        results.push({
          dream,
          snippet:     extractSnippet(text, term),
          matchedTerm: term,
        });
        break; // one snippet per dream is enough
      }
    }
  }

  return results;
}

/** Apply a tag to the selected subset of matching dreams. */
export async function applyTagToDreams(
  selectedIds: Set<string>,
  matches: DreamMatch[],
  tagId: string,
): Promise<void> {
  const toUpdate = matches.filter((m) => selectedIds.has(m.dream.id));
  await Promise.all(toUpdate.map((m) => addTagToDream(m.dream.id, tagId)));
}
