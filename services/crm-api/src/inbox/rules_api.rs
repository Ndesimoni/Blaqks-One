//! `GET/PUT /inbox/rules`: the company Admin reads and edits the lead rules (plan §2.3).
//! Version 0 means the defaults have never been saved; the first save expects 0.
use super::{
    access,
    rules::{self, Rules, SOURCES},
};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    state::AppState,
    workspaces,
};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::HeaderMap,
    Json,
};
use serde_json::{json, Value};
use std::collections::BTreeSet;

pub const INVALID: &str = "Check the lead rules and try again.";
const RELOAD: &str = "Reload the lead rules and try again.";
const KEYS: [&str; 5] = [
    "expectedVersion",
    "leadMode",
    "autoSources",
    "wordsEn",
    "wordsAr",
];

fn view(rules: &Rules) -> Value {
    json!({"rules": {"leadMode": rules.lead_mode, "autoSources": rules.auto_sources,
        "wordsEn": rules.words_en, "wordsAr": rules.words_ar, "version": rules.version}})
}

fn list(value: Option<&Value>, max_items: usize) -> ApiResult<Vec<String>> {
    let items = value
        .and_then(Value::as_array)
        .ok_or(ApiError::invalid(INVALID))?;
    let mut seen = BTreeSet::new();
    for item in items {
        let word = item.as_str().map(|text| text.trim().to_lowercase());
        match word {
            Some(word) if (1..=60).contains(&word.chars().count()) => seen.insert(word),
            _ => return Err(ApiError::invalid(INVALID)),
        };
    }
    (seen.len() <= max_items)
        .then(|| seen.into_iter().collect())
        .ok_or(ApiError::invalid(INVALID))
}

/// Strict decoding: every key present, known lead mode and sources, 0–100 unique words
/// of 1–60 characters per language.
pub fn parse(body: Value) -> ApiResult<(i64, Rules)> {
    let Value::Object(map) = body else {
        return Err(ApiError::invalid(INVALID));
    };
    if map.len() != KEYS.len() || KEYS.iter().any(|key| !map.contains_key(*key)) {
        return Err(ApiError::invalid(INVALID));
    }
    let version = map["expectedVersion"]
        .as_i64()
        .filter(|v| *v >= 0)
        .ok_or(ApiError::invalid(INVALID))?;
    let lead_mode = map["leadMode"]
        .as_str()
        .filter(|m| ["suggest", "create"].contains(m));
    let auto_sources = list(map.get("autoSources"), SOURCES.len())?;
    if auto_sources
        .iter()
        .any(|source| !SOURCES.contains(&source.as_str()))
    {
        return Err(ApiError::invalid(INVALID));
    }
    let rules = Rules {
        lead_mode: lead_mode.ok_or(ApiError::invalid(INVALID))?.to_owned(),
        auto_sources,
        words_en: list(map.get("wordsEn"), 100)?,
        words_ar: list(map.get("wordsAr"), 100)?,
        version,
    };
    Ok((version, rules))
}

pub async fn get(
    State(state): State<AppState>,
    session: Session,
    Path(workspace): Path<String>,
) -> ApiResult<Json<Value>> {
    access::ensure_admin(&state, &session, &workspace).await?;
    let mut tx = state.pool.begin().await?;
    let rules = rules::load(&mut tx, &workspace).await?;
    tx.commit().await?;
    Ok(Json(view(&rules)))
}

pub async fn put(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(workspace): Path<String>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    access::ensure_admin(&state, &session, &workspace).await?;
    crate::auth::protection::mutation(&state, &headers, &session.csrf_token)?;
    let Json(body) = body.map_err(|_| ApiError::invalid(INVALID))?;
    let (expected, next) = parse(body)?;
    let mut tx = state.pool.begin().await?;
    workspaces::lock(&mut tx, &workspace).await?;
    if access::live(&mut tx, &workspace, session.user.id)
        .await?
        .role
        != "admin"
    {
        return Err(ApiError::forbidden());
    }
    if rules::load(&mut tx, &workspace).await?.version != expected {
        return Err(ApiError::stale(RELOAD));
    }
    sqlx::query(
        "INSERT INTO inbox.crm_inbox_rules \
           (workspace_id,lead_mode,auto_sources,words_en,words_ar,version,updated_by) \
         VALUES ($1,$2,$3,$4,$5,1,$6) \
         ON CONFLICT (workspace_id) DO UPDATE SET lead_mode=$2,auto_sources=$3,words_en=$4, \
           words_ar=$5,version=inbox.crm_inbox_rules.version+1,updated_by=$6,updated_at=now()",
    )
    .bind(&workspace)
    .bind(&next.lead_mode)
    .bind(&next.auto_sources)
    .bind(&next.words_en)
    .bind(&next.words_ar)
    .bind(session.user.id)
    .execute(&mut *tx)
    .await?;
    let saved = rules::load(&mut tx, &workspace).await?;
    tx.commit().await?;
    Ok(Json(view(&saved)))
}

#[cfg(test)]
#[path = "rules_api_tests.rs"]
mod tests;
