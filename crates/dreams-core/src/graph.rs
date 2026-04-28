//! Graph construction + (optional) Python analysis runner.
//!
//! Construction is **pure Rust** and works on every platform. The Python
//! runner is gated behind the `python-analysis` Cargo feature so mobile
//! builds that don't ship a Python interpreter can still link the crate —
//! they just call `build_graph_input` and feed the JSON into their own
//! analyser (or a future pure-Rust implementation).

use std::collections::{HashMap, HashSet};

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

use crate::db::Backend;
use crate::error::{CoreError, CoreResult};

// --- Result types (wire-compatible with the existing frontend) ---

#[derive(Debug, Serialize, Deserialize)]
pub struct GraphNodeStat {
    pub id: String,
    pub name: String,
    pub value: serde_json::Value,
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
    pub top_order: Vec<GraphNodeStat>,
    pub top_strength: Vec<GraphNodeStat>,
    pub top_centrality: Vec<GraphNodeStat>,
    pub top_edges: Vec<GraphEdgeStat>,
    pub significant_pairs: Vec<GraphEdgeAffinityStat>,
    pub top_clustering: Vec<GraphNodeStat>,
    pub top_betweenness: Vec<GraphNodeStat>,
    pub top_lift: Vec<GraphEdgeLiftStat>,
    pub top_triangles: Vec<GraphTriangle>,
}

// --- Public entry points ---

/// Build the JSON input for the graph analyser without running it. Useful
/// when the host wants to run analysis in its own environment (e.g. a
/// pure-Rust analyser on mobile, or a remote server).
pub fn build_graph_input_json(
    backend: &Backend,
    start_date: &str,
    end_date: &str,
) -> CoreResult<serde_json::Value> {
    backend.with_conn(|conn| build_graph_input(conn, start_date, end_date))
}

/// Build the graph input and run the Python analyser. Only available when
/// compiled with the `python-analysis` feature (default on desktop).
#[cfg(feature = "python-analysis")]
pub fn get_graph_stats(
    backend: &Backend,
    start_date: &str,
    end_date: &str,
) -> CoreResult<GraphStatsResult> {
    let input_json = build_graph_input_json(backend, start_date, end_date)?;
    let input_str = serde_json::to_string(&input_json)?;
    let output = python_runner::run_python_analysis(&input_str)?;
    let parsed: GraphStatsResult = serde_json::from_str(&output).map_err(|e| {
        CoreError::msg(format!("Failed to parse Python output: {e}\nRaw: {output}"))
    })?;
    Ok(parsed)
}

// --- Graph construction (vertex contraction) ---

