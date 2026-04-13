use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Dream {
    pub id: String,
    pub title: String,
    pub content_html: String,
    pub content_plain: String,
    pub dream_date: String,
    pub created_at: String,
    pub updated_at: String,
    pub is_lucid: bool,
    pub mood_rating: Option<i32>,
    pub clarity_rating: Option<i32>,
    pub meaningfulness_rating: Option<i32>,
    pub waking_life_context: Option<String>,
    pub analysis_notes: Option<String>,
    #[serde(default)]
    pub tags: Vec<Tag>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WordTagAssociation {
    pub tag_id: String,
    pub word: String,
    /// 0-based index of the block (paragraph / heading / list-item).
    #[serde(default)]
    pub paragraph_index: i64,
    /// 'manual' (user selected) or 'auto' (auto-match / AI Tag applied).
    #[serde(default = "default_source")]
    pub source: String,
}

fn default_source() -> String {
    "manual".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TagWordUsage {
    pub dream_id: String,
    pub dream_title: String,
    pub dream_date: String,
    pub word: String,
    pub source: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateDreamInput {
    pub title: String,
    pub content_html: String,
    pub content_plain: String,
    pub dream_date: String,
    pub is_lucid: bool,
    pub mood_rating: Option<i32>,
    pub clarity_rating: Option<i32>,
    pub meaningfulness_rating: Option<i32>,
    pub waking_life_context: Option<String>,
    pub analysis_notes: Option<String>,
    pub tag_ids: Vec<String>,
    #[serde(default)]
    pub word_tag_associations: Vec<WordTagAssociation>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateDreamInput {
    pub id: String,
    pub title: String,
    pub content_html: String,
    pub content_plain: String,
    pub dream_date: String,
    pub is_lucid: bool,
    pub mood_rating: Option<i32>,
    pub clarity_rating: Option<i32>,
    pub meaningfulness_rating: Option<i32>,
    pub waking_life_context: Option<String>,
    pub analysis_notes: Option<String>,
    pub tag_ids: Vec<String>,
    #[serde(default)]
    pub word_tag_associations: Vec<WordTagAssociation>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tag {
    pub id: String,
    pub name: String,
    pub category: TagCategory,
    pub color: String,
    pub description: Option<String>,
    pub usage_count: i32,
    #[serde(default)]
    pub aliases: Vec<String>,
    pub emotive_subcategory: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TagCategory {
    Location,
    Person,
    Symbolic,
    Emotive,
    Custom,
}

impl TagCategory {
    pub fn as_str(&self) -> &'static str {
        match self {
            TagCategory::Location => "location",
            TagCategory::Person => "person",
            TagCategory::Symbolic => "symbolic",
            TagCategory::Emotive => "emotive",
            TagCategory::Custom => "custom",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "location" => TagCategory::Location,
            "person" => TagCategory::Person,
            "symbolic" => TagCategory::Symbolic,
            "emotive" => TagCategory::Emotive,
            _ => TagCategory::Custom,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTagInput {
    pub name: String,
    pub category: TagCategory,
    pub color: String,
    pub description: Option<String>,
    #[serde(default)]
    pub aliases: Vec<String>,
    pub emotive_subcategory: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateTagInput {
    pub id: String,
    pub name: String,
    pub category: TagCategory,
    pub color: String,
    pub description: Option<String>,
    #[serde(default)]
    pub aliases: Vec<String>,
    pub emotive_subcategory: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchQuery {
    pub query: String,
    pub category_filter: Option<TagCategory>,
    pub is_lucid_filter: Option<bool>,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub dreams: Vec<Dream>,
    pub total: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportResult {
    pub exported_count: i32,
    pub vault_path: String,
}
