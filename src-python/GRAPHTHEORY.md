# Graph Theory Formulas

Reference formulas used by `graph_analysis.py`.

Assume **W** is a weighted adjacency matrix where `W[i][j]` is the weight of the
edge between nodes *i* and *j*. A value of 0 means no connection.  The matrix is
symmetric (undirected graph).

---

## Weighted Adjacency Matrix

```python
def add_edge(mat, i, j, weight):
    mat[i][j] = weight
    mat[j][i] = weight  # undirected graph

def display_matrix(mat):
    for row in mat:
        print(" ".join(map(str, row)))

if __name__ == "__main__":
    V = 4
    mat = [[0] * V for _ in range(V)]
    add_edge(mat, 0, 1, 5)
    add_edge(mat, 0, 2, 2)
    add_edge(mat, 1, 2, 3)
    add_edge(mat, 2, 3, 7)
    print("Weighted Adjacency Matrix:")
    display_matrix(mat)
```

---

## Node Metrics

### Order (unweighted degree)

```python
def node_order(W, i):
    return sum(1 for w in W[i] if w > 0)
```

Counts the number of distinct neighbours of node *i*, ignoring edge weight.

---

### Strength

```python
def node_strength(W, i):
    return sum(W[i])
```

The weighted analogue of degree: sums all edge weights incident to node *i*.

---

### Weighted Centrality (simple normalised strength)

```python
def weighted_centrality(W, i):
    s_i = sum(W[i])
    total_weight = sum(sum(row) for row in W)
    return s_i / total_weight if total_weight > 0 else 0
```

Represents node *i*'s share of the total graph weight.  Ranges in \[0, 1\].

---

### Weighted Connection Between Two Nodes

```python
def weighted_connection(W, i, j):
    return W[i][j]
```

Returns the co-occurrence weight of the edge between nodes *i* and *j*.
Returns 0 if the two nodes have never co-occurred.

---

## Vertex Contraction (dream → tag graph)

The Dreams app starts with a **bipartite** graph:

```
Dreams ←──────── dream–tag membership edges ────────→ Tags
```

Each dream node is **contracted**: for every pair of tags (tᵢ, tⱼ) that share
a dream dₖ, an edge tᵢ ↔ tⱼ is added (or its weight incremented).  After all
dream nodes are removed, the remaining graph is a **weighted tag co-occurrence
network** suitable for the metrics above.
