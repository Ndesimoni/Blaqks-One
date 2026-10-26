//! `GET /agreements/listing-shares/{id}/evidence`: the proof of introduction as a JSON
//! attachment (never cached or sniffed). The sender's side gets the whole snapshot, each
//! file's SHA-256, the location salt, the share digest and the history; the agent's side
//! and the receiving Admin get both digests and the history, with the twelve facts while the
//! share is open (none once it closes, R2a security review M1): enough to prove what was
//! acknowledged while the full listing stays with the side that owns it.
use super::{
    access::{self, Caller, Viewer},
    places, read, store, view,
};
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

pub const DIGEST_INSTRUCTIONS: &str = "Each digest is the lowercase hexadecimal SHA-256 of \
one compact JSON object with its keys sorted at every level and no spaces. Snapshot digest: \
{\"exactLocation\", \"facts\", \"files\": [{\"kind\", \"name\", \"sha256\"}], \
\"locationDigest\", \"scheme\": 1}. Location fingerprint: SHA-256 of the salt, the unit \
reference, the address and the map link, one per line. Share digest, stored on acceptance: \
{\"note\", \"recipient\": {\"memberId\", \"workspaceId\"}, \"scheme\": 1, \"sender\": \
{\"memberId\", \"workspaceId\"}, \"sentAt\", \"shareId\", \"snapshotDigest\", \"viewEndsAt\"}, \
where viewEndsAt is acceptedViewEndsAt: the last day as it stood when the agent accepted.";

#[derive(sqlx::FromRow)]
struct Event {
    action: String,
    actor_id: Option<uuid::Uuid>,
    side: Option<String>,
    reason: Option<String>,
    ends_at: Option<String>,
    at: String,
}

pub async fn evidence(
    State(state): State<AppState>,
    session: Session,
    Path((workspace, id)): Path<(String, String)>,
) -> ApiResult<(HeaderMap, Json<Value>)> {
    access::reader(&state, &session, &workspace).await?;
    let id = access::id(&id)?;
    let caller = Caller::of(&session, &workspace);
    let mut tx = state.pool.begin().await?;
    sqlx::query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
        .execute(&mut *tx)
        .await?;
    let row = store::find(&mut tx, id)
        .await?
        .ok_or_else(ApiError::missing)?;
    let place = places::one(&mut tx, &row, &caller)
        .await?
        .ok_or_else(ApiError::missing)?;
    let stamp = |column: &str| {
        format!("to_char({column} AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')")
    };
    let events: Vec<Event> = sqlx::query_as(&format!(
        "SELECT action,actor_id,side,reason,{} AS ends_at,{} AS at \
         FROM agreements.crm_listing_share_events WHERE share_id=$1 ORDER BY created_at,id",
        stamp("ends_at"),
        stamp("created_at"),
    ))
    .bind(id)
    .fetch_all(&mut *tx)
    .await?;
    let shown = read::one_view(&mut tx, &row, &caller).await?;
    tx.commit().await?;
    let snapshot = match place {
        Viewer::Sender => json!({
            "digest": row.snapshot_digest, "scheme": 1, "facts": row.facts,
            "files": row.media.as_array().into_iter().flatten()
                .map(|entry| json!({"kind": entry["kind"], "name": entry["name"],
                    "sha256": entry["sha256"]}))
                .collect::<Vec<_>>(),
            "exactLocation": row.exact_location, "locationDigest": row.location_digest,
            "locationSalt": row.location_salt,
        }),
        _ => {
            let reads = matches!(place, Viewer::Agent | Viewer::AgentAdmin);
            let basic = (reads && row.open() && row.sender_live).then(|| {
                if row.origin == "marketplace" {
                    super::market_view::basic(&row.facts)
                } else {
                    view::basic(&row.facts)
                }
            });
            json!({"digest": row.snapshot_digest, "scheme": 1, "basicFacts": basic})
        }
    };
    // The acknowledged end (review M2); shares accepted before it was kept never moved it
    // without an `extended` event, so their current end is the acknowledged one.
    let extended = events.iter().any(|event| event.action == "extended");
    let accepted = events.iter().find(|event| event.action == "accepted");
    let acknowledged = match accepted.and_then(|event| event.ends_at.clone()) {
        Some(at) => Some(at),
        None if accepted.is_some() && !extended => Some(row.view_ends_at.clone()),
        None => None,
    };
    let events: Vec<Value> = events
        .into_iter()
        .map(|event| {
            json!({"action": event.action, "actorId": event.actor_id, "side": event.side,
            "reason": event.reason, "endsAt": event.ends_at, "at": event.at})
        })
        .collect();
    let body = json!({
        "evidence": {
            "share": {
                "id": row.id, "reference": row.reference, "status": row.status,
                "endReason": row.end_reason,
                "sender": {"workspaceId": row.workspace_id, "memberId": row.from_id},
                "recipient": {"workspaceId": row.recipient_workspace_id, "memberId": row.to_id},
                "sentAt": row.created_at, "offerEndsAt": row.offer_ends_at,
                "viewEndsAt": row.view_ends_at, "acceptedViewEndsAt": acknowledged,
                "decidedAt": row.decided_at,
                "closedAt": row.closed_at, "note": row.note, "acceptedDigest": row.accepted_digest,
            },
            "snapshot": snapshot,
            "events": events,
        },
        "display": {"from": shown["from"], "to": shown["to"], "label": shown["label"]},
        "digestInstructions": DIGEST_INSTRUCTIONS,
    });
    let mut headers = HeaderMap::new();
    let file = format!("attachment; filename=\"listing-share-{id}-evidence.json\"");
    let disposition = HeaderValue::from_str(&file).map_err(|_| ApiError::missing())?;
    headers.insert(header::CONTENT_DISPOSITION, disposition);
    headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    headers.insert(
        header::X_CONTENT_TYPE_OPTIONS,
        HeaderValue::from_static("nosniff"),
    );
    Ok((headers, Json(body)))
}
