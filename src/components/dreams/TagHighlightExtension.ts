import { Mark, mergeAttributes } from '@tiptap/core';

export const TAG_HIGHLIGHT = 'tagHighlight';

export interface TagRef {
  tagId: string;
  tagColor: string;
  tagName: string;
}

export type MarkSource = 'manual' | 'auto';

/**
 * A mark that stores an array of tags on a text range.
 * Uses a JSON-encoded `data-tags` attribute so multiple tags can share
 * the same text without ProseMirror's one-mark-per-type restriction
 * causing them to collide.
 *
 * Backward-compat: legacy `data-tag-id` spans (single-tag) are parsed
 * into the new array format on load.
 */
export const TagHighlight = Mark.create({
  name: TAG_HIGHLIGHT,

  inclusive: false,

  addAttributes() {
    return {
      tags: {
        default: [] as TagRef[],
        parseHTML: (element) => {
          // New format
          const raw = element.getAttribute('data-tags');
          if (raw) {
            try {
              return JSON.parse(raw) as TagRef[];
            } catch {
              // fall through to legacy
            }
          }
          // Legacy single-tag format
          const tagId = element.getAttribute('data-tag-id');
          const tagColor = element.getAttribute('data-tag-color') ?? '#de0615';
          const tagName = element.getAttribute('data-tag-name') ?? '';
          if (tagId) return [{ tagId, tagColor, tagName }];
          return [];
        },
        renderHTML: (attributes) => ({
          'data-tags': JSON.stringify(attributes.tags ?? []),
        }),
      },
      source: {
        default: 'manual' as MarkSource,
        parseHTML: (element) => (element.getAttribute('data-source') as MarkSource) ?? 'manual',
        renderHTML: (attributes) => ({ 'data-source': attributes.source ?? 'manual' }),
      },
    };
  },

  parseHTML() {
    return [
      { tag: 'span[data-tags]' },
      { tag: 'span[data-tag-id]' }, // legacy
    ];
  },

  renderHTML({ HTMLAttributes }) {
    let tags: TagRef[] = [];
    try {
      tags = HTMLAttributes['data-tags'] ? (JSON.parse(HTMLAttributes['data-tags']) as TagRef[]) : [];
    } catch {
      tags = [];
    }

    const firstColor = tags[0]?.tagColor ?? '#de0615';
    const borderStyle =
      tags.length > 1
        ? `border-bottom: 2px solid; border-image: linear-gradient(to right, ${tags.map((t) => t.tagColor).join(', ')}) 1;`
        : `border-bottom: 2px solid ${firstColor};`;
    const title = tags.map((t) => t.tagName).join(', ');

    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        style: `background-color: ${firstColor}26; ${borderStyle} border-radius: 2px; padding: 0 1px;`,
        title,
      }),
      0,
    ];
  },
});
