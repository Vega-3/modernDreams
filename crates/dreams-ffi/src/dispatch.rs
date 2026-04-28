//! Method dispatch table for the FFI layer.
//!
//! Each arm parses the JSON `args` object into the corresponding core input
//! type, invokes the core function, and returns a `serde_json::Value` for the
//! envelope builder. Async core functions are driven via
//! `ctx.runtime.block_on`.
//!
//! The method names here are the same strings the frontend already sends
//! over Tauri's `invoke()`, so the TS client wrapper can target either path
//! with a tiny abstraction that picks `window.__TAURI__.invoke` on desktop
//! and `dreams_call` (through a JNI/Dart-FFI bridge) on mobile.

use serde_json::Value;

use dreams_core::models::{
    CreateDreamInput, CreateTagInput, SearchQuery, UpdateDreamInput, UpdateTagInput,
};
use dreams_core::CoreError;

use super::{
    core_claude, core_dreams, core_graph, core_search, core_tags, core_theme, DreamsContext,
};

type R = Result<Value, CoreError>;

pub fn dispatch(ctx: &DreamsContext, method: &str, args: &Value) -> R {
    match method {
        // --- Dreams ---
        "get_dreams" => to_value(core_dreams::get_dreams(&ctx.backend)?),
        "get_dream" => {
            let id = pick_str(args, "id")?;
            to_value(core_dreams::get_dream(&ctx.backend, id)?)
        }
        "create_dream" => {
            let input: CreateDreamInput = pick_field(args, "input")?;
            to_value(core_dreams::create_dream(&ctx.backend, input)?)
        }
        "update_dream" => {
            let input: UpdateDreamInput = pick_field(args, "input")?;
            to_value(core_dreams::update_dream(&ctx.backend, input)?)
        }
        "delete_dream" => {
            let id = pick_str(args, "id")?;
            core_dreams::delete_dream(&ctx.backend, id)?;
            Ok(Value::Null)
        }
        "add_tag_to_dream" => {
            let dream_id = pick_str(args, "dreamId")?;
            let tag_id = pick_str(args, "tagId")?;
            core_dreams::add_tag_to_dream(&ctx.backend, dream_id, tag_id)?;
            Ok(Value::Null)
        }

        // --- Tags ---
        "get_tags" => to_value(core_tags::get_tags(&ctx.backend)?),
        "get_tag" => {
            let id = pick_str(args, "id")?;
            to_value(core_tags::get_tag(&ctx.backend, id)?)
        }
        "create_tag" => {
            let input: CreateTagInput = pick_field(args, "input")?;
            to_value(core_tags::create_tag(&ctx.backend, input)?)
        }
        "update_tag" => {
            let input: UpdateTagInput = pick_field(args, "input")?;
            to_value(core_tags::update_tag(&ctx.backend, input)?)
        }
        "delete_tag" => {
            let id = pick_str(args, "id")?;
            core_tags::delete_tag(&ctx.backend, id)?;
            Ok(Value::Null)
        }
        "get_tag_word_associations" => {
            let tag_id = pick_str(args, "tagId")?;
            to_value(core_tags::get_tag_word_associations(&ctx.backend, tag_id)?)
        }
        "delete_word_tag_association" => {
            let dream_id = pick_str(args, "dreamId")?;
            let tag_id = pick_str(args, "tagId")?;
            let word = pick_str(args, "word")?;
            core_tags::delete_word_tag_association(&ctx.backend, dream_id, tag_id, word)?;
            Ok(Value::Null)
        }

        // --- Search ---
        "search_dreams" => {
            let query: SearchQuery = pick_field(args, "query")?;
            to_value(core_search::search_dreams(&ctx.backend, query)?)
        }

        // --- Theme notes ---
        "get_tag_notes" => {
            let tag_id = pick_str(args, "tagId")?;
            to_value(core_theme::get_tag_notes(&ctx.backend, tag_id)?)
        }
        "save_tag_notes" => {
            let tag_id = pick_str(args, "tagId")?;
            let notes = pick_str(args, "notes")?;
            core_theme::save_tag_notes(&ctx.backend, tag_id, notes)?;
            Ok(Value::Null)
        }

        // --- Graph ---
        // Always exposed: raw JSON input for callers that run their own analyser.
        "build_graph_input" => {
            let start_date = pick_str(args, "startDate")?;
            let end_date = pick_str(args, "endDate")?;
            core_graph::build_graph_input_json(&ctx.backend, start_date, end_date)
        }
        #[cfg(feature = "python-analysis")]
        "get_graph_stats" => {
            let start_date = pick_str(args, "startDate")?;
            let end_date = pick_str(args, "endDate")?;
            to_value(core_graph::get_graph_stats(
                &ctx.backend,
                start_date,
                end_date,
            )?)
        }

        // --- Claude (async; driven through the embedded runtime) ---
        "verify_api_key" => {
            let api_key = pick_str(args, "apiKey")?.to_owned();
            ctx.runtime
                .block_on(core_claude::verify_api_key(&api_key))?;
            Ok(Value::Null)
        }
        "transcribe_handwriting" => {
            let image_base64 = pick_str(args, "imageBase64")?.to_owned();
            let image_media_type = pick_str(args, "imageMediaType")?.to_owned();
            let api_key = pick_str(args, "apiKey")?.to_owned();
            let result = ctx.runtime.block_on(core_claude::transcribe_handwriting(
                &image_base64,
                &image_media_type,
                &api_key,
            ))?;
            to_value(result)
        }
        "analyze_dream" => {
            let dream_text = pick_str(args, "dreamText")?.to_owned();
            let available_tags = pick_str(args, "availableTags")?.to_owned();
            let api_key = pick_str(args, "apiKey")?.to_owned();
            let result = ctx.runtime.block_on(core_claude::analyze_dream(
                &dream_text,
                &available_tags,
                &api_key,
            ))?;
            to_value(result)
        }
        "ai_tag_dream" => {
            let dream_text = pick_str(args, "dreamText")?.to_owned();
            let available_tags = pick_str(args, "availableTags")?.to_owned();
            let api_key = pick_str(args, "apiKey")?.to_owned();
            let result = ctx.runtime.block_on(core_claude::ai_tag_dream(
                &dream_text,
                &available_tags,
                &api_key,
            ))?;
            to_value(result)
        }

        other => Err(CoreError::msg(format!("unknown method: {other}"))),
    }
}

// --- Arg helpers ---

fn pick_str<'a>(args: &'a Value, key: &str) -> Result<&'a str, CoreError> {
    args.get(key)
        .and_then(|v| v.as_str())
        .ok_or_else(|| CoreError::msg(format!("missing or non-string arg: {key}")))
}

fn pick_field<T: serde::de::DeserializeOwned>(args: &Value, key: &str) -> Result<T, CoreError> {
    let v = args
        .get(key)
        .ok_or_else(|| CoreError::msg(format!("missing arg: {key}")))?;
    serde_json::from_value(v.clone()).map_err(CoreError::from)
}

fn to_value<T: serde::Serialize>(v: T) -> R {
    serde_json::to_value(v).map_err(CoreError::from)
}
