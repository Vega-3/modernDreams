//! Thin Tauri wrappers delegating to `dreams_core::claude`.
//!
//! These commands are async; Tauri's runtime awaits them directly. The
//! command names are kept identical to the pre-split ones so the frontend's
//! `invoke(...)` call sites don't need to change.

use dreams_core::claude as core;
use dreams_core::claude::{DreamAnalysisResult, InlineTagResult, TranscriptionResult};

use super::to_ipc_err;

#[tauri::command]
pub async fn verify_api_key(api_key: String) -> Result<(), String> {
    core::verify_api_key(&api_key).await.map_err(to_ipc_err)
}

#[tauri::command]
pub async fn transcribe_handwriting_claude(
    image_base64: String,
    image_media_type: String,
    api_key: String,
) -> Result<TranscriptionResult, String> {
    core::transcribe_handwriting(&image_base64, &image_media_type, &api_key)
        .await
        .map_err(to_ipc_err)
}

#[tauri::command]
pub async fn analyze_dream(
    dream_text: String,
    available_tags: String,
    api_key: String,
) -> Result<DreamAnalysisResult, String> {
    core::analyze_dream(&dream_text, &available_tags, &api_key)
        .await
        .map_err(to_ipc_err)
}

#[tauri::command]
pub async fn ai_tag_dream(
    dream_text: String,
    available_tags: String,
    api_key: String,
) -> Result<InlineTagResult, String> {
    core::ai_tag_dream(&dream_text, &available_tags, &api_key)
        .await
        .map_err(to_ipc_err)
}
