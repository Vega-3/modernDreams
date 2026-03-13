import { useState } from 'react';
import { BarChart2, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getGraphStats } from '@/lib/tauri';
import type { GraphEdgeStat, GraphNodeStat, GraphStatsResult } from '@/lib/tauri';

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

  // ── Collapsed: just a vertical toggle strip ──────────────────────────────
  if (!isOpen) {
    return (
      <div className="flex flex-col items-center pt-1">
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

  // ── Expanded panel ────────────────────────────────────────────────────────
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
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
        {stats ? (
          <>
            <p className="text-xs text-muted-foreground">
              {stats.dream_count} dream{stats.dream_count !== 1 ? 's' : ''} ·{' '}
              {stats.tag_count} tag{stats.tag_count !== 1 ? 's' : ''}
            </p>

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
          </>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-8 leading-relaxed">
            Select a date range and press <strong>Run Analysis</strong> to compute graph
            statistics for the tag co-occurrence network.
          </p>
        )}
      </div>
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
