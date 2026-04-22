//! C ABI shim over [`dreams_core`].
//!
//! # Why a JSON dispatch?
//!
//! Mobile hosts (Flutter Dart-FFI, Kotlin JNI, Swift) bind most cleanly to a
//! tiny, mostly-string C surface. Defining one `dreams_call` that takes a
//! method name + JSON args and returns a JSON envelope avoids writing (and
//! versioning) dozens of per-method extern functions, and mirrors the shape
//! of the Tauri `invoke()` IPC that the existing frontend already uses. The
//! same TypeScript client wrapper can drive either path.
//!
//! # Contract
//!
//! All returned `*mut c_char` pointers are UTF-8 JSON and must be freed by
//! the caller with [`dreams_free_string`]. A null return indicates a panic
//! or invalid input (null / non-UTF-8 method or args pointers).
//!
//! The envelope is always one of:
//! - `{"ok": true,  "result": <value>}`
//! - `{"ok": false, "error":  <string>}`
//!
//! # Async
//!
//! The shim owns a Tokio multi-thread runtime per [`DreamsContext`]. Async
//! core methods (Claude HTTP calls) are driven synchronously via
//! `runtime.block_on`, so every FFI call returns only once the work is
//! complete. Hosts that need non-blocking behaviour should invoke
//! `dreams_call` from their own background thread / isolate / coroutine.

use std::ffi::{c_char, CStr, CString};
use std::sync::Arc;

use serde_json::{json, Value};

use dreams_core::{
    claude, dreams, graph, search, tags, theme, Backend, CoreError,
};

mod dispatch;

// --- Opaque context handle ---

pub struct DreamsContext {
    backend: Arc<Backend>,
    runtime: tokio::runtime::Runtime,
}

impl DreamsContext {
    fn new(backend: Backend) -> Result<Self, CoreError> {
        let runtime = tokio::runtime::Builder::new_multi_thread()
            .enable_all()
            .worker_threads(2)
            .build()
            .map_err(|e| CoreError::msg(format!("tokio runtime build failed: {e}")))?;
        Ok(Self {
            backend: Arc::new(backend),
            runtime,
        })
    }
}

// --- Open / close / free ---

/// Open (or create) the SQLite database at `db_path` and run migrations.
/// Returns a heap-allocated context pointer, or null on error. Pair with
/// [`dreams_close`].
///
/// # Safety
/// `db_path` must be a valid NUL-terminated UTF-8 string.
#[no_mangle]
pub unsafe extern "C" fn dreams_open(db_path: *const c_char) -> *mut DreamsContext {
    if db_path.is_null() {
        return std::ptr::null_mut();
    }
    let path = match unsafe { CStr::from_ptr(db_path) }.to_str() {
        Ok(s) => s,
        Err(_) => return std::ptr::null_mut(),
    };
    let backend = match Backend::open(path) {
        Ok(b) => b,
        Err(_) => return std::ptr::null_mut(),
    };
    match DreamsContext::new(backend) {
        Ok(ctx) => Box::into_raw(Box::new(ctx)),
        Err(_) => std::ptr::null_mut(),
    }
}

/// Destroy a context and release the underlying SQLite connection.
///
/// # Safety
/// `ctx` must be a pointer previously returned by `dreams_open`, or null.
#[no_mangle]
pub unsafe extern "C" fn dreams_close(ctx: *mut DreamsContext) {
    if ctx.is_null() {
        return;
    }
    // Reclaim the Box so its destructor runs.
    drop(unsafe { Box::from_raw(ctx) });
}

/// Free a `*mut c_char` returned by this library.
///
/// # Safety
/// `s` must be a pointer returned by a `dreams_ffi` function, or null.
#[no_mangle]
pub unsafe extern "C" fn dreams_free_string(s: *mut c_char) {
    if s.is_null() {
        return;
    }
    drop(unsafe { CString::from_raw(s) });
}

// --- Single dispatch entry point ---

/// Invoke a core method. `method` is an ASCII command name; `args_json` is a
/// UTF-8 JSON object whose shape depends on the command (see
/// [`dispatch::dispatch`] for the full table). Returns a heap-allocated
/// JSON envelope string which the caller must free with
/// [`dreams_free_string`]. Returns null only when the input pointers are
/// invalid.
///
/// # Safety
/// `ctx`, `method`, and `args_json` must all be valid; `method` and
/// `args_json` must be NUL-terminated UTF-8 strings.
#[no_mangle]
pub unsafe extern "C" fn dreams_call(
    ctx: *mut DreamsContext,
    method: *const c_char,
    args_json: *const c_char,
) -> *mut c_char {
    if ctx.is_null() || method.is_null() || args_json.is_null() {
        return std::ptr::null_mut();
    }
    let ctx = unsafe { &*ctx };
    let method = match unsafe { CStr::from_ptr(method) }.to_str() {
        Ok(s) => s,
        Err(_) => return envelope_error("method is not valid UTF-8"),
    };
    let args_str = match unsafe { CStr::from_ptr(args_json) }.to_str() {
        Ok(s) => s,
        Err(_) => return envelope_error("args_json is not valid UTF-8"),
    };
    let args: Value = match serde_json::from_str(args_str) {
        Ok(v) => v,
        Err(e) => return envelope_error(&format!("args_json parse error: {e}")),
    };

    let envelope = match dispatch::dispatch(ctx, method, &args) {
        Ok(value) => json!({"ok": true, "result": value}),
        Err(e) => json!({"ok": false, "error": e.to_string()}),
    };

    // `to_string` on serde_json::Value is infallible.
    let s = envelope.to_string();
    // Unwrap: `to_string` never produces an interior NUL.
    CString::new(s).unwrap().into_raw()
}

fn envelope_error(msg: &str) -> *mut c_char {
    let s = json!({"ok": false, "error": msg}).to_string();
    CString::new(s).unwrap().into_raw()
}

// --- Re-exports for the dispatch module ---

pub(crate) use claude as core_claude;
pub(crate) use dreams as core_dreams;
pub(crate) use graph as core_graph;
pub(crate) use search as core_search;
pub(crate) use tags as core_tags;
pub(crate) use theme as core_theme;
