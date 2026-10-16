//! `POST /finance/{payments|expenses}/{id}/{approve|reject|void}` (finance-design §4, §6.1,
//! §13 M-F4, M-F6, M-F7). Approve and reject need finance `approve`; void is Admin-only on
//! the Admin path. Every decision takes the workspace lock, re-reads the caller, locks the
//! row and checks its version before the state and separation-of-duties rules.
use super::{
    admin,
    approval_rules::{self, Verdict},
    deals::gate::{self, Need},
    entry::{self, Kind, STALE},
    entry_view,
    events::{self, Action, Changes},
    wire,
};
use crate::{
    auth::{profile::UserRow, session::Session},
    error::{ApiError, ApiResult},
    records::audit,
    state::AppState,
};
use axum::{extract::rejection::JsonRejection, http::HeaderMap, Json};
use serde_json::{json, Value};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

type Body = Result<Json<Value>, JsonRejection>;

impl Verdict {
    fn need(self) -> Need {
        match self {
            Self::Void => Need::Manage,
            _ => Need::Approve,
        }
    }

    /// `(status, finance event, activity action)`.
    fn parts(self) -> (&'static str, Action, &'static str) {
        match self {
            Self::Approve => ("approved", Action::Approved, "approved"),
            Self::Reject => ("rejected", Action::Rejected, "rejected"),
            Self::Void => ("void", Action::Voided, "voided"),
        }
    }
}

pub async fn decide(
    kind: Kind,
    verdict: Verdict,
    state: AppState,
    session: Session,
    headers: HeaderMap,
    (workspace, id): (String, String),
    body: Body,
) -> ApiResult<Json<Value>> {
    gate::writer(&state, &session, &headers, &workspace, verdict.need()).await?;
    let (keys, invalid): (&[&str], _) = match verdict {
        Verdict::Approve => (&["version"], "Provide the record version."),
        _ => (&["version", "reason"], "Provide a version and a reason."),
    };
    let Json(body) = body.map_err(|_| ApiError::invalid(invalid))?;
    let body = wire::exact(body, keys, invalid)?;
    let version = gate::version(&body["version"])?;
    let reason = match verdict {
        Verdict::Approve => None,
        _ => Some(gate::reason(&body["reason"])?),
    };
    let id = gate::id(&id)?;
    let mut tx = state.pool.begin().await?;
    let live = gate::relock(&mut tx, &workspace, session.user.id, verdict.need()).await?;
    apply(
        &mut tx,
        &workspace,
        &live,
        (kind, verdict),
        id,
        version,
        reason,
    )
    .await?;
    let entry = entry_view::entry(&mut tx, &workspace, &live, kind, id).await?;
    tx.commit().await?;
    Ok(Json(json!({ kind.key(): entry })))
}

/// Steps 5–10 under the workspace lock with the live decider: the locked row and its
/// version, the state and separation-of-duties rules, the M-F4 cap and server VAT for
/// payments, the Admin path for voids, then the decision, its event and activity.
pub async fn apply(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    live: &UserRow,
    (kind, verdict): (Kind, Verdict),
    id: Uuid,
    version: i64,
    reason: Option<String>,
) -> ApiResult<()> {
    let (status, action, activity) = verdict.parts();
    let row = entry::locked(tx, workspace, live, kind, id).await?;
    if row.version != version {
        return Err(ApiError::stale(STALE));
    }
    let self_decided = approval_rules::check(verdict, &row, live)?;
    let mut changes = Changes::default().pair("status", row.status.clone(), status);
    let mut vat = None;
    if kind == Kind::Payment && verdict == Verdict::Approve {
        let (deal_ref, before): (String, i64) =
            sqlx::query_as("SELECT deal_ref,vat_fils FROM crm_payments WHERE id=$1")
                .bind(id)
                .fetch_one(&mut **tx)
                .await?;
        let funds = approval_rules::funds(tx, workspace, &deal_ref, Some(id)).await?;
        funds.ensure_room(row.amount_fils)?;
        let after = funds.vat(row.amount_fils, false)?;
        changes = changes.pair("vatFils", before, after);
        vat = Some(after);
    }
    if verdict == Verdict::Void {
        admin::admin_path(tx, live).await?;
    }
    let sql = format!(
        "UPDATE {} SET status=$2,decided_by=$3,decided_at=now(),decision_reason=$4, \
         version=version+1,updated_at=now(){} WHERE id=$1",
        kind.table(),
        if vat.is_some() { ",vat_fils=$5" } else { "" },
    );
    let mut update = sqlx::query(&sql)
        .bind(id)
        .bind(status)
        .bind(live.id)
        .bind(&reason);
    if let Some(vat) = vat {
        update = update.bind(vat);
    }
    update.execute(&mut **tx).await?;
    changes = changes.flag("selfDecided", self_decided);
    let (ws, actor, entity) = (workspace, live.id, kind.entity());
    let reason = reason.as_deref();
    events::append(tx, ws, entity, id, action, actor, changes, reason).await?;
    audit::append(tx, actor, ws, activity, kind.collection(), id).await?;
    Ok(())
}
