use rusqlite::Connection;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

pub mod migrations;

pub struct DbConnection(pub Mutex<Connection>);

pub fn get_db_path(app_handle: &AppHandle) -> PathBuf {
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .expect("Failed to get app data dir");
    fs::create_dir_all(&app_dir).expect("Failed to create app data dir");
    app_dir.join("dreams.db")
}

pub fn init_db(app_handle: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let db_path = get_db_path(app_handle);
    let conn = Connection::open(&db_path)?;

    migrations::run_migrations(&conn)?;

    app_handle.manage(DbConnection(Mutex::new(conn)));

    Ok(())
}

pub fn get_connection(app_handle: &AppHandle) -> tauri::State<'_, DbConnection> {
    app_handle.state::<DbConnection>()
}
