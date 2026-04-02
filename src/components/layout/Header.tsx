import { Search, Plus, Upload, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useUIStore } from '@/stores/uiStore';
import { useAnalystStore } from '@/stores/analystStore';

const viewTitles: Record<string, string> = {
  journal: 'Dream Journal',
  calendar: 'Calendar',
  graph: 'Dream Graph',
  tags: 'Tags',
  theme: 'Theme Analysis',
  analyst: 'Analyst',
  settings: 'Settings',
  guide: 'Guide',
};

export function Header() {
  const { currentView, openSearch, openEditor, openHandwritingUpload } = useUIStore();
  const { analystMode, clients, activeClientId, setActiveClient } = useAnalystStore();

  const activeClient = clients.find((c) => c.id === activeClientId) ?? null;

  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-6">
      <h1 className="text-xl font-black tracking-tight uppercase text-foreground">
        {viewTitles[currentView]}
      </h1>

      <div className="flex items-center gap-2">
        {/* Client filter — visible on all views when analyst mode is active and clients exist */}
        {analystMode && clients.length > 0 && (
          <div className="flex items-center gap-1">
            {activeClient ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 pr-1.5"
                style={{ borderColor: activeClient.color, color: activeClient.color }}
              >
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: activeClient.color }}
                />
                <span className="text-xs max-w-[100px] truncate">{activeClient.name}</span>
                <button
                  onClick={() => setActiveClient(null)}
                  className="ml-1 rounded hover:bg-accent p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Button>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Users className="h-4 w-4" />
                    <span className="hidden sm:inline">All clients</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {clients.map((c) => (
                    <DropdownMenuItem key={c.id} onClick={() => setActiveClient(c.id)}>
                      <div className="h-2.5 w-2.5 rounded-full mr-2" style={{ backgroundColor: c.color }} />
                      {c.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}

        <Button variant="outline" size="sm" className="gap-2" onClick={openSearch}>
          <Search className="h-4 w-4" />
          <span className="hidden sm:inline">Search</span>
          <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <span className="text-xs">Ctrl</span>K
          </kbd>
        </Button>

        {currentView === 'journal' && (
          <>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={openHandwritingUpload}
            >
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Scan Handwriting</span>
            </Button>
            <Button size="sm" className="gap-2" onClick={() => openEditor()}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New Dream</span>
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
