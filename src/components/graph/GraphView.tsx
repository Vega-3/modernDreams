import { useEffect, useRef, useMemo, useState } from 'react';
import cytoscape, { Core, ElementDefinition } from 'cytoscape';
import fcose from 'cytoscape-fcose';
import { ZoomIn, ZoomOut, Maximize2, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDreamStore } from '@/stores/dreamStore';
import { useTagStore } from '@/stores/tagStore';
import { useUIStore } from '@/stores/uiStore';
import { getCategoryColor } from '@/lib/utils';
import { GraphStats } from './GraphStats';

cytoscape.use(fcose);

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

// ── Physics constants (inspired by Obsidian graph view) ─────────────────────

const REPEL_STRENGTH = 5000;   // Coulomb-like repulsion between every node pair
const LINK_DISTANCE  = 100;    // Spring rest length in pixels
const LINK_STRENGTH  = 0.06;   // Spring constant
const CENTER_GRAVITY = 0.008;  // Attraction towards canvas centre
const DAMPING        = 0.82;   // Velocity damping per frame (0 = stop, 1 = no friction)
const STOP_THRESHOLD = 0.08;   // Max velocity below which simulation stops

// ── Helpers ─────────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function oneYearAgo(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

// ── Component ────────────────────────────────────────────────────────────────

