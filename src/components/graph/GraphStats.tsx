import { useState } from 'react';
import { BarChart2, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { getGraphStats } from '@/lib/tauri';
import type {
  GraphEdgeAffinityStat,
  GraphEdgeLiftStat,
  GraphEdgeStat,
  GraphNodeStat,
  GraphStatsResult,
  GraphTriangle,
} from '@/lib/tauri';

interface GraphStatsProps {
  startDate: string;
  endDate: string;
}

export function GraphStats({ startDate, endDate }: GraphStatsProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<GraphStatsResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canRun = Boolean(startDate && endDate && startDate <= endDate);

  const handleCompute = async () => {
    if (!canRun) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await getGraphStats(startDate, endDate);
      setStats(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <div className="w-9 shrink-0 flex flex-col items-center pt-1">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => setIsOpen(true)}
          title="Show graph analysis"
        >
          <BarChart2 className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <Card className="w-72 shrink-0 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Graph Analysis</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setIsOpen(false)}
          title="Collapse panel"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Run button */}
      <div className="px-3 py-2 border-b">
        <Button
          className="w-full"
          size="sm"
          onClick={handleCompute}
          disabled={isLoading || !canRun}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-3 w-3 mr-2 animate-spin" />
              Analysing…
            </>
          ) : (
            'Run Analysis'
          )}
        </Button>
        {!canRun && !isLoading && (
          <p className="text-xs text-muted-foreground mt-1 text-center">
            Set a valid date range above
          </p>
        )}
        {error && (
          <p className="text-xs text-destructive mt-1 break-words">{error}</p>
        )}
      </div>

      {/* Results */}
      {stats ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <p className="text-xs text-muted-foreground px-3 pt-2">
            {stats.dream_count} dream{stats.dream_count !== 1 ? 's' : ''} ·{' '}
            {stats.tag_count} tag{stats.tag_count !== 1 ? 's' : ''}
          </p>

          <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden mt-1">
            <TabsList className="mx-3 mb-1 h-7 text-xs">
              <TabsTrigger value="overview" className="flex-1 text-xs h-6">Overview</TabsTrigger>
              <TabsTrigger value="deep" className="flex-1 text-xs h-6">Deep Analysis</TabsTrigger>
            </TabsList>

            {/* ── Overview tab ──────────────────────────────────────────── */}
            <TabsContent value="overview" className="flex-1 overflow-y-auto px-3 py-2 space-y-5 mt-0">
              <NodeSection
                title="Highest Order"
                tooltip="Number of distinct tag neighbours (unweighted degree)"
                rows={stats.top_order}
                format={(v) => String(v)}
              />
              <NodeSection
                title="Highest Strength"
                tooltip="Sum of all co-occurrence edge weights"
                rows={stats.top_strength}
                format={(v) => String(v)}
              />
              <NodeSection
                title="Weighted Centrality"
                tooltip="Share of total graph weight: s(i) / Σs"
                rows={stats.top_centrality}
                format={(v) => `${(Number(v) * 100).toFixed(1)}%`}
              />
              <EdgeSection title="Strongest Connections" rows={stats.top_edges} />
            </TabsContent>

            {/* ── Deep Analysis tab ─────────────────────────────────────── */}
            <TabsContent value="deep" className="flex-1 overflow-y-auto px-3 py-2 space-y-5 mt-0">
              <SignificantPairsSection rows={stats.significant_pairs} />
              <NodeSection
                title="Clustering Coefficient"
                tooltip="How often a tag's co-tags also connect to each other. High = tight thematic cluster."
                rows={stats.top_clustering}
                format={(v) => Number(v).toFixed(3)}
              />
              <NodeSection
                title="Betweenness Centrality"
                tooltip="Fraction of shortest paths passing through this tag. High = bridge between themes."
                rows={stats.top_betweenness}
                format={(v) => Number(v).toFixed(3)}
              />
              <LiftSection rows={stats.top_lift} />
              <TriangleSection rows={stats.top_triangles} />
            </TabsContent>
          </Tabs>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-3 py-3">
          <p className="text-xs text-muted-foreground text-center py-8 leading-relaxed">
            Select a date range and press <strong>Run Analysis</strong> to compute graph
            statistics for the tag co-occurrence network.
          </p>
        </div>
      )}
    </Card>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function NodeSection({
  title,
  tooltip,
  rows,
  format,
}: {
  title: string;
  tooltip: string;
  rows: GraphNodeStat[];
  format: (v: number) => string;
}) {
  if (rows.length === 0) return null;

  return (
    <section>
      <p
        className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5"
        title={tooltip}
      >
        {title}
      </p>
      <ol className="space-y-0.5">
        {rows.map((row, i) => (
          <li key={row.id} className="flex items-center justify-between text-xs py-0.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-muted-foreground w-4 shrink-0 text-right">{i + 1}.</span>
              <span className="truncate" title={row.name}>
                {row.name}
              </span>
            </div>
            <span className="shrink-0 font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded ml-2">
              {format(row.value)}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function EdgeSection({ title, rows }: { title: string; rows: GraphEdgeStat[] }) {
  if (rows.length === 0) return null;

  return (
    <section>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
        {title}
      </p>
      <ol className="space-y-1">
        {rows.map((edge, i) => (
          <li key={i} className="text-xs border-b border-border/40 pb-1 last:border-0">
            <div className="flex items-center justify-between gap-1">
              <span className="truncate min-w-0">
                <span className="font-medium" title={edge.source_name}>
                  {edge.source_name}
                </span>
                <span className="text-muted-foreground mx-1">↔</span>
                <span className="font-medium" title={edge.target_name}>
                  {edge.target_name}
                </span>
              </span>
              <span className="shrink-0 font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded">
                {edge.weight}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function SignificantPairsSection({ rows }: { rows: GraphEdgeAffinityStat[] }) {
  if (rows.length === 0) {
    return (
      <section>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5"
           title="Pairs co-occurring ≥ 3 times, ranked by Jaccard affinity (w / (N_i + N_j − w))">
          Significant Pairs
        </p>
        <p className="text-xs text-muted-foreground italic">
          No pairs co-occur ≥ 3 times in this window.
        </p>
      </section>
    );
  }

  return (
    <section>
      <p
        className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5"
        title="Pairs co-occurring ≥ 3 times, ranked by Jaccard affinity (w / (N_i + N_j − w)). Close to 1 = almost always appear together."
      >
        Significant Pairs
      </p>
      <ol className="space-y-1">
        {rows.map((edge, i) => (
          <li key={i} className="text-xs border-b border-border/40 pb-1 last:border-0">
            <div className="flex items-center justify-between gap-1">
              <span className="truncate min-w-0">
                <span className="font-medium" title={edge.source_name}>{edge.source_name}</span>
                <span className="text-muted-foreground mx-1">↔</span>
                <span className="font-medium" title={edge.target_name}>{edge.target_name}</span>
              </span>
              <div className="flex gap-1 shrink-0 ml-1">
                <span className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded">
                  ×{edge.weight}
                </span>
                <span className="font-mono text-[11px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                  {(edge.affinity * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function LiftSection({ rows }: { rows: GraphEdgeLiftStat[] }) {
  if (rows.length === 0) return null;

  return (
    <section>
      <p
        className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5"
        title="Lift = (w × D) / (N_i × N_j). Values > 1 mean the pair appears together more than chance predicts. High lift + moderate count = niche but real connection."
      >
        Co-occurrence Lift
      </p>
      <ol className="space-y-1">
        {rows.map((edge, i) => (
          <li key={i} className="text-xs border-b border-border/40 pb-1 last:border-0">
            <div className="flex items-center justify-between gap-1">
              <span className="truncate min-w-0">
                <span className="font-medium" title={edge.source_name}>{edge.source_name}</span>
                <span className="text-muted-foreground mx-1">↔</span>
                <span className="font-medium" title={edge.target_name}>{edge.target_name}</span>
              </span>
              <div className="flex gap-1 shrink-0 ml-1">
                <span className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded">
                  ×{edge.weight}
                </span>
                <span className="font-mono text-[11px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded">
                  {edge.lift.toFixed(1)}×
                </span>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function TriangleSection({ rows }: { rows: GraphTriangle[] }) {
  if (rows.length === 0) {
    return (
      <section>
        <p
          className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5"
          title="Sets of 3 tags that all mutually co-occur ≥ 2 times — tight thematic triplets"
        >
          Thematic Triangles
        </p>
        <p className="text-xs text-muted-foreground italic">
          No thematic triangles found in this window.
        </p>
      </section>
    );
  }

  return (
    <section>
      <p
        className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5"
        title="Sets of 3 tags that all mutually co-occur ≥ 2 times — tight thematic triplets unlikely to be coincidental"
      >
        Thematic Triangles
      </p>
      <ol className="space-y-1.5">
        {rows.map((tri, i) => (
          <li key={i} className="text-xs border-b border-border/40 pb-1.5 last:border-0">
            <div className="flex items-start justify-between gap-1">
              <span className="leading-tight min-w-0">
                <span className="font-medium" title={tri.a_name}>{tri.a_name}</span>
                <span className="text-muted-foreground mx-0.5">·</span>
                <span className="font-medium" title={tri.b_name}>{tri.b_name}</span>
                <span className="text-muted-foreground mx-0.5">·</span>
                <span className="font-medium" title={tri.c_name}>{tri.c_name}</span>
              </span>
              <span className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded shrink-0 ml-1">
                ≥{tri.min_weight}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
