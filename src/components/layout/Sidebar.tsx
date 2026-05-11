import { BookOpen, Calendar, Network, Tags, Microscope, Layers, GitBranch, Briefcase, Settings, PanelLeftClose, PanelLeft, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/uiStore';

const navItems = [
  { id: 'journal' as const, icon: BookOpen, label: 'Journal' },
  { id: 'calendar' as const, icon: Calendar, label: 'Calendar' },
  { id: 'graph' as const, icon: Network, label: 'Constellation' },
  { id: 'tags' as const, icon: Tags, label: 'Tags' },
  { id: 'theme' as const, icon: Microscope, label: 'Theme Analysis' },
  { id: 'archetypes' as const, icon: Layers, label: 'Archetypes' },
  { id: 'series' as const, icon: GitBranch, label: 'Dream Series' },
  { id: 'analyst' as const, icon: Briefcase, label: 'Professional' },
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
            <svg className="logo-mark h-6 w-6 shrink-0" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Ipsacarta">
                <g stroke="currentColor" stroke-linecap="round">
                  <line x1="60" y1="14" x2="95" y2="36" stroke-width="1.8" stroke-opacity="0.55"/>
                  <line x1="95" y1="36" x2="87" y2="78" stroke-width="1.8" stroke-opacity="0.55"/>
                  <line x1="87" y1="78" x2="42" y2="94" stroke-width="1.8" stroke-opacity="0.55"/>
                  <line x1="42" y1="94" x2="18" y2="56" stroke-width="1.8" stroke-opacity="0.55"/>
                  <line x1="18" y1="56" x2="60" y2="14" stroke-width="1.8" stroke-opacity="0.55"/>
                  <line x1="60" y1="14" x2="87" y2="78" stroke-width="1" stroke-opacity="0.22"/>
                  <line x1="95" y1="36" x2="42" y2="94" stroke-width="1" stroke-opacity="0.22"/>
                </g>
                <circle cx="60"  cy="14" r="5"   fill="currentColor"/>
                <circle cx="95"  cy="36" r="4"   fill="currentColor" opacity="0.85"/>
                <circle cx="87"  cy="78" r="5"   fill="currentColor"/>
                <circle cx="42"  cy="94" r="4"   fill="currentColor" opacity="0.85"/>
                <circle cx="18"  cy="56" r="4"   fill="currentColor" opacity="0.85"/>
              </svg>
            {!sidebarCollapsed && (
              <span className="font-p5 text-lg tracking-tight text-foreground">
                IPSACARTA
              </span>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-0.5">
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
                      className={cn('w-full', isActive && 'nav-item-active')}
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
                className={cn(
                  'w-full justify-start gap-3 rounded-sm',
                  isActive && 'nav-item-active text-primary'
                )}
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