export function GraphView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef        = useRef<Core | null>(null);

  const { dreams, fetchDreams } = useDreamStore();
  const { tags, fetchTags }     = useTagStore();
  const { openEditor }          = useUIStore();

  const [hiddenGroups, setHiddenGroups] = useState<Set<GroupKey>>(new Set());
  const [, setSelectedNode]             = useState<string | null>(null);
  const [startDate, setStartDate]       = useState<string>(oneYearAgo());
  const [endDate, setEndDate]           = useState<string>(today());

  useEffect(() => {
    fetchDreams();
    fetchTags();
  }, [fetchDreams, fetchTags]);

  // ── Toggle a visibility group ──────────────────────────────────────────────
  const toggleGroup = (group: GroupKey) => {
    setHiddenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  // ── Build cytoscape elements from store data ───────────────────────────────
  const elements = useMemo(() => {
    const nodes: ElementDefinition[] = [];
    const edges: ElementDefinition[] = [];
    const tagCoOccurrence: Map<string, Map<string, number>> = new Map();

    const showDreams      = !hiddenGroups.has('dreams');
    const visibleCatSet   = new Set(
      ALL_GROUPS.filter((g) => g !== 'dreams' && !hiddenGroups.has(g))
    );

    // Tag nodes
    tags
      .filter((t) => visibleCatSet.has(t.category as GroupKey))
      .forEach((tag) => {
        nodes.push({
          data: {
            id: `tag-${tag.id}`,
            label: tag.name,
            type: 'tag',
            category: tag.category,
            color: getCategoryColor(tag.category),
            size: Math.max(20, Math.min(50, tag.usage_count * 5 + 20)),
          },
        });
      });

    // Dream nodes + dream-tag edges + co-occurrence
    if (showDreams) {
      dreams.forEach((dream) => {
        const dreamTags = dream.tags.filter((t) =>
          visibleCatSet.has(t.category as GroupKey)
        );

        nodes.push({
          data: {
            id: `dream-${dream.id}`,
            label: dream.title,
            type: 'dream',
            color: '#6b7280',
            size: 15,
          },
        });

        dreamTags.forEach((tag) => {
          edges.push({
            data: {
              id: `edge-${dream.id}-${tag.id}`,
              source: `dream-${dream.id}`,
              target: `tag-${tag.id}`,
              type: 'dream-tag',
            },
          });
          if (!tagCoOccurrence.has(tag.id)) tagCoOccurrence.set(tag.id, new Map());
        });

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
    }

    // Tag-tag co-occurrence edges (threshold ≥ 2)
    const addedEdges = new Set<string>();
    tagCoOccurrence.forEach((coTags, tagId) => {
      coTags.forEach((count, coTagId) => {
        const edgeKey = [tagId, coTagId].sort().join('-');
        if (!addedEdges.has(edgeKey) && count >= 2) {
          addedEdges.add(edgeKey);
          edges.push({
            data: {
              id: `coedge-${edgeKey}`,
              source: `tag-${tagId}`,
              target: `tag-${coTagId}`,
              type: 'tag-tag',
              weight: count,
            },
          });
        }
      });
    });

    return [...nodes, ...edges];
  }, [dreams, tags, hiddenGroups]);

  // ── Cytoscape + physics simulation ────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || elements.length === 0) return;

    // ── Physics state (local to this effect instance) ────────────────────
    let animFrameId: number | null = null;
    const velocities = new Map<string, { vx: number; vy: number }>();
    let simRunning = false;

    const stopSim = () => {
      simRunning = false;
      if (animFrameId !== null) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
      }
    };

    const startSim = (instance: Core) => {
      stopSim();
      simRunning = true;

      // Seed velocities with a small random jitter so nodes start moving
      instance.nodes().forEach((n) => {
        velocities.set(n.id(), {
          vx: (Math.random() - 0.5) * 3,
          vy: (Math.random() - 0.5) * 3,
        });
      });

      const tick = () => {
        if (!simRunning) return;

        const nodes = instance.nodes();
        if (nodes.length === 0) { simRunning = false; return; }

        const cw = containerRef.current?.offsetWidth  ?? 800;
        const ch = containerRef.current?.offsetHeight ?? 600;
        const cx = cw / 2;
        const cy = ch / 2;

        // Accumulate forces for each node
        const forces = new Map<string, { fx: number; fy: number }>();
        nodes.forEach((n) => forces.set(n.id(), { fx: 0, fy: 0 }));

        const nodeArr = nodes.toArray();

        // Repel force: every pair of nodes pushes apart (Coulomb-like)
        for (let i = 0; i < nodeArr.length; i++) {
          for (let j = i + 1; j < nodeArr.length; j++) {
            const n1 = nodeArr[i];
            const n2 = nodeArr[j];
            const p1 = n1.position();
            const p2 = n2.position();
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const d2 = Math.max(dx * dx + dy * dy, 1);
            const d  = Math.sqrt(d2);
            const f  = REPEL_STRENGTH / d2;
            const fx = (f * dx) / d;
            const fy = (f * dy) / d;
            forces.get(n1.id())!.fx -= fx;
            forces.get(n1.id())!.fy -= fy;
            forces.get(n2.id())!.fx += fx;
            forces.get(n2.id())!.fy += fy;
          }
        }

        // Link (spring) force: connected nodes attract/repel towards rest length
        instance.edges().forEach((edge) => {
          const src = edge.source();
          const tgt = edge.target();
          const sf  = forces.get(src.id());
          const tf  = forces.get(tgt.id());
          if (!sf || !tf) return;
          const p1 = src.position();
          const p2 = tgt.position();
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const d  = Math.sqrt(dx * dx + dy * dy) || 1;
          const f  = LINK_STRENGTH * (d - LINK_DISTANCE);
          const fx = (f * dx) / d;
          const fy = (f * dy) / d;
          sf.fx += fx;
          sf.fy += fy;
          tf.fx -= fx;
          tf.fy -= fy;
        });

        // Integrate velocities and update positions
        let maxVel = 0;
        instance.startBatch();
        nodes.forEach((node) => {
          const vel   = velocities.get(node.id()) ?? { vx: 0, vy: 0 };
          const force = forces.get(node.id())!;
          const pos   = node.position();

          // Center gravity pulls nodes gently towards canvas centre
          vel.vx += (cx - pos.x) * CENTER_GRAVITY + force.fx;
          vel.vy += (cy - pos.y) * CENTER_GRAVITY + force.fy;

          // Apply damping (friction)
          vel.vx *= DAMPING;
          vel.vy *= DAMPING;

          maxVel = Math.max(maxVel, Math.abs(vel.vx) + Math.abs(vel.vy));
          node.position({ x: pos.x + vel.vx, y: pos.y + vel.vy });
          velocities.set(node.id(), vel);
        });
        instance.endBatch();

        // Keep running until the system settles
        if (simRunning && maxVel > STOP_THRESHOLD) {
          animFrameId = requestAnimationFrame(tick);
        } else {
          simRunning = false;
          animFrameId = null;
        }
      };

      animFrameId = requestAnimationFrame(tick);
    };

    // ── Build cytoscape instance ──────────────────────────────────────────
    const instance = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            label: 'data(label)',
            'background-color': 'data(color)',
            width: 'data(size)',
            height: 'data(size)',
            shape: 'ellipse',           // All nodes are circles
            'text-valign': 'bottom',
            'text-halign': 'center',
            'font-size': '10px',
            color: '#a0a0b0',
            'text-margin-y': 5,
          },
        },
        {
          selector: 'node[type="dream"]',
          style: { 'border-width': 2, 'border-color': '#3f3f50' },
        },
        {
          selector: 'node[type="tag"]',
          style: { 'border-width': 2, 'border-color': 'data(color)' },
        },
        {
          selector: 'edge[type="dream-tag"]',
          style: { width: 1, 'line-color': '#3f3f50', 'curve-style': 'bezier', opacity: 0.5 },
        },
        {
          selector: 'edge[type="tag-tag"]',
          style: {
            width: 'mapData(weight, 2, 10, 2, 6)',
            'line-color': '#6366f1',
            'curve-style': 'bezier',
            opacity: 0.7,
          },
        },
        { selector: 'node:selected', style: { 'border-width': 3, 'border-color': '#6366f1' } },
        { selector: '.faded',        style: { opacity: 0.15 } },
        { selector: '.highlighted',  style: { opacity: 1 } },
      ],
      layout: {
        name: 'fcose',
        animate: true,
        animationDuration: 600,
        nodeDimensionsIncludeLabels: true,
        nodeRepulsion: () => 4500,
        idealEdgeLength: () => LINK_DISTANCE,
        edgeElasticity: () => 0.45,
      } as any,
    });

    // Start physics simulation after the initial layout settles
    instance.on('layoutstop', () => startSim(instance));

    // Re-excite the simulation whenever the user finishes dragging a node
    instance.on('dragfree', 'node', () => startSim(instance));

    instance.on('tap', 'node', (e) => {
      const node = e.target;
      instance.elements().addClass('faded');
      node.addClass('highlighted');
      node.neighborhood().addClass('highlighted');
      setSelectedNode(node.id());
      if (node.data('type') === 'dream' && e.originalEvent.detail === 2) {
        openEditor(node.id().replace('dream-', ''));
      }
    });

    instance.on('tap', (e) => {
      if (e.target === instance) {
        instance.elements().removeClass('faded highlighted');
        setSelectedNode(null);
      }
    });

    cyRef.current = instance;
    return () => {
      stopSim();
      instance.destroy();
    };
  }, [elements, openEditor]);

  // ── Zoom / reset controls ─────────────────────────────────────────────────
  const handleZoomIn  = () => cyRef.current?.zoom(cyRef.current.zoom() * 1.2);
  const handleZoomOut = () => cyRef.current?.zoom(cyRef.current.zoom() / 1.2);
  const handleFit     = () => cyRef.current?.fit(undefined, 50);
  const handleReset   = () => {
    cyRef.current?.elements().removeClass('faded highlighted');
    cyRef.current?.fit(undefined, 50);
    setSelectedNode(null);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-3">

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">

        {/* Node-group toggles — click to collapse/show each group */}
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

        {/* Analysis date range */}
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

        {/* Zoom controls */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handleZoomIn}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleZoomOut}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleFit}>
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleReset}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ── Graph canvas + collapsible stats panel ───────────────────────── */}
      <div className="flex-1 flex gap-3 min-h-0">
        <div
          ref={containerRef}
          className="flex-1 rounded-lg border bg-card cytoscape-container min-h-0"
        />
        <GraphStats startDate={startDate} endDate={endDate} />
      </div>
    </div>
  );
}
