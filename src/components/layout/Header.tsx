import { Search, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/stores/uiStore';

const viewTitles: Record<string, string> = {
  dashboard: 'Dashboard',
  journal: 'Dream Journal',
  calendar: 'Calendar',
  graph: 'Dream Graph',
  tags: 'Tags',
  settings: 'Settings',
};

export function Header() {
  const { currentView, openSearch, openEditor } = useUIStore();

  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-6">
      <h1 className="text-xl font-semibold">{viewTitles[currentView]}</h1>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="gap-2" onClick={openSearch}>
          <Search className="h-4 w-4" />
          <span className="hidden sm:inline">Search</span>
          <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <span className="text-xs">Ctrl</span>K
          </kbd>
        </Button>

        {currentView === 'journal' && (
          <Button size="sm" className="gap-2" onClick={() => openEditor()}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Dream</span>
          </Button>
        )}
      </div>
    </header>
  );
}
