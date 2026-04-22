#!/usr/bin/env python3
"""
graph_analysis.py — Graph-theory statistics engine for the Dreams app.

Reads a graph description from stdin as JSON, builds a weighted undirected
adjacency matrix (via vertex contraction of dream nodes so only tags remain),
then computes nine families of statistics and writes results to stdout as JSON.

Input (JSON on stdin)
---------------------
{
  "dream_count": int,
  "tags": [{"id": str, "name": str}, ...],
  "co_occurrences": [[tag_id_a, tag_id_b, weight], ...],
  "tag_dream_counts": {"tag_id": int, ...}
}

  • tags             — every tag that appears in at least one dream in the window
  • co_occurrences   — after vertex contraction: each entry [a, b, w] means
                       tags a and b co-appeared in w dreams together
  • tag_dream_counts — number of dreams in which each tag appears individually

Output (JSON to stdout)
-----------------------
{
  "dream_count":       int,
  "tag_count":         int,

  // ── Overview metrics (existing) ──────────────────────────────────────────
  "top_order":         [{"id", "name", "value": int},   ...],  # top 5
  "top_strength":      [{"id", "name", "value": int},   ...],  # top 5
  "top_centrality":    [{"id", "name", "value": float}, ...],  # top 5
  "top_edges":         [{"source_id", "source_name",
                          "target_id", "target_name",
                          "weight": int}, ...],                 # top 5

  // ── Deep Analysis metrics (new) ──────────────────────────────────────────
  "significant_pairs": [{"source_id", "source_name",
                          "target_id", "target_name",
                          "weight": int, "affinity": float}, ...],  # top 5

  "top_clustering":    [{"id", "name", "value": float}, ...],  # top 5

  "top_betweenness":   [{"id", "name", "value": float}, ...],  # top 5

  "top_lift":          [{"source_id", "source_name",
                          "target_id", "target_name",
                          "weight": int, "lift": float}, ...],  # top 5

  "top_triangles":     [{"a_id", "a_name",
                          "b_id", "b_name",
                          "c_id", "c_name",
                          "min_weight": int}, ...],             # top 5
}
"""

import sys
import json
from collections import deque


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


# ── Overview metrics ──────────────────────────────────────────────────────────

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


# ── Deep Analysis metrics ─────────────────────────────────────────────────────

def significant_pairs(W, tag_ids, tag_names, tag_freqs, min_weight=3, top_n=5):
    """
    Tag pairs with co-occurrence >= min_weight, ranked by Jaccard affinity.

    Jaccard(i, j) = w(i,j) / (N_i + N_j − w(i,j))

    where N_i = number of dreams containing tag i (its individual frequency).
    The Jaccard coefficient ranges in [0, 1]; a value close to 1 means the two
    tags almost exclusively appear together — a dedicated, non-coincidental
    pairing.  Filtering to w ≥ 3 eliminates pairs that could be random.
    """
    n = len(tag_ids)
    results = []
    seen = set()
    for i in range(n):
        for j in range(i + 1, n):
            w = W[i][j]
            if w < min_weight:
                continue
            key = (i, j)
            if key in seen:
                continue
            seen.add(key)
            n_i = tag_freqs[i]
            n_j = tag_freqs[j]
            denom = n_i + n_j - w
            affinity = w / denom if denom > 0 else 0.0
            results.append({
                "source_id":   tag_ids[i],
                "source_name": tag_names[tag_ids[i]],
                "target_id":   tag_ids[j],
                "target_name": tag_names[tag_ids[j]],
                "weight":      w,
                "affinity":    round(affinity, 4),
            })
    results.sort(key=lambda x: x["affinity"], reverse=True)
    return results[:top_n]


