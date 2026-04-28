//! Tauri command wrappers.
//!
//! Each submodule exposes `#[tauri::command]` functions that unwrap the
//! Tauri-managed `AppState`, delegate to the equivalent `dreams_core`
//! function, and stringify any `CoreError` before returning. Platform-only
//! OCR is the one exception — it lives here because it is Windows-specific
//! and used only by the desktop build.

pub mod claude;
pub mod dreams;
pub mod graph;
pub mod ocr;
pub mod search;
pub mod tags;
pub mod theme;

use crate::AppState;
use dreams_core::{Backend, CoreError};
use tauri::State;

/// Extract the `Arc<Backend>` from Tauri's managed state. Centralised so every
/// command goes through the same path and we can swap the state representation
/// in one place if it ever changes.
pub(crate) fn backend<'a>(state: &'a State<'a, AppState>) -> &'a Backend {
    state.0.as_ref()
}

/// Convert a `CoreError` into the `String` shape Tauri's IPC expects. A free
/// function lets the commands stay expression-oriented with `?` + `map_err`.
pub(crate) fn to_ipc_err(e: CoreError) -> String {
    e.to_string()
}
