import { useEffect, useRef, useState, useCallback } from 'react';
import cytoscape, { Core } from 'cytoscape';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDreamStore } from '@/stores/dreamStore';
import { useTagStore } from '@/stores/tagStore';
import { getCategoryColor } from '@/lib/utils';
import { getTagNotes, saveTagNotes } from '@/lib/tauri';
import type { Tag, Dream } from '@/lib/tauri';

export function ThemeAnalysisPage() {
  const { dreams, fetchDreams } = useDreamStore();
  const { tags, fetchTags } = useTagStore();

  const [selectedTag, setSelectedTag] = useState<Tag | null>(null);
  const [selectedDream, setSelectedDream] = useState<Dream | null>(null);
  const [notes, setNotes] = useState('');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchDreams();
    fetchTags();
  }, [fetchDreams, fetchTags]);

  // When the selected tag changes, load its notes and reset dream selection
  useEffect(() => {
    if (!selectedTag) {
      setNotes('');
      setSelectedDream(null);
      return;
    }
    setSelectedDream(null);
    getTagNotes(selectedTag.id)
      .then(setNotes)
      .catch(() => setNotes(''));
  }, [selectedTag]);

  // Auto-save notes with 800 ms debounce
  const handleNotesChange = useCallback(
    (value: string) => {
      setNotes(value);
      if (!selectedTag) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveTagNotes(selectedTag.id, value).catch(console.error);
      }, 800);
    },
    [selectedTag],
  );

  // Dreams that contain the selected tag
  const tagDreams = selectedTag
    ? dreams.filter((d) => d.tags.some((t) => t.id === selectedTag.id))
    : [];

  const sortedTags = [...tags].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-3">
      {/* ── Tag selector ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Label className="shrink-0 text-sm">Select tag</Label>
        <Select
          value={selectedTag?.id ?? ''}
          onValueChange={(id) => {
            const tag = tags.find((t) => t.id === id) ?? null;
            setSelectedTag(tag);
          }}
        >
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Choose a tag…" />
          </SelectTrigger>
          <SelectContent>
            {sortedTags.map((tag) => (
              <SelectItem key={tag.id} value={tag.id}>
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
                  {tag.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedTag && (
          <span className="text-xs text-muted-foreground">
            {tagDreams.length} dream{tagDreams.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* ── Tripartite view ───────────────────────────────────────────────── */}
      {selectedTag ? (
        <div className="flex-1 grid grid-cols-3 gap-3 min-h-0">
          {/* Panel 1 — Notes */}
          <NotesPanel
            tag={selectedTag}
            notes={notes}
            onNotesChange={handleNotesChange}
          />

          {/* Panel 2 — Dream viewer */}
          <DreamPanel
            tag={selectedTag}
            dreams={tagDreams}
            selectedDream={selectedDream}
            onSelectDream={setSelectedDream}
          />

          {/* Panel 3 — Star graph */}
          <StarGraphPanel tag={selectedTag} dreams={tagDreams} allTags={tags} />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          Select a tag above to begin your analysis.
        </div>
      )}
    </div>
  );
}

// ── Panel 1: Notes ────────────────────────────────────────────────────────────

function NotesPanel({
  tag,
  notes,
  onNotesChange,
}: {
  tag: Tag;
  notes: string;
  onNotesChange: (v: string) => void;
}) {
  return (
    <Card className="flex flex-col overflow-hidden p-3 gap-2">
      <div className="flex items-center gap-2 shrink-0">
        <span
          className="inline-block w-3 h-3 rounded-full"
          style={{ backgroundColor: tag.color }}
        />
        <span className="text-sm font-semibold truncate" title={tag.name}>
          {tag.name}
        </span>
        <span className="text-xs text-muted-foreground ml-auto shrink-0">Notes</span>
      </div>
      <Textarea
        className="flex-1 resize-none text-sm leading-relaxed min-h-0"
        placeholder={`Write your observations about the "${tag.name}" theme…`}
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
      />
    </Card>
  );
}

// ── Panel 2: Dream viewer ─────────────────────────────────────────────────────

