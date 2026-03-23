use rusqlite::{Connection, Result};

pub fn run_migrations(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        r#"
        -- Core tables
        CREATE TABLE IF NOT EXISTS dreams (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            content_html TEXT NOT NULL,
            content_plain TEXT NOT NULL,
            dream_date DATE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_lucid BOOLEAN DEFAULT FALSE,
            mood_rating INTEGER,
            clarity_rating INTEGER,
            waking_life_context TEXT,
            analysis_notes TEXT
        );

        CREATE TABLE IF NOT EXISTS tags (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            category TEXT NOT NULL CHECK (category IN ('location', 'person', 'symbolic', 'emotive', 'custom')),
            color TEXT NOT NULL DEFAULT '#6366f1',
            description TEXT,
            usage_count INTEGER DEFAULT 0,
            aliases TEXT NOT NULL DEFAULT '[]'
        );

        CREATE TABLE IF NOT EXISTS dream_tags (
            dream_id TEXT REFERENCES dreams(id) ON DELETE CASCADE,
            tag_id TEXT REFERENCES tags(id) ON DELETE CASCADE,
            PRIMARY KEY (dream_id, tag_id)
        );

        -- Indexes for performance
        CREATE INDEX IF NOT EXISTS idx_dreams_date ON dreams(dream_date);
        CREATE INDEX IF NOT EXISTS idx_dreams_lucid ON dreams(is_lucid);
        CREATE INDEX IF NOT EXISTS idx_tags_category ON tags(category);
        CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
        CREATE INDEX IF NOT EXISTS idx_dream_tags_dream ON dream_tags(dream_id);
        CREATE INDEX IF NOT EXISTS idx_dream_tags_tag ON dream_tags(tag_id);

        -- Word-level tag associations (inline highlights)
        CREATE TABLE IF NOT EXISTS word_tag_associations (
            id TEXT PRIMARY KEY,
            dream_id TEXT NOT NULL REFERENCES dreams(id) ON DELETE CASCADE,
            tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
            word TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_wta_dream ON word_tag_associations(dream_id);
        CREATE INDEX IF NOT EXISTS idx_wta_tag ON word_tag_associations(tag_id);

        -- Full-text search virtual table
        CREATE VIRTUAL TABLE IF NOT EXISTS dreams_fts USING fts5(
            id UNINDEXED,
            title,
            content_plain,
            content=dreams,
            content_rowid=rowid
        );

        -- Triggers to keep FTS in sync
        CREATE TRIGGER IF NOT EXISTS dreams_ai AFTER INSERT ON dreams BEGIN
            INSERT INTO dreams_fts(rowid, id, title, content_plain)
            VALUES (NEW.rowid, NEW.id, NEW.title, NEW.content_plain);
        END;

        CREATE TRIGGER IF NOT EXISTS dreams_ad AFTER DELETE ON dreams BEGIN
            INSERT INTO dreams_fts(dreams_fts, rowid, id, title, content_plain)
            VALUES ('delete', OLD.rowid, OLD.id, OLD.title, OLD.content_plain);
        END;

        CREATE TRIGGER IF NOT EXISTS dreams_au AFTER UPDATE ON dreams BEGIN
            INSERT INTO dreams_fts(dreams_fts, rowid, id, title, content_plain)
            VALUES ('delete', OLD.rowid, OLD.id, OLD.title, OLD.content_plain);
            INSERT INTO dreams_fts(rowid, id, title, content_plain)
            VALUES (NEW.rowid, NEW.id, NEW.title, NEW.content_plain);
        END;

        -- Trigger to update tag usage count
        CREATE TRIGGER IF NOT EXISTS update_tag_usage_insert AFTER INSERT ON dream_tags BEGIN
            UPDATE tags SET usage_count = usage_count + 1 WHERE id = NEW.tag_id;
        END;

        CREATE TRIGGER IF NOT EXISTS update_tag_usage_delete AFTER DELETE ON dream_tags BEGIN
            UPDATE tags SET usage_count = usage_count - 1 WHERE id = OLD.tag_id;
        END;
        "#,
    )?;

    // Additive migration: add aliases column to existing databases.
    // Silently ignored if the column already exists (fresh DB has it from CREATE TABLE).
    let _ = conn.execute(
        "ALTER TABLE tags ADD COLUMN aliases TEXT NOT NULL DEFAULT '[]'",
        [],
    );

    // Additive migration: add waking_life_context column to existing databases.
    // Silently ignored if the column already exists (fresh DB has it from CREATE TABLE).
    let _ = conn.execute(
        "ALTER TABLE dreams ADD COLUMN waking_life_context TEXT",
        [],
    );

    // Additive migration: add analysis_notes column to existing databases.
    let _ = conn.execute(
        "ALTER TABLE dreams ADD COLUMN analysis_notes TEXT",
        [],
    );

    Ok(())
}
