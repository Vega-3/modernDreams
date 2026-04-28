//! Thin Tauri wrapper delegating to `dreams_core::graph`.
//!
//! The desktop build always enables the `python-analysis` feature of
//! `dreams-core`, so `get_graph_stats` is available. Mobile builds (driven
//! via `dreams-ffi`) use `build_graph_input_json` and run analysis in-host.

use dreams_core::graph as core;
use dreams_core::graph::GraphStatsResult;
use tauri::State;

use super::{backend, to_ipc_err};
use crate::AppState;

#[tauri::command]
pub fn get_graph_stats(
    start_date: String,
    end_date: String,
    state: State<'_, AppState>,
) -> Result<GraphStatsResult, String> {
    core::get_graph_stats(backend(&state), &start_date, &end_date).map_err(to_ipc_err)
}
