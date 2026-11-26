//! Team finance settings (finance-design §6.2, §13 H-F1): the team default split,
//! where a second agent's share comes from, the referral cap and VAT registration.
//! Only the company's Admin changes them; teamView callers read them.
use super::{access, settings_store, wire};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    state::AppState,
};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::HeaderMap,
    Json,
};
use serde_json::{json, Value};
use sqlx::FromRow;
use uuid::Uuid;

const INVALID: &str = "Provide valid finance settings.";
pub const TRN: &str = "Enter a 15-digit TRN.";
pub const STALE: &str = "Finance settings changed. Reload before saving.";
const KEYS: [&str; 6] = [
    "version",
    "agentShareBp",
    "secondAgentSource",
    "maxReferralShareBp",
    "vatRegistered",
    "trn",
];

#[derive(Clone, FromRow)]
pub struct SettingsRow {
    pub id: Uuid,
    pub version: i64,
    pub agent_share_bp: i32,
    pub second_agent_source: String,
    pub max_referral_share_bp: i32,
    pub vat_registered: bool,
    pub vat_rate_bp: i32,
    pub trn: Option<String>,
}

impl SettingsRow {
    /// Team view: the whole configuration.
    pub fn team_view(&self) -> Value {
        json!({"version": self.version, "agentShareBp": self.agent_share_bp,
            "secondAgentSource": self.second_agent_source,
            "maxReferralShareBp": self.max_referral_share_bp,
            "vatRegistered": self.vat_registered, "vatRateBp": self.vat_rate_bp, "trn": self.trn})
    }

    /// Own view (§5.3): never the team default split or the referral cap.
    pub fn own_view(&self) -> Value {
        json!({"vatRegistered": self.vat_registered, "vatRateBp": self.vat_rate_bp,
            "trn": self.trn})
    }
}

/// A validated `PUT /finance/settings` body; `version` is `None` for the first save.
pub struct SettingsInput {
    pub version: Option<i64>,
    pub agent_share_bp: i32,
    pub second_agent_source: &'static str,
    pub max_referral_share_bp: i32,
    pub vat_registered: bool,
    pub trn: Option<String>,
}

fn parse(body: Value) -> ApiResult<SettingsInput> {
    let body = wire::exact(body, &KEYS, INVALID)?;
    let version = match &body["version"] {
        Value::Null => None,
        value => Some(
            value
                .as_i64()
                .filter(|v| *v > 0)
                .ok_or(ApiError::invalid(INVALID))?,
        ),
    };
    let agent_share_bp = wire::bp(&body["agentShareBp"])?;
    let max_referral_share_bp = wire::bp(&body["maxReferralShareBp"])?;
    let second_agent_source = match body["secondAgentSource"].as_str() {
        Some("first_agent") => "first_agent",
        Some("company") => "company",
        _ => {
            return Err(ApiError::invalid(
                "Choose a valid second-agent split source.",
            ))
        }
    };
    let vat_registered = wire::boolean(&body["vatRegistered"], INVALID)?;
    let trn = match &body["trn"] {
        Value::Null => None,
        Value::String(trn) if trn.len() == 15 && trn.bytes().all(|b| b.is_ascii_digit()) => {
            Some(trn.clone())
        }
        _ => return Err(ApiError::invalid(TRN)),
    };
    Ok(SettingsInput {
        version,
        agent_share_bp,
        second_agent_source,
        max_referral_share_bp,
        vat_registered,
        trn,
    })
}

/// `PUT /finance/settings`: Admin role (403 before the body), strict body (400), then
/// the lock, live re-check, version (409) and write with a finance event.
pub async fn save(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(workspace): Path<String>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<Json<Value>> {
    access::manager(&state, &session, &headers, &workspace).await?;
    let Json(body) = body.map_err(|_| ApiError::invalid(INVALID))?;
    let input = parse(body)?;
    let saved = settings_store::save(&state.pool, session.user.id, &workspace, input).await?;
    Ok(Json(json!({"settings": saved.team_view()})))
}
