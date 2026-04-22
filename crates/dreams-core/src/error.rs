//! Typed error for the core library.
//!
//! The Tauri wrapper and the FFI shim both convert `CoreError` to a string
//! representation before crossing the process boundary (Tauri IPC serialises
//! `Result<T, String>`; the FFI layer returns JSON with an `error` field).
//! Keeping a typed error in-core means future consumers (a native Flutter
//! plugin, an integration test) can match on variants without string parsing.

use thiserror::Error;

#[derive(Debug, Error)]
pub enum CoreError {
    #[error("database error: {0}")]
    Db(#[from] rusqlite::Error),

    #[error("serialisation error: {0}")]
    Serde(#[from] serde_json::Error),

    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    #[error("http error: {0}")]
    Http(#[from] reqwest::Error),

    #[error("anthropic api error {status}: {body}")]
    AnthropicApi { status: u16, body: String },

    #[error("mutex poisoned")]
    Poisoned,

    #[error("{0}")]
    Message(String),
}

impl CoreError {
    pub fn msg(s: impl Into<String>) -> Self {
        Self::Message(s.into())
    }
}

// Any `PoisonError<T>` collapses to CoreError::Poisoned — we never want to
// propagate the generic parameter.
impl<T> From<std::sync::PoisonError<T>> for CoreError {
    fn from(_: std::sync::PoisonError<T>) -> Self {
        Self::Poisoned
    }
}

pub type CoreResult<T> = std::result::Result<T, CoreError>;
