//! A deal hand-over takes the deal's client and property with it (agreements design §18,
//! H3 amendments 1–7). Called by finance in the transaction that moves the deal, after the
//! workspace, request, deal, member and agreement locks; each record row is locked here.
//! A record moves only when the sender holds it and the receiver may hold its type; the
//! sender then keeps reading it. A listing other live deals use stays with the sender and
//! is shared, read-only, with the receiver. No keep is written for an Admin.
use super::eligibility;
use crate::{
    error::ApiResult,
    inbox,
    records::{
        history::Change,
        keeps::{self, NewKeep},
    },
};
use serde_json::{json, Value};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

type Tx<'c> = Transaction<'c, Postgres>;

/// The deal's records and the hand-over that moves them.
pub struct Follow<'a> {
    pub workspace: &'a str,
    pub actor: Uuid,
    pub from: Uuid,
    pub to: Uuid,
    pub client_ref: &'a str,
    pub property_ref: Option<&'a str>,
    /// Another deal that is not lost, cancelled or earned uses the property (amendment 3).
    pub property_in_use: bool,
    pub deal_ref: &'a str,
    pub referral_share_bp: Option<i32>,
}

async fn locked(
    tx: &mut Tx<'_>,
    f: &Follow<'_>,
    collection: &str,
    legacy: &str,
) -> ApiResult<Option<(Uuid, Option<Uuid>)>> {
    Ok(sqlx::query_as(
        "SELECT id,assignee_id FROM crm_records WHERE workspace_id=$1 AND collection=$2 \
         AND legacy_id=$3 FOR UPDATE",
    )
    .bind(f.workspace)
    .bind(collection)
    .bind(legacy)
    .fetch_optional(&mut **tx)
    .await?)
}

async fn admin(tx: &mut Tx<'_>, member: Uuid) -> ApiResult<bool> {
    let role: Option<String> = sqlx::query_scalar("SELECT role FROM crm_users WHERE id=$1")
        .bind(member)
        .fetch_optional(&mut **tx)
        .await?;
    Ok(role.as_deref() == Some("admin"))
}

/// A keep for `member` unless they are the Admin.
async fn keep(
    tx: &mut Tx<'_>,
    f: &Follow<'_>,
    record: Uuid,
    (member, other): (Uuid, Uuid),
    reason: &'static str,
) -> ApiResult<()> {
    if admin(tx, member).await? {
        return Ok(());
    }
    let keep = NewKeep {
        workspace: f.workspace,
        record,
        member,
        other,
        reason,
        deal_ref: f.deal_ref,
        referral_share_bp: f.referral_share_bp,
    };
    keeps::insert(tx, &keep).await
}

/// Moves one record from the sender to the receiver when it may; `true` when it moved.
async fn moved(
    tx: &mut Tx<'_>,
    f: &Follow<'_>,
    collection: &'static str,
    record: Uuid,
) -> ApiResult<bool> {
    if !eligibility::can_hold(tx, f.workspace, collection, f.to).await? {
        return Ok(false);
    }
    let change = Change {
        workspace: f.workspace,
        record,
        collection,
        from: Some(f.from),
        to: Some(f.to),
        actor: f.actor,
        reason: "handover",
    };
    eligibility::apply(tx, &change, None).await?;
    keep(tx, f, record, (f.from, f.to), "handed_over").await?;
    Ok(true)
}

/// Moves the client (with its conversations) and the property; reports each as `moved`,
/// `shared` or `unchanged`.
pub async fn follow(tx: &mut Tx<'_>, f: &Follow<'_>) -> ApiResult<Value> {
    let mut client = "unchanged";
    if let Some((record, Some(holder))) = locked(tx, f, "Clients", f.client_ref).await? {
        if holder == f.from && moved(tx, f, "Clients", record).await? {
            inbox::handover::follow_client(tx, f.workspace, record, (f.from, f.to), f.actor)
                .await?;
            client = "moved";
        }
    }
    let mut property = "unchanged";
    let found = match f.property_ref {
        Some(legacy) => locked(tx, f, "Properties", legacy).await?,
        None => None,
    };
    if let Some((record, Some(holder))) = found.filter(|(_, holder)| *holder == Some(f.from)) {
        if f.property_in_use {
            keep(tx, f, record, (f.to, holder), "shared").await?;
            property = "shared";
        } else if moved(tx, f, "Properties", record).await? {
            property = "moved";
        }
    }
    Ok(json!({"client": client, "property": property}))
}
