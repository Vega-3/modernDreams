import { useEffect } from 'react';
import { BookOpen } from 'lucide-react';
import { DreamCard } from './DreamCard';
import { Button } from '@/components/ui/button';
import { useDreamStore } from '@/stores/dreamStore';
import { useUIStore } from '@/stores/uiStore';
import { useClientStore } from '@/stores/clientStore';

export function DreamList() {
  const { dreams, isLoading, fetchDreams } = useDreamStore();
  const { openEditor } = useUIStore();
  const { activeClientId, clients } = useClientStore();

  useEffect(() => {
    fetchDreams();
  }, [fetchDreams]);

  // Filter dreams by active client; null = personal journal (client_id IS NULL)
  const visibleDreams = dreams.filter((d) => d.client_id === activeClientId);

  const clientName = activeClientId
    ? clients.find((c) => c.id === activeClientId)?.name
    : null;

  if (isLoading && dreams.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (visibleDreams.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No dreams yet</h3>
        <p className="text-muted-foreground mb-4">
          {clientName
            ? `No dreams recorded for ${clientName} yet`
            : 'Start recording your dreams to see them here'}
        </p>
        <Button onClick={() => openEditor()}>Record First Dream</Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {visibleDreams.map((dream) => (
        <DreamCard key={dream.id} dream={dream} />
      ))}
    </div>
  );
}
