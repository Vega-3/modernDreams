import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Tag } from '@/lib/tauri';

interface TagBadgeProps {
  tag: Tag;
  onRemove?: () => void;
  size?: 'sm' | 'md';
  className?: string;
}

export function TagBadge({ tag, onRemove, size = 'md', className }: TagBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        className
      )}
      style={{
        backgroundColor: `${tag.color}20`,
        color: tag.color,
        borderColor: `${tag.color}40`,
        borderWidth: 1,
      }}
    >
      {tag.name}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 rounded-full hover:bg-white/20 p-0.5"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}
