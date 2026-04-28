//! Thin Tauri wrappers delegating to `dreams_core::dreams`.

use dreams_core::dreams as core;
use dreams_core::models::{CreateDreamInput, Dream, UpdateDreamInput};
use tauri::State;

use super::{backend, to_ipc_err};
use crate::AppState;

#[tauri::command]
pub fn get_dreams(state: State<'_, AppState>) -> Result<Vec<Dream>, String> {
    core::get_dreams(backend(&state)).map_err(to_ipc_err)
}

#[tauri::command]
pub fn get_dream(id: String, state: State<'_, AppState>) -> Result<Option<Dream>, String> {
    core::get_dream(backend(&state), &id).map_err(to_ipc_err)
}

#[tauri::command]
pub fn create_dream(
    input: CreateDreamInput,
    state: State<'_, AppState>,
) -> Result<Dream, String> {
    core::create_dream(backend(&state), input).map_err(to_ipc_err)
}

#[tauri::command]
pub fn update_dream(
    input: UpdateDreamInput,
    state: State<'_, AppState>,
) -> Result<Dream, String> {
    core::update_dream(backend(&state), input).map_err(to_ipc_err)
}

#[tauri::command]
pub fn delete_dream(id: String, state: State<'_, AppState>) -> Result<(), String> {
    core::delete_dream(backend(&state), &id).map_err(to_ipc_err)
}

#[tauri::command]
pub fn add_tag_to_dream(
    dream_id: String,
    tag_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    core::add_tag_to_dream(backend(&state), &dream_id, &tag_id).map_err(to_ipc_err)
}
