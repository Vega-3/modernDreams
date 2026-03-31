use crate::db::DbConnection;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::Write as _;
use tauri::State;

// The Python analysis script is compiled into the binary via include_str!.
// At runtime it is written to the OS temp directory before execution.
const GRAPH_ANALYSIS_SCRIPT: &str =
    include_str!("../../resources/graph_analysis.py");

// ── Result types ──────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct GraphNodeStat {
    pub id: String,
    pub name: String,
    pub value: serde_json::Value, // int for order/strength, float for centrality
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GraphEdgeStat {
    pub source_id: String,
    pub source_name: String,
    pub target_id: String,
    pub target_name: String,
    pub weight: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GraphEdgeAffinityStat {
    pub source_id: String,
    pub source_name: String,
    pub target_id: String,
    pub target_name: String,
    pub weight: u64,
    pub affinity: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GraphEdgeLiftStat {
    pub source_id: String,
    pub source_name: String,
    pub target_id: String,
    pub target_name: String,
    pub weight: u64,
    pub lift: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GraphTriangle {
    pub a_id: String,
    pub a_name: String,
    pub b_id: String,
    pub b_name: String,
    pub c_id: String,
    pub c_name: String,
    pub min_weight: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GraphStatsResult {
    pub dream_count: u64,
    pub tag_count: u64,
    // Overview
    pub top_order: Vec<GraphNodeStat>,
    pub top_strength: Vec<GraphNodeStat>,
    pub top_centrality: Vec<GraphNodeStat>,
    pub top_edges: Vec<GraphEdgeStat>,
    // Deep Analysis
    pub significant_pairs: Vec<GraphEdgeAffinityStat>,
    pub top_clustering: Vec<GraphNodeStat>,
    pub top_betweenness: Vec<GraphNodeStat>,
    pub top_lift: Vec<GraphEdgeLiftStat>,
    pub top_triangles: Vec<GraphTriangle>,
}

// ── Tauri command ─────────────────────────────────────────────────────────────

/// Query all dreams in [start_date, end_date], build a weighted tag
/// co-occurrence graph (vertex contraction of dream nodes), run the Python
/// analysis script, and return the top-5 statistics for four metrics.
#[tauri::command]
pub fn get_graph_stats(
    start_date: String,
    end_date: String,
    db: State<'_, DbConnection>,
) -> Result<GraphStatsResult, String> {
    // ── 1. Query DB (hold mutex only during DB access) ────────────────────
    let input_json = {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        build_graph_input(&conn, &start_date, &end_date)?
        // Mutex guard dropped here — Python runs outside the lock
    };

    // ── 2. Invoke Python analysis ─────────────────────────────────────────
    let input_str = serde_json::to_string(&input_json).map_err(|e| e.to_string())?;
    let output = run_python_analysis(&input_str)?;

    // ── 3. Parse and return result ────────────────────────────────────────
    serde_json::from_str::<GraphStatsResult>(&output)
        .map_err(|e| format!("Failed to parse Python output: {e}\nRaw: {output}"))
}

// ── Graph construction (vertex contraction) ───────────────────────────────────

/// Query dreams and tags within the date window, then perform vertex
/// contraction: merge every dream node so only tags remain, with edge
/// weight = number of dreams both tags shared.
fn build_graph_input(
    conn: &rusqlite::Connection,
    start_date: &str,
    end_date: &str,
) -> Result<serde_json::Value, String> {
    // 1. Fetch dream IDs in the window
    let dream_ids: Vec<String> = {
        let mut stmt = conn
            .prepare(
                r#"
                SELECT id FROM dreams
                WHERE dream_date >= ?1 AND dream_date <= ?2
                ORDER BY dream_date ASC
                "#,
            )
            .map_err(|e| e.to_string())?;

        let ids: Vec<String> = stmt
            .query_map(params![start_date, end_date], |row| row.get(0))
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        ids
    };

    let dream_count = dream_ids.len() as u64;

    // 2. For each dream, fetch its associated tag IDs and names
    let mut tag_map: HashMap<String, String> = HashMap::new(); // id → name
    let mut dream_tag_sets: Vec<Vec<String>> = Vec::new();

    for dream_id in &dream_ids {
        let mut stmt = conn
            .prepare(
                r#"
                SELECT t.id, t.name
                FROM tags t
                JOIN dream_tags dt ON t.id = dt.tag_id
                WHERE dt.dream_id = ?1
                "#,
            )
            .map_err(|e| e.to_string())?;

        let pairs: Vec<(String, String)> = stmt
            .query_map(params![dream_id], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        let tag_ids: Vec<String> = pairs
            .into_iter()
            .map(|(id, name)| {
                tag_map.insert(id.clone(), name);
                id
            })
            .collect();

        dream_tag_sets.push(tag_ids);
    }

    // 3. Vertex contraction: for every pair of tags that co-appear in a dream,
    //    increment their shared edge weight by 1.
    //
    //    Formally: contract each dream node dₖ by adding edges between all
    //    pairs of tags incident to dₖ, accumulating weights across dreams.
    let mut co_occurrence: HashMap<(String, String), u64> = HashMap::new();
    let mut tag_dream_counts: HashMap<String, u64> = HashMap::new();

    for tag_ids in &dream_tag_sets {
        // Individual tag frequencies (needed for Jaccard / lift in Python)
        for tag_id in tag_ids {
            *tag_dream_counts.entry(tag_id.clone()).or_insert(0) += 1;
        }

        for i in 0..tag_ids.len() {
            for j in (i + 1)..tag_ids.len() {
                // Canonical key: (smaller_id, larger_id) — keeps the matrix undirected
                let a = std::cmp::min(tag_ids[i].as_str(), tag_ids[j].as_str());
                let b = std::cmp::max(tag_ids[i].as_str(), tag_ids[j].as_str());
                *co_occurrence
                    .entry((a.to_string(), b.to_string()))
                    .or_insert(0) += 1;
            }
        }
    }

    // 4. Serialise for Python
    let tags_json: Vec<serde_json::Value> = tag_map
        .iter()
        .map(|(id, name)| serde_json::json!({ "id": id, "name": name }))
        .collect();

    let co_json: Vec<serde_json::Value> = co_occurrence
        .iter()
        .map(|((a, b), w)| serde_json::json!([a, b, w]))
        .collect();

    Ok(serde_json::json!({
        "dream_count":      dream_count,
        "tags":             tags_json,
        "co_occurrences":   co_json,
        "tag_dream_counts": tag_dream_counts,
    }))
}

// ── Python runner ─────────────────────────────────────────────────────────────

/// Write the embedded Python script to a temp file and run it, passing
/// `input` on stdin and returning stdout as a String.
/// Tries `python` first, then `python3` for cross-platform compatibility.
fn run_python_analysis(input: &str) -> Result<String, String> {
    // Write the embedded script to OS temp dir
    let script_path = std::env::temp_dir().join("dreams_graph_analysis.py");
    std::fs::write(&script_path, GRAPH_ANALYSIS_SCRIPT)
        .map_err(|e| format!("Failed to write Python script: {e}"))?;

    // Try `python` first (standard on Windows), then `python3` (Linux/macOS)
    for interpreter in &["python", "python3"] {
        match invoke_interpreter(interpreter, &script_path, input) {
            Ok(out) => return Ok(out),
            Err(_) => continue,
        }
    }

    Err(
        "Python interpreter not found. Please install Python 3 and ensure it is on PATH."
            .to_string(),
    )
}

fn invoke_interpreter(
    cmd: &str,
    script: &std::path::Path,
    input: &str,
) -> Result<String, String> {
    use std::process::{Command, Stdio};

    let mut child = Command::new(cmd)
        .arg(script)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;

    // Write JSON input to stdin
    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(input.as_bytes())
            .map_err(|e| e.to_string())?;
    }

    let output = child.wait_with_output().map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Python error: {stderr}"));
    }

    String::from_utf8(output.stdout).map_err(|e| e.to_string())
}
