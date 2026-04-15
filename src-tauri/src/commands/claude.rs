use serde::{Deserialize, Serialize};
use serde_json::Value;

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

/// Verify that an API key is valid and the account has sufficient credits.
/// Makes a minimal text-only call so it costs almost nothing.
#[tauri::command]
pub async fn verify_api_key(api_key: String) -> Result<(), String> {
    if api_key.trim().is_empty() {
        return Err("No API key provided.".to_string());
    }

    let client = reqwest::Client::new();

    let request = AnthropicRequest {
        model: "claude-haiku-4-5-20251001",
        max_tokens: 5,
        messages: vec![Message {
            role: "user",
            content: vec![ContentBlock::Text { text: "Hi" }],
        }],
    };

    call_claude(&client, api_key.trim(), &request).await?;
    Ok(())
}

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

// ─── Dream analysis ────────────────────────────────────────────────────────────

/// Condensed Jungian archetype reference injected into the analyse prompt.
/// Sourced from public/ARCHETYPES.md — update both if archetypes change.
const ARCHETYPES_REFERENCE: &str = r#"
JUNGIAN ARCHETYPES REFERENCE (use only when clearly present in the dream):
1. The Self (gold) — wholeness, mandalas, luminous figures, divine encounters, circles/quaternity
2. The Shadow (black) — dark pursuer, sinister double, criminal/outcast figure, being chased
3. The Anima/Animus (magenta) — opposite-sex figures that feel fated/uncanny, lover/guide/witch/hero
4. The Persona (red) — losing clothes, wearing masks/uniforms, social embarrassment, performing
5. The Hero (silver) — quests, battles with monsters, rescuing others, overcoming obstacles
6. The Great Mother (pink) — nurturing/devouring mother, earth, ocean, caves, cauldrons, ancient women
7. The Wise Old Man (royal blue) — sage, guru, prophet, elder bearing counsel, wizard, grandfather
8. The Trickster (orange) — clown, shapeshifter, impossible comedy, reversals, absurdist humour
9. The Child (baby blue) — miraculous/endangered infant, gifted child, rebirth symbols, new beginnings
10. The Maiden/Kore (light green) — innocent woman in danger, descent/abduction theme, threshold figures
11. The Father (dark green) — authority figures, kings, judges, law, sky/sun symbols, institutional structures
12. The Lover (dark red) — romantic encounters, intense beauty, passionate creative work, erotic imagery
"#;

#[derive(Serialize, Deserialize)]
pub struct DreamAnalysisResult {
    /// Tag names Claude recommends applying (subset of available_tags, plus new
    /// suggestions that are hard to place in existing ones).
    pub suggested_tag_names: Vec<String>,
    /// Thematic observations Claude generated — ready to paste into analysis notes.
    pub theme_suggestions: String,
}

/// Analyse a dream entry with Claude and return tag suggestions + theme notes.
///
/// The prompt is deliberately structured so Claude returns a compact JSON object,
/// making tag parsing reliable without free-form string matching.
///
/// `available_tags` – JSON-serialised list of `{id, name, category}` so Claude
/// can ground its suggestions in the real tag vocabulary.
#[tauri::command]
pub async fn analyze_dream(
    dream_text: String,
    available_tags: String,  // JSON array of {id, name, category}
    api_key: String,
) -> Result<DreamAnalysisResult, String> {
    if api_key.trim().is_empty() {
        return Err(
            "No Anthropic API key configured. Please add your key in Settings.".to_string(),
        );
    }
    if dream_text.trim().is_empty() {
        return Err("Dream text is empty.".to_string());
    }

    let client = reqwest::Client::new();
    let model = "claude-haiku-4-5-20251001";

    // Validate available_tags is parseable JSON; fall back to empty array.
    let tags_json: Value = serde_json::from_str(&available_tags)
        .unwrap_or(Value::Array(vec![]));

    let system = "You are an expert Jungian dream analyst and symbolic psychologist. \
        Analyse dreams carefully, attending to symbolic imagery, emotional tone, \
        recurring motifs, and archetypal patterns. Frame your analysis as questions into the symbols, themes and emotions present in the dream, rather than trying to provide fixed interpretations. ";

    let user_prompt = format!(
        r#"Analyse the following dream journal entry.

DREAM TEXT:
{dream_text}

AVAILABLE TAGS (use these names when assigning; you may suggest genuinely new names
if no existing tag fits):
{tags_json}

{ARCHETYPES_REFERENCE}

Return ONLY a valid JSON object with exactly these two keys:
{{
  "suggested_tag_names": ["tag_name_1", "tag_name_2", ...],
  "theme_suggestions": "A concise paragraph of thematic observations, symbolic interpretations, and questions worth reflecting on. Write in the analyst voice — direct and exploratory. ONLY if archetypes are clearly and unmistakably present in this dream, name them and explain why at the end of the paragraph — otherwise omit archetype references entirely."
}}

Rules for suggested_tag_names:
- Use existing tag names where possible (exact match, case-insensitive).
- Suggest a new name if no existing tag adequately captures a meaningful or repeated symbol, character, or theme.
- New tag suggestions are welcome for any clearly distinct symbolic element, recurring figure, or emotional quality not already in the list — aim for concise, one-or-two-word names."#,
    );

    let request = AnthropicRequest {
        model,
        max_tokens: 1024,
        messages: vec![Message {
            role: "user",
            content: vec![
                ContentBlock::Text { text: system },
                ContentBlock::Text { text: &user_prompt },
            ],
        }],
    };

    let raw = call_claude(&client, api_key.trim(), &request).await?;

    // Extract JSON from the response (Claude may wrap it in markdown fences)
    let json_str = extract_json(&raw);
    let parsed: DreamAnalysisResult = serde_json::from_str(&json_str)
        .map_err(|e| format!("Failed to parse Claude response as JSON: {e}\nRaw: {raw}"))?;

    Ok(parsed)
}