def clustering_coefficients(W, n):
    """
    Local clustering coefficient for each node.

    CC(i) = 2 * |{(j,k) : j,k ∈ N(i), W[j][k] > 0}|
            ─────────────────────────────────────────
                     k_i * (k_i − 1)

    where k_i = order(i) (unweighted degree) and N(i) is the set of neighbours.

    A high value means a tag's co-tags also co-occur among themselves — the tag
    sits at the centre of a tight thematic cluster.  Nodes with k < 2 get 0.
    """
    coeffs = []
    for i in range(n):
        neighbors = [j for j in range(n) if W[i][j] > 0]
        k = len(neighbors)
        if k < 2:
            coeffs.append(0.0)
            continue
        closed_triplets = sum(
            1
            for a in range(len(neighbors))
            for b in range(a + 1, len(neighbors))
            if W[neighbors[a]][neighbors[b]] > 0
        )
        coeffs.append(2 * closed_triplets / (k * (k - 1)))
    return coeffs


def betweenness_centrality(W, n):
    """
    Normalised betweenness centrality using Brandes' BFS algorithm (unweighted).

    BC(v) = Σ_{s≠v≠t} σ(s,t|v) / σ(s,t)

    where σ(s,t) is the number of shortest paths from s to t, and σ(s,t|v) is
    the number of those paths that pass through v.  Normalised by (n−1)(n−2)/2
    for undirected graphs.

    Tags with high betweenness are structural bridges that connect otherwise
    separated parts of the co-occurrence network — thematic cross-roads.
    """
    bc = [0.0] * n

    for s in range(n):
        stack = []
        pred = [[] for _ in range(n)]
        sigma = [0] * n
        dist  = [-1] * n
        sigma[s] = 1
        dist[s]  = 0
        queue = deque([s])

        while queue:
            v = queue.popleft()
            stack.append(v)
            for w in range(n):
                if W[v][w] <= 0:
                    continue
                if dist[w] < 0:
                    dist[w] = dist[v] + 1
                    queue.append(w)
                if dist[w] == dist[v] + 1:
                    sigma[w] += sigma[v]
                    pred[w].append(v)

        delta = [0.0] * n
        while stack:
            w = stack.pop()
            for v in pred[w]:
                if sigma[w] > 0:
                    delta[v] += (sigma[v] / sigma[w]) * (1.0 + delta[w])
            if w != s:
                bc[w] += delta[w]

    norm = (n - 1) * (n - 2)
    if norm > 0:
        bc = [2.0 * v / norm for v in bc]

    return bc


def lift_scores(W, tag_ids, tag_names, tag_freqs, dream_count, min_weight=2, top_n=5):
    """
    Co-occurrence lift for each edge with weight >= min_weight.

    Lift(i, j) = w(i,j) · D / (N_i · N_j)

    where D = total dreams in the window, N_i / N_j = individual tag frequencies.
    Under independence, the expected co-occurrence of tags i and j is
    N_i · N_j / D, so Lift > 1 means the pair appears together more often than
    chance alone would predict.  High lift with moderate weight identifies
    niche-but-real connections that are statistically significant.
    """
    n = len(tag_ids)
    D = dream_count
    if D == 0:
        return []
    results = []
    seen = set()
    for i in range(n):
        for j in range(i + 1, n):
            w = W[i][j]
            if w < min_weight:
                continue
            key = (i, j)
            if key in seen:
                continue
            seen.add(key)
            n_i = tag_freqs[i]
            n_j = tag_freqs[j]
            if n_i == 0 or n_j == 0:
                continue
            lift = (w * D) / (n_i * n_j)
            results.append({
                "source_id":   tag_ids[i],
                "source_name": tag_names[tag_ids[i]],
                "target_id":   tag_ids[j],
                "target_name": tag_names[tag_ids[j]],
                "weight":      w,
                "lift":        round(lift, 3),
            })
    results.sort(key=lambda x: x["lift"], reverse=True)
    return results[:top_n]


