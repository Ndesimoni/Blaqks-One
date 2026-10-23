//! `POST /agreements/listing-shares`: sends one listing to one agent at another company, in
//! three steps (review amendment 3), so no lock is held while bytes move:
//! 1. under the locks, check the request, rebuild the snapshot and compare it with the
//!    reviewed preview; reserve photo copies unless this snapshot already exists;
//! 2. copy the photos' bytes, with no transaction open;
//! 3. under the locks again (workspace → listing → members), check everything once more and
//!    write the snapshot (attaching the copies), the share and its `sent` event.
//!
//! Copies left unattached by a refusal or a parallel duplicate are hidden at once.
use super::{
    access::{self, Caller},
    create_checks::{self, Input, CHANGED},
    read, snapshot, snapshot_store, store,
};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    media::{
        copies::{self, Reserved},
        copy_bytes,
    },
    records::outside_facts,
    state::AppState,
};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde_json::{json, Value};
use std::collections::HashMap;
use time::OffsetDateTime;
use uuid::Uuid;

pub async fn create(
    State(state): State<AppState>,
    session: Session,
    headers: HeaderMap,
    Path(workspace): Path<String>,
    body: Result<Json<Value>, JsonRejection>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    access::writer(&state, &session, &headers, &workspace).await?;
    let input = create_checks::parse(body, OffsetDateTime::now_utc())?;
    let mut tx = state.pool.begin().await?;
    let live = access::live(&mut tx, &workspace, session.user.id).await?;
    let outside = outside_facts::shareable(&mut tx, &workspace, &live, input.record).await?;
    let draft = snapshot::draft(&mut tx, &workspace, input.record, outside, input.exact).await?;
    if draft.review != input.preview {
        return Err(ApiError::conflict(CHANGED));
    }
    create_checks::check(&mut tx, &workspace, &live, &input, false).await?;
    let made = snapshot_store::existing(&mut tx, &workspace, input.record, &draft.digest).await?;
    let reserved = match made {
        Some(_) => Vec::new(),
        None => copies::reserve(&mut tx, &workspace, live.id, &draft.plan()).await?,
    };
    tx.commit().await?;
    copy_bytes::store(&state, &reserved).await?;
    let finished = finish(&state, &session, &workspace, &input, &reserved).await;
    // Whatever was not attached (a refusal, or a parallel share made the snapshot first).
    copy_bytes::discard(&state.pool, &copy_bytes::ids(&reserved)).await?;
    Ok((StatusCode::CREATED, Json(json!({ "share": finished? }))))
}

async fn finish(
    state: &AppState,
    session: &Session,
    workspace: &str,
    input: &Input,
    reserved: &[Reserved],
) -> ApiResult<Value> {
    let mut tx = state.pool.begin().await?;
    let live = access::live(&mut tx, workspace, session.user.id).await?;
    let outside = outside_facts::shareable(&mut tx, workspace, &live, input.record).await?;
    let draft = snapshot::draft(&mut tx, workspace, input.record, outside, input.exact).await?;
    if draft.review != input.preview {
        return Err(ApiError::conflict(CHANGED));
    }
    create_checks::check(&mut tx, workspace, &live, input, true).await?;
    let snapshot: Uuid =
        match snapshot_store::existing(&mut tx, workspace, input.record, &draft.digest).await? {
            Some(made) => made,
            None => {
                let copy: HashMap<Uuid, Uuid> = reserved
                    .iter()
                    .map(|copy| (copy.source.id, copy.id))
                    .collect();
                if draft
                    .plan()
                    .iter()
                    .any(|(source, _)| !copy.contains_key(&source.id))
                {
                    return Err(ApiError::conflict(CHANGED));
                }
                let owner = (workspace, input.record, live.id);
                snapshot_store::insert(&mut tx, owner, &draft, &copy).await?
            }
        };
    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO agreements.crm_listing_shares (id,snapshot_id,workspace_id, \
         source_record_id,from_id,recipient_workspace_id,to_id,status,note,created_at, \
         offer_ends_at,view_ends_at) VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8,now(), \
         now() + interval '336 hours',$9::timestamptz)",
    )
    .bind(id)
    .bind(snapshot)
    .bind(workspace)
    .bind(input.record)
    .bind(live.id)
    .bind(&input.to_workspace)
    .bind(input.to)
    .bind(&input.note)
    .bind(&input.view_ends)
    .execute(&mut *tx)
    .await?;
    store::event(&mut tx, id, "sent", Some((live.id, "sender")), (None, None)).await?;
    let row = store::find(&mut tx, id)
        .await?
        .ok_or_else(ApiError::missing)?;
    let share = read::one_view(&mut tx, &row, &Caller::of(session, workspace)).await?;
    tx.commit().await?;
    Ok(share)
}
