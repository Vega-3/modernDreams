//! Tauri desktop shim.
//!
//! All business logic lives in the `dreams_core` crate. This file is a thin
//! adapter that:
//!   1. locates the desktop-appropriate DB path via Tauri's path API,
//!   2. opens a `dreams_core::Backend` and stores it in the managed state,
//!   3. registers `#[tauri::command]` wrappers that delegate to the core.
//!
//! Keeping Tauri-specific code confined here means the same `dreams_core`
//! crate drives both the desktop (this shim) and mobile (the `dreams-ffi`
//! crate), which is the architecture this branch is preparing.

mod commands;

use std::fs;
use std::sync::Arc;

use dreams_core::Backend;
use tauri::Manager;

/// Managed state wrapper. Tauri requires `'static + Send + Sync`; `Arc<Backend>`
/// satisfies both (the internal Mutex provides Sync, Arc provides 'static + clone).
pub struct AppState(pub Arc<Backend>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let app_handle = app.handle();
            let app_dir = app_handle
                .path()
                .app_data_dir()
                .expect("Failed to get app data dir");
            fs::create_dir_all(&app_dir)?;
            let db_path = app_dir.join("dreams.db");
            let backend = Backend::open(&db_path)?;
            app_handle.manage(AppState(Arc::new(backend)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::dreams::get_dreams,
            commands::dreams::get_dream,
            commands::dreams::create_dream,
            commands::dreams::update_dream,
            commands::dreams::delete_dream,
            commands::dreams::add_tag_to_dream,
            commands::tags::get_tags,
            commands::tags::get_tag,
            commands::tags::create_tag,
            commands::tags::update_tag,
            commands::tags::delete_tag,
            commands::tags::get_tag_word_associations,
            commands::tags::delete_word_tag_association,
            commands::search::search_dreams,
            commands::ocr::recognize_handwriting,
            commands::claude::transcribe_handwriting_claude,
            commands::claude::verify_api_key,
            commands::claude::analyze_dream,
            commands::claude::ai_tag_dream,
            commands::graph::get_graph_stats,
            commands::theme::get_tag_notes,
            commands::theme::save_tag_notes,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
