//! Full-text + filter search over the dreams table.

use rusqlite::params;

use crate::db::Backend;
use crate::error::CoreResult;
use crate::models::{Dream, SearchQuery, SearchResult};
use crate::tags::load_dream_tags;

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
        meaningfulness_rating: row.get(10)?,
        waking_life_context: row.get(11)?,
        analysis_notes: row.get(12)?,
        tags: Vec::new(),
    })
}

pub fn search_dreams(backend: &Backend, query: SearchQuery) -> CoreResult<SearchResult> {
    backend.with_conn(|conn| {
        // Trigger: no query text, no filters.
        // Why: FTS5 MATCH '' returns an error; bypass the FTS path entirely.
        // Outcome: the 50 most-recent dreams are returned without search.
        if query.query.is_empty()
            && query.is_lucid_filter.is_none()
            && query.category_filter.is_none()
            && query.date_from.is_none()
            && query.date_to.is_none()
        {
            let mut stmt = conn.prepare(
                r#"
                SELECT id, title, content_html, content_plain, dream_date,
                       created_at, updated_at, is_lucid, mood_rating, clarity_rating,
                       meaningfulness_rating, waking_life_context, analysis_notes
                FROM dreams
                ORDER BY dream_date DESC, created_at DESC
                LIMIT 50
                "#,
            )?;
            let iter = stmt.query_map([], map_dream_row)?;
            let mut dreams: Vec<Dream> = Vec::new();
            for d in iter {
                let mut dream = d?;
                dream.tags = load_dream_tags(conn, &dream.id)?;
                dreams.push(dream);
            }
            let total = dreams.len() as i32;
            return Ok(SearchResult { dreams, total });
        }

        // Escape double quotes for FTS5 phrase syntax; append `*` for prefix match.
        let search_term = format!("{}*", query.query.replace('"', "\"\""));

        let mut stmt = conn.prepare(
            r#"
            SELECT d.id, d.title, d.content_html, d.content_plain, d.dream_date,
                   d.created_at, d.updated_at, d.is_lucid, d.mood_rating, d.clarity_rating,
                   d.meaningfulness_rating, d.waking_life_context, d.analysis_notes
            FROM dreams d
            WHERE d.id IN (SELECT id FROM dreams_fts WHERE dreams_fts MATCH ?1)
            ORDER BY d.dream_date DESC, d.created_at DESC
            LIMIT 50
            "#,
        )?;
        let iter = stmt.query_map(params![search_term], map_dream_row)?;

        let mut dreams: Vec<Dream> = Vec::new();
        for d in iter {
            let mut dream = d?;
            dream.tags = load_dream_tags(conn, &dream.id)?;

            // Post-filter in Rust — these are cheap to evaluate and keep the
            // SQL simpler than a huge parameterised query with optional joins.
            if let Some(is_lucid) = query.is_lucid_filter {
                if dream.is_lucid != is_lucid {
                    continue;
                }
            }
            if let Some(ref category) = query.category_filter {
                if !dream.tags.iter().any(|t| &t.category == category) {
                    continue;
                }
            }
            if let Some(ref date_from) = query.date_from {
                if dream.dream_date < *date_from {
                    continue;
                }
            }
            if let Some(ref date_to) = query.date_to {
                if dream.dream_date > *date_to {
                    continue;
                }
            }
            dreams.push(dream);
        }

        let total = dreams.len() as i32;
        Ok(SearchResult { dreams, total })
    })
}
