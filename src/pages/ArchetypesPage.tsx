import { useState } from 'react';
import { Link2, Link2Off, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useArchetypeStore, type Archetype } from '@/stores/archetypeStore';
import { useTagStore } from '@/stores/tagStore';
import { useDreamStore } from '@/stores/dreamStore';
import type { Tag } from '@/lib/tauri';

// ── Archetype card ────────────────────────────────────────────────────────────

function ArchetypeCard({ archetype }: { archetype: Archetype }) {
  const { tags } = useTagStore();
  const { dreamArchetypeMap } = useArchetypeStore();
  const { linkTagToArchetype, unlinkTagFromArchetype } = useArchetypeStore();
  const [expanded, setExpanded] = useState(false);
  const [showLinkPanel, setShowLinkPanel] = useState(false);

  const linkedTags = tags.filter((t) => archetype.linkedTagIds.includes(t.id));
  const unlinkable = linkedTags;
  const linkable = tags.filter((t) => !archetype.linkedTagIds.includes(t.id));

  // Count dreams that have this archetype applied
  const dreamCount = Object.values(dreamArchetypeMap).filter((ids) =>
    ids.includes(archetype.id)
  ).length;

  return (
    <Card className="flex flex-col overflow-hidden border-l-4" style={{ borderLeftColor: archetype.color }}>
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span
              className="w-4 h-4 rounded-full shrink-0 ring-2 ring-offset-1 ring-offset-card"
              style={{ backgroundColor: archetype.color, ringColor: archetype.color }}
            />
            <CardTitle className="text-sm font-semibold leading-tight">
              {archetype.name}
            </CardTitle>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {dreamCount > 0 && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                {dreamCount} dream{dreamCount !== 1 ? 's' : ''}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-3 space-y-2">
        {expanded && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground leading-relaxed">{archetype.description}</p>
            <p className="text-[11px] text-muted-foreground/70 italic">
              <span className="font-medium not-italic text-muted-foreground">Dream indicators:</span>{' '}
              {archetype.dreamIndicators}
            </p>
          </div>
        )}

        {/* Linked tags */}
        <div className="flex flex-wrap gap-1 min-h-[20px]">
          {linkedTags.length === 0 ? (
            <span className="text-[11px] text-muted-foreground/60 italic">No tags linked yet</span>
          ) : (
            linkedTags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: tag.color + '33', color: tag.color }}
              >
                {tag.name}
                <button
                  className="opacity-60 hover:opacity-100"
                  onClick={() => unlinkTagFromArchetype(archetype.id, tag.id)}
                >
                  <Link2Off className="h-2.5 w-2.5" />
                </button>
              </span>
            ))
          )}
        </div>

        {/* Link tag panel */}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-[11px] gap-1 text-muted-foreground hover:text-foreground px-1.5"
          onClick={() => setShowLinkPanel((v) => !v)}
        >
          <Link2 className="h-3 w-3" />
          {showLinkPanel ? 'Close' : 'Link tag…'}
        </Button>

        {showLinkPanel && (
          <div className="rounded-md border bg-muted/20 p-2 max-h-36 overflow-y-auto space-y-1">
            {linkable.length === 0 ? (
              <p className="text-[11px] text-muted-foreground italic">All tags are already linked.</p>
            ) : (
              linkable.map((tag) => (
                <button
                  key={tag.id}
                  className="flex items-center gap-2 w-full text-left hover:bg-muted/40 rounded px-2 py-1 text-xs transition-colors"
                  onClick={() => {
                    linkTagToArchetype(archetype.id, tag.id);
                  }}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span>{tag.name}</span>
                  <span className="text-muted-foreground/60 text-[10px] ml-auto capitalize">
                    {tag.category}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Activity summary ──────────────────────────────────────────────────────────

function ActivitySummary() {
  const { getArchetypesByDreamActivity } = useArchetypeStore();
  const activity = getArchetypesByDreamActivity()
    .filter((a) => a.dreamCount > 0)
    .sort((a, b) => b.dreamCount - a.dreamCount);

  if (activity.length === 0) return null;

  const max = activity[0].dreamCount;

  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold mb-3">Archetypal Activity</h3>
      <div className="space-y-1.5">
        {activity.map(({ archetype, dreamCount }) => (
          <div key={archetype.id} className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: archetype.color }}
            />
            <span className="text-xs w-32 truncate shrink-0">{archetype.name}</span>
            <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${(dreamCount / max) * 100}%`,
                  backgroundColor: archetype.color,
                }}
              />
            </div>
            <span className="text-[11px] text-muted-foreground w-8 text-right shrink-0">
              {dreamCount}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function ArchetypesPage() {
  const { archetypes } = useArchetypeStore();

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-4">
      {/* Left: activity summary */}
      <div className="w-64 shrink-0 flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-semibold mb-0.5">Archetypes</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Universal patterns from the collective unconscious. Link tags to archetypes and apply them
            directly to dreams to reveal the individuation process across your journal.
          </p>
        </div>
        <ActivitySummary />
      </div>

      {/* Right: archetype grid */}
      <ScrollArea className="flex-1">
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 pr-2 pb-4">
          {archetypes.map((archetype) => (
            <ArchetypeCard key={archetype.id} archetype={archetype} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
