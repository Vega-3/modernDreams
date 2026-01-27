import { useEffect } from 'react';
import { BookOpen } from 'lucide-react';
import { DreamCard } from './DreamCard';
import { Button } from '@/components/ui/button';
import { useDreamStore } from '@/stores/dreamStore';
import { useUIStore } from '@/stores/uiStore';

export function DreamList() {
  const { dreams, isLoading, fetchDreams } = useDreamStore();
  const { openEditor } = useUIStore();

  useEffect(() => {
    fetchDreams();
  }, [fetchDreams]);

  if (isLoading && dreams.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (dreams.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No dreams yet</h3>
        <p className="text-muted-foreground mb-4">Start recording your dreams to see them here</p>
        <Button onClick={() => openEditor()}>Record First Dream</Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {dreams.map((dream) => (
        <DreamCard key={dream.id} dream={dream} />
      ))}
    </div>
  );
}
