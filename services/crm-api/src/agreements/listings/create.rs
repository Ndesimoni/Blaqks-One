//! `POST /agreements/listing-shares`: sends one listing to one agent at another company, in
//! three steps (review amendment 3), so no lock is held while bytes move:
//! 1. under the locks, check the request, rebuild the snapshot and compare it with the
//!    reviewed preview; reserve photo copies unless this snapshot already exists;
//! 2. copy the photos' bytes, with no transaction open;
//! 3. under the locks again (workspace → listing → members), check everything once more and
//!    write the snapshot (attaching the copies), the share and its `sent` event.
//!
//! Copies left unattached by a refusal or a parallel duplicate are hidden at once. Steps 2
//! and 3 run as their own task, so a dropped request still attaches or hides what it
//! reserved; a changed listing copies only files no earlier snapshot holds (R2a security
//! review M4–M5).
use super::create_finish::finish;
use super::{
    access,
    create_checks::{self, Input},
    review, snapshot, snapshot_store,
};
use crate::{
    auth::session::Session,
    error::{ApiError, ApiResult},
    media::{copies, copy_bytes},
    records::outside_facts,
    state::AppState,
};
use axum::{
    extract::{rejection::JsonRejection, Path, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde_json::{json, Value};
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
    run(state, session.user.id, workspace, input, None).await
}

pub async fn run(
    state: AppState,
    actor: Uuid,
    workspace: String,
    input: Input,
    market: Option<crate::marketplace::answers_send::Context>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    let mut tx = state.pool.begin().await?;
    let live = access::live(&mut tx, &workspace, actor).await?;
    let outside = outside_facts::shareable(&mut tx, &workspace, &live, input.record).await?;
    if let Some(context) = &market {
        context.check(&mut tx, &live, &outside.facts).await?;
    }
    let draft = snapshot::draft(&mut tx, &workspace, input.record, outside, input.exact).await?;
    review::sendable(&draft, &input)?;
    create_checks::check(&mut tx, &workspace, &live, &input, false).await?;
    let made = snapshot_store::existing(&mut tx, &workspace, input.record, &draft.digest).await?;
    let reserved = match made {
        Some(_) => Vec::new(),
        None => {
            let reused =
                snapshot_store::reusable(&mut tx, &workspace, input.record, &draft).await?;
            let mut plan = draft.plan();
            plan.retain(|(source, _)| !reused.contains_key(&source.id));
            copies::reserve(&mut tx, &workspace, live.id, &plan).await?
        }
    };
    tx.commit().await?;
    let actor = live.id;
    let task = tokio::spawn(async move {
        copy_bytes::store(&state, &reserved).await?;
        let finished = finish(
            &state,
            actor,
            &workspace,
            &input,
            &reserved,
            market.as_ref(),
        )
        .await;
        // Whatever was not attached (a refusal, or a parallel share made the snapshot first).
        copy_bytes::discard(&state.pool, &copy_bytes::ids(&reserved)).await?;
        finished
    });
    let unavailable = ApiError(
        StatusCode::SERVICE_UNAVAILABLE,
        copies::FAILED,
        "copy_failed",
    );
    let share = task.await.map_err(|_| unavailable)??;
    Ok((StatusCode::CREATED, Json(json!({ "share": share }))))
}
