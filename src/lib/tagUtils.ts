import type { Tag, Dream } from '@/lib/tauri';
import { addTagToDream } from '@/lib/tauri';

/** Return dreams that contain any of the tag's terms but don't already have the tag. */
export function findMatchingDreams(tag: Tag, dreams: Dream[]): Dream[] {
  const terms = [tag.name, ...tag.aliases].map((s) => s.toLowerCase());
  return dreams.filter((d) => {
    if (d.tags.some((t) => t.id === tag.id)) return false;
    const text = d.content_plain.toLowerCase();
    return terms.some((term) => text.includes(term));
  });
}

/** Apply a tag to the selected subset of matching dreams. */
export async function applyTagToDreams(
  selectedIds: Set<string>,
  matchingDreams: Dream[],
  tagId: string,
): Promise<void> {
  const toUpdate = matchingDreams.filter((d) => selectedIds.has(d.id));
  await Promise.all(toUpdate.map((d) => addTagToDream(d.id, tagId)));
}
