import { useEffect } from 'react';
import { useDreamStore } from '@/stores/dreamStore';

export function useDreams() {
  const { dreams, isLoading, error, fetchDreams } = useDreamStore();

  useEffect(() => {
    if (dreams.length === 0 && !isLoading) {
      fetchDreams();
    }
  }, [dreams.length, isLoading, fetchDreams]);

  return { dreams, isLoading, error };
}
