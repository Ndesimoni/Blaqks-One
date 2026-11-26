//! `GET /agreements/{id}/certificate` (docs/agreements-a3b.md, design §14 A3b, owner
//! decision 3): the evidence file of an offered agreement for its two participants and
//! their companies' Admins under the usual read rule; everyone else gets the usual
//! not-found and the Super Admin is refused. One read-only snapshot gives the stable
//! `evidence` block, a separate `display` block (names, companies, `generatedAt`) and the
//! recipe for recomputing each digest. Served as a JSON attachment, never cached or sniffed.
use super::{access, certificate_store, model::State as AgreementState, parties, store};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    state::AppState,
};
use axum::{
    extract::{Path, State},
    http::{header, HeaderMap, HeaderValue},
    Json,
};
use serde_json::{json, Value};
use sqlx::{Postgres, Transaction};
use time::{format_description::well_known::Rfc3339, OffsetDateTime};
use uuid::Uuid;

pub const NOT_OFFERED: &str = "A certificate is available once the offer is sent.";
pub const DIGEST_INSTRUCTIONS: &str = "Each revision digest is the lowercase hexadecimal \
SHA-256 of one compact JSON object with its keys sorted at every level and no spaces. \
Digest scheme 2: {\"agreementId\", \"author\", \"parentId\", \"revision\", \"scheme\": 2, \
\"terms\"}, where author is the revision's authorParty, parentId its parentId (or null), \
revision its number and terms its terms exactly as listed. Digest scheme 1, for older \
revisions: the same object without author and scheme. An acceptance or approval stores the \
digest of the revision it accepts as acceptedDigest.";

/// Both parties' names and companies, every named person's name and the time made.
async fn display(
    tx: &mut Transaction<'_, Postgres>,
    row: &super::rows::AgreementRow,
    actors: &[Uuid],
) -> ApiResult<Value> {
    let view = parties::views(tx, std::slice::from_ref(row)).await?.pop();
    let people: Vec<(Uuid, String)> =
        sqlx::query_as("SELECT id,name FROM crm_all_user_profiles WHERE id=ANY($1) ORDER BY id")
            .bind(actors)
            .fetch_all(&mut **tx)
            .await?;
    let now = OffsetDateTime::now_utc()
        .replace_nanosecond(0)
        .unwrap_or(OffsetDateTime::UNIX_EPOCH);
    Ok(json!({
        "generatedAt": now.format(&Rfc3339).unwrap_or_default(),
        "agreement": {"parties": view.map_or(Value::Null, |view| view["parties"].clone())},
        "actors": people.into_iter().map(|(id, name)| json!({"id": id, "name": name}))
            .collect::<Vec<_>>(),
    }))
}

pub async fn read(
    State(state): State<AppState>,
    session: Session,
    Path((workspace, id)): Path<(String, String)>,
) -> ApiResult<(HeaderMap, Json<Value>)> {
    access::ensure_reader(&state, &session, &workspace).await?;
    let id = access::id(&id)?;
    let mut tx = state.pool.begin().await?;
    sqlx::query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
        .execute(&mut *tx)
        .await?;
    let row = store::load(&mut tx, id)
        .await?
        .filter(|row| access::can_read(row, &session, &workspace))
        .ok_or_else(ApiError::missing)?;
    if row.state() == AgreementState::Draft {
        return Err(ApiError::conflict(NOT_OFFERED));
    }
    let evidence = certificate_store::build(&mut tx, &row).await?;
    let display = display(&mut tx, &row, &evidence.actors).await?;
    tx.commit().await?;
    let mut headers = HeaderMap::new();
    let file = format!("attachment; filename=\"agreement-{id}-evidence.json\"");
    let disposition = HeaderValue::from_str(&file).map_err(|_| ApiError::missing())?;
    headers.insert(header::CONTENT_DISPOSITION, disposition);
    headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    headers.insert(
        header::X_CONTENT_TYPE_OPTIONS,
        HeaderValue::from_static("nosniff"),
    );
    let body = json!({"evidence": evidence.value, "display": display,
        "digestInstructions": DIGEST_INSTRUCTIONS});
    Ok((headers, Json(body)))
}