// ─── AI inline tag detection ──────────────────────────────────────────────────

#[derive(Serialize, Deserialize)]
pub struct InlineTagEntry {
    pub text: String,
    pub tag_name: String,
}

#[derive(Serialize, Deserialize)]
pub struct InlineTagResult {
    pub inline_tags: Vec<InlineTagEntry>,
}

/// Ask Claude to identify which exact words/phrases in the dream text correspond
/// to tags in the available vocabulary.  Returns a list of (phrase → tag_name)
/// pairs that the frontend uses to apply inline highlights.
#[tauri::command]
pub async fn ai_tag_dream(
    dream_text: String,
    available_tags: String,
    api_key: String,
) -> Result<InlineTagResult, String> {
    if api_key.trim().is_empty() {
        return Err("No Anthropic API key configured. Please add your key in Settings.".to_string());
    }
    if dream_text.trim().is_empty() {
        return Err("Dream text is empty.".to_string());
    }

    let client = reqwest::Client::new();
    let model = "claude-haiku-4-5-20251001";

    let tags_json: serde_json::Value = serde_json::from_str(&available_tags)
        .unwrap_or(serde_json::Value::Array(vec![]));

    let user_prompt = format!(
        r#"You are an inline dream-tag annotator.

DREAM TEXT:
{dream_text}

AVAILABLE TAGS (name + aliases):
{tags_json}

Your task: identify specific words or short phrases in the dream text that correspond to the available tags.
Return ONLY a valid JSON object with this structure:
{{
  "inline_tags": [
    {{"text": "exact phrase from dream text", "tag_name": "matching tag name"}},
    ...
  ]
}}

Rules:
- "text" must be the exact substring (case preserved) as it appears in the dream text.
- "tag_name" must be an existing tag name from the list above.
- A tag can appear multiple times if it matches different phrases.
- Match by tag name OR any of the tag's aliases.
- Prefer longer, more specific matches over single common words.
- Omit trivial matches (articles, pronouns, common verbs unless they clearly map to a tag).
- Return an empty array if nothing meaningful matches."#,
    );

    let request = AnthropicRequest {
        model,
        max_tokens: 1024,
        messages: vec![Message {
            role: "user",
            content: vec![ContentBlock::Text { text: &user_prompt }],
        }],
    };

    let raw = call_claude(&client, api_key.trim(), &request).await?;
    let json_str = extract_json(&raw);
    let parsed: InlineTagResult = serde_json::from_str(&json_str)
        .map_err(|e| format!("Failed to parse AI Tag response: {e}\nRaw: {raw}"))?;

    Ok(parsed)
}

/// Strip optional markdown code fences and extract the JSON object.
fn extract_json(s: &str) -> String {
    let s = s.trim();
    // Remove ```json ... ``` or ``` ... ``` wrappers
    let s = if s.starts_with("```") {
        let start = s.find('\n').map(|i| i + 1).unwrap_or(3);
        let end = s.rfind("```").unwrap_or(s.len());
        &s[start..end]
    } else {
        s
    };
    // Find first '{' and last '}'
    let start = s.find('{').unwrap_or(0);
    let end = s.rfind('}').map(|i| i + 1).unwrap_or(s.len());
    s[start..end].to_string()
}