/// Query dreams and tags within the date window, then perform vertex
/// contraction: merge every dream node so only tags remain, with edge
/// weight = number of dreams both tags shared, plus a +1 bonus per
/// paragraph-level co-highlight.
fn build_graph_input(
    conn: &Connection,
    start_date: &str,
    end_date: &str,
) -> CoreResult<serde_json::Value> {
    // 1. Fetch dream IDs in the window.
    let dream_ids: Vec<String> = {
        let mut stmt = conn.prepare(
            r#"
            SELECT id FROM dreams
            WHERE dream_date >= ?1 AND dream_date <= ?2
            ORDER BY dream_date ASC
            "#,
        )?;
        let ids: Vec<String> = stmt
            .query_map(params![start_date, end_date], |row| row.get(0))?
            .filter_map(|r| r.ok())
            .collect();
        ids
    };

    let dream_count = dream_ids.len() as u64;

    // 2. For each dream, fetch associated tag IDs and names.
    let mut tag_map: HashMap<String, String> = HashMap::new(); // id → name
    let mut dream_tag_sets: Vec<Vec<String>> = Vec::new();

    for dream_id in &dream_ids {
        let mut stmt = conn.prepare(
            r#"
            SELECT t.id, t.name
            FROM tags t
            JOIN dream_tags dt ON t.id = dt.tag_id
            WHERE dt.dream_id = ?1
            "#,
        )?;
        let pairs: Vec<(String, String)> = stmt
            .query_map(params![dream_id], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })?
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

    // 3a. Batch-fetch paragraph-level word-tag associations for all dreams in
    //     the window in a single query, partitioned into
    //       dream_id → paragraph_index → Vec<tag_id>.
    //     Two tags sharing a paragraph get a +1 bonus on top of the base +1
    //     they already have for sharing a dream.
    let mut para_tag_map: HashMap<String, HashMap<i64, Vec<String>>> = HashMap::new();
    if !dream_ids.is_empty() {
        let placeholders = dream_ids
            .iter()
            .enumerate()
            .map(|(i, _)| format!("?{}", i + 1))
            .collect::<Vec<_>>()
            .join(", ");
        let sql = format!(
            "SELECT dream_id, tag_id, paragraph_index FROM word_tag_associations WHERE dream_id IN ({placeholders})"
        );
        let mut stmt = conn.prepare(&sql)?;
        let rows: Vec<(String, String, i64)> = stmt
            .query_map(rusqlite::params_from_iter(dream_ids.iter()), |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, i64>(2)?,
                ))
            })?
            .filter_map(|r| r.ok())
            .collect();

        for (dream_id, tag_id, para_idx) in rows {
            para_tag_map
                .entry(dream_id)
                .or_default()
                .entry(para_idx)
                .or_default()
                .push(tag_id);
        }
    }

    // 3b. Vertex contraction: for every pair of tags that co-appear in a dream,
    //     increment their shared edge weight.
    let mut co_occurrence: HashMap<(String, String), u64> = HashMap::new();
    let mut tag_dream_counts: HashMap<String, u64> = HashMap::new();

    for (dream_id, tag_ids) in dream_ids.iter().zip(dream_tag_sets.iter()) {
        for tag_id in tag_ids {
            *tag_dream_counts.entry(tag_id.clone()).or_insert(0) += 1;
        }

        // Base co-occurrence weight (1 per shared dream).
        for i in 0..tag_ids.len() {
            for j in (i + 1)..tag_ids.len() {
                let a = std::cmp::min(tag_ids[i].as_str(), tag_ids[j].as_str());
                let b = std::cmp::max(tag_ids[i].as_str(), tag_ids[j].as_str());
                *co_occurrence
                    .entry((a.to_string(), b.to_string()))
                    .or_insert(0) += 1;
            }
        }

        // Paragraph bonus: +1 for each paragraph where both tags are highlighted.
        if let Some(para_map) = para_tag_map.get(dream_id) {
            let dream_tag_set: HashSet<&str> = tag_ids.iter().map(|s| s.as_str()).collect();
            for tag_ids_in_para in para_map.values() {
                // Filter to tags actually on the dream (ignore dangling WTA rows).
                let para_tags: Vec<&str> = tag_ids_in_para
                    .iter()
                    .map(|s| s.as_str())
                    .filter(|id| dream_tag_set.contains(id))
                    .collect();
                let n = para_tags.len();
                for i in 0..n {
                    for j in (i + 1)..n {
                        let a = std::cmp::min(para_tags[i], para_tags[j]);
                        let b = std::cmp::max(para_tags[i], para_tags[j]);
                        *co_occurrence
                            .entry((a.to_string(), b.to_string()))
                            .or_insert(0) += 1;
                    }
                }
            }
        }
    }

    // 4. Serialise for the analyser.
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

// --- Python runner (desktop only) ---

#[cfg(feature = "python-analysis")]
mod python_runner {
    use std::io::Write as _;

    use crate::error::{CoreError, CoreResult};

    // The Python analysis script is compiled into the binary via include_str!.
    // At runtime it is written to the OS temp directory before execution.
    const GRAPH_ANALYSIS_SCRIPT: &str = include_str!("graph_analysis.py");

    /// Write the embedded Python script to a temp file and run it, passing
    /// `input` on stdin and returning stdout. Tries `python` first, then
    /// `python3` for cross-platform compatibility (Windows ships `python`,
    /// Linux/macOS commonly use `python3`).
    pub(super) fn run_python_analysis(input: &str) -> CoreResult<String> {
        let script_path = std::env::temp_dir().join("dreams_graph_analysis.py");
        std::fs::write(&script_path, GRAPH_ANALYSIS_SCRIPT)?;

        for interpreter in &["python", "python3"] {
            if let Ok(out) = invoke_interpreter(interpreter, &script_path, input) {
                return Ok(out);
            }
        }
        Err(CoreError::msg(
            "Python interpreter not found. Please install Python 3 and ensure it is on PATH.",
        ))
    }

    fn invoke_interpreter(
        cmd: &str,
        script: &std::path::Path,
        input: &str,
    ) -> CoreResult<String> {
        use std::process::{Command, Stdio};

        let mut child = Command::new(cmd)
            .arg(script)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()?;

        if let Some(mut stdin) = child.stdin.take() {
            stdin.write_all(input.as_bytes())?;
        }

        let output = child.wait_with_output()?;
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            return Err(CoreError::msg(format!("Python error: {stderr}")));
        }
        Ok(String::from_utf8_lossy(&output.stdout).into_owned())
    }
}
