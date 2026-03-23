use crate::db::DbConnection;
use crate::models::{Dream, ExportResult, Tag, TagCategory};
use chrono::NaiveDate;
use rusqlite::params;
use std::fs;
use std::path::PathBuf;
use tauri::State;

const VAULT_PATH: &str = "C:\\Users\\globo\\Desktop\\Dreams\\vault";

#[tauri::command]
pub fn get_obsidian_path() -> String {
    VAULT_PATH.to_string()
}

#[tauri::command]
pub fn export_to_obsidian(db: State<'_, DbConnection>) -> Result<ExportResult, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let vault_path = PathBuf::from(VAULT_PATH);

    // Create vault structure
    let dreams_path = vault_path.join("Dreams");
    let tags_path = vault_path.join("Tags");

    fs::create_dir_all(&dreams_path).map_err(|e| e.to_string())?;
    fs::create_dir_all(tags_path.join("Locations")).map_err(|e| e.to_string())?;
    fs::create_dir_all(tags_path.join("People")).map_err(|e| e.to_string())?;
    fs::create_dir_all(tags_path.join("Symbolic")).map_err(|e| e.to_string())?;
    fs::create_dir_all(tags_path.join("Emotive")).map_err(|e| e.to_string())?;
    fs::create_dir_all(tags_path.join("Custom")).map_err(|e| e.to_string())?;

    // Export all dreams
    let mut stmt = conn
        .prepare(
            r#"
            SELECT id, title, content_html, content_plain, dream_date,
                   created_at, updated_at, is_lucid, mood_rating, clarity_rating
            FROM dreams
            ORDER BY dream_date DESC
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

    let mut exported_count = 0;

    for dream_result in dreams_iter {
        let mut dream = dream_result.map_err(|e| e.to_string())?;
        dream.tags = get_dream_tags(&conn, &dream.id)?;

        export_dream(&dreams_path, &dream)?;
        exported_count += 1;
    }

    // Export all tags
    let mut tag_stmt = conn
        .prepare(
            r#"
            SELECT id, name, category, color, description, usage_count
            FROM tags
            ORDER BY category, name
            "#,
        )
        .map_err(|e| e.to_string())?;

    let tags_iter = tag_stmt
        .query_map([], |row| {
            let category_str: String = row.get(2)?;
            Ok(Tag {
                id: row.get(0)?,
                name: row.get(1)?,
                category: TagCategory::from_str(&category_str),
                color: row.get(3)?,
                description: row.get(4)?,
                usage_count: row.get(5)?,
                aliases: vec![],
            })
        })
        .map_err(|e| e.to_string())?;

    for tag_result in tags_iter {
        let tag = tag_result.map_err(|e| e.to_string())?;
        export_tag(&tags_path, &tag, &conn)?;
    }

    // Create index file
    create_index_file(&vault_path)?;

    Ok(ExportResult {
        exported_count,
        vault_path: VAULT_PATH.to_string(),
    })
}

fn export_dream(dreams_path: &PathBuf, dream: &Dream) -> Result<(), String> {
    // Parse date to create folder structure
    let date = NaiveDate::parse_from_str(&dream.dream_date, "%Y-%m-%d")
        .map_err(|e| e.to_string())?;

    let year = date.format("%Y").to_string();
    let month = date.format("%m-%B").to_string();

    let year_path = dreams_path.join(&year);
    let month_path = year_path.join(&month);
    fs::create_dir_all(&month_path).map_err(|e| e.to_string())?;

    // Create filename
    let safe_title: String = dream
        .title
        .chars()
        .map(|c| if c.is_alphanumeric() || c == ' ' || c == '-' { c } else { '-' })
        .collect();
    let safe_title = safe_title.trim().replace("  ", " ").replace(" ", "-").to_lowercase();
    let filename = format!("{}-{}.md", dream.dream_date, safe_title);

    // Build markdown content
    let mut content = String::new();

    // YAML frontmatter
    content.push_str("---\n");
    content.push_str(&format!("date: {}\n", dream.dream_date));
    content.push_str(&format!("created: {}\n", dream.created_at));
    content.push_str(&format!("updated: {}\n", dream.updated_at));
    content.push_str(&format!("lucid: {}\n", dream.is_lucid));

    if let Some(mood) = dream.mood_rating {
        content.push_str(&format!("mood: {}\n", mood));
    }
    if let Some(clarity) = dream.clarity_rating {
        content.push_str(&format!("clarity: {}\n", clarity));
    }

    if !dream.tags.is_empty() {
        content.push_str("tags:\n");
        for tag in &dream.tags {
            content.push_str(&format!("  - {}\n", tag.name));
        }
    }

    content.push_str("---\n\n");

    // Title
    content.push_str(&format!("# {}\n\n", dream.title));

    // Tags as wikilinks
    if !dream.tags.is_empty() {
        let wikilinks: Vec<String> = dream
            .tags
            .iter()
            .map(|t| format!("[[{}]]", t.name))
            .collect();
        content.push_str(&format!("**Tags:** {}\n\n", wikilinks.join(" ")));
    }

    // Content
    content.push_str(&dream.content_plain);
    content.push('\n');

    // Write file
    let file_path = month_path.join(filename);
    fs::write(file_path, content).map_err(|e| e.to_string())?;

    Ok(())
}

fn export_tag(tags_path: &PathBuf, tag: &Tag, conn: &rusqlite::Connection) -> Result<(), String> {
    let category_folder = match tag.category {
        TagCategory::Location => "Locations",
        TagCategory::Person => "People",
        TagCategory::Symbolic => "Symbolic",
        TagCategory::Emotive => "Emotive",
        TagCategory::Custom => "Custom",
    };

    let folder_path = tags_path.join(category_folder);
    let filename = format!("{}.md", tag.name);

    // Get related dreams
    let mut stmt = conn
        .prepare(
            r#"
            SELECT d.title, d.dream_date
            FROM dreams d
            JOIN dream_tags dt ON d.id = dt.dream_id
            WHERE dt.tag_id = ?1
            ORDER BY d.dream_date DESC
            "#,
        )
        .map_err(|e| e.to_string())?;

    let dreams_iter = stmt
        .query_map(params![tag.id], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|e| e.to_string())?;

    let mut related_dreams: Vec<(String, String)> = Vec::new();
    for dream_result in dreams_iter {
        related_dreams.push(dream_result.map_err(|e| e.to_string())?);
    }

    // Build markdown content
    let mut content = String::new();

    // YAML frontmatter
    content.push_str("---\n");
    content.push_str(&format!("category: {}\n", category_folder.to_lowercase()));
    content.push_str(&format!("color: \"{}\"\n", tag.color));
    content.push_str(&format!("usage_count: {}\n", tag.usage_count));
    content.push_str("---\n\n");

    // Title
    content.push_str(&format!("# {}\n\n", tag.name));

    // Description
    if let Some(ref desc) = tag.description {
        content.push_str(&format!("{}\n\n", desc));
    }

    // Related dreams
    if !related_dreams.is_empty() {
        content.push_str("## Related Dreams\n\n");
        for (title, date) in &related_dreams {
            let safe_title: String = title
                .chars()
                .map(|c| if c.is_alphanumeric() || c == ' ' || c == '-' { c } else { '-' })
                .collect();
            let safe_title = safe_title.trim().replace("  ", " ").replace(" ", "-").to_lowercase();
            content.push_str(&format!("- [[{}-{}|{} ({})]]\n", date, safe_title, title, date));
        }
    }

    // Dataview query for related dreams
    content.push_str("\n## All Dreams with this Tag\n\n");
    content.push_str("```dataview\n");
    content.push_str("TABLE date, mood, clarity\n");
    content.push_str("FROM \"Dreams\"\n");
    content.push_str(&format!("WHERE contains(tags, \"{}\")\n", tag.name));
    content.push_str("SORT date DESC\n");
    content.push_str("```\n");

    // Write file
    let file_path = folder_path.join(filename);
    fs::write(file_path, content).map_err(|e| e.to_string())?;

    Ok(())
}

fn create_index_file(vault_path: &PathBuf) -> Result<(), String> {
    let content = r#"# Dream Vault

Welcome to your Dream Vault! This vault is automatically synced from the Dreams application.

## Quick Navigation

- [[Dreams/]] - Browse all dreams by date
- [[Tags/]] - Explore dream themes and patterns

## Tag Categories

- [[Tags/Locations/]] - Places in your dreams
- [[Tags/People/]] - People appearing in dreams
- [[Tags/Symbolic/]] - Symbolic elements
- [[Tags/Emotive/]] - Emotional themes
- [[Tags/Custom/]] - Custom tags

## Statistics

```dataview
TABLE length(rows) as "Dream Count"
FROM "Dreams"
GROUP BY dateformat(date, "yyyy-MM") as Month
SORT Month DESC
LIMIT 12
```

## Recent Dreams

```dataview
TABLE date, tags
FROM "Dreams"
SORT date DESC
LIMIT 10
```

## Most Common Tags

```dataview
TABLE usage_count as "Count"
FROM "Tags"
SORT usage_count DESC
LIMIT 15
```
"#;

    let file_path = vault_path.join("_index.md");
    fs::write(file_path, content).map_err(|e| e.to_string())?;

    Ok(())
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
                aliases: vec![],
            })
        })
        .map_err(|e| e.to_string())?;

    let mut tags = Vec::new();
    for tag_result in tags_iter {
        tags.push(tag_result.map_err(|e| e.to_string())?);
    }

    Ok(tags)
}
