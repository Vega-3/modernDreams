use crate::db::DbConnection;
use crate::models::{Client, CreateClientInput, ImportDreamInput};
use chrono::Utc;
use rusqlite::params;
use tauri::State;
use uuid::Uuid;

// ── Client CRUD ──────────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_clients(db: State<'_, DbConnection>) -> Result<Vec<Client>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT id, name, notes, created_at FROM clients ORDER BY name ASC")
        .map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map([], |row| {
            Ok(Client {
                id: row.get(0)?,
                name: row.get(1)?,
                notes: row.get(2)?,
                created_at: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut clients = Vec::new();
    for item in iter {
        clients.push(item.map_err(|e| e.to_string())?);
    }

    Ok(clients)
}

#[tauri::command]
pub fn create_client(
    input: CreateClientInput,
    db: State<'_, DbConnection>,
) -> Result<Client, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO clients (id, name, notes, created_at) VALUES (?1, ?2, ?3, ?4)",
        params![id, input.name, input.notes, now],
    )
    .map_err(|e| e.to_string())?;

    Ok(Client {
        id,
        name: input.name,
        notes: input.notes,
        created_at: now,
    })
}

#[tauri::command]
pub fn delete_client(id: String, db: State<'_, DbConnection>) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    conn.execute("DELETE FROM clients WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

// ── Batch dream import ────────────────────────────────────────────────────────

/// Import a batch of pre-parsed dreams for a client.
/// Returns the number of dreams successfully inserted.
#[tauri::command]
pub fn import_client_dreams(
    dreams: Vec<ImportDreamInput>,
    db: State<'_, DbConnection>,
) -> Result<u32, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    for dream in &dreams {
        let id = Uuid::new_v4().to_string();

        conn.execute(
            r#"INSERT INTO dreams
               (id, title, content_html, content_plain, dream_date,
                created_at, updated_at, is_lucid, mood_rating, clarity_rating,
                waking_life_context, client_id)
               VALUES (?1,?2,?3,?4,?5,?6,?6,0,NULL,NULL,NULL,?7)"#,
            params![
                id,
                dream.title,
                dream.content_html,
                dream.content_plain,
                dream.dream_date,
                now,
                dream.client_id,
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(dreams.len() as u32)
}
