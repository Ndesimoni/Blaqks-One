//! Files of an incoming company email (packet F3b, docs/media-storage.md F3 design). Only a
//! verified, unspammy sender's files may be kept (review M2), at most 10 per mail, within the
//! daily budgets, and never a file already in the conversation; each is reserved for the
//! stored message inside the intake transaction (M1). Every file not kept is counted, so the
//! thread can say so.
use super::{normalize, send::files::KIND};
use crate::{
    error::ApiResult,
    integrations::webhooks::inbound::Event,
    media::{
        inbound::{reserve, Budget, Prepared, Reserved},
        sigv4::sha256_hex,
    },
    workspaces,
};
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

const MAX_FILES: usize = 10;

/// The prepared files of one mail, and how many could not even be prepared (an unsupported
/// type, too large, unreadable, or file storage not set up).
#[derive(Default)]
pub struct Incoming {
    pub files: Vec<Prepared>,
    pub unkeepable: usize,
}

pub async fn keep(
    tx: &mut Transaction<'_, Postgres>,
    event: &Event,
    message: Uuid,
    incoming: Incoming,
) -> ApiResult<Vec<Reserved>> {
    let total = incoming.files.len() + incoming.unkeepable;
    if total == 0 {
        return Ok(Vec::new());
    }
    let workspace = event.workspace_id.as_str();
    let trusted = (event.message.email.as_ref()).is_some_and(|meta| meta.company && meta.verified);
    let mut reserved = Vec::new();
    if trusted {
        let uploader = workspaces::owner_of(tx, workspace).await?;
        let dedupe: Vec<Uuid> = sqlx::query_scalar(
            "SELECT id FROM inbox.crm_inbox_messages m WHERE m.workspace_id=$1 \
             AND m.conversation_id=(SELECT conversation_id FROM inbox.crm_inbox_messages \
               WHERE id=$2)",
        )
        .bind(workspace)
        .bind(message)
        .fetch_all(&mut **tx)
        .await?;
        // Tied to the company, so a sender's key never matches across companies (review L3).
        let sender = normalize::email(&event.message.from).unwrap_or_default();
        let budget = Budget {
            group: event.connection_id,
            sender: &sha256_hex(format!("{workspace}\n{sender}").as_bytes()),
            dedupe: &dedupe,
        };
        for file in incoming.files.into_iter().take(MAX_FILES) {
            let owner = (KIND, message);
            if let Some(file) = reserve(tx, workspace, uploader, owner, &budget, file).await? {
                reserved.push(file);
            }
        }
    }
    add_not_kept(&mut **tx, message, total - reserved.len()).await?;
    Ok(reserved)
}

/// Counts files that were not kept, including any whose bytes failed to store afterwards.
pub async fn add_not_kept<'c, E: sqlx::Executor<'c, Database = Postgres>>(
    executor: E,
    message: Uuid,
    count: usize,
) -> ApiResult<()> {
    if count == 0 {
        return Ok(());
    }
    sqlx::query(
        "UPDATE inbox.crm_inbox_messages \
         SET files_not_kept=LEAST(files_not_kept+$2,100),has_media=true WHERE id=$1",
    )
    .bind(message)
    .bind(i16::try_from(count.min(100)).unwrap_or(100))
    .execute(executor)
    .await?;
    Ok(())
}

/// After the commit: files whose bytes could not be stored are counted too.
pub async fn stored_failed(pool: &PgPool, message: Uuid, failed: usize) -> ApiResult<()> {
    add_not_kept(pool, message, failed).await
}
