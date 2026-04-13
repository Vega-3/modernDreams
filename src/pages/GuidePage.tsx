import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ── Binder pages ──────────────────────────────────────────────────────────────

interface BinderPage {
  id: string;
  label: string;
  url: string;
  tab: string;
}

const PAGES: BinderPage[] = [
  { id: 'archetypes', label: 'Archetypes', url: '/ARCHETYPES.md', tab: 'Archetypes' },
  { id: 'sleep', label: 'Sleep & Dream Recall', url: '/SLEEP.md', tab: 'Sleep & REM' },
  { id: 'guide', label: 'Using the Journal', url: '/GUIDE.md', tab: 'Guide' },
];

// ── Markdown renderer ─────────────────────────────────────────────────────────

const MD_COMPONENTS: React.ComponentProps<typeof ReactMarkdown>['components'] = {
  h1: ({ children }) => (
    <h1 className="text-2xl font-bold mt-6 mb-3 text-foreground border-b border-border pb-2">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-xl font-semibold mt-5 mb-2 text-foreground">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-semibold mt-4 mb-1.5 text-foreground">{children}</h3>
  ),
  p: ({ children }) => <p className="text-foreground/80 mb-3 leading-relaxed">{children}</p>,
  ul: ({ children }) => (
    <ul className="list-disc list-inside space-y-1 mb-3 text-foreground/80">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-inside space-y-1 mb-3 text-foreground/80">{children}</ol>
  ),
  li: ({ children }) => <li className="ml-2">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-primary/40 pl-4 italic text-muted-foreground my-3">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="border-border my-6" />,
  code: ({ children }) => (
    <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>
  ),
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic text-muted-foreground">{children}</em>,
};

// ── Page ──────────────────────────────────────────────────────────────────────

export function GuidePage() {
  const [activePage, setActivePage] = useState(0);
  const [contents, setContents] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  // Pre-fetch all pages eagerly
  useEffect(() => {
    PAGES.forEach(({ id, url }) => {
      fetch(url)
        .then((r) => {
          if (!r.ok) throw new Error('not found');
          return r.text();
        })
        .then((text) => setContents((prev) => ({ ...prev, [id]: text })))
        .catch(() => setErrors((prev) => ({ ...prev, [id]: true })));
    });
  }, []);

  const page = PAGES[activePage];
  const content = contents[page.id];
  const hasError = errors[page.id];

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-0">
      {/* ── Binder spine / tabs ─────────────────────────────────────────────── */}
      <div className="flex flex-col w-36 shrink-0 border-r bg-card/60">
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-3 border-b">
          <BookOpen className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-semibold tracking-tight">Guide</span>
        </div>

        {/* Tab list */}
        <nav className="flex-1 py-2 space-y-0.5 px-1.5">
          {PAGES.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setActivePage(i)}
              className={cn(
                'w-full text-left px-2.5 py-2 rounded text-xs transition-all leading-tight',
                i === activePage
                  ? 'bg-primary text-primary-foreground font-medium shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {p.tab}
            </button>
          ))}
        </nav>

        {/* Page navigation arrows at bottom */}
        <div className="flex items-center justify-between px-2 py-2 border-t">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={activePage === 0}
            onClick={() => setActivePage((p) => p - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-[10px] text-muted-foreground">
            {activePage + 1} / {PAGES.length}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={activePage === PAGES.length - 1}
            onClick={() => setActivePage((p) => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ── Page content ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Page header strip */}
        <div className="flex items-center gap-2 px-6 py-2.5 border-b bg-muted/30 shrink-0">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {page.label}
          </span>
        </div>

        <ScrollArea className="flex-1">
          <div className="max-w-3xl mx-auto px-8 py-6">
            {hasError ? (
              <p className="text-muted-foreground text-sm">
                Couldn't load {page.label}. Make sure the file exists in the app's public folder.
              </p>
            ) : !content ? (
              <p className="text-muted-foreground text-sm animate-pulse">Loading…</p>
            ) : (
              <div className="guide-content space-y-1 text-sm leading-relaxed">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
                  {content}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
