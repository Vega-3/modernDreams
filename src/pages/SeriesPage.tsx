import { useState, useCallback, useRef, useMemo } from 'react';
import { Plus, Trash2, Lightbulb, X, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSeriesStore, suggestSeriesFromDreams, type DreamSeries } from '@/stores/seriesStore';
import { useDreamStore } from '@/stores/dreamStore';
import { getCategoryColor } from '@/lib/utils';
import type { Dream } from '@/lib/tauri';

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveSeriesDreams(dreamIds: string[], dreamMap: Map<string, Dream>): Dream[] {
  return dreamIds
    .map((id) => dreamMap.get(id))
    .filter((d): d is Dream => d !== undefined)
    .sort((a, b) => a.dream_date.localeCompare(b.dream_date));
}

// ── Horizontal timeline ───────────────────────────────────────────────────────

function SeriesTimeline({ series, dreamMap }: { series: DreamSeries; dreamMap: Map<string, Dream> }) {
  const seriesDreams = resolveSeriesDreams(series.dreamIds, dreamMap);

  if (seriesDreams.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">No dreams added to this series yet.</p>
    );
  }

  return (
    <div className="relative">
      {/* Horizontal connector line */}
      <div className="absolute top-5 left-4 right-4 h-0.5 bg-border" />
      <div className="flex gap-4 overflow-x-auto pb-2 pt-1 px-1 relative">
        {seriesDreams.map((dream) => {
          // Dominant emotive tag (first emotive tag found)
          const emotive = dream.tags.find((t) => t.category === 'emotive');
          const dotColor = emotive ? emotive.color : getCategoryColor('symbolic');

          // Symbolic tags for hover
          const symbolic = dream.tags.filter((t) => t.category === 'symbolic').slice(0, 3);

          return (
            <div
              key={dream.id}
              className="flex flex-col items-center gap-1.5 shrink-0 group"
              style={{ minWidth: 72 }}
            >
              {/* Node */}
              <div
                className="w-10 h-10 rounded-full border-2 border-background shadow-sm z-10 relative flex items-center justify-center cursor-default transition-transform group-hover:scale-110"
                style={{ backgroundColor: dotColor }}
                title={`${dream.title}\n${dream.dream_date}${symbolic.length ? '\n' + symbolic.map((t) => t.name).join(', ') : ''}`}
              >
                <span className="text-[9px] text-white font-bold leading-none text-center px-0.5">
                  {dream.title.slice(0, 3).toUpperCase()}
                </span>
              </div>
              {/* Date label */}
              <span className="text-[10px] text-muted-foreground text-center leading-tight">
                {format(new Date(dream.dream_date), 'MMM d')}
              </span>
              {/* Title truncated */}
              <span
                className="text-[9px] text-center leading-tight max-w-[68px] truncate text-foreground/70"
                title={dream.title}
              >
                {dream.title}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Tag evolution summary ─────────────────────────────────────────────────────

function TagEvolution({ series, dreamMap }: { series: DreamSeries; dreamMap: Map<string, Dream> }) {
  const seriesDreams = resolveSeriesDreams(series.dreamIds, dreamMap);

  if (seriesDreams.length === 0) return null;

  // Count ALL tag appearances (all categories are symbolic carriers)
  const tagCounts = new Map<string, { name: string; color: string; count: number; presentIn: Set<number> }>();
  seriesDreams.forEach((dream, i) => {
    dream.tags.forEach((tag) => {
      const existing = tagCounts.get(tag.id);
      if (existing) {
        existing.count++;
        existing.presentIn.add(i);
      } else {
        tagCounts.set(tag.id, { name: tag.name, color: tag.color, count: 1, presentIn: new Set([i]) });
      }
    });
  });

  // Only show tags that appear in more than one dream (longitudinal interest)
  const sorted = [...tagCounts.values()]
    .filter((t) => t.count > 1)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  if (sorted.length === 0) return null;

  return (
    <div className="mt-3">
      <p className="text-[11px] text-muted-foreground font-medium mb-2">Tag overlap across series</p>
      <div className="flex flex-wrap gap-1.5">
        {sorted.map((tag) => (
          <div
            key={tag.name}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
            style={{ backgroundColor: tag.color + '22', color: tag.color, border: `1px solid ${tag.color}55` }}
            title={`Appears in ${tag.count} of ${seriesDreams.length} dreams`}
          >
            <span>{tag.name}</span>
            <Badge
              variant="secondary"
              className="h-3.5 px-1 text-[9px] font-bold leading-none"
              style={{ backgroundColor: tag.color + '33', color: tag.color }}
            >
              {tag.count}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Series card ───────────────────────────────────────────────────────────────

function SeriesCard({ series, allDreams, dreamMap }: { series: DreamSeries; allDreams: Dream[]; dreamMap: Map<string, Dream> }) {
  const { deleteSeries, addDreamToSeries, removeDreamFromSeries, setInterpretation, renameSeries } =
    useSeriesStore();
  const [expanded, setExpanded] = useState(true);
  const [showAddDream, setShowAddDream] = useState(false);
  const [dreamSearch, setDreamSearch] = useState('');
  const [interpretation, setLocalInterp] = useState(series.interpretation);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleInterpretation = (val: string) => {
    setLocalInterp(val);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setInterpretation(series.id, val), 800);
  };

  const seriesDreamIds = new Set(series.dreamIds);
  const availableDreams = allDreams.filter((d) => {
    if (seriesDreamIds.has(d.id)) return false;
    if (!dreamSearch.trim()) return true;
    const q = dreamSearch.toLowerCase();
    return d.title.toLowerCase().includes(q) || d.tags.some((t) => t.name.toLowerCase().includes(q));
  });

  return (
    <Card>
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-semibold flex-1">
            <input
              className="bg-transparent border-none outline-none w-full text-sm font-semibold"
              value={series.name}
              onChange={(e) => renameSeries(series.id, e.target.value)}
            />
          </CardTitle>
          <span className="text-xs text-muted-foreground shrink-0">
            {series.dreamIds.length} dream{series.dreamIds.length !== 1 ? 's' : ''}
          </span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setExpanded((v) => !v)}>
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={() => deleteSeries(series.id)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="px-4 pb-4 space-y-3">
          {/* Timeline */}
          <SeriesTimeline series={series} dreamMap={dreamMap} />

          {/* Tag evolution */}
          <TagEvolution series={series} dreamMap={dreamMap} />

          {/* Added dream list */}
          {series.dreamIds.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {series.dreamIds.map((id) => {
                const dream = dreamMap.get(id);
                if (!dream) return null;
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                  >
                    {dream.title}
                    <button
                      onClick={() => removeDreamFromSeries(series.id, id)}
                      className="opacity-60 hover:opacity-100"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          {/* Add dream selector */}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[11px] gap-1 text-muted-foreground hover:text-foreground px-1.5"
            onClick={() => setShowAddDream((v) => !v)}
          >
            <Plus className="h-3 w-3" />
            {showAddDream ? 'Close' : 'Add dream…'}
          </Button>

          {showAddDream && (
            <div className="rounded-md border bg-muted/20 p-2 space-y-1.5">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <input
                  className="w-full h-6 pl-6 pr-2 text-[11px] rounded bg-muted/30 border border-muted/50 focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="Search by title or tag…"
                  value={dreamSearch}
                  onChange={(e) => setDreamSearch(e.target.value)}
                />
              </div>
              <div className="max-h-36 overflow-y-auto space-y-0.5">
                {availableDreams.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground italic px-1">
                    {dreamSearch ? 'No matching dreams.' : 'All dreams are already in this series.'}
                  </p>
                ) : (
                  availableDreams.slice(0, 40).map((dream) => (
                    <button
                      key={dream.id}
                      className="flex items-center gap-2 w-full text-left hover:bg-muted/40 rounded px-2 py-1 text-xs transition-colors"
                      onClick={() => { addDreamToSeries(series.id, dream.id); }}
                    >
                      <span className="flex-1 truncate">{dream.title}</span>
                      <span className="text-muted-foreground/60 text-[10px] shrink-0">{dream.dream_date}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Analyst interpretation */}
          <div className="space-y-1">
            <Label className="text-[11px]">Series interpretation</Label>
            <Textarea
              className="resize-none text-xs min-h-[64px]"
              placeholder="Annotate the overall arc of this dream series…"
              value={interpretation}
              onChange={(e) => handleInterpretation(e.target.value)}
            />
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ── Suggestions banner ────────────────────────────────────────────────────────

function SuggestionsBanner({
  dreams,
  dreamMap,
  existingIds,
  onAccept,
}: {
  dreams: Dream[];
  dreamMap: Map<string, Dream>;
  existingIds: Set<string>;
  onAccept: (group: string[]) => void;
}) {
  const [visible, setVisible] = useState(true);
  const suggestions = suggestSeriesFromDreams(dreams);
  const novel = suggestions.filter((group) =>
    group.some((id) => !existingIds.has(id))
  );
  if (!visible || novel.length === 0) return null;

  return (
    <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 space-y-2">
      <div className="flex items-start gap-2">
        <Lightbulb className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
            {novel.length} potential series detected by tag overlap
          </p>
          <div className="mt-2 space-y-1.5">
            {novel.slice(0, 3).map((group, i) => {
              const names = group
                .map((id) => dreamMap.get(id)?.title)
                .filter(Boolean)
                .slice(0, 4);
              return (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground flex-1 truncate">
                    {names.join(', ')}{group.length > 4 ? ` +${group.length - 4}` : ''}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-[11px] shrink-0"
                    onClick={() => onAccept(group)}
                  >
                    Create series
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setVisible(false)}>
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function SeriesPage() {
  const { series, createSeries } = useSeriesStore();
  const { dreams } = useDreamStore();
  const [newName, setNewName] = useState('');

  const dreamMap = useMemo(() => new Map(dreams.map((d) => [d.id, d])), [dreams]);
  const existingDreamIds = new Set(series.flatMap((s) => s.dreamIds));

  const handleCreate = () => {
    if (!newName.trim()) return;
    createSeries(newName);
    setNewName('');
  };

  const handleAcceptSuggestion = useCallback(
    (group: string[]) => {
      const names = group
        .map((id) => dreamMap.get(id)?.title)
        .filter(Boolean)
        .slice(0, 2);
      const s = createSeries(names.join(' / ') || 'New Series');
      group.forEach((id) => {
        const store = useSeriesStore.getState();
        store.addDreamToSeries(s.id, id);
      });
    },
    [dreamMap, createSeries]
  );

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-4">
      {/* ── Left panel ──────────────────────────────────────────────────────── */}
      <div className="w-60 shrink-0 flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-semibold mb-0.5">Dream Series</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Group related dreams into a series to track the longitudinal arc of psychic
            movement and symbolic evolution over time.
          </p>
        </div>

        {/* Create new series */}
        <div className="space-y-1.5">
          <Label className="text-xs">New series</Label>
          <div className="flex gap-1.5">
            <Input
              className="h-8 text-xs flex-1"
              placeholder="Series name…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <Button size="sm" className="h-8 px-2.5" onClick={handleCreate} disabled={!newName.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="text-xs text-muted-foreground border-t pt-2">
          {series.length} series · {dreams.length} dreams
        </div>
      </div>

      {/* ── Right panel: series cards ────────────────────────────────────────── */}
      <ScrollArea className="flex-1">
        <div className="space-y-3 pr-2 pb-4">
          {/* Auto-suggestion banner */}
          <SuggestionsBanner
            dreams={dreams}
            dreamMap={dreamMap}
            existingIds={existingDreamIds}
            onAccept={handleAcceptSuggestion}
          />

          {series.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
              Create a series to begin tracking dream sequences.
            </div>
          ) : (
            series.map((s) => (
              <SeriesCard key={s.id} series={s} allDreams={dreams} dreamMap={dreamMap} />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
