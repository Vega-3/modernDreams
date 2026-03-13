import { useEffect, useRef, useMemo, useState } from 'react';
import cytoscape, { Core, ElementDefinition } from 'cytoscape';
import fcose from 'cytoscape-fcose';
import { ZoomIn, ZoomOut, Maximize2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDreamStore } from '@/stores/dreamStore';
import { useTagStore } from '@/stores/tagStore';
import { useUIStore } from '@/stores/uiStore';
import { getCategoryColor } from '@/lib/utils';
import { GraphStats } from './GraphStats';

cytoscape.use(fcose);

type FilterMode = 'all' | 'location' | 'person' | 'symbolic' | 'emotive' | 'custom';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function oneYearAgo(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

export function GraphView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const { dreams, fetchDreams } = useDreamStore();
  const { tags, fetchTags } = useTagStore();
  const { openEditor } = useUIStore();
  const [filter, setFilter] = useState<FilterMode>('all');
  const [, setSelectedNode] = useState<string | null>(null);

  // Date range for the graph analysis panel
  const [startDate, setStartDate] = useState<string>(oneYearAgo());
  const [endDate, setEndDate] = useState<string>(today());

  useEffect(() => {
    fetchDreams();
    fetchTags();
  }, [fetchDreams, fetchTags]);

  const elements = useMemo(() => {
    const nodes: ElementDefinition[] = [];
    const edges: ElementDefinition[] = [];
    const tagCoOccurrence: Map<string, Map<string, number>> = new Map();

    const filteredTags = filter === 'all' ? tags : tags.filter((t) => t.category === filter);

    filteredTags.forEach((tag) => {
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

    dreams.forEach((dream) => {
      const dreamTags = dream.tags.filter(
        (t) => filter === 'all' || t.category === filter
      );
      if (dreamTags.length === 0) return;

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
          const tag1 = dreamTags[i].id;
          const tag2 = dreamTags[j].id;
          const map1 = tagCoOccurrence.get(tag1)!;
          map1.set(tag2, (map1.get(tag2) || 0) + 1);
          if (!tagCoOccurrence.has(tag2)) tagCoOccurrence.set(tag2, new Map());
          tagCoOccurrence.get(tag2)!.set(tag1, (tagCoOccurrence.get(tag2)!.get(tag1) || 0) + 1);
        }
      }
    });

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
  }, [dreams, tags, filter]);

  useEffect(() => {
    if (!containerRef.current || elements.length === 0) return;

    const cy = cytoscape({
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
            'text-valign': 'bottom',
            'text-halign': 'center',
            'font-size': '10px',
            color: '#a0a0b0',
            'text-margin-y': 5,
          },
        },
        {
          selector: 'node[type="dream"]',
          style: { shape: 'ellipse', 'border-width': 2, 'border-color': '#3f3f50' },
        },
        {
          selector: 'node[type="tag"]',
          style: { shape: 'round-rectangle', 'border-width': 2, 'border-color': 'data(color)' },
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
        animationDuration: 500,
        nodeDimensionsIncludeLabels: true,
        nodeRepulsion: () => 4500,
        idealEdgeLength: () => 100,
        edgeElasticity: () => 0.45,
      } as any,
    });

    cy.on('tap', 'node', (e) => {
      const node = e.target;
      cy.elements().addClass('faded');
      node.addClass('highlighted');
      node.neighborhood().addClass('highlighted');
      setSelectedNode(node.id());
      if (node.data('type') === 'dream' && e.originalEvent.detail === 2) {
        openEditor(node.id().replace('dream-', ''));
      }
    });

    cy.on('tap', (e) => {
      if (e.target === cy) {
        cy.elements().removeClass('faded highlighted');
        setSelectedNode(null);
      }
    });

    cyRef.current = cy;
    return () => cy.destroy();
  }, [elements, openEditor]);

  const handleZoomIn  = () => cyRef.current?.zoom(cyRef.current.zoom() * 1.2);
  const handleZoomOut = () => cyRef.current?.zoom(cyRef.current.zoom() / 1.2);
  const handleFit     = () => cyRef.current?.fit(undefined, 50);
  const handleReset   = () => {
    cyRef.current?.elements().removeClass('faded highlighted');
    cyRef.current?.fit(undefined, 50);
    setSelectedNode(null);
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-3">

      {/* ── Top bar: filter tabs | date range (centre) | zoom ───────────── */}
      <div className="flex items-center justify-between gap-4">

        <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterMode)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="location">Location</TabsTrigger>
            <TabsTrigger value="person">Person</TabsTrigger>
            <TabsTrigger value="symbolic">Symbolic</TabsTrigger>
            <TabsTrigger value="emotive">Emotive</TabsTrigger>
            <TabsTrigger value="custom">Custom</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Analysis date range — centred between the two control groups */}
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

      {/* ── Legend ──────────────────────────────────────────────────────── */}
      <Card className="p-3 shrink-0">
        <div className="flex flex-wrap gap-4 text-sm">
          {[
            { color: '#6b7280', label: 'Dreams' },
            { color: '#22c55e', label: 'Location' },
            { color: '#3b82f6', label: 'Person' },
            { color: '#a855f7', label: 'Symbolic' },
            { color: '#f43f5e', label: 'Emotive' },
            { color: '#f59e0b', label: 'Custom' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Graph canvas + collapsible stats panel (right) ──────────────── */}
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
