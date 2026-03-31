use crate::db::DbConnection;
use crate::models::{CreateDreamInput, Dream, Tag, TagCategory, UpdateDreamInput};
use chrono::Utc;
use rusqlite::{params, OptionalExtension};
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub fn get_dreams(db: State<'_, DbConnection>) -> Result<Vec<Dream>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            r#"
            SELECT id, title, content_html, content_plain, dream_date,
                   created_at, updated_at, is_lucid, mood_rating, clarity_rating,
                   waking_life_context
            FROM dreams
            ORDER BY dream_date DESC, created_at DESC
            "#,
        )
        .map_err(|e| e.to_string())?;

    let dreams_iter = stmt
        .query_map([], |row| {
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
                waking_life_context: row.get(10)?,
                tags: Vec::new(),
            })
        })
        .map_err(|e| e.to_string())?;

    let mut dreams: Vec<Dream> = Vec::new();
    for dream_result in dreams_iter {
        let mut dream = dream_result.map_err(|e| e.to_string())?;
        dream.tags = get_dream_tags(&conn, &dream.id)?;
        dreams.push(dream);
    }

    Ok(dreams)
}

#[tauri::command]
pub fn get_dream(id: String, db: State<'_, DbConnection>) -> Result<Option<Dream>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            r#"
            SELECT id, title, content_html, content_plain, dream_date,
                   created_at, updated_at, is_lucid, mood_rating, clarity_rating,
                   waking_life_context
            FROM dreams
            WHERE id = ?1
            "#,
        )
        .map_err(|e| e.to_string())?;

    let dream_result = stmt
        .query_row(params![id], |row| {
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
                waking_life_context: row.get(10)?,
                tags: Vec::new(),
            })
        })
        .optional()
        .map_err(|e| e.to_string())?;

    match dream_result {
        Some(mut dream) => {
            dream.tags = get_dream_tags(&conn, &dream.id)?;
            Ok(Some(dream))
        }
        None => Ok(None),
    }
}

#[tauri::command]
pub fn create_dream(
    input: CreateDreamInput,
    db: State<'_, DbConnection>,
) -> Result<Dream, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        r#"
        INSERT INTO dreams (id, title, content_html, content_plain, dream_date,
                           created_at, updated_at, is_lucid, mood_rating, clarity_rating,
                           waking_life_context)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
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
        ],
    )
    .map_err(|e| e.to_string())?;

    // Add tags
    for tag_id in &input.tag_ids {
        conn.execute(
            "INSERT INTO dream_tags (dream_id, tag_id) VALUES (?1, ?2)",
            params![id, tag_id],
        )
        .map_err(|e| e.to_string())?;
    }

    // Add word-level tag associations
    for assoc in &input.word_tag_associations {
        let assoc_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO word_tag_associations (id, dream_id, tag_id, word) VALUES (?1, ?2, ?3, ?4)",
            params![assoc_id, id, assoc.tag_id, assoc.word],
        )
        .map_err(|e| e.to_string())?;
    }

    let tags = get_dream_tags(&conn, &id)?;

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
        waking_life_context: input.waking_life_context,
        tags,
    })
}

#[tauri::command]
pub fn update_dream(
    input: UpdateDreamInput,
    db: State<'_, DbConnection>,
) -> Result<Dream, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let now = Utc::now().to_rfc3339();

    conn.execute(
        r#"
        UPDATE dreams
        SET title = ?2, content_html = ?3, content_plain = ?4, dream_date = ?5,
            updated_at = ?6, is_lucid = ?7, mood_rating = ?8, clarity_rating = ?9,
            waking_life_context = ?10
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
        ],
    )
    .map_err(|e| e.to_string())?;

    // Update tags - remove old, add new
    conn.execute(
        "DELETE FROM dream_tags WHERE dream_id = ?1",
        params![input.id],
    )
    .map_err(|e| e.to_string())?;

    for tag_id in &input.tag_ids {
        conn.execute(
            "INSERT INTO dream_tags (dream_id, tag_id) VALUES (?1, ?2)",
            params![input.id, tag_id],
        )
        .map_err(|e| e.to_string())?;
    }

    // Update word-level tag associations
    conn.execute(
        "DELETE FROM word_tag_associations WHERE dream_id = ?1",
        params![input.id],
    )
    .map_err(|e| e.to_string())?;

    for assoc in &input.word_tag_associations {
        let assoc_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO word_tag_associations (id, dream_id, tag_id, word) VALUES (?1, ?2, ?3, ?4)",
            params![assoc_id, input.id, assoc.tag_id, assoc.word],
        )
        .map_err(|e| e.to_string())?;
    }

    let tags = get_dream_tags(&conn, &input.id)?;

    // Fetch the updated dream
    let mut stmt = conn
        .prepare(
            r#"
            SELECT id, title, content_html, content_plain, dream_date,
                   created_at, updated_at, is_lucid, mood_rating, clarity_rating,
                   waking_life_context
            FROM dreams
            WHERE id = ?1
            "#,
        )
        .map_err(|e| e.to_string())?;

    let dream = stmt
        .query_row(params![input.id], |row| {
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
                waking_life_context: row.get(10)?,
                tags,
            })
        })
        .map_err(|e| e.to_string())?;

    Ok(dream)
}

#[tauri::command]
pub fn delete_dream(id: String, db: State<'_, DbConnection>) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    conn.execute("DELETE FROM dreams WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Add a tag to a dream without needing the full dream payload.
/// Silently succeeds if the association already exists.
#[tauri::command]
pub fn add_tag_to_dream(
    dream_id: String,
    tag_id: String,
    db: State<'_, DbConnection>,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT OR IGNORE INTO dream_tags (dream_id, tag_id) VALUES (?1, ?2)",
        params![dream_id, tag_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

fn get_dream_tags(
    conn: &rusqlite::Connection,
    dream_id: &str,
) -> Result<Vec<Tag>, String> {
    let mut stmt = conn
        .prepare(
            r#"
            SELECT t.id, t.name, t.category, t.color, t.description, t.usage_count, t.aliases
            FROM tags t
            JOIN dream_tags dt ON t.id = dt.tag_id
            WHERE dt.dream_id = ?1
            ORDER BY t.name
            "#,
        )
        .map_err(|e| e.to_string())?;

    let tags_iter = stmt
        .query_map(params![dream_id], |row| {
            let category_str: String = row.get(2)?;
            let aliases_str: String = row.get(6).unwrap_or_else(|_| "[]".to_string());
            Ok(Tag {
                id: row.get(0)?,
                name: row.get(1)?,
                category: TagCategory::from_str(&category_str),
                color: row.get(3)?,
                description: row.get(4)?,
                usage_count: row.get(5)?,
                aliases: serde_json::from_str(&aliases_str).unwrap_or_default(),
            })
        })
        .map_err(|e| e.to_string())?;

    let mut tags = Vec::new();
    for tag_result in tags_iter {
        tags.push(tag_result.map_err(|e| e.to_string())?);
    }

    Ok(tags)
}
