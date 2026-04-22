//! dreams-core
//!
//! Platform-independent backend for the Dreams journal application.
//!
//! This crate has **no Tauri dependency**. It exposes a [`Backend`] handle that
//! owns the SQLite connection and a set of free functions / methods that
//! perform the business logic. The same crate is linked from:
//!
//! - `src-tauri/` — desktop (Windows/macOS/Linux), driven by Tauri commands
//! - `crates/dreams-ffi/` — mobile (iOS/Android) and any non-Tauri host,
//!   driven through a C ABI JSON-dispatch shim
//!
//! The split is deliberate: Tauri Mobile is not yet production-ready, so the
//! architecture keeps the option open to drive the same Rust backend from a
//! Flutter / React-Native host via the FFI shim without rewriting business
//! logic.

pub mod claude;
pub mod db;
pub mod dreams;
pub mod error;
pub mod graph;
pub mod models;
pub mod search;
pub mod tags;
pub mod theme;

pub use db::Backend;
pub use error::{CoreError, CoreResult};
