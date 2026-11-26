//! Accepts, declines, withdraws or stops a share under the workspace/share/record/member
//! lock order. Every invalid party sees the same not-found response.
use super::{access, locks, rules, store, view::Caller};
use crate::{
    auth::session::Session, error::ApiError, error::ApiResult, records::keeps, state::AppState,
};
use axum::{
    extract::{Path, State},
    http::HeaderMap,
    Json,
};
use serde_json::{json, Value};

#[derive(Clone, Copy)]
enum Action {
    Accept,
    Decline,
    Withdraw,
    Stop,
}

async fn change(
    state: AppState,
    session: Session,
    headers: HeaderMap,
    workspace: String,
    id: String,
    action: Action,
) -> ApiResult<Json<Value>> {
    access::writer(&state, &session, &headers, &workspace).await?;
    let id = access::id(&id)?;
    let mut tx = state.pool.begin().await?;
    let live = access::live(&mut tx, &workspace, session.user.id).await?;
    let caller = Caller::of(&live, &workspace);
    let scope = (!live.has_team_scope()).then_some(live.id);
    let row = store::find(&mut tx, &workspace, scope, id, true)
        .await?
        .filter(|row| row.party(caller))
        .ok_or_else(ApiError::missing)?;
    if row.status == "expired" {
        // Stored once, while the row is still pending; later answers just say so (L1).
        if row.closed_at.is_none() {
            store::set(&mut tx, id, "expired", None).await?;
            tx.commit().await?;
        }
        return Err(ApiError::conflict("This share has expired."));
    }
    let target = rules::target(&mut tx, &workspace, &row.collection, row.record_id).await?;
    locks::members(&mut tx, &[row.from_id, row.to_id]).await?;
    let allowed = match action {
        Action::Accept | Action::Decline => row.status == "pending" && live.id == row.to_id,
        Action::Withdraw => row.status == "pending" && (caller.admin || live.id == row.from_id),
        Action::Stop => {
            row.status == "accepted"
                && (caller.admin || live.id == row.from_id || target.holder == Some(live.id))
        }
    };
    if !allowed {
        return Err(ApiError::conflict(
            "This share action is no longer available.",
        ));
    }
    if matches!(action, Action::Accept) {
        if !rules::sender_still(&mut tx, &workspace, target, row.from_id).await? {
            store::set(&mut tx, id, "ended", None).await?;
            tx.commit().await?;
            return Err(ApiError::conflict("This share is no longer available."));
        }
        if !rules::receivable(
            &mut tx,
            &workspace,
            (&row.collection, target),
            (row.from_id, row.to_id),
        )
        .await?
        {
            store::set(&mut tx, id, "ended", None).await?;
            tx.commit().await?;
            return Err(ApiError::conflict(rules::RECEIVER));
        }
        store::set(&mut tx, id, "accepted", Some(live.id)).await?;
        keeps::insert_colleague(
            &mut tx,
            &workspace,
            (id, row.record_id),
            (row.to_id, row.from_id),
        )
        .await?;
    } else {
        let status = match action {
            Action::Decline => "declined",
            Action::Withdraw => "withdrawn",
            Action::Stop => "stopped",
            Action::Accept => unreachable!(),
        };
        store::set(&mut tx, id, status, Some(live.id)).await?;
    }
    let row = store::find(&mut tx, &workspace, scope, id, false)
        .await?
        .ok_or_else(ApiError::missing)?;
    let share = row.view(caller);
    tx.commit().await?;
    Ok(Json(json!({"share":share})))
}

macro_rules! endpoint {
    ($name:ident, $action:expr) => {
        pub async fn $name(
            State(state): State<AppState>,
            session: Session,
            headers: HeaderMap,
            Path((workspace, id)): Path<(String, String)>,
        ) -> ApiResult<Json<Value>> {
            change(state, session, headers, workspace, id, $action).await
        }
    };
}

endpoint!(accept, Action::Accept);
endpoint!(decline, Action::Decline);
endpoint!(withdraw, Action::Withdraw);
endpoint!(stop, Action::Stop);
