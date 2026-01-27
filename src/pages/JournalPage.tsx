import { DreamList } from '@/components/dreams/DreamList';
import { DreamEditor } from '@/components/dreams/DreamEditor';

export function JournalPage() {
  return (
    <>
      <DreamList />
      <DreamEditor />
    </>
  );
}
