import { Mark, mergeAttributes } from '@tiptap/core';

export const TagHighlight = Mark.create({
  name: 'tagHighlight',

  addAttributes() {
    return {
      tagId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-tag-id'),
        renderHTML: (attributes) => ({ 'data-tag-id': attributes.tagId }),
      },
      tagColor: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-tag-color'),
        renderHTML: (attributes) => ({ 'data-tag-color': attributes.tagColor }),
      },
      tagName: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-tag-name'),
        renderHTML: (attributes) => ({ 'data-tag-name': attributes.tagName }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-tag-id]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const color = HTMLAttributes['data-tag-color'] || '#6366f1';
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        style: `background-color: ${color}26; border-bottom: 2px solid ${color}; border-radius: 2px; padding: 0 1px;`,
        title: HTMLAttributes['data-tag-name'] || '',
      }),
      0,
    ];
  },
});
