use serde::{Deserialize, Serialize};

#[derive(Serialize)]
pub struct TranscriptionResult {
    pub raw_transcript: String,
    pub english_transcript: String,
}

// ─── Anthropic API request / response shapes ─────────────────────────────────

#[derive(Serialize)]
struct AnthropicRequest<'a> {
    model: &'a str,
    max_tokens: u32,
    messages: Vec<Message<'a>>,
}

#[derive(Serialize)]
struct Message<'a> {
    role: &'a str,
    content: Vec<ContentBlock<'a>>,
}

#[derive(Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum ContentBlock<'a> {
    Image { source: ImageSource<'a> },
    Text { text: &'a str },
}

#[derive(Serialize)]
struct ImageSource<'a> {
    #[serde(rename = "type")]
    source_type: &'a str,
    media_type: &'a str,
    data: &'a str,
}

#[derive(Deserialize)]
struct AnthropicResponse {
    content: Vec<ResponseContent>,
}

#[derive(Deserialize)]
struct ResponseContent {
    #[serde(rename = "type")]
    content_type: String,
    text: Option<String>,
}

// ─── Helper ───────────────────────────────────────────────────────────────────

async fn call_claude(
    client: &reqwest::Client,
    api_key: &str,
    request: &AnthropicRequest<'_>,
) -> Result<String, String> {
    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(request)
        .send()
        .await
        .map_err(|e| format!("Request failed: {e}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Anthropic API error {status}: {body}"));
    }

    let parsed: AnthropicResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {e}"))?;

    parsed
        .content
        .into_iter()
        .find(|c| c.content_type == "text")
        .and_then(|c| c.text)
        .ok_or_else(|| "No text content in response".to_string())
}

// ─── Tauri command ────────────────────────────────────────────────────────────

/// Transcribe handwriting from a base64-encoded image using Claude.
///
/// Two sequential API calls are made:
/// 1. Vision call – Claude reads the image and produces a raw transcript.
/// 2. Text-only call – Claude translates / refines the raw transcript into
///    fluent English.
///
/// Both results are returned so the user can choose which to save.
#[tauri::command]
pub async fn transcribe_handwriting_claude(
    image_base64: String,
    image_media_type: String,
    api_key: String,
) -> Result<TranscriptionResult, String> {
    if api_key.trim().is_empty() {
        return Err(
            "No Anthropic API key configured. Please add your key in Settings.".to_string(),
        );
    }

    let client = reqwest::Client::new();
    let model = "claude-haiku-4-5-20251001";

    // ── Stage 1: transcribe the image ────────────────────────────────────────
    let transcribe_prompt = "Please transcribe the handwritten text in this image exactly as written. \
        Preserve the original words, abbreviations, line breaks, and any non-English text. \
        Output only the transcribed text with no commentary.";

    let stage1_request = AnthropicRequest {
        model,
        max_tokens: 2048,
        messages: vec![Message {
            role: "user",
            content: vec![
                ContentBlock::Image {
                    source: ImageSource {
                        source_type: "base64",
                        media_type: &image_media_type,
                        data: &image_base64,
                    },
                },
                ContentBlock::Text {
                    text: transcribe_prompt,
                },
            ],
        }],
    };

    let raw_transcript = call_claude(&client, &api_key, &stage1_request).await?;

    // ── Stage 2: translate / refine to English ───────────────────────────────
    let translate_prompt = format!(
        "You are given a raw handwriting transcript. Translate and refine it into clear, \
        fluent English. Preserve the full meaning and narrative of the original. \
        Output only the refined English text with no commentary.\n\nTranscript:\n{raw_transcript}"
    );

    let stage2_request = AnthropicRequest {
        model,
        max_tokens: 2048,
        messages: vec![Message {
            role: "user",
            content: vec![ContentBlock::Text {
                text: &translate_prompt,
            }],
        }],
    };

    let english_transcript = call_claude(&client, &api_key, &stage2_request).await?;

    Ok(TranscriptionResult {
        raw_transcript,
        english_transcript,
    })
}
