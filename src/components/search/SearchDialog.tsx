import { useState, useEffect } from 'react';
import { Search, X, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TagBadge } from '@/components/tags/TagBadge';
import { useUIStore } from '@/stores/uiStore';
import { searchDreams } from '@/lib/tauri';
import type { Dream } from '@/lib/tauri';

export function SearchDialog() {
  const { searchOpen, closeSearch, openEditor } = useUIStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Dream[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Keyboard shortcut to open search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (searchOpen) {
          closeSearch();
        } else {
          useUIStore.getState().openSearch();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchOpen, closeSearch]);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const result = await searchDreams({
          query: query.trim(),
          category_filter: null,
          is_lucid_filter: null,
          date_from: null,
          date_to: null,
        });
        setResults(result.dreams);
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (dream: Dream) => {
    closeSearch();
    openEditor(dream.id);
  };

  const handleClose = () => {
    closeSearch();
    setQuery('');
    setResults([]);
  };

  return (
    <Dialog open={searchOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl p-0">
        <div className="flex items-center border-b px-4 py-2">
          <Search className="h-5 w-5 text-muted-foreground mr-3" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search dreams..."
            className="border-0 focus-visible:ring-0 text-lg"
            autoFocus
          />
          {query && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setQuery('')}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <ScrollArea className="max-h-[400px]">
          {isSearching ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : results.length > 0 ? (
            <div className="p-2">
              {results.map((dream) => (
                <button
                  key={dream.id}
                  onClick={() => handleSelect(dream)}
                  className="w-full text-left p-3 rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{dream.title}</span>
                    {dream.is_lucid && <Sparkles className="h-4 w-4 text-primary" />}
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {format(new Date(dream.dream_date), 'MMM d, yyyy')}
                  </p>
                  {dream.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {dream.tags.slice(0, 3).map((tag) => (
                        <TagBadge key={tag.id} tag={tag} size="sm" />
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          ) : query ? (
            <div className="text-center py-8 text-muted-foreground">No dreams found</div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Start typing to search your dreams
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
