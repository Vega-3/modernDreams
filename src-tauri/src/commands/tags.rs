//! Thin Tauri wrappers delegating to `dreams_core::tags`.

use dreams_core::models::{CreateTagInput, Tag, TagWordUsage, UpdateTagInput};
use dreams_core::tags as core;
use tauri::State;

use super::{backend, to_ipc_err};
use crate::AppState;

#[tauri::command]
pub fn get_tags(state: State<'_, AppState>) -> Result<Vec<Tag>, String> {
    core::get_tags(backend(&state)).map_err(to_ipc_err)
}

#[tauri::command]
pub fn get_tag(id: String, state: State<'_, AppState>) -> Result<Option<Tag>, String> {
    core::get_tag(backend(&state), &id).map_err(to_ipc_err)
}

#[tauri::command]
pub fn create_tag(
    input: CreateTagInput,
    state: State<'_, AppState>,
) -> Result<Tag, String> {
    core::create_tag(backend(&state), input).map_err(to_ipc_err)
}

#[tauri::command]
pub fn update_tag(
    input: UpdateTagInput,
    state: State<'_, AppState>,
) -> Result<Tag, String> {
    core::update_tag(backend(&state), input).map_err(to_ipc_err)
}

#[tauri::command]
pub fn delete_tag(id: String, state: State<'_, AppState>) -> Result<(), String> {
    core::delete_tag(backend(&state), &id).map_err(to_ipc_err)
}

#[tauri::command]
pub fn get_tag_word_associations(
    tag_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<TagWordUsage>, String> {
    core::get_tag_word_associations(backend(&state), &tag_id).map_err(to_ipc_err)
}

#[tauri::command]
pub fn delete_word_tag_association(
    dream_id: String,
    tag_id: String,
    word: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    core::delete_word_tag_association(backend(&state), &dream_id, &tag_id, &word)
        .map_err(to_ipc_err)
}
