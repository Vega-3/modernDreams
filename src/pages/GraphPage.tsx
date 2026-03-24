import { GraphView } from '@/components/graph/GraphView';
import { DreamEditor } from '@/components/dreams/DreamEditor';
import { useUIStore } from '@/stores/uiStore';

export function GraphPage() {
  const editorOpen = useUIStore((s) => s.editorOpen);
  return (
    <>
      <GraphView />
      {editorOpen && <DreamEditor />}
    </>
  );
}
