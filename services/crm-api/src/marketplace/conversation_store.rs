//! Bounded message reads and transactional writes; no bodies in activity or notices.
use crate::error::{ApiError, ApiResult};
use serde_json::{json, Value};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

pub async fn append(
    tx: &mut Transaction<'_, Postgres>,
    room: Uuid,
    author: Uuid,
    body: &str,
) -> ApiResult<Uuid> {
    let count: i64 = sqlx::query_scalar("SELECT count(*) FROM marketplace.crm_market_messages WHERE conversation_id=$1 AND created_at > now()-interval '1 hour'")
        .bind(room).fetch_one(&mut **tx).await?;
    if count >= 60 {
        return Err(ApiError::conflict(
            "This conversation's hourly message limit has been reached.",
        ));
    }
    let id = Uuid::new_v4();
    sqlx::query("INSERT INTO marketplace.crm_market_messages(id,conversation_id,author_id,body) VALUES($1,$2,$3,$4)")
        .bind(id).bind(room).bind(author).bind(body).execute(&mut **tx).await?;
    sqlx::query("UPDATE marketplace.crm_market_conversations SET updated_at=now() WHERE id=$1")
        .bind(room)
        .execute(&mut **tx)
        .await?;
    Ok(id)
}

pub async fn messages(tx: &mut Transaction<'_, Postgres>, room: Uuid) -> ApiResult<Vec<Value>> {
    let rows: Vec<(Uuid, Uuid, String, String)> = sqlx::query_as("SELECT id,author_id,body,created_at::text FROM marketplace.crm_market_messages WHERE conversation_id=$1 ORDER BY created_at DESC,id DESC LIMIT 100")
        .bind(room).fetch_all(&mut **tx).await?;
    Ok(rows
        .into_iter()
        .rev()
        .map(|(id, author, body, at)| json!({"id":id,"authorId":author,"body":body,"createdAt":at}))
        .collect())
}

pub async fn list(
    tx: &mut Transaction<'_, Postgres>,
    request: Uuid,
    actor: Uuid,
    owner: bool,
) -> ApiResult<Vec<Value>> {
    let rows: Vec<(Uuid, Uuid, String)> = sqlx::query_as("SELECT id,broker_id,updated_at::text FROM marketplace.crm_market_conversations WHERE request_id=$1 AND ($3 OR broker_id=$2) ORDER BY updated_at DESC,id DESC LIMIT 50")
        .bind(request).bind(actor).bind(owner).fetch_all(&mut **tx).await?;
    let mut items = Vec::new();
    for (id, broker, at) in rows {
        if let Some(profile) = super::visibility::visible(tx, broker).await? {
            items.push(json!({"id":id,"brokerId":broker,"brokerName":profile.name,"updatedAt":at}));
        }
    }
    Ok(items)
}
