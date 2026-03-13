#!/usr/bin/env python3
"""
graph_analysis.py — Graph-theory statistics engine for the Dreams app.

Reads a graph description from stdin as JSON, builds a weighted undirected
adjacency matrix (via vertex contraction of dream nodes so only tags remain),
then computes four families of statistics and writes results to stdout as JSON.

Input (JSON on stdin)
---------------------
{
  "dream_count": int,
  "tags": [{"id": str, "name": str}, ...],
  "co_occurrences": [[tag_id_a, tag_id_b, weight], ...]
}

  • tags          — every tag that appears in at least one dream in the window
  • co_occurrences— after vertex contraction: each entry [a, b, w] means
                    tags a and b co-appeared in w dreams together

Output (JSON to stdout)
-----------------------
{
  "dream_count": int,
  "tag_count":   int,
  "top_order":       [{"id": str, "name": str, "value": int},   ...],  # top 5
  "top_strength":    [{"id": str, "name": str, "value": int},   ...],  # top 5
  "top_centrality":  [{"id": str, "name": str, "value": float}, ...],  # top 5
  "top_edges":       [{"source_id": str, "source_name": str,
                        "target_id": str, "target_name": str,
                        "weight": int}, ...]                            # top 5
}
"""

import sys
import json


# ── Adjacency matrix construction ─────────────────────────────────────────────

def build_adjacency_matrix(tags: list, co_occurrences: list):
    """
    Build a weighted undirected adjacency matrix W.

    W[i][j] = number of dreams in which tag i and tag j both appear (edge weight
    after the dream-node vertex contraction described below).

    Vertex contraction procedure
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    1. Start with the bipartite dream–tag graph:
       • Dream nodes  {d₁, d₂, …}
       • Tag nodes    {t₁, t₂, …}
       • Edges        dream dₖ ↔ tag tᵢ  (weight 1 for each membership)
    2. Contract every dream node: for each dream dₖ that is incident to tags
       tᵢ and tⱼ, add/increment an edge tᵢ ↔ tⱼ with the number of shared
       dreams as the new weight.  The result is a tag-only graph.

    The Rust backend already performs this contraction before calling this
    script, so `co_occurrences` already contains the contracted edge list.

    Returns
    -------
    tag_ids   : list[str]  — ordered tag IDs (index → id)
    tag_names : dict       — id → display name
    W         : list[list[int]]  — n×n adjacency matrix
    """
    tag_ids = [t["id"] for t in tags]
    tag_names = {t["id"]: t["name"] for t in tags}
    idx = {tid: i for i, tid in enumerate(tag_ids)}
    n = len(tag_ids)

    # Initialise zero matrix
    W = [[0] * n for _ in range(n)]

    for entry in co_occurrences:
        a, b, weight = entry[0], entry[1], int(entry[2])
        if a in idx and b in idx:
            i, j = idx[a], idx[b]
            W[i][j] = weight
            W[j][i] = weight  # undirected: symmetric

    return tag_ids, tag_names, W


# ── Node metrics (from graphtheory.md) ────────────────────────────────────────

def node_order(W: list, i: int) -> int:
    """
    Order (unweighted degree) of node i.

    order(i) = |{ j : W[i][j] > 0 }|

    Counts the number of distinct tag neighbours, ignoring edge weight.
    """
    return sum(1 for w in W[i] if w > 0)


def node_strength(W: list, i: int) -> int:
    """
    Strength of node i — the weighted analogue of degree.

    s(i) = Σⱼ W[i][j]

    Sums all co-occurrence counts for the tag, giving the total number of
    (dream, co-tag) co-appearance events.
    """
    return sum(W[i])


def weighted_centrality(W: list, i: int) -> float:
    """
    Normalised weighted centrality of node i.

    C_w(i) = s(i) / Σₖ s(k)
           = s(i) / Σᵢⱼ W[i][j]

    Represents the fraction of total graph weight contributed by node i.
    Ranges in [0, 1]; higher values indicate more central tags.
    """
    s_i = sum(W[i])
    total_weight = sum(sum(row) for row in W)
    return s_i / total_weight if total_weight > 0 else 0.0


def weighted_connection(W: list, i: int, j: int) -> int:
    """
    Weight of the direct edge between nodes i and j.

    w(i, j) = W[i][j]

    Equals the number of dreams in which both tag i and tag j appear.
    Returns 0 if the two tags have never co-occurred.
    """
    return W[i][j]


# ── Top-N helpers ─────────────────────────────────────────────────────────────

def top_n_nodes(values: list, tag_ids: list, tag_names: dict, n: int = 5) -> list:
    """Return the top-n nodes sorted by descending metric value (value > 0 only)."""
    indexed = sorted(enumerate(values), key=lambda x: x[1], reverse=True)
    result = []
    for i, v in indexed:
        if v <= 0:
            break
        result.append({"id": tag_ids[i], "name": tag_names[tag_ids[i]], "value": v})
        if len(result) >= n:
            break
    return result


# ── Main analysis ─────────────────────────────────────────────────────────────

def analyze(data: dict) -> dict:
    dream_count = data.get("dream_count", 0)
    tags        = data.get("tags", [])
    co_occ      = data.get("co_occurrences", [])

    if not tags:
        return {
            "dream_count":   dream_count,
            "tag_count":     0,
            "top_order":     [],
            "top_strength":  [],
            "top_centrality":[],
            "top_edges":     [],
        }

    tag_ids, tag_names, W = build_adjacency_matrix(tags, co_occ)
    n = len(tag_ids)

    # ── Per-node metrics ──────────────────────────────────────────────────────
    orders       = [node_order(W, i)       for i in range(n)]
    strengths    = [node_strength(W, i)    for i in range(n)]
    centralities = [weighted_centrality(W, i) for i in range(n)]

    top_order      = top_n_nodes(orders,       tag_ids, tag_names)
    top_strength   = top_n_nodes(strengths,    tag_ids, tag_names)

    # Centrality: round to 4 dp for display
    top_centrality = [
        {**node, "value": round(node["value"], 4)}
        for node in top_n_nodes(centralities, tag_ids, tag_names)
    ]

    # ── Edge ranking ─────────────────────────────────────────────────────────
    edges = []
    seen  = set()
    for i in range(n):
        for j in range(i + 1, n):
            w = weighted_connection(W, i, j)
            if w > 0:
                key = (min(i, j), max(i, j))
                if key not in seen:
                    seen.add(key)
                    edges.append({
                        "source_id":   tag_ids[i],
                        "source_name": tag_names[tag_ids[i]],
                        "target_id":   tag_ids[j],
                        "target_name": tag_names[tag_ids[j]],
                        "weight":      w,
                    })

    edges.sort(key=lambda e: e["weight"], reverse=True)
    top_edges = edges[:5]

    return {
        "dream_count":    dream_count,
        "tag_count":      n,
        "top_order":      top_order,
        "top_strength":   top_strength,
        "top_centrality": top_centrality,
        "top_edges":      top_edges,
    }


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    raw    = sys.stdin.read()
    data   = json.loads(raw)
    result = analyze(data)
    print(json.dumps(result))
