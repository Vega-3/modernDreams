import { useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { SearchDialog } from '@/components/search/SearchDialog';
import { DreamEditor } from '@/components/dreams/DreamEditor';
import { JournalPage } from '@/pages/JournalPage';
import { CalendarPage } from '@/pages/CalendarPage';
import { GraphPage } from '@/pages/GraphPage';
import { TagsPage } from '@/pages/TagsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { GuidePage } from '@/pages/GuidePage';
import { useUIStore } from '@/stores/uiStore';
import { useTagStore } from '@/stores/tagStore';
import { useDreamStore } from '@/stores/dreamStore';

function App() {
  const currentView = useUIStore((state) => state.currentView);
  const fetchTags = useTagStore((state) => state.fetchTags);
  const fetchDreams = useDreamStore((state) => state.fetchDreams);

  // Load tags and dreams on app start so the editor can always find any dream
  useEffect(() => {
    fetchTags();
    fetchDreams();
  }, [fetchTags, fetchDreams]);

  const renderPage = () => {
    switch (currentView) {
      case 'journal':
        return <JournalPage />;
      case 'calendar':
        return <CalendarPage />;
      case 'graph':
        return <GraphPage />;
      case 'tags':
        return <TagsPage />;
      case 'settings':
        return <SettingsPage />;
      case 'guide':
        return <GuidePage />;
      default:
        return <JournalPage />;
    }
  };

  return (
    <AppLayout>
      {renderPage()}
      <SearchDialog />
      <DreamEditor />
    </AppLayout>
  );
}

export default App;
