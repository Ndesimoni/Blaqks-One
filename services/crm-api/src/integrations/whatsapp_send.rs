//! Sending one WhatsApp message for the Inbox's outbox domain (design §5). Right before the
//! call it re-checks the number (active, the author's, on this connection), the author's
//! live state and grant, the company account and the template, then posts only the
//! allowlisted fields. Results are fixed codes. The no-duplicate rule: only an answer
//! proving Twilio did not accept the message is retried; anything unclear is `Unknown`.
use super::{
    credential, numbers, store, templates, twilio,
    whatsapp::{Content, Outgoing, Sent},
};
use crate::{
    config::{messaging_settings::MessagingKey, twilio_settings::TwilioConfig},
    error::ApiResult,
    workspaces,
};
use sqlx::PgPool;
use twilio::messages;

pub async fn send(
    pool: &PgPool,
    key: &MessagingKey,
    config: &TwilioConfig,
    out: &Outgoing<'_>,
) -> ApiResult<Sent> {
    let failed = |code| Ok(Sent::Failed { code });
    let mut tx = pool.begin().await?;
    let number = super::whatsapp::number(&mut tx, out.workspace, out.number).await?;
    let number = number.filter(|row| {
        row.active && row.member_id == out.author && row.connection_id == out.connection
    });
    let author = workspaces::member(&mut tx, out.workspace, out.author).await;
    let allowed = author.is_ok_and(|user| numbers::may_have(&user, out.workspace));
    let (Some(number), true) = (number, allowed) else {
        return failed("sender_unavailable");
    };
    let row = store::load(&mut tx, out.workspace, out.connection).await?;
    let Some(row) = row.filter(|row| row.provider == "twilio" && row.state == "connected") else {
        return failed("account_reconnect");
    };
    if let Content::Template { sid, variables } = &out.content {
        let found = templates::store::offered_one(&mut tx, out.workspace, row.id, sid).await?;
        if found.is_none_or(|found| found.variable_count as usize != variables.len()) {
            return failed("template_unavailable");
        }
    }
    let token = credential::open(&mut tx, key, &row).await?;
    tx.commit().await?;
    let account = twilio::shape::account_sid(&row.external_account_id).ok();
    let (Some(account), Some(token)) = (account, token) else {
        return failed("account_reconnect");
    };
    let callback = config.public_url.as_ref().map(|base| {
        format!(
            "{base}/api/integrations/webhooks/twilio/{}/status?m={}",
            out.connection, out.message
        )
    });
    let content = match out.content {
        Content::Text(body) => messages::Content::Text(body),
        Content::Template { sid, variables } => messages::Content::Template { sid, variables },
    };
    let request = messages::Send {
        account,
        token: &token,
        from: &number.phone,
        to: out.to,
        content,
        callback,
    };
    let answer = messages::send(config, &request).await;
    super::whatsapp_answer::settle(pool, key, config, out, number.id, answer).await
}
