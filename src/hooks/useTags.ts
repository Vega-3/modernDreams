import { useEffect } from 'react';
import { useTagStore } from '@/stores/tagStore';

export function useTags() {
  const { tags, isLoading, error, fetchTags } = useTagStore();

  useEffect(() => {
    if (tags.length === 0 && !isLoading) {
      fetchTags();
    }
  }, [tags.length, isLoading, fetchTags]);

  return { tags, isLoading, error };
}
