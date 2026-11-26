//! A client's timeline: appended in the transaction that makes the change, never changed
//! afterwards (the database refuses it), and read newest first with the author's name.
use crate::error::ApiResult;
use serde_json::{json, Value};
use sqlx::{FromRow, Postgres, Transaction};
use uuid::Uuid;

/// The newest entries a client read returns.
const SHOWN: i64 = 200;

const SELECT: &str = "SELECT t.id,t.kind,t.body,a.name AS author_name, \
    to_char(t.at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS at \
    FROM platform_clients.crm_platform_client_timeline t \
    LEFT JOIN crm_all_user_profiles a ON a.id=t.author_id";

#[derive(FromRow)]
struct Entry {
    id: Uuid,
    kind: String,
    body: Option<String>,
    author_name: Option<String>,
    at: String,
}

impl Entry {
    fn view(self) -> Value {
        json!({
            "id": self.id,
            "kind": self.kind,
            "body": self.body,
            "authorName": self.author_name,
            "at": self.at,
        })
    }
}

/// Adds one entry; `author` is empty for the website intake and the sign-up link.
pub(super) async fn append(
    tx: &mut Transaction<'_, Postgres>,
    client: Uuid,
    kind: &str,
    body: Option<&str>,
    author: Option<Uuid>,
) -> ApiResult<Uuid> {
    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO platform_clients.crm_platform_client_timeline \
         (id,client_id,kind,body,author_id) VALUES ($1,$2,$3,$4,$5)",
    )
    .bind(id)
    .bind(client)
    .bind(kind)
    .bind(body)
    .bind(author)
    .execute(&mut **tx)
    .await?;
    Ok(id)
}

/// One entry, as the log route answers.
pub(super) async fn one(tx: &mut Transaction<'_, Postgres>, id: Uuid) -> ApiResult<Value> {
    let entry = sqlx::query_as::<_, Entry>(&format!("{SELECT} WHERE t.id=$1"))
        .bind(id)
        .fetch_one(&mut **tx)
        .await?;
    Ok(entry.view())
}

/// The client's newest entries, newest first.
pub(super) async fn list(
    tx: &mut Transaction<'_, Postgres>,
    client: Uuid,
) -> ApiResult<Vec<Value>> {
    let entries = sqlx::query_as::<_, Entry>(&format!(
        "{SELECT} WHERE t.client_id=$1 ORDER BY t.at DESC,t.id DESC LIMIT $2"
    ))
    .bind(client)
    .bind(SHOWN)
    .fetch_all(&mut **tx)
    .await?;
    Ok(entries.into_iter().map(Entry::view).collect())
}
