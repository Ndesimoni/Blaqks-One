//! Writing help requests and their messages, inside the caller's transaction.
use crate::error::{ApiError, ApiResult};
use sqlx::{FromRow, Postgres, Transaction};
use uuid::Uuid;

type Tx<'a> = Transaction<'a, Postgres>;

pub(super) async fn insert_request(
    tx: &mut Tx<'_>,
    workspace: &str,
    requester: Uuid,
    category: &str,
    subject: &str,
) -> ApiResult<Uuid> {
    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO support.crm_support_requests \
         (id,workspace_id,requester_id,category,subject) VALUES ($1,$2,$3,$4,$5)",
    )
    .bind(id)
    .bind(workspace)
    .bind(requester)
    .bind(category)
    .bind(subject)
    .execute(&mut **tx)
    .await?;
    Ok(id)
}

pub(super) async fn insert_message(
    tx: &mut Tx<'_>,
    request: Uuid,
    author: Uuid,
    side: &str,
    body: &str,
) -> ApiResult<()> {
    sqlx::query(
        "INSERT INTO support.crm_support_messages (id,request_id,author_id,side,body) \
         VALUES ($1,$2,$3,$4,$5)",
    )
    .bind(Uuid::new_v4())
    .bind(request)
    .bind(author)
    .bind(side)
    .bind(body)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

#[derive(FromRow)]
pub(super) struct Locked {
    pub workspace_id: String,
    pub requester_id: Uuid,
    pub state: String,
    pub version: i64,
    /// Solved more than 30 days ago: the member opens a new request instead.
    pub closed: bool,
}

/// The request, locked for a change; a missing one is not found.
pub(super) async fn lock(tx: &mut Tx<'_>, id: Uuid) -> ApiResult<Locked> {
    sqlx::query_as::<_, Locked>(
        "SELECT workspace_id,requester_id,state,version, \
         (state='solved' AND solved_at < now()-interval '30 days') AS closed \
         FROM support.crm_support_requests WHERE id=$1 FOR UPDATE",
    )
    .bind(id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or_else(ApiError::missing)
}

/// Moves the request to `state` (and the side effects that go with it), bumping its version.
pub(super) async fn set_state(
    tx: &mut Tx<'_>,
    id: Uuid,
    state: &str,
    answered: bool,
) -> ApiResult<()> {
    sqlx::query(
        "UPDATE support.crm_support_requests SET state=$2, updated_at=now(), \
         version=version+1, \
         first_answer_at=CASE WHEN $3 THEN COALESCE(first_answer_at, now()) \
           ELSE first_answer_at END, \
         solved_at=CASE WHEN $2='solved' THEN now() ELSE NULL END WHERE id=$1",
    )
    .bind(id)
    .bind(state)
    .bind(answered)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// The requester has read the thread up to now.
pub(super) async fn mark_read(tx: &mut Tx<'_>, id: Uuid) -> ApiResult<()> {
    sqlx::query("UPDATE support.crm_support_requests SET requester_read_at=now() WHERE id=$1")
        .bind(id)
        .execute(&mut **tx)
        .await?;
    Ok(())
}

/// Assigns (or, with `None`, unassigns) the request.
pub(super) async fn assign(tx: &mut Tx<'_>, id: Uuid, assignee: Option<Uuid>) -> ApiResult<()> {
    sqlx::query(
        "UPDATE support.crm_support_requests SET assignee_id=$2, updated_at=now(), \
         version=version+1 WHERE id=$1",
    )
    .bind(id)
    .bind(assignee)
    .execute(&mut **tx)
    .await?;
    Ok(())
}
