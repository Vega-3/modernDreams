import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import ForceGraph3D from '3d-force-graph';
import type { NodeObject, LinkObject } from '3d-force-graph';
import * as THREE from 'three';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
import { getCategoryColor, sortByName } from '@/lib/utils';
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

  const sortedTags = useMemo(() => sortByName(tags), [tags]);

  // Dream count per tag — drives the index page count column
  const dreamCountByTagId = useMemo(() => {
    const map = new Map<string, number>();
    for (const dream of dreams) {
      for (const t of dream.tags) {
        map.set(t.id, (map.get(t.id) ?? 0) + 1);
      }
    }
    return map;
  }, [dreams]);

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-3">

      {selectedTag ? (
        // ── Analysis view ──────────────────────────────────────────────────
        <>
          {/* Back button + active tag label */}
          <div className="flex items-center gap-3 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 px-2"
              onClick={() => setSelectedTag(null)}
            >
              <ChevronLeft className="h-4 w-4" />
              All tags
            </Button>
            <span
              className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: selectedTag.color }}
            />
            <span className="text-sm font-semibold">{selectedTag.name}</span>
            <span className="text-xs text-muted-foreground">
              {tagDreams.length} dream{tagDreams.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Tripartite panels */}
          <div className="flex-1 grid grid-cols-3 gap-3 min-h-0">
            <NotesPanel tag={selectedTag} notes={notes} onNotesChange={handleNotesChange} />
            <DreamPanel
              tag={selectedTag}
              dreams={tagDreams}
              selectedDream={selectedDream}
              onSelectDream={setSelectedDream}
            />
            <ConstellationPanel tag={selectedTag} dreams={tagDreams} allTags={tags} />
          </div>
        </>
      ) : (
        // ── Tag index ──────────────────────────────────────────────────────
        // All tags in 5 columns, alphabetical, with dream count on the right.
        <div className="overflow-y-auto flex-1">
          <div className="grid grid-cols-5 gap-x-3 gap-y-0.5">
            {sortedTags.map((tag) => {
              const count = dreamCountByTagId.get(tag.id) ?? 0;
              return (
                <button
                  key={tag.id}
                  onClick={() => setSelectedTag(tag)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded text-left hover:bg-accent transition-colors"
                >
                  <span
                    className="inline-block w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="text-sm flex-1 truncate">{tag.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
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

// ── Label sprite helper (shared texture cache) ────────────────────────────────

const _labelTextureCache = new Map<string, THREE.Texture>();
function getLabelTexture(text: string): THREE.Texture {
  if (_labelTextureCache.has(text)) return _labelTextureCache.get(text)!;
  const canvas = document.createElement('canvas');
  const fontSize = 30;
  const padding = 10;
  canvas.height = fontSize + padding * 3;
  const ctx = canvas.getContext('2d')!;
  ctx.font = `${fontSize}px sans-serif`;
  canvas.width = Math.ceil(ctx.measureText(text).width) + padding * 2 + 16;
  ctx.font = `${fontSize}px sans-serif`;
  ctx.shadowColor = 'rgba(255, 255, 255, 0.75)';
  ctx.shadowBlur = 14;
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fillText(text, padding + 8, fontSize + padding);
  ctx.shadowBlur = 6;
  ctx.fillText(text, padding + 8, fontSize + padding);
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,1)';
  ctx.fillText(text, padding + 8, fontSize + padding);
  const texture = new THREE.CanvasTexture(canvas);
  _labelTextureCache.set(text, texture);
  return texture;
}

// ── Panel 3: Constellation ────────────────────────────────────────────────────

function ConstellationPanel({
  tag,
  dreams,
  allTags,
}: {
  tag: Tag;
  dreams: Dream[];
  allTags: Tag[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(null);
  const fittedRef = useRef(false);

  const coTagMap = useMemo(() => {
    const map = new Map<string, { tag: Tag; weight: number }>();
    const tagById = new Map(allTags.map((t) => [t.id, t]));
    for (const dream of dreams) {
      for (const dt of dream.tags) {
        if (dt.id === tag.id) continue;
        const full = tagById.get(dt.id);
        if (!full) continue;
        const existing = map.get(dt.id);
        if (existing) existing.weight += 1;
        else map.set(dt.id, { tag: full, weight: 1 });
      }
    }
    return map;
  }, [dreams, tag, allTags]);

  const graphData = useMemo(() => {
    const nodes = [
      { id: 'center', name: tag.name, color: getCategoryColor(tag.category), size: 10 },
      ...Array.from(coTagMap.entries()).map(([id, { tag: ct, weight }]) => ({
        id,
        name: ct.name,
        color: getCategoryColor(ct.category),
        size: Math.max(4, Math.min(8, 3 + weight * 1.5)),
      })),
    ];
    const links = Array.from(coTagMap.entries()).map(([id, { weight }]) => ({
      source: 'center',
      target: id,
      weight,
    }));
    return { nodes, links };
  }, [tag, coTagMap]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const graph = new ForceGraph3D(container, { rendererConfig: { antialias: true } })
      .width(Math.max(container.offsetWidth, 200))
      .height(Math.max(container.offsetHeight, 200))
      .backgroundColor('#08080f')
      .showNavInfo(false)
      .nodeId('id')
      .nodeLabel('name')
      .nodeVal((node: NodeObject) => { const n = node as any; return n.size * n.size; })
      .nodeColor((node: NodeObject) => (node as any).color)
      .nodeOpacity(0.92)
      .nodeResolution(12)
      .nodeThreeObject((node: NodeObject) => {
        const n = node as any;
        const texture = getLabelTexture(n.name);
        const spriteMat = new THREE.SpriteMaterial({
          map: texture, transparent: true, depthWrite: false, depthTest: false,
        });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.renderOrder = 999;
        const img = texture.image as HTMLCanvasElement;
        sprite.scale.set(img.width / 4, img.height / 4, 1);
        sprite.position.set(0, n.size + (img.height / 4) / 2 + 1, 0);
        return sprite;
      })
      .nodeThreeObjectExtend(true)
      .linkSource('source')
      .linkTarget('target')
      .linkColor(() => '#ccccee')
      .linkOpacity(0.35)
      .linkWidth((link: LinkObject) => Math.min((link as any).weight * 0.6, 2.5))
      .linkDirectionalParticles(0)
      .onEngineStop(() => {
        const nodeCount = (graph.graphData() as any).nodes?.length ?? 0;
        if (nodeCount > 0 && !fittedRef.current) {
          fittedRef.current = true;
          graph.zoomToFit(600, 40);
        }
      })
      .graphData(graphData as any);

    graphRef.current = graph;

    const observer = new ResizeObserver(() => {
      if (graphRef.current && container) {
        graphRef.current.width(container.offsetWidth).height(container.offsetHeight);
      }
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      try { graph._destructor(); } catch { /* ignore */ }
      container.innerHTML = '';
      graphRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!graphRef.current) return;
    fittedRef.current = false;
    graphRef.current.graphData(graphData as any);
  }, [graphData]);

  return (
    <Card className="flex flex-col overflow-hidden p-3 gap-2">
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-sm font-semibold">Constellation</span>
        <span className="text-xs text-muted-foreground ml-auto">
          {coTagMap.size} connected tag{coTagMap.size !== 1 ? 's' : ''}
        </span>
      </div>
      {coTagMap.size === 0 ? (
        <p className="text-xs text-muted-foreground italic flex-1 flex items-center justify-center">
          No co-occurring tags found for this theme.
        </p>
      ) : (
        <div
          ref={containerRef}
          className="flex-1 rounded-md border min-h-0 overflow-hidden"
          style={{ background: '#08080f' }}
        />
      )}
    </Card>
  );
}
