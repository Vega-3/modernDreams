import { useEffect, useMemo } from 'react';
import { BookOpen } from 'lucide-react';
import { DreamCard } from './DreamCard';
import { Button } from '@/components/ui/button';
import { useDreamStore } from '@/stores/dreamStore';
import { useUIStore } from '@/stores/uiStore';
import { useAnalystStore, extractClientName } from '@/stores/analystStore';

export function DreamList() {
  const { dreams, isLoading, fetchDreams } = useDreamStore();
  const { openEditor } = useUIStore();
  const { analystMode, clients, activeClientId } = useAnalystStore();

  // --- Client filter ---
  // When an active client is selected in analyst mode, show only their dreams.
  // Client dreams are identified by the [Client: Name] prefix in waking_life_context.
  const activeClient = analystMode && activeClientId
    ? clients.find((c) => c.id === activeClientId) ?? null
    : null;

  // Separate personal and professional views so they never intermix.
  // Personal mode: show only dreams that have no client prefix.
  // Professional mode (no specific client): show all client dreams.
  // Professional mode (specific client selected): show only that client's dreams.
  const visibleDreams = useMemo(() => {
    if (activeClient) return dreams.filter((d) => extractClientName(d.waking_life_context) === activeClient.name);
    if (analystMode)  return dreams.filter((d) => extractClientName(d.waking_life_context) !== null);
    return dreams.filter((d) => extractClientName(d.waking_life_context) === null);
  }, [dreams, activeClient, analystMode]);

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

  if (visibleDreams.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">
          {activeClient
            ? `No dreams for ${activeClient.name}`
            : analystMode
              ? 'No client dreams yet'
              : 'No dreams yet'}
        </h3>
        <p className="text-muted-foreground mb-4">
          {activeClient
            ? 'Import dreams for this client from the Professional page.'
            : analystMode
              ? 'Import client dreams from the Professional page.'
              : 'Start recording your dreams to see them here'}
        </p>
        {!analystMode && <Button onClick={() => openEditor()}>Record First Dream</Button>}
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
