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
  graph: 'Constellation',
  tags: 'Tags',
  theme: 'Theme Analysis',
  archetypes: 'Archetypes',
  series: 'Dream Series',
  analyst: 'Professional',
  settings: 'Settings',
  guide: 'Guide',
};

export function Header() {
  const { currentView, openSearch, openEditor, openHandwritingUpload } = useUIStore();
  const { analystMode, clients, activeClientId, setActiveClient } = useAnalystStore();

  const activeClient = clients.find((c) => c.id === activeClientId) ?? null;

  return (
    <header className="relative flex h-14 items-center justify-between border-b bg-card px-6">
      <h1 className="font-p5 text-2xl tracking-tight uppercase text-foreground">
        {viewTitles[currentView]}
      </h1>

      {/* All-clients button — centred in the header, fixed position so it never shifts */}
      {analystMode && clients.length > 0 && (
        <div className="absolute left-1/2 -translate-x-1/2">
          {activeClient ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 min-w-[180px] justify-between px-4 font-medium border-2"
              style={{ borderColor: activeClient.color, color: activeClient.color }}
            >
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: activeClient.color }} />
                <span className="text-sm">{activeClient.name}</span>
              </div>
              <button onClick={() => setActiveClient(null)} className="rounded hover:bg-accent p-0.5">
                <X className="h-3.5 w-3.5" />
              </button>
            </Button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 min-w-[180px] justify-center font-medium border-2 border-primary/30 hover:border-primary/60"
                >
                  <Users className="h-4 w-4 text-primary" />
                  <span className="text-sm">All Clients</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center">
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

      <div className="flex items-center gap-2">

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
