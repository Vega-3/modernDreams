use crate::db::DbConnection;
use crate::models::{Dream, SearchQuery, SearchResult, Tag, TagCategory};
use rusqlite::params;
use tauri::State;

#[tauri::command]
pub fn search_dreams(
    query: SearchQuery,
    db: State<'_, DbConnection>,
) -> Result<SearchResult, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    // If query is empty, return all dreams
    if query.query.is_empty()
        && query.is_lucid_filter.is_none()
        && query.category_filter.is_none()
        && query.date_from.is_none()
        && query.date_to.is_none()
    {
        let mut stmt = conn
            .prepare(
                r#"
                SELECT id, title, content_html, content_plain, dream_date,
                       created_at, updated_at, is_lucid, mood_rating, clarity_rating
                FROM dreams
                ORDER BY dream_date DESC, created_at DESC
                LIMIT 50
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

        let total = dreams.len() as i32;
        return Ok(SearchResult { dreams, total });
    }

    // Full-text search with FTS5
    let search_term = format!("{}*", query.query.replace("\"", "\"\""));

    let mut stmt = conn
        .prepare(
            r#"
            SELECT d.id, d.title, d.content_html, d.content_plain, d.dream_date,
                   d.created_at, d.updated_at, d.is_lucid, d.mood_rating, d.clarity_rating
            FROM dreams d
            WHERE d.id IN (SELECT id FROM dreams_fts WHERE dreams_fts MATCH ?1)
            ORDER BY d.dream_date DESC, d.created_at DESC
            LIMIT 50
            "#,
        )
        .map_err(|e| e.to_string())?;

    let dreams_iter = stmt
        .query_map(params![search_term], |row| {
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
                tags: Vec::new(),
            })
        })
        .map_err(|e| e.to_string())?;

    let mut dreams: Vec<Dream> = Vec::new();
    for dream_result in dreams_iter {
        let mut dream = dream_result.map_err(|e| e.to_string())?;
        dream.tags = get_dream_tags(&conn, &dream.id)?;

        // Apply additional filters
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
}

fn get_dream_tags(conn: &rusqlite::Connection, dream_id: &str) -> Result<Vec<Tag>, String> {
    let mut stmt = conn
        .prepare(
            r#"
            SELECT t.id, t.name, t.category, t.color, t.description, t.usage_count
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
