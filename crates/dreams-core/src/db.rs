//! SQLite-backed storage handle.
//!
//! [`Backend`] owns the connection and the migration runner. Every command
//! module in this crate receives `&Backend` and reaches into the connection
//! through [`Backend::with_conn`], which takes the mutex and hands out a
//! borrowed `Connection`.
//!
//! # Why a mutex, not a pool?
//!
//! The existing desktop app uses a single mutex-guarded `rusqlite::Connection`.
//! Preserving that shape makes the extraction mechanical — command bodies can
//! be lifted verbatim from `src-tauri/`. A connection pool is an easy future
//! upgrade: replace the `Mutex<Connection>` with `r2d2::Pool<SqliteConnectionManager>`
//! and update `with_conn` to hand out pooled guards.

use std::path::Path;
use std::sync::Mutex;

use rusqlite::Connection;

use crate::error::{CoreError, CoreResult};

mod migrations;

pub struct Backend {
    conn: Mutex<Connection>,
}

impl Backend {
    /// Open (or create) the SQLite database at `db_path` and run every
    /// idempotent migration. The caller is responsible for choosing a
    /// platform-appropriate path (Tauri uses the app data dir; mobile hosts
    /// should pass the app's private documents directory).
    pub fn open(db_path: impl AsRef<Path>) -> CoreResult<Self> {
        let conn = Connection::open(db_path.as_ref())?;
        migrations::run_migrations(&conn)?;
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    /// In-memory backend, primarily for integration tests.
    pub fn open_in_memory() -> CoreResult<Self> {
        let conn = Connection::open_in_memory()?;
        migrations::run_migrations(&conn)?;
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    /// Run a closure with exclusive access to the underlying connection.
    ///
    /// All command implementations in this crate go through this method so
    /// that lock acquisition, error mapping, and future pool migration are
    /// centralised.
    pub fn with_conn<F, T>(&self, f: F) -> CoreResult<T>
    where
        F: FnOnce(&Connection) -> CoreResult<T>,
    {
        let guard = self.conn.lock().map_err(|_| CoreError::Poisoned)?;
        f(&guard)
    }
}
