mod commands;
mod db;
mod models;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let app_handle = app.handle();
            db::init_db(&app_handle)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::dreams::get_dreams,
            commands::dreams::get_dream,
            commands::dreams::create_dream,
            commands::dreams::update_dream,
            commands::dreams::delete_dream,
            commands::tags::get_tags,
            commands::tags::get_tag,
            commands::tags::create_tag,
            commands::tags::update_tag,
            commands::tags::delete_tag,
            commands::search::search_dreams,
            commands::obsidian::export_to_obsidian,
            commands::obsidian::get_obsidian_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
