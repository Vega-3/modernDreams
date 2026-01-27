use crate::db::DbConnection;
use crate::models::{CreateTagInput, Tag, TagCategory, UpdateTagInput};
use rusqlite::{params, OptionalExtension};
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub fn get_tags(db: State<'_, DbConnection>) -> Result<Vec<Tag>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            r#"
            SELECT id, name, category, color, description, usage_count
            FROM tags
            ORDER BY usage_count DESC, name ASC
            "#,
        )
        .map_err(|e| e.to_string())?;

    let tags_iter = stmt
        .query_map([], |row| {
            let category_str: String = row.get(2)?;
            Ok(Tag {
                id: row.get(0)?,
                name: row.get(1)?,
                category: TagCategory::from_str(&category_str),
                color: row.get(3)?,
                description: row.get(4)?,
                usage_count: row.get(5)?,
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
            SELECT id, name, category, color, description, usage_count
            FROM tags
            WHERE id = ?1
            "#,
        )
        .map_err(|e| e.to_string())?;

    let tag_result = stmt
        .query_row(params![id], |row| {
            let category_str: String = row.get(2)?;
            Ok(Tag {
                id: row.get(0)?,
                name: row.get(1)?,
                category: TagCategory::from_str(&category_str),
                color: row.get(3)?,
                description: row.get(4)?,
                usage_count: row.get(5)?,
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

    conn.execute(
        r#"
        INSERT INTO tags (id, name, category, color, description, usage_count)
        VALUES (?1, ?2, ?3, ?4, ?5, 0)
        "#,
        params![
            id,
            input.name,
            input.category.as_str(),
            input.color,
            input.description,
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
    })
}

#[tauri::command]
pub fn update_tag(input: UpdateTagInput, db: State<'_, DbConnection>) -> Result<Tag, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    conn.execute(
        r#"
        UPDATE tags
        SET name = ?2, category = ?3, color = ?4, description = ?5
        WHERE id = ?1
        "#,
        params![
            input.id,
            input.name,
            input.category.as_str(),
            input.color,
            input.description,
        ],
    )
    .map_err(|e| e.to_string())?;

    // Fetch the updated tag to get usage_count
    let mut stmt = conn
        .prepare(
            r#"
            SELECT id, name, category, color, description, usage_count
            FROM tags
            WHERE id = ?1
            "#,
        )
        .map_err(|e| e.to_string())?;

    let tag = stmt
        .query_row(params![input.id], |row| {
            let category_str: String = row.get(2)?;
            Ok(Tag {
                id: row.get(0)?,
                name: row.get(1)?,
                category: TagCategory::from_str(&category_str),
                color: row.get(3)?,
                description: row.get(4)?,
                usage_count: row.get(5)?,
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
