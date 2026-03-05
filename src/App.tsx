import { useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { SearchDialog } from '@/components/search/SearchDialog';
import { JournalPage } from '@/pages/JournalPage';
import { CalendarPage } from '@/pages/CalendarPage';
import { GraphPage } from '@/pages/GraphPage';
import { TagsPage } from '@/pages/TagsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { GuidePage } from '@/pages/GuidePage';
import { useUIStore } from '@/stores/uiStore';
import { useTagStore } from '@/stores/tagStore';

function App() {
  const currentView = useUIStore((state) => state.currentView);
  const fetchTags = useTagStore((state) => state.fetchTags);

  // Load tags on app start
  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

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
    </AppLayout>
  );
}

export default App;
