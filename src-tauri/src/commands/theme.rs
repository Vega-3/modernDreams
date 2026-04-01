use crate::db::DbConnection;
use rusqlite::params;
use tauri::State;

/// Return the saved notes for `tag_id`, or an empty string if none exist yet.
#[tauri::command]
pub fn get_tag_notes(tag_id: String, db: State<'_, DbConnection>) -> Result<String, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let notes: String = conn
        .query_row(
            "SELECT notes FROM tag_notes WHERE tag_id = ?1",
            params![tag_id],
            |row| row.get(0),
        )
        .unwrap_or_default();
    Ok(notes)
}

/// Upsert the notes for `tag_id`.
#[tauri::command]
pub fn save_tag_notes(
    tag_id: String,
    notes: String,
    db: State<'_, DbConnection>,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        r#"
        INSERT INTO tag_notes (tag_id, notes, updated_at)
        VALUES (?1, ?2, CURRENT_TIMESTAMP)
        ON CONFLICT(tag_id) DO UPDATE
            SET notes = excluded.notes,
                updated_at = CURRENT_TIMESTAMP
        "#,
        params![tag_id, notes],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
