//! Per-tag theme notes (Theme Analysis page).

use rusqlite::params;

use crate::db::Backend;
use crate::error::CoreResult;

pub fn get_tag_notes(backend: &Backend, tag_id: &str) -> CoreResult<String> {
    backend.with_conn(|conn| {
        let notes: String = conn
            .query_row(
                "SELECT notes FROM tag_notes WHERE tag_id = ?1",
                params![tag_id],
                |row| row.get(0),
            )
            .unwrap_or_default();
        Ok(notes)
    })
}

pub fn save_tag_notes(backend: &Backend, tag_id: &str, notes: &str) -> CoreResult<()> {
    backend.with_conn(|conn| {
        conn.execute(
            r#"
            INSERT INTO tag_notes (tag_id, notes, updated_at)
            VALUES (?1, ?2, CURRENT_TIMESTAMP)
            ON CONFLICT(tag_id) DO UPDATE
                SET notes = excluded.notes,
                    updated_at = CURRENT_TIMESTAMP
            "#,
            params![tag_id, notes],
        )?;
        Ok(())
    })
}
