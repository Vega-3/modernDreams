import { Moon, BookOpen, Calendar, Network, Tags, Settings, PanelLeftClose, PanelLeft, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/uiStore';

const navItems = [
  { id: 'journal' as const, icon: BookOpen, label: 'Journal' },
  { id: 'calendar' as const, icon: Calendar, label: 'Calendar' },
  { id: 'graph' as const, icon: Network, label: 'Graph' },
  { id: 'tags' as const, icon: Tags, label: 'Tags' },
  { id: 'settings' as const, icon: Settings, label: 'Settings' },
  { id: 'guide' as const, icon: HelpCircle, label: 'Guide' },
];

export function Sidebar() {
  const { currentView, setView, sidebarCollapsed, toggleSidebar } = useUIStore();

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'flex flex-col border-r bg-card transition-all duration-300',
          sidebarCollapsed ? 'w-16' : 'w-56'
        )}
      >
        {/* Header */}
        <div className="flex h-14 items-center border-b px-4">
          <div className={cn('flex items-center gap-2', sidebarCollapsed && 'justify-center w-full')}>
            <Moon className="h-6 w-6 text-primary" />
            {!sidebarCollapsed && <span className="font-semibold text-lg">Dreams</span>}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;

            if (sidebarCollapsed) {
              return (
                <Tooltip key={item.id}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={isActive ? 'secondary' : 'ghost'}
                      size="icon"
                      className="w-full"
                      onClick={() => setView(item.id)}
                    >
                      <Icon className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              );
            }

            return (
              <Button
                key={item.id}
                variant={isActive ? 'secondary' : 'ghost'}
                className="w-full justify-start gap-3"
                onClick={() => setView(item.id)}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Button>
            );
          })}
        </nav>

        {/* Collapse button */}
        <div className="p-2 border-t">
          <Button variant="ghost" size="icon" className="w-full" onClick={toggleSidebar}>
            {sidebarCollapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </Button>
        </div>
      </aside>
    </TooltipProvider>
  );
}
