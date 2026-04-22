//! Thin Tauri wrapper delegating to `dreams_core::search`.

use dreams_core::models::{SearchQuery, SearchResult};
use dreams_core::search as core;
use tauri::State;

use super::{backend, to_ipc_err};
use crate::AppState;

#[tauri::command]
pub fn search_dreams(
    query: SearchQuery,
    state: State<'_, AppState>,
) -> Result<SearchResult, String> {
    core::search_dreams(backend(&state), query).map_err(to_ipc_err)
}
