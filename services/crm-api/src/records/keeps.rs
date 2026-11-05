//! Read-only keeps of handed-over records (agreements design §18, H3 amendments 4–7).
//! When a deal hand-over moves the client and property, the sender keeps reading them
//! (`handed_over`); a listing that stays with the sender is shared with the receiver
//! (`shared`); a colleague who accepts a share keeps that record (`colleague`,
//! docs/record-sharing.md R1). A keep covers that one row: it shows in the record list and
//! its photos, never in writes, pickers, recipients, children or projections.
use crate::error::ApiResult;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub use super::keeps_list::{listed, readable, KeptRow};

type Tx<'c> = Transaction<'c, Postgres>;

/// One keep, written in the transaction that moves the deal.
pub struct NewKeep<'a> {
    pub workspace: &'a str,
    pub record: Uuid,
    pub member: Uuid,
    pub other: Uuid,
    /// `handed_over` or `shared`.
    pub reason: &'static str,
    pub deal_ref: &'a str,
    pub referral_share_bp: Option<i32>,
}

/// Records the keep; a later hand-over of the same record to the same member replaces it.
/// An open colleague share of the record to that member ends first (R1 amendment 6), so
/// a hand-over never fails on a colleague's copy.
pub async fn insert(tx: &mut Tx<'_>, keep: &NewKeep<'_>) -> ApiResult<()> {
    super::shares::end_to(tx, keep.record, keep.member).await?;
    let kind = match keep.referral_share_bp {
        Some(_) => "referral",
        None => "full",
    };
    sqlx::query(
        "INSERT INTO crm_record_keeps (workspace_id,record_id,member_id,other_id,reason, \
         deal_ref,kind,referral_share_bp) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) \
         ON CONFLICT (record_id,member_id) DO UPDATE SET other_id=EXCLUDED.other_id, \
         reason=EXCLUDED.reason,deal_ref=EXCLUDED.deal_ref,kind=EXCLUDED.kind, \
         referral_share_bp=EXCLUDED.referral_share_bp,share_id=NULL,created_at=now()",
    )
    .bind(keep.workspace)
    .bind(keep.record)
    .bind(keep.member)
    .bind(keep.other)
    .bind(keep.reason)
    .bind(keep.deal_ref)
    .bind(kind)
    .bind(keep.referral_share_bp)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// A departing member's keeps end with their membership (amendment 6).
pub async fn forget(tx: &mut Tx<'_>, workspace: &str, member: Uuid) -> ApiResult<()> {
    sqlx::query("DELETE FROM crm_record_keeps WHERE workspace_id=$1 AND member_id=$2")
        .bind(workspace)
        .bind(member)
        .execute(&mut **tx)
        .await?;
    Ok(())
}

/// A colleague's view-only copy of an accepted share (R1 amendment 9): a plain insert, so
/// an existing keep of the record is never overwritten.
pub async fn insert_colleague(
    tx: &mut Tx<'_>,
    workspace: &str,
    (share, record): (Uuid, Uuid),
    (member, other): (Uuid, Uuid),
) -> ApiResult<()> {
    sqlx::query(
        "INSERT INTO crm_record_keeps (workspace_id,record_id,member_id,other_id,reason,share_id) \
         VALUES ($1,$2,$3,$4,'colleague',$5)",
    )
    .bind(workspace)
    .bind(record)
    .bind(member)
    .bind(other)
    .bind(share)
    .execute(&mut **tx)
    .await?;
    Ok(())
}
