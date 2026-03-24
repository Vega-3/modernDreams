import { CalendarView } from '@/components/calendar/CalendarView';
import { DreamEditor } from '@/components/dreams/DreamEditor';
import { useUIStore } from '@/stores/uiStore';

export function CalendarPage() {
  const editorOpen = useUIStore((s) => s.editorOpen);
  return (
    <>
      <CalendarView />
      {editorOpen && <DreamEditor />}
    </>
  );
}
