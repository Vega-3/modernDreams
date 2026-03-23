use crate::db::DbConnection;
use crate::models::{CreateTagInput, Tag, TagCategory, TagWordUsage, UpdateTagInput};
use rusqlite::{params, OptionalExtension};
use tauri::State;
use uuid::Uuid;

// ── Aliases JSON helpers ────────────────────────────────────────────────────

fn parse_aliases(s: &str) -> Vec<String> {
    serde_json::from_str(s).unwrap_or_default()
}

fn serialize_aliases(aliases: &[String]) -> String {
    serde_json::to_string(aliases).unwrap_or_else(|_| "[]".to_string())
}

// ── Tag commands ────────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_tags(db: State<'_, DbConnection>) -> Result<Vec<Tag>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            r#"
            SELECT id, name, category, color, description, usage_count, aliases, emotive_subcategory
            FROM tags
            ORDER BY usage_count DESC, name ASC
            "#,
        )
        .map_err(|e| e.to_string())?;

    let tags_iter = stmt
        .query_map([], |row| {
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
        })
        .map_err(|e| e.to_string())?;

    let mut tags = Vec::new();
    for tag_result in tags_iter {
        tags.push(tag_result.map_err(|e| e.to_string())?);
    }

    Ok(tags)
}

#[tauri::command]
pub fn get_tag(id: String, db: State<'_, DbConnection>) -> Result<Option<Tag>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            r#"
            SELECT id, name, category, color, description, usage_count, aliases, emotive_subcategory
            FROM tags
            WHERE id = ?1
            "#,
        )
        .map_err(|e| e.to_string())?;

    let tag_result = stmt
        .query_row(params![id], |row| {
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
        })
        .optional()
        .map_err(|e| e.to_string())?;

    Ok(tag_result)
}

#[tauri::command]
pub fn create_tag(input: CreateTagInput, db: State<'_, DbConnection>) -> Result<Tag, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

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
    )
    .map_err(|e| e.to_string())?;

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
}

#[tauri::command]
pub fn update_tag(input: UpdateTagInput, db: State<'_, DbConnection>) -> Result<Tag, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

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
    )
    .map_err(|e| e.to_string())?;

    // Fetch the updated tag to get usage_count
    let mut stmt = conn
        .prepare(
            r#"
            SELECT id, name, category, color, description, usage_count, aliases, emotive_subcategory
            FROM tags
            WHERE id = ?1
            "#,
        )
        .map_err(|e| e.to_string())?;

    let tag = stmt
        .query_row(params![input.id], |row| {
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
        })
        .map_err(|e| e.to_string())?;

    Ok(tag)
}

#[tauri::command]
pub fn delete_tag(id: String, db: State<'_, DbConnection>) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    conn.execute("DELETE FROM tags WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn get_tag_word_associations(
    tag_id: String,
    db: State<'_, DbConnection>,
) -> Result<Vec<TagWordUsage>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            r#"
            SELECT wta.word, d.id, d.title, d.dream_date
            FROM word_tag_associations wta
            JOIN dreams d ON d.id = wta.dream_id
            WHERE wta.tag_id = ?1
            ORDER BY d.dream_date DESC, wta.word ASC
            "#,
        )
        .map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map(params![tag_id], |row| {
            Ok(TagWordUsage {
                word: row.get(0)?,
                dream_id: row.get(1)?,
                dream_title: row.get(2)?,
                dream_date: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for item in iter {
        result.push(item.map_err(|e| e.to_string())?);
    }

    Ok(result)
}
