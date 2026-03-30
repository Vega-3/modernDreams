import { Search, Plus, Upload, Users, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/stores/uiStore';
import { useClientStore } from '@/stores/clientStore';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const viewTitles: Record<string, string> = {
  dashboard: 'Dashboard',
  journal: 'Dream Journal',
  calendar: 'Calendar',
  graph: 'Dream Graph',
  tags: 'Tags',
  analyst: 'Analyst',
  settings: 'Settings',
  guide: 'Guide',
};

export function Header() {
  const { currentView, openSearch, openEditor, openHandwritingUpload } = useUIStore();
  const { clients, activeClientId, setActiveClient } = useClientStore();

  const activeClientName = activeClientId
    ? clients.find((c) => c.id === activeClientId)?.name ?? 'Unknown'
    : 'Personal Journal';

  const showClientFilter = clients.length > 0 && currentView !== 'analyst' && currentView !== 'settings' && currentView !== 'guide';

  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-6">
      <h1 className="text-xl font-semibold">{viewTitles[currentView] ?? currentView}</h1>

      <div className="flex items-center gap-2">
        {/* Client filter — shown when clients exist */}
        {showClientFilter && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 max-w-[180px]">
                <Users className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{activeClientName}</span>
                <ChevronDown className="h-3 w-3 flex-shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setActiveClient(null)}>
                Personal Journal
              </DropdownMenuItem>
              {clients.length > 0 && <DropdownMenuSeparator />}
              {clients.map((client) => (
                <DropdownMenuItem key={client.id} onClick={() => setActiveClient(client.id)}>
                  {client.name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setActiveClient(null)} className="text-muted-foreground text-xs">
                View all clients
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
