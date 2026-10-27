//! A selected marketplace introduction becomes a sealed, participant-bound agreement draft.
use super::{digest, market_view, store};
use crate::{
    agreements::{
        evidence::Parties, introduction, limits, model::Kind, store as agreements, write,
    },
    auth::profile::UserRow,
    error::{ApiError, ApiResult},
};
use serde_json::{json, Value};
use sqlx::{Postgres, Transaction};
use time::OffsetDateTime;
use uuid::Uuid;

pub async fn draft(
    tx: &mut Transaction<'_, Postgres>,
    share: Uuid,
    user: &UserRow,
    terms: &Value,
) -> ApiResult<Value> {
    let row = store::locked(tx, share)
        .await?
        .ok_or_else(ApiError::missing)?;
    if row.origin != "marketplace"
        || row.to_id != user.id
        || row.recipient_workspace_id != user.workspace_id
    {
        return Err(ApiError::missing());
    }
    if !row.open() || row.paused() {
        return Err(ApiError::conflict(
            "This marketplace offer is no longer available.",
        ));
    }
    agreements::ensure_recipient(tx, &user.workspace_id, &row.workspace_id, row.from_id).await?;
    if let Some(found) = agreement(tx, share, user.id).await? {
        if matches!(
            found["state"].as_str(),
            Some("draft" | "sent" | "accepted" | "completed")
        ) {
            return Err(ApiError::conflict(
                "This offer already has an agreement. Open it in Agreements.",
            ));
        }
    }
    if row.status == "pending" {
        let digest = digest::share(&digest::ShareFacts {
            id: row.id,
            snapshot: &row.snapshot_digest,
            sender: (&row.workspace_id, row.from_id),
            recipient: (&row.recipient_workspace_id, row.to_id),
            sent_at: &row.created_at,
            view_ends_at: &row.view_ends_at,
            note: row.note.as_deref(),
        });
        sqlx::query("UPDATE agreements.crm_listing_shares SET status='accepted',decided_at=clock_timestamp(),accepted_digest=$2 WHERE id=$1")
            .bind(share).bind(digest).execute(&mut **tx).await?;
        store::event(
            tx,
            share,
            "accepted",
            Some((user.id, "recipient")),
            (None, Some(&row.view_ends_at)),
        )
        .await?;
    }
    let row = store::find(tx, share)
        .await?
        .ok_or_else(ApiError::missing)?;
    let property = introduction::property(&market_view::basic(&row.facts), &row.reference);
    let binding = json!({"reference":row.reference,"snapshotDigest":row.snapshot_digest,"sharedAt":row.created_at,"acceptedAt":row.decided_at,"marketplace":true});
    let built = introduction::bound(
        Kind::CoBroking,
        terms,
        &property,
        &binding,
        OffsetDateTime::now_utc(),
    )?;
    limits::ensure(
        tx,
        Kind::CoBroking,
        &built.value,
        (&user.workspace_id, true),
    )
    .await?;
    let parties = Parties {
        sender_workspace: user.workspace_id.clone(),
        sender_member: user.id,
        recipient_workspace: row.workspace_id,
        recipient_member: row.from_id,
    };
    let id = write::insert_draft_from(
        tx,
        &parties,
        ("co_broking", "direct"),
        user.id,
        &built,
        Some(share),
    )
    .await?;
    store::event(
        tx,
        share,
        "converted",
        Some((user.id, "recipient")),
        (None, None),
    )
    .await?;
    Ok(agreements::load(tx, id)
        .await?
        .ok_or_else(ApiError::missing)?
        .view())
}

pub async fn agreement(
    tx: &mut Transaction<'_, Postgres>,
    share: Uuid,
    actor: Uuid,
) -> ApiResult<Option<Value>> {
    let row:Option<(Uuid,String,i64)>=sqlx::query_as("SELECT a.id,CASE WHEN a.state='sent' AND a.expires_at<=clock_timestamp() THEN 'expired' ELSE a.state END,a.version FROM agreements.crm_agreements a WHERE a.listing_share_id=$1 AND EXISTS(SELECT 1 FROM agreements.crm_agreement_participants p WHERE p.agreement_id=a.id AND p.member_id=$2) AND (a.state!='draft' OR a.created_by=$2) ORDER BY a.created_at DESC LIMIT 1")
        .bind(share).bind(actor).fetch_optional(&mut **tx).await?;
    Ok(row.map(|(id, state, version)| json!({"id":id,"state":state,"version":version})))
}

pub async fn preview(
    tx: &mut Transaction<'_, Postgres>,
    share: Uuid,
    user: &UserRow,
) -> ApiResult<Value> {
    let row = store::find(tx, share)
        .await?
        .ok_or_else(ApiError::missing)?;
    if row.origin != "marketplace" || row.to_id != user.id {
        return Err(ApiError::missing());
    }
    Ok(
        json!({"id":share,"reference":row.reference,"coBrokingProperty":introduction::property(&market_view::basic(&row.facts),&row.reference),"from":{"id":row.from_id,"name":row.from_name},"to":{"id":row.to_id,"name":row.to_name}}),
    )
}
