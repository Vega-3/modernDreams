//! Thin Tauri wrappers delegating to `dreams_core::theme`.

use dreams_core::theme as core;
use tauri::State;

use super::{backend, to_ipc_err};
use crate::AppState;

#[tauri::command]
pub fn get_tag_notes(tag_id: String, state: State<'_, AppState>) -> Result<String, String> {
    core::get_tag_notes(backend(&state), &tag_id).map_err(to_ipc_err)
}

#[tauri::command]
pub fn save_tag_notes(
    tag_id: String,
    notes: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    core::save_tag_notes(backend(&state), &tag_id, &notes).map_err(to_ipc_err)
}