function DreamPanel({
  tag,
  dreams,
  selectedDream,
  onSelectDream,
}: {
  tag: Tag;
  dreams: Dream[];
  selectedDream: Dream | null;
  onSelectDream: (d: Dream | null) => void;
}) {
  return (
    <Card className="flex flex-col overflow-hidden p-3 gap-2">
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-sm font-semibold">Dreams</span>
        <span className="text-xs text-muted-foreground">tagged "{tag.name}"</span>
      </div>

      {dreams.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          No dreams tagged with this theme yet.
        </p>
      ) : (
        <>
          <Select
            value={selectedDream?.id ?? ''}
            onValueChange={(id) => {
              const dream = dreams.find((d) => d.id === id) ?? null;
              onSelectDream(dream);
            }}
          >
            <SelectTrigger className="h-8 text-xs shrink-0">
              <SelectValue placeholder="Select a dream to view…" />
            </SelectTrigger>
            <SelectContent>
              {dreams.map((dream) => (
                <SelectItem key={dream.id} value={dream.id}>
                  <span className="flex flex-col">
                    <span className="font-medium">{dream.title}</span>
                    <span className="text-muted-foreground text-[11px]">
                      {dream.dream_date}
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedDream ? (
            <div className="flex-1 overflow-y-auto min-h-0">
              <h3 className="text-sm font-semibold mb-1">{selectedDream.title}</h3>
              <p className="text-xs text-muted-foreground mb-2">{selectedDream.dream_date}</p>
              <div
                className="tiptap prose dark:prose-invert max-w-none text-xs leading-relaxed"
                dangerouslySetInnerHTML={{ __html: selectedDream.content_html }}
              />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              Select a dream from the dropdown above.
            </p>
          )}
        </>
      )}
    </Card>
  );
}

// ── Panel 3: Star graph ───────────────────────────────────────────────────────

function StarGraphPanel({
  tag,
  dreams,
  allTags,
}: {
  tag: Tag;
  dreams: Dream[];
  allTags: Tag[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);

  // Compute co-occurring tags and edge weights from the dreams list
  const coTagMap = useRef<Map<string, { tag: Tag; weight: number }>>(new Map());

  useEffect(() => {
    const map = new Map<string, { tag: Tag; weight: number }>();
    const tagById = new Map(allTags.map((t) => [t.id, t]));
    for (const dream of dreams) {
      for (const dt of dream.tags) {
        if (dt.id === tag.id) continue;
        const full = tagById.get(dt.id);
        if (!full) continue;
        const existing = map.get(dt.id);
        if (existing) {
          existing.weight += 1;
        } else {
          map.set(dt.id, { tag: full, weight: 1 });
        }
      }
    }
    coTagMap.current = map;
  }, [dreams, tag, allTags]);

  useEffect(() => {
    if (!containerRef.current) return;

    const centerColor = getCategoryColor(tag.category);
    const coEntries = Array.from(coTagMap.current.entries());

    const nodes = [
      {
        data: {
          id: 'center',
          label: tag.name,
          color: centerColor,
          size: 36,
          isCenter: true,
        },
      },
      ...coEntries.map(([id, { tag: ct, weight }]) => ({
        data: {
          id,
          label: ct.name,
          color: getCategoryColor(ct.category),
          size: Math.max(18, Math.min(30, 14 + weight * 3)),
          weight,
        },
      })),
    ];

    const edges = coEntries.map(([id, { weight }]) => ({
      data: {
        id: `e-${id}`,
        source: 'center',
        target: id,
        weight,
      },
    }));

    const cy = cytoscape({
      container: containerRef.current,
      elements: [...nodes, ...edges],
      style: [
        {
          selector: 'node',
          style: {
            label: 'data(label)',
            'background-color': 'data(color)',
            width: 'data(size)',
            height: 'data(size)',
            shape: 'ellipse',
            'text-valign': 'bottom',
            'text-halign': 'center',
            'font-size': '9px',
            color: '#a0a0b0',
            'text-margin-y': 4,
          },
        },
        {
          selector: 'node[?isCenter]',
          style: {
            'border-width': 3,
            'border-color': 'data(color)',
            'font-size': '11px',
            color: '#e0e0f0',
            'font-weight': 'bold',
          },
        },
        {
          selector: 'edge',
          style: {
            width: 'mapData(weight, 1, 10, 1, 4)',
            'line-color': '#3f3f60',
            'curve-style': 'bezier',
            opacity: 0.6,
          },
        },
      ],
      layout:
        coEntries.length === 0
          ? { name: 'grid' }
          : {
              name: 'breadthfirst',
              roots: ['center'],
              circle: true,
              directed: false,
              padding: 24,
            },
    });

    cyRef.current = cy;
    return () => cy.destroy();
  }, [tag, dreams, allTags]);

  return (
    <Card className="flex flex-col overflow-hidden p-3 gap-2">
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-sm font-semibold">Co-occurrence Network</span>
        <span className="text-xs text-muted-foreground ml-auto">
          {coTagMap.current.size} connected tag{coTagMap.current.size !== 1 ? 's' : ''}
        </span>
      </div>
      {coTagMap.current.size === 0 ? (
        <p className="text-xs text-muted-foreground italic flex-1 flex items-center justify-center">
          No co-occurring tags found for this theme.
        </p>
      ) : (
        <div
          ref={containerRef}
          className="flex-1 rounded-md border bg-card min-h-0 cytoscape-container"
        />
      )}
    </Card>
  );
}
