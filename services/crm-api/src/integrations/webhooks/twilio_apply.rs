//! A verified Twilio status callback (design §5, W-M2). The message `m` is looked up joined
//! to its conversation on this connection and company; `To` must be the conversation's
//! client and `From` its number row's phone; a stored `MessageSid` must match, and a new one
//! is kept only if no other message of the connection holds it. The receipt
//! `(connection, status:{sid}:{status})` and the Inbox's forward-only change commit
//! together, so each status applies once; anything that changes nothing rolls back.
use crate::{
    error::ApiResult,
    inbox::send::status as inbox,
    integrations::{
        model::ConnectionRow,
        twilio::{codes, senders},
        whatsapp,
    },
};
use sqlx::PgPool;
use uuid::Uuid;

pub async fn apply(
    pool: &PgPool,
    row: &ConnectionRow,
    message: Uuid,
    params: &[(String, String)],
) -> ApiResult<()> {
    let field = |name: &str| {
        params
            .iter()
            .find(|(known, _)| known == name)
            .map(|(_, value)| value.as_str())
    };
    let raw = field("MessageStatus").unwrap_or("");
    let sid = field("MessageSid").filter(|sid| codes::message_sid(sid));
    let phone = |name| {
        field(name)
            .and_then(|value| value.strip_prefix("whatsapp:"))
            .and_then(senders::e164)
    };
    let (Some(status), Some(sid), Some(to), Some(from)) =
        (codes::Status::parse(raw), sid, phone("To"), phone("From"))
    else {
        return Ok(());
    };
    let reason = (status == codes::Status::Failed)
        .then(|| codes::reason(codes::error_code(field("ErrorCode"))));
    let workspace = row.workspace_id.as_str();
    let mut tx = pool.begin().await?;
    let Some(target) = inbox::target(&mut tx, workspace, row.id, message).await? else {
        return Ok(());
    };
    let number = match target.number {
        Some(id) => whatsapp::number(&mut tx, workspace, id).await?,
        None => None,
    };
    let from_ok =
        number.is_some_and(|number| number.phone == from && number.connection_id == row.id);
    if target.contact_key != to || !from_ok {
        return Ok(());
    }
    match target.provider_id.as_deref() {
        Some(stored) if stored != sid => return Ok(()),
        Some(_) => {}
        None if inbox::sid_taken(&mut tx, workspace, row.id, message, sid).await? => return Ok(()),
        None => {}
    }
    let receipt: Option<Uuid> = sqlx::query_scalar(
        "INSERT INTO integrations.crm_webhook_receipts \
           (id,provider,event_id,workspace_id,connection_id,outcome,processed_at) \
         VALUES ($1,'twilio',$2,$3,$4,'processed',now()) \
         ON CONFLICT (connection_id,event_id) DO NOTHING RETURNING id",
    )
    .bind(Uuid::new_v4())
    .bind(format!("status:{sid}:{raw}"))
    .bind(workspace)
    .bind(row.id)
    .fetch_optional(&mut *tx)
    .await?;
    if receipt.is_none() {
        return Ok(());
    }
    let change = inbox::Change {
        message,
        status: status.as_str(),
        reason,
        sid,
    };
    if inbox::apply(&mut tx, workspace, &change).await? {
        tx.commit().await?;
    }
    Ok(())
}
