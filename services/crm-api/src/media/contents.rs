//! The bytes of an item's files, for a module that sends them on (F3a: email attachments).
//! Files are found only by their owner in the owner's company, never by IDs from a request;
//! each must still be stored and match its recorded SHA-256 (F3 review M5, L4).
use super::{naming::typed_name, s3, sigv4::sha256_hex};
use crate::config::media_settings::MediaConfig;
use sqlx::PgPool;
use uuid::Uuid;

pub struct File {
    pub name: String,
    pub content_type: String,
    pub bytes: Vec<u8>,
}

#[derive(Debug, PartialEq)]
pub enum Unreadable {
    /// Storage or the database could not answer now: try again later.
    Unavailable,
    /// A file is gone, hidden or altered: never send without it.
    Missing,
}

pub async fn of_owner(
    pool: &PgPool,
    config: Option<&MediaConfig>,
    workspace: &str,
    kind: &str,
    owner: Uuid,
) -> Result<Vec<File>, Unreadable> {
    // Hidden files are read too, so one removed after queuing fails the send.
    let rows: Vec<(String, String, String, i32, String, bool)> = sqlx::query_as(
        "SELECT storage_key,file_name,content_type,byte_size,sha256,deleted_at IS NOT NULL \
         FROM media.crm_media_objects WHERE workspace_id=$1 AND owner_kind=$2 AND owner_id=$3 \
         ORDER BY attached_at,id",
    )
    .bind(workspace)
    .bind(kind)
    .bind(owner)
    .fetch_all(pool)
    .await
    .map_err(|_| Unreadable::Unavailable)?;
    let mut files = Vec::with_capacity(rows.len());
    for (key, name, content_type, size, sha256, hidden) in rows {
        if hidden {
            return Err(Unreadable::Missing);
        }
        let Some(config) = config else {
            return Err(Unreadable::Unavailable);
        };
        let bytes = match s3::get(config, &key, size.max(0) as usize).await {
            Ok(bytes) => bytes,
            Err(s3::StorageError::Missing) => return Err(Unreadable::Missing),
            Err(s3::StorageError::Unavailable) => return Err(Unreadable::Unavailable),
        };
        if sha256_hex(&bytes) != sha256 {
            return Err(Unreadable::Missing);
        }
        files.push(File {
            name: typed_name(&name, &content_type),
            content_type,
            bytes,
        });
    }
    Ok(files)
}
