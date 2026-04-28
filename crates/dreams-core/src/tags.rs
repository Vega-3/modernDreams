//! Tag CRUD + word-tag association queries.
//!
//! Every function takes `&Backend` and never touches platform-specific types;
//! the Tauri command layer and the FFI shim are thin adapters that just call
//! these. Error handling is unified through [`CoreError`] — callers convert
//! once at the boundary.

use rusqlite::{params, Connection, OptionalExtension};
use uuid::Uuid;

use crate::db::Backend;
use crate::error::CoreResult;
use crate::models::{CreateTagInput, Tag, TagCategory, TagWordUsage, UpdateTagInput};

// --- Aliases JSON helpers ---

fn parse_aliases(s: &str) -> Vec<String> {
    serde_json::from_str(s).unwrap_or_default()
}

fn serialize_aliases(aliases: &[String]) -> String {
    serde_json::to_string(aliases).unwrap_or_else(|_| "[]".to_string())
}

// --- Row → Tag mapping ---

// Centralised so every query that SELECTs the tag columns in the same order
// uses the same mapping. Keeps aliases parsing + category decoding in one
// place and avoids drift between dreams.rs / search.rs / here.
pub(crate) fn map_tag_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Tag> {
    let category_str: String = row.get(2)?;
    let aliases_str: String = row.get(6).unwrap_or_else(|_| "[]".to_string());
    Ok(Tag {
        id: row.get(0)?,
        name: row.get(1)?,
        category: TagCategory::from_str(&category_str),
        color: row.get(3)?,
        description: row.get(4)?,
        usage_count: row.get(5)?,
        aliases: parse_aliases(&aliases_str),
        emotive_subcategory: row.get(7)?,
    })
}

/// Fetch the tags attached to a single dream. Used by `dreams::get_dreams` and
/// the search path to hydrate the `tags` field. Takes a raw `Connection` so
/// callers that already hold the mutex (like the batch loaders) don't
/// re-enter it.
pub(crate) fn load_dream_tags(conn: &Connection, dream_id: &str) -> CoreResult<Vec<Tag>> {
    let mut stmt = conn.prepare(
        r#"
        SELECT t.id, t.name, t.category, t.color, t.description, t.usage_count, t.aliases, t.emotive_subcategory
        FROM tags t
        JOIN dream_tags dt ON t.id = dt.tag_id
        WHERE dt.dream_id = ?1
        ORDER BY t.name
        "#,
    )?;
    let iter = stmt.query_map(params![dream_id], map_tag_row)?;
    let mut tags = Vec::new();
    for t in iter {
        tags.push(t?);
    }
    Ok(tags)
}

// --- Public API ---

pub fn get_tags(backend: &Backend) -> CoreResult<Vec<Tag>> {
    backend.with_conn(|conn| {
        let mut stmt = conn.prepare(
            r#"
            SELECT id, name, category, color, description, usage_count, aliases, emotive_subcategory
            FROM tags
            ORDER BY usage_count DESC, name ASC
            "#,
        )?;
        let iter = stmt.query_map([], map_tag_row)?;
        let mut tags = Vec::new();
        for t in iter {
            tags.push(t?);
        }
        Ok(tags)
    })
}

pub fn get_tag(backend: &Backend, id: &str) -> CoreResult<Option<Tag>> {
    backend.with_conn(|conn| {
        let mut stmt = conn.prepare(
            r#"
            SELECT id, name, category, color, description, usage_count, aliases, emotive_subcategory
            FROM tags
            WHERE id = ?1
            "#,
        )?;
        let tag = stmt
            .query_row(params![id], map_tag_row)
            .optional()?;
        Ok(tag)
    })
}

pub fn create_tag(backend: &Backend, input: CreateTagInput) -> CoreResult<Tag> {
    backend.with_conn(|conn| {
        let id = Uuid::new_v4().to_string();
        let aliases_json = serialize_aliases(&input.aliases);
        conn.execute(
            r#"
            INSERT INTO tags (id, name, category, color, description, usage_count, aliases, emotive_subcategory)
            VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6, ?7)
            "#,
            params![
                id,
                input.name,
                input.category.as_str(),
                input.color,
                input.description,
                aliases_json,
                input.emotive_subcategory,
            ],
        )?;
        Ok(Tag {
            id,
            name: input.name,
            category: input.category,
            color: input.color,
            description: input.description,
            usage_count: 0,
            aliases: input.aliases,
            emotive_subcategory: input.emotive_subcategory,
        })
    })
}

pub fn update_tag(backend: &Backend, input: UpdateTagInput) -> CoreResult<Tag> {
    backend.with_conn(|conn| {
        let aliases_json = serialize_aliases(&input.aliases);
        conn.execute(
            r#"
            UPDATE tags
            SET name = ?2, category = ?3, color = ?4, description = ?5, aliases = ?6, emotive_subcategory = ?7
            WHERE id = ?1
            "#,
            params![
                input.id,
                input.name,
                input.category.as_str(),
                input.color,
                input.description,
                aliases_json,
                input.emotive_subcategory,
            ],
        )?;
        // Re-read so we pick up the live usage_count rather than trusting the caller's input.
        let mut stmt = conn.prepare(
            r#"
            SELECT id, name, category, color, description, usage_count, aliases, emotive_subcategory
            FROM tags
            WHERE id = ?1
            "#,
        )?;
        let tag = stmt.query_row(params![input.id], map_tag_row)?;
        Ok(tag)
    })
}

pub fn delete_tag(backend: &Backend, id: &str) -> CoreResult<()> {
    backend.with_conn(|conn| {
        conn.execute("DELETE FROM tags WHERE id = ?1", params![id])?;
        Ok(())
    })
}

pub fn get_tag_word_associations(
    backend: &Backend,
    tag_id: &str,
) -> CoreResult<Vec<TagWordUsage>> {
    backend.with_conn(|conn| {
        let mut stmt = conn.prepare(
            r#"
            SELECT wta.word, d.id, d.title, d.dream_date, wta.source
            FROM word_tag_associations wta
            JOIN dreams d ON d.id = wta.dream_id
            WHERE wta.tag_id = ?1
            ORDER BY d.dream_date DESC, wta.word ASC
            "#,
        )?;
        let iter = stmt.query_map(params![tag_id], |row| {
            Ok(TagWordUsage {
                word: row.get(0)?,
                dream_id: row.get(1)?,
                dream_title: row.get(2)?,
                dream_date: row.get(3)?,
                source: row.get(4).ok(),
            })
        })?;
        let mut out = Vec::new();
        for r in iter {
            out.push(r?);
        }
        Ok(out)
    })
}

/// Delete a single word-tag association (removes a learned association entry).
pub fn delete_word_tag_association(
    backend: &Backend,
    dream_id: &str,
    tag_id: &str,
    word: &str,
) -> CoreResult<()> {
    backend.with_conn(|conn| {
        conn.execute(
            "DELETE FROM word_tag_associations WHERE dream_id = ?1 AND tag_id = ?2 AND word = ?3",
            params![dream_id, tag_id, word],
        )?;
        Ok(())
    })
}
