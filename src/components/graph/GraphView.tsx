import { useEffect, useRef, useMemo, useState } from 'react';
import ForceGraph3D from '3d-force-graph';
import type { NodeObject, LinkObject } from '3d-force-graph';
import * as THREE from 'three';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { Eye, EyeOff, HelpCircle, Maximize2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDreamStore } from '@/stores/dreamStore';
import { useTagStore } from '@/stores/tagStore';
import { useUIStore } from '@/stores/uiStore';
import { getCategoryColor } from '@/lib/utils';
import { GraphStats } from './GraphStats';

// ── Group definitions ────────────────────────────────────────────────────────

const ALL_GROUPS = ['dreams', 'location', 'person', 'symbolic', 'emotive', 'custom'] as const;
type GroupKey = typeof ALL_GROUPS[number];

const GROUP_LABELS: Record<GroupKey, string> = {
  dreams: 'Dreams',
  location: 'Location',
  person: 'Person',
  symbolic: 'Symbolic',
  emotive: 'Emotive',
  custom: 'Custom',
};

const GROUP_COLORS: Record<GroupKey, string> = {
  dreams: '#6b7280',
  location: '#22c55e',
  person: '#3b82f6',
  symbolic: '#a855f7',
  emotive: '#f43f5e',
  custom: '#f59e0b',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function oneYearAgo(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

// ── Data types ───────────────────────────────────────────────────────────────

interface GNode extends NodeObject {
  id: string;
  name: string;
  nodeType: 'tag' | 'dream';
  category?: GroupKey;
  color: string;
  /** Radius for the sphere, in graph units */
  size: number;
  /** Original dream id (for dream nodes only) */
  dreamId?: string;
}

interface GLink extends LinkObject<GNode> {
  linkType: 'dream-tag' | 'tag-tag';
  /** Co-occurrence count for tag-tag edges, 1 for dream-tag */
  weight: number;
}

// Glow sprite texture (radial gradient, created once)
let _glowTexture: THREE.Texture | null = null;
function getGlowTexture(): THREE.Texture {
  if (_glowTexture) return _glowTexture;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.3, 'rgba(255,255,255,0.6)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  _glowTexture = new THREE.CanvasTexture(canvas);
  return _glowTexture;
}

// ── Component ────────────────────────────────────────────────────────────────

export function GraphView() {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(null);
  const openEditorRef = useRef<(id: string) => void>(() => {});
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // fittedRef: guards against the empty-data onEngineStop locking out the real-data auto-fit
  const fittedRef = useRef(false);

  const { dreams, fetchDreams } = useDreamStore();
  const { tags, fetchTags } = useTagStore();
  const { openEditor } = useUIStore();

  // Keep openEditor in a ref so the init effect doesn't re-run on identity change
  useEffect(() => { openEditorRef.current = openEditor; }, [openEditor]);

  const [hiddenGroups, setHiddenGroups] = useState<Set<GroupKey>>(new Set());
  const [startDate, setStartDate] = useState(oneYearAgo());
  const [endDate, setEndDate] = useState(today());
  // Defaults chosen so the 3-D force mapping produces reasonable initial layouts:
  // repelStrength 20000 → d3 charge ≈ -60; linkStrength 0.001 → link dist ≈ 130
  const [repelStrength, setRepelStrength] = useState(20000);
  const [linkStrength, setLinkStrength] = useState(0.001);
  const [showControls, setShowControls] = useState(false);

  useEffect(() => {
    fetchDreams();
    fetchTags();
  }, [fetchDreams, fetchTags]);

  const toggleGroup = (group: GroupKey) => {
    setHiddenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group); else next.add(group);
      return next;
    });
  };

  // ── Build graph data ───────────────────────────────────────────────────────
  const graphData = useMemo<{ nodes: GNode[]; links: GLink[] }>(() => {
    const nodes: GNode[] = [];
    const links: GLink[] = [];
    const tagCoOccurrence = new Map<string, Map<string, number>>();

    const showDreams    = !hiddenGroups.has('dreams');
    const visibleCatSet = new Set(ALL_GROUPS.filter(g => g !== 'dreams' && !hiddenGroups.has(g)));

    // Tag nodes — size proportional to usage_count
    tags
      .filter(t => visibleCatSet.has(t.category as GroupKey))
      .forEach(tag => {
        nodes.push({
          id: `tag-${tag.id}`,
          name: tag.name,
          nodeType: 'tag',
          category: tag.category as GroupKey,
          color: getCategoryColor(tag.category),
          size: Math.max(3, Math.min(14, tag.usage_count * 1.8 + 3)),
        });
      });

    // Filter dreams to selected date range
    const filteredDreams = dreams.filter(d => {
      const date = d.dream_date.slice(0, 10);
      return date >= startDate && date <= endDate;
    });

    filteredDreams.forEach(dream => {
      const dreamTags = dream.tags.filter(t => visibleCatSet.has(t.category as GroupKey));

      if (showDreams) {
        nodes.push({
          id: `dream-${dream.id}`,
          name: dream.title,
          nodeType: 'dream',
          color: GROUP_COLORS.dreams,
          size: 2.5,
          dreamId: dream.id,
        });

        dreamTags.forEach(tag => {
          links.push({
            source: `dream-${dream.id}`,
            target: `tag-${tag.id}`,
            linkType: 'dream-tag',
            weight: 1,
          } as GLink);
        });
      }

      // Co-occurrence (computed even when dream nodes are hidden)
      for (let i = 0; i < dreamTags.length; i++) {
        for (let j = i + 1; j < dreamTags.length; j++) {
          const a = dreamTags[i].id;
          const b = dreamTags[j].id;
          if (!tagCoOccurrence.has(a)) tagCoOccurrence.set(a, new Map());
          if (!tagCoOccurrence.has(b)) tagCoOccurrence.set(b, new Map());
          tagCoOccurrence.get(a)!.set(b, (tagCoOccurrence.get(a)!.get(b) ?? 0) + 1);
          tagCoOccurrence.get(b)!.set(a, (tagCoOccurrence.get(b)!.get(a) ?? 0) + 1);
        }
      }
    });

    // Tag–tag co-occurrence edges
    const coEdgeThreshold = showDreams ? 2 : 1;
    const addedEdges = new Set<string>();
    tagCoOccurrence.forEach((coTags, tagId) => {
      coTags.forEach((count, coTagId) => {
        const edgeKey = [tagId, coTagId].sort().join('-');
        if (!addedEdges.has(edgeKey) && count >= coEdgeThreshold) {
          addedEdges.add(edgeKey);
          links.push({
            source: `tag-${tagId}`,
            target: `tag-${coTagId}`,
            linkType: 'tag-tag',
            weight: count,
          } as GLink);
        }
      });
    });

    return { nodes, links };
  }, [dreams, tags, hiddenGroups, startDate, endDate]);

  // ── Initialise the 3D graph (once) ────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const w = Math.max(container.offsetWidth, 400);
    const h = Math.max(container.offsetHeight, 400);

    const graph = new ForceGraph3D(container, { rendererConfig: { antialias: true } })
      .width(w)
      .height(h)
      .backgroundColor('#08080f')
      .showNavInfo(false)
      // Node appearance
      .nodeId('id')
      .nodeLabel('name')
      .nodeVal((node: NodeObject) => { const n = node as GNode; return n.size * n.size; })
      .nodeColor((node: NodeObject) => (node as GNode).color)
      .nodeOpacity(0.92)
      .nodeResolution(12)
      // Custom node rendering — glow sprite so bloom looks great
      .nodeThreeObject((node: NodeObject) => {
        const n = node as GNode;
        const spriteMat = new THREE.SpriteMaterial({
          map: getGlowTexture(),
          color: new THREE.Color(n.color),
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        const sprite = new THREE.Sprite(spriteMat);
        const scale = n.size * 3.5;
        sprite.scale.set(scale, scale, 1);
        return sprite;
      })
      .nodeThreeObjectExtend(true)   // also render default sphere behind the sprite
      // Link appearance
      .linkSource('source')
      .linkTarget('target')
      .linkColor((link: LinkObject) => {
        const l = link as GLink;
        return l.linkType === 'tag-tag' ? '#aaaacc' : '#555577';
      })
      .linkOpacity(0.5)
      .linkWidth((link: LinkObject) => {
        const l = link as GLink;
        return l.linkType === 'tag-tag' ? Math.min(l.weight * 0.7, 3.5) : 0.4;
      })
      .linkDirectionalParticles(0)
      // Interactions
      .onNodeClick((node: NodeObject, _event: MouseEvent) => {
        const n = node as GNode;
        if (n.nodeType === 'dream') {
          // Double-click detection
          if (clickTimerRef.current) {
            clearTimeout(clickTimerRef.current);
            clickTimerRef.current = null;
            if (n.dreamId) openEditorRef.current(n.dreamId);
            return;
          }
          clickTimerRef.current = setTimeout(() => { clickTimerRef.current = null; }, 280);
        }
        // Fly camera towards clicked node
        const nx = (n as unknown as { x?: number }).x ?? 0;
        const ny = (n as unknown as { y?: number }).y ?? 0;
        const nz = (n as unknown as { z?: number }).z ?? 0;
        const dist = 80;
        const mag  = Math.hypot(nx, ny, nz) || 1;
        const ratio = (mag + dist) / mag;
        graph.cameraPosition(
          { x: nx * ratio, y: ny * ratio, z: nz * ratio },
          { x: nx, y: ny, z: nz },
          800,
        );
      })
      .onBackgroundClick(() => {
        graph.zoomToFit(600, 60);
      })
      // Auto-fit once the simulation settles — but only when we have real nodes.
      // Without this guard the empty-data stop (0 nodes on init) sets fittedRef=true
      // and the camera never repositions when the real data arrives.
      .onEngineStop(() => {
        const nodeCount = (graph.graphData() as { nodes: NodeObject[] }).nodes?.length ?? 0;
        if (nodeCount > 0 && !fittedRef.current) {
          fittedRef.current = true;
          graph.zoomToFit(600, 60);
        }
      })
      // Initial data
      .graphData(graphData as { nodes: NodeObject[]; links: LinkObject[] });

    // Add bloom pass for the constellation glow effect
    try {
      const bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 1.2, 0.5, 0.1);
      graph.postProcessingComposer().addPass(bloomPass);
    } catch (e) {
      console.warn('Bloom pass unavailable:', e);
    }

    graphRef.current = graph;

    // Resize observer
    const observer = new ResizeObserver(() => {
      if (graphRef.current && container) {
        graphRef.current
          .width(container.offsetWidth)
          .height(container.offsetHeight);
      }
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current = null; }
      try { graph._destructor(); } catch { /* ignore */ }
      container.innerHTML = '';
      graphRef.current = null;
    };
  // Only recreate the graph if the container changes (openEditor is in a ref)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Reactively update graph data ──────────────────────────────────────────
  useEffect(() => {
    if (!graphRef.current) return;
    // Reset so onEngineStop will trigger a fresh zoomToFit once the simulation settles
    fittedRef.current = false;
    graphRef.current.graphData(graphData as { nodes: NodeObject[]; links: LinkObject[] });
  }, [graphData]);

  // ── Map physics slider values to 3D force params ──────────────────────────
  useEffect(() => {
    if (!graphRef.current) return;
    // repelStrength: [5000, 40000] → charge strength [-15, -120]
    const charge = -Math.max(15, repelStrength / 333);
    // linkStrength: [0.00005, 0.005] → link distance [150, 30]
    const linkDist = Math.max(30, 150 - linkStrength * 20000);
    graphRef.current.d3Force('charge')?.strength(charge);
    graphRef.current.d3Force('link')?.distance(linkDist);
    graphRef.current.d3ReheatSimulation();
  }, [repelStrength, linkStrength]);

  // ── Camera controls ────────────────────────────────────────────────────────
  const handleFit    = () => graphRef.current?.zoomToFit(600, 60);
  const handleReset  = () => {
    graphRef.current?.zoomToFit(600, 60);
    graphRef.current?.cameraPosition({ x: 0, y: 0, z: 400 }, { x: 0, y: 0, z: 0 }, 800);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-3">

      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">

        {/* Node-group toggles */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {ALL_GROUPS.map((group) => {
            const hidden = hiddenGroups.has(group);
            return (
              <button
                key={group}
                onClick={() => toggleGroup(group)}
                title={hidden ? `Show ${GROUP_LABELS[group]}` : `Hide ${GROUP_LABELS[group]}`}
                className={[
                  'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium',
                  'border transition-all duration-150 select-none',
                  hidden
                    ? 'border-border bg-transparent text-muted-foreground opacity-50'
                    : 'border-transparent text-white',
                ].join(' ')}
                style={hidden ? {} : { backgroundColor: GROUP_COLORS[group] }}
              >
                {hidden
                  ? <EyeOff className="h-3 w-3 shrink-0" />
                  : <Eye    className="h-3 w-3 shrink-0" />
                }
                {GROUP_LABELS[group]}
              </button>
            );
          })}
        </div>

        {/* Date range */}
        <div className="flex items-center gap-2">
          <Label htmlFor="graph-start" className="text-xs text-muted-foreground whitespace-nowrap">
            From
          </Label>
          <Input
            id="graph-start"
            type="date"
            value={startDate}
            max={endDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-8 w-36 text-xs"
          />
          <Label htmlFor="graph-end" className="text-xs text-muted-foreground whitespace-nowrap">
            To
          </Label>
          <Input
            id="graph-end"
            type="date"
            value={endDate}
            min={startDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-8 w-36 text-xs"
          />
        </div>

        {/* Zoom/reset controls */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handleFit} title="Fit view">
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleReset} title="Reset camera">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ── 3D canvas + stats panel ────────────────────────────────────────── */}
      <div className="flex-1 flex gap-3 min-h-0">
        {/* Relative wrapper so the controls button can be layered over the canvas */}
        <div className="flex-1 relative min-h-0">
          <div
            ref={containerRef}
            className="absolute inset-0 rounded-lg border overflow-hidden"
            style={{ background: '#08080f' }}
          />
          {/* Controls overlay — bottom-left of the canvas */}
          <div className="absolute bottom-3 left-3 z-10">
            <button
              onClick={() => setShowControls((v) => !v)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs
                         bg-black/60 backdrop-blur-sm border border-white/10
                         text-white/60 hover:text-white transition-colors select-none"
            >
              <HelpCircle className="h-3 w-3 shrink-0" />
              Controls
            </button>
            {showControls && (
              <div className="absolute bottom-full mb-2 left-0 w-52 p-3 rounded-lg
                              bg-black/80 backdrop-blur-md border border-white/10
                              text-xs space-y-1.5">
                <p className="font-semibold text-white/90 mb-2">Interactions</p>
                <p className="text-white/60">Left-drag &nbsp;—&nbsp; <span className="text-white/90">Rotate</span></p>
                <p className="text-white/60">Right-drag &nbsp;—&nbsp; <span className="text-white/90">Pan</span></p>
                <p className="text-white/60">Scroll &nbsp;—&nbsp; <span className="text-white/90">Zoom</span></p>
                <p className="text-white/60">Click node &nbsp;—&nbsp; <span className="text-white/90">Fly to it</span></p>
                <p className="text-white/60">Dbl-click dream &nbsp;—&nbsp; <span className="text-white/90">Open editor</span></p>
                <p className="text-white/60">Click background &nbsp;—&nbsp; <span className="text-white/90">Fit all</span></p>
              </div>
            )}
          </div>
        </div>
        <GraphStats
          startDate={startDate}
          endDate={endDate}
          repelStrength={repelStrength}
          linkStrength={linkStrength}
          onRepelChange={setRepelStrength}
          onLinkChange={setLinkStrength}
        />
      </div>
    </div>
  );
}