def find_triangles(W, tag_ids, tag_names, min_edge_weight=2, top_n=5):
    """
    All triangles (i, j, k) where every edge has weight >= min_edge_weight,
    ranked by the minimum edge weight (the weakest link in the triplet).

    A triangle means all three tags mutually co-occur across dreams — they form
    a thematic triplet that is unlikely to be coincidental.  The minimum edge
    weight is a conservative lower bound on the triplet's cohesion.
    """
    n = len(tag_ids)
    triangles = []
    for i in range(n):
        for j in range(i + 1, n):
            if W[i][j] < min_edge_weight:
                continue
            for k in range(j + 1, n):
                if W[i][k] < min_edge_weight or W[j][k] < min_edge_weight:
                    continue
                min_w = min(W[i][j], W[i][k], W[j][k])
                triangles.append({
                    "a_id":      tag_ids[i],
                    "a_name":    tag_names[tag_ids[i]],
                    "b_id":      tag_ids[j],
                    "b_name":    tag_names[tag_ids[j]],
                    "c_id":      tag_ids[k],
                    "c_name":    tag_names[tag_ids[k]],
                    "min_weight": min_w,
                })
    triangles.sort(key=lambda x: x["min_weight"], reverse=True)
    return triangles[:top_n]


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
    dream_count      = data.get("dream_count", 0)
    tags             = data.get("tags", [])
    co_occ           = data.get("co_occurrences", [])
    tag_dream_counts = data.get("tag_dream_counts", {})

    empty = {
        "dream_count":      dream_count,
        "tag_count":        0,
        "top_order":        [],
        "top_strength":     [],
        "top_centrality":   [],
        "top_edges":        [],
        "significant_pairs":[],
        "top_clustering":   [],
        "top_betweenness":  [],
        "top_lift":         [],
        "top_triangles":    [],
    }

    if not tags:
        return empty

    tag_ids, tag_names, W = build_adjacency_matrix(tags, co_occ)
    n = len(tag_ids)

    # Individual dream frequencies for each tag (for lift / Jaccard)
    tag_freqs = [tag_dream_counts.get(tid, 0) for tid in tag_ids]

    # ── Overview metrics ──────────────────────────────────────────────────────
    orders       = [node_order(W, i)       for i in range(n)]
    strengths    = [node_strength(W, i)    for i in range(n)]
    centralities = [weighted_centrality(W, i) for i in range(n)]

    top_order    = top_n_nodes(orders,    tag_ids, tag_names)
    top_strength = top_n_nodes(strengths, tag_ids, tag_names)

    top_centrality = [
        {**node, "value": round(node["value"], 4)}
        for node in top_n_nodes(centralities, tag_ids, tag_names)
    ]

    edges = []
    seen  = set()
    for i in range(n):
        for j in range(i + 1, n):
            w = weighted_connection(W, i, j)
            if w > 0:
                key = (i, j)
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

    # ── Deep Analysis metrics ─────────────────────────────────────────────────
    sig_pairs    = significant_pairs(W, tag_ids, tag_names, tag_freqs, min_weight=3)
    clust_coeffs = clustering_coefficients(W, n)
    between      = betweenness_centrality(W, n)
    lifts        = lift_scores(W, tag_ids, tag_names, tag_freqs, dream_count, min_weight=2)
    triangles    = find_triangles(W, tag_ids, tag_names, min_edge_weight=2)

    top_clustering  = [
        {**node, "value": round(node["value"], 4)}
        for node in top_n_nodes(clust_coeffs, tag_ids, tag_names)
    ]
    top_betweenness = [
        {**node, "value": round(node["value"], 4)}
        for node in top_n_nodes(between, tag_ids, tag_names)
    ]

    return {
        "dream_count":       dream_count,
        "tag_count":         n,
        "top_order":         top_order,
        "top_strength":      top_strength,
        "top_centrality":    top_centrality,
        "top_edges":         top_edges,
        "significant_pairs": sig_pairs,
        "top_clustering":    top_clustering,
        "top_betweenness":   top_betweenness,
        "top_lift":          lifts,
        "top_triangles":     triangles,
    }


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    raw    = sys.stdin.read()
    data   = json.loads(raw)
    result = analyze(data)
    print(json.dumps(result))
