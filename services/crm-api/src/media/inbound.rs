//! Files kept from incoming email (packet F3b, docs/media-storage.md F3 design). The owning
//! module prepares each file (real type, size, metadata removed, fingerprint) without keeping
//! a copy, reserves it inside its own transaction under daily budgets, and the bytes are
//! stored after the commit (`inbound_store.rs`). Media never learns who sent a file: the
//! budgets use two opaque keys from the owning module (security review H2).
use super::{
    naming::{plain_name, typed_name},
    sigv4::sha256_hex,
    sniff::{clean, detect, Kind},
    upload::COMPANY_BYTES,
};
use crate::error::ApiResult;
use sqlx::{Postgres, Transaction};
use std::ops::Range;
use uuid::Uuid;

/// A file part, checked and fingerprinted; its bytes stay in the verified request body.
pub struct Prepared {
    pub name: String,
    pub kind: Kind,
    pub size: i32,
    pub sha256: String,
    pub range: Range<usize>,
}

/// The owning module's budget keys and the items whose files count as duplicates.
pub struct Budget<'a> {
    pub group: Uuid,
    pub sender: &'a str,
    pub dedupe: &'a [Uuid],
}

pub struct Reserved {
    pub id: Uuid,
    pub owner: Uuid,
    pub key: String,
    pub prepared: Prepared,
}

/// One day of inbound files per group (connection) and per sender, and the company headroom.
const GROUP_BYTES: i64 = 1024 * 1024 * 1024;
const GROUP_FILES: i64 = 300;
const SENDER_BYTES: i64 = 100 * 1024 * 1024;
const COMPANY_SHARE: i64 = COMPANY_BYTES / 5 * 4;

/// `None` for anything that is not a supported photo or PDF within its size.
pub fn prepare(name: &str, body: &[u8], range: Range<usize>) -> Option<Prepared> {
    let bytes = body.get(range.clone())?;
    let kind = detect(bytes).filter(|kind| bytes.len() <= kind.max_bytes())?;
    let cleaned = clean(kind, bytes).ok()?;
    Some(Prepared {
        name: typed_name(&plain_name(name), kind.content_type()),
        kind,
        size: i32::try_from(cleaned.len()).ok()?,
        sha256: sha256_hex(&cleaned),
        range,
    })
}

/// Reserves the file for `owner` if every budget allows it; `None` when it is not kept.
pub async fn reserve(
    tx: &mut Transaction<'_, Postgres>,
    workspace: &str,
    uploader: Uuid,
    (kind, owner): (&str, Uuid),
    budget: &Budget<'_>,
    prepared: Prepared,
) -> ApiResult<Option<Reserved>> {
    // One group's files are counted one at a time, so parallel posts cannot both pass.
    sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1::text, 9))")
        .bind(budget.group.to_string())
        .execute(&mut **tx)
        .await?;
    let (files, group_bytes, sender_bytes, company, duplicate): (i64, i64, i64, i64, bool) =
        sqlx::query_as(
            "SELECT count(*) FILTER (WHERE quota_group=$2 AND recent), \
               coalesce(sum(byte_size) FILTER (WHERE quota_group=$2 AND recent),0)::bigint, \
               coalesce(sum(byte_size) FILTER (WHERE quota_key=$3 AND recent),0)::bigint, \
               coalesce(sum(byte_size) FILTER (WHERE deleted_at IS NULL),0)::bigint, \
               coalesce(bool_or(owner_kind=$4 AND owner_id=ANY($5) AND sha256=$6 \
                 AND deleted_at IS NULL),false) \
             FROM (SELECT *, origin='inbound' AND created_at>now()-interval '1 day' AS recent \
               FROM media.crm_media_objects WHERE workspace_id=$1) m",
        )
        .bind(workspace)
        .bind(budget.group)
        .bind(budget.sender)
        .bind(kind)
        .bind(budget.dedupe)
        .bind(&prepared.sha256)
        .fetch_one(&mut **tx)
        .await?;
    let size = i64::from(prepared.size);
    let over = files >= GROUP_FILES
        || group_bytes + size > GROUP_BYTES
        || sender_bytes + size > SENDER_BYTES
        || company + size > COMPANY_SHARE;
    if over || duplicate {
        return Ok(None);
    }
    let (id, key) = (Uuid::new_v4(), Uuid::new_v4().simple().to_string());
    sqlx::query(
        "INSERT INTO media.crm_media_objects (id,workspace_id,uploaded_by,storage_key,file_name, \
           content_type,byte_size,sha256,owner_kind,owner_id,attached_at,origin, \
           storage_pending,quota_group,quota_key) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now(),'inbound',true,$11,$12)",
    )
    .bind(id)
    .bind(workspace)
    .bind(uploader)
    .bind(&key)
    .bind(&prepared.name)
    .bind(prepared.kind.content_type())
    .bind(prepared.size)
    .bind(&prepared.sha256)
    .bind(kind)
    .bind(owner)
    .bind(budget.group)
    .bind(budget.sender)
    .execute(&mut **tx)
    .await?;
    Ok(Some(Reserved {
        id,
        owner,
        key,
        prepared,
    }))
}
