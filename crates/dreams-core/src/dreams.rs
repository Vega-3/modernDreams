//! Dream CRUD + word-tag association writeback.

use chrono::Utc;
use rusqlite::{params, OptionalExtension};
use uuid::Uuid;

use crate::db::Backend;
use crate::error::CoreResult;
use crate::models::{CreateDreamInput, Dream, UpdateDreamInput};
use crate::tags::load_dream_tags;

// Centralised row→Dream mapping mirroring the column order used in every
// SELECT across this module. Adjust both together if the schema changes.
fn map_dream_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Dream> {
    Ok(Dream {
        id: row.get(0)?,
        title: row.get(1)?,
        content_html: row.get(2)?,
        content_plain: row.get(3)?,
        dream_date: row.get(4)?,
        created_at: row.get(5)?,
        updated_at: row.get(6)?,
        is_lucid: row.get(7)?,
        mood_rating: row.get(8)?,
        clarity_rating: row.get(9)?,
        meaningfulness_rating: row.get(12)?,
        waking_life_context: row.get(10)?,
        analysis_notes: row.get(11)?,
        tags: Vec::new(),
    })
}

const DREAM_COLS: &str = r#"
    id, title, content_html, content_plain, dream_date,
    created_at, updated_at, is_lucid, mood_rating, clarity_rating,
    waking_life_context, analysis_notes, meaningfulness_rating
"#;

pub fn get_dreams(backend: &Backend) -> CoreResult<Vec<Dream>> {
    backend.with_conn(|conn| {
        let sql = format!(
            "SELECT {DREAM_COLS} FROM dreams ORDER BY dream_date DESC, created_at DESC"
        );
        let mut stmt = conn.prepare(&sql)?;
        let iter = stmt.query_map([], map_dream_row)?;
        let mut dreams = Vec::new();
        for d in iter {
            let mut dream = d?;
            dream.tags = load_dream_tags(conn, &dream.id)?;
            dreams.push(dream);
        }
        Ok(dreams)
    })
}

pub fn get_dream(backend: &Backend, id: &str) -> CoreResult<Option<Dream>> {
    backend.with_conn(|conn| {
        let sql = format!("SELECT {DREAM_COLS} FROM dreams WHERE id = ?1");
        let mut stmt = conn.prepare(&sql)?;
        let dream = stmt
            .query_row(params![id], map_dream_row)
            .optional()?;
        match dream {
            Some(mut d) => {
                d.tags = load_dream_tags(conn, &d.id)?;
                Ok(Some(d))
            }
            None => Ok(None),
        }
    })
}

pub fn create_dream(backend: &Backend, input: CreateDreamInput) -> CoreResult<Dream> {
    backend.with_conn(|conn| {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();

        conn.execute(
            r#"
            INSERT INTO dreams (id, title, content_html, content_plain, dream_date,
                               created_at, updated_at, is_lucid, mood_rating, clarity_rating,
                               waking_life_context, analysis_notes, meaningfulness_rating)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
            "#,
            params![
                id,
                input.title,
                input.content_html,
                input.content_plain,
                input.dream_date,
                now,
                now,
                input.is_lucid,
                input.mood_rating,
                input.clarity_rating,
                input.waking_life_context,
                input.analysis_notes,
                input.meaningfulness_rating,
            ],
        )?;

        for tag_id in &input.tag_ids {
            conn.execute(
                "INSERT INTO dream_tags (dream_id, tag_id) VALUES (?1, ?2)",
                params![id, tag_id],
            )?;
        }

        for assoc in &input.word_tag_associations {
            let assoc_id = Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO word_tag_associations (id, dream_id, tag_id, word, paragraph_index, source) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![assoc_id, id, assoc.tag_id, assoc.word, assoc.paragraph_index, assoc.source],
            )?;
        }

        let tags = load_dream_tags(conn, &id)?;

        Ok(Dream {
            id,
            title: input.title,
            content_html: input.content_html,
            content_plain: input.content_plain,
            dream_date: input.dream_date,
            created_at: now.clone(),
            updated_at: now,
            is_lucid: input.is_lucid,
            mood_rating: input.mood_rating,
            clarity_rating: input.clarity_rating,
            meaningfulness_rating: input.meaningfulness_rating,
            waking_life_context: input.waking_life_context,
            analysis_notes: input.analysis_notes,
            tags,
        })
    })
}

pub fn update_dream(backend: &Backend, input: UpdateDreamInput) -> CoreResult<Dream> {
    backend.with_conn(|conn| {
        let now = Utc::now().to_rfc3339();

        conn.execute(
            r#"
            UPDATE dreams
            SET title = ?2, content_html = ?3, content_plain = ?4, dream_date = ?5,
                updated_at = ?6, is_lucid = ?7, mood_rating = ?8, clarity_rating = ?9,
                waking_life_context = ?10, analysis_notes = ?11, meaningfulness_rating = ?12
            WHERE id = ?1
            "#,
            params![
                input.id,
                input.title,
                input.content_html,
                input.content_plain,
                input.dream_date,
                now,
                input.is_lucid,
                input.mood_rating,
                input.clarity_rating,
                input.waking_life_context,
                input.analysis_notes,
                input.meaningfulness_rating,
            ],
        )?;

        // Replace tag membership wholesale — simpler than diffing and the set
        // is tiny (single-digit tags per dream in practice).
        conn.execute(
            "DELETE FROM dream_tags WHERE dream_id = ?1",
            params![input.id],
        )?;
        for tag_id in &input.tag_ids {
            conn.execute(
                "INSERT INTO dream_tags (dream_id, tag_id) VALUES (?1, ?2)",
                params![input.id, tag_id],
            )?;
        }

        conn.execute(
            "DELETE FROM word_tag_associations WHERE dream_id = ?1",
            params![input.id],
        )?;
        for assoc in &input.word_tag_associations {
            let assoc_id = Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO word_tag_associations (id, dream_id, tag_id, word, paragraph_index, source) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![assoc_id, input.id, assoc.tag_id, assoc.word, assoc.paragraph_index, assoc.source],
            )?;
        }

        let tags = load_dream_tags(conn, &input.id)?;

        let sql = format!("SELECT {DREAM_COLS} FROM dreams WHERE id = ?1");
        let mut stmt = conn.prepare(&sql)?;
        let mut dream = stmt.query_row(params![input.id], map_dream_row)?;
        dream.tags = tags;
        Ok(dream)
    })
}

pub fn delete_dream(backend: &Backend, id: &str) -> CoreResult<()> {
    backend.with_conn(|conn| {
        conn.execute("DELETE FROM dreams WHERE id = ?1", params![id])?;
        Ok(())
    })
}

/// Attach a tag to a dream without rewriting the whole dream. Duplicate
/// associations are silently ignored so the UI can retry without bookkeeping.
pub fn add_tag_to_dream(backend: &Backend, dream_id: &str, tag_id: &str) -> CoreResult<()> {
    backend.with_conn(|conn| {
        conn.execute(
            "INSERT OR IGNORE INTO dream_tags (dream_id, tag_id) VALUES (?1, ?2)",
            params![dream_id, tag_id],
        )?;
        Ok(())
    })
}
