//! `POST …/listing-shares/{id}/co-broking` (docs/record-sharing.md R2): either named person
//! of an accepted, open share proposes a co-broking agreement to the other, as a draft they
//! then send from Agreements. The money terms are the proposer's; the server takes the
//! property from the share's snapshot and binds the introduction into the terms, so every
//! revision's digest names the share. One standing agreement per share (migration 0072).
use super::{access::Viewer, step, store};
use crate::{
    agreements::{
        errors, evidence::Parties, introduction, limits, model::Kind, store as agreements, wire,
        write,
    },
    auth::session::Session,
    error::{ApiError, ApiResult},
    state::AppState,
};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde_json::{json, Value};
use time::OffsetDateTime;

const NOT_ACCEPTED: &str = "Co-broking needs an accepted share that is still open.";
const OWN_DRAFT: &str = "You already have a draft co-broking agreement for this listing.";

pub async fn propose(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(path): Path<(String, String)>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    let (mut step, viewer) = step::open(&state, &session, &headers, path).await?;
    let row = step.row.clone();
    let from_sender = viewer == Some(Viewer::Sender) && step.actor == row.from_id;
    if !from_sender && viewer != Some(Viewer::Agent) {
        return Err(ApiError::missing());
    }
    let Json(body) = body.map_err(|_| ApiError::invalid(wire::INVALID))?;
    let input = wire::exact(body, &["terms"], wire::INVALID)?;
    if row.status != "accepted" {
        step.tx.commit().await?;
        return Err(ApiError::conflict(NOT_ACCEPTED));
    }
    if row.paused() {
        return Err(ApiError::conflict(step::PAUSED));
    }
    let own: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM agreements.crm_agreements \
         WHERE listing_share_id=$1 AND created_by=$2 AND state='draft')",
    )
    .bind(row.id)
    .bind(step.actor)
    .fetch_one(&mut *step.tx)
    .await?;
    if own {
        return Err(ApiError::conflict(OWN_DRAFT));
    }
    let taken: bool = sqlx::query_scalar("SELECT agreements.crm_listing_share_taken($1,NULL)")
        .bind(row.id)
        .fetch_one(&mut *step.tx)
        .await?;
    if taken {
        return Err(ApiError::conflict(errors::SHARE_TAKEN));
    }
    let (other_workspace, other) = match from_sender {
        true => (row.recipient_workspace_id.clone(), row.to_id),
        false => (row.workspace_id.clone(), row.from_id),
    };
    agreements::ensure_recipient(&mut step.tx, &step.workspace, &other_workspace, other).await?;
    let property = introduction::property(&row.facts, &row.reference);
    let bound = json!({
        "reference": row.reference,
        "snapshotDigest": row.snapshot_digest,
        "sharedAt": row.created_at,
        "acceptedAt": row.decided_at,
    });
    let terms = wire::node(&input, "terms")?;
    let now = OffsetDateTime::now_utc();
    let built = introduction::bound(Kind::CoBroking, terms, &property, &bound, now)?;
    let sender = (step.workspace.as_str(), true);
    limits::ensure(&mut step.tx, Kind::CoBroking, &built.value, sender).await?;
    let parties = Parties {
        sender_workspace: step.workspace.clone(),
        sender_member: step.actor,
        recipient_workspace: other_workspace,
        recipient_member: other,
    };
    let kind = (Kind::CoBroking.as_str(), "direct");
    let id = write::insert_draft_from(
        &mut step.tx,
        &parties,
        kind,
        step.actor,
        &built,
        Some(row.id),
    )
    .await?;
    let side = if from_sender { "sender" } else { "recipient" };
    let by = Some((step.actor, side));
    store::event(&mut step.tx, row.id, "converted", by, (None, None)).await?;
    let agreement = agreements::load(&mut step.tx, id)
        .await?
        .ok_or_else(ApiError::missing)?;
    step.tx.commit().await?;
    Ok((
        StatusCode::CREATED,
        Json(json!({ "agreement": agreement.view() })),
    ))
}
