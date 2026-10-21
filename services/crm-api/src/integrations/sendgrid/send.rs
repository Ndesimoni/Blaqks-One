//! Sending one email through the company's SendGrid account (E3b, design §5). Right
//! before the call it re-checks the connection, that the author is live with the email
//! grant, and their active address on the domain; From is always that address. The
//! no-duplicate rule: only an answer proving SendGrid did not accept the mail is retried;
//! a timeout or 5xx after the request left is `Unknown` and never re-sent automatically.
use super::payload::{self, From};
use crate::{
    config::{messaging_settings::MessagingKey, sendgrid_settings::SendgridConfig},
    error::ApiResult,
    integrations::{
        addresses::lookup, credential, google::oauth::client, mail, mailbox, model::ConnectionRow,
    },
    workspaces,
};
use sqlx::PgPool;
use std::time::Duration;

pub async fn send(
    pool: &PgPool,
    key: &MessagingKey,
    config: &SendgridConfig,
    out: &mail::Outgoing<'_>,
    row: &ConnectionRow,
) -> ApiResult<mail::Delivery> {
    let failed = |code| Ok(mail::Delivery::Failed { code });
    let domain = row.external_account_id.as_str();
    let mut tx = pool.begin().await?;
    let author = workspaces::member(&mut tx, out.workspace, out.author).await;
    let allowed = author.is_ok_and(|user| mailbox::may_connect(&user, out.workspace));
    let address = lookup::active(&mut tx, out.workspace, domain, out.author).await?;
    let (true, Some(address)) = (allowed, address) else {
        return failed("sender_unavailable");
    };
    if row.state != "connected" {
        return failed("mailbox_reconnect");
    }
    let api_key = credential::open(&mut tx, key, row).await?;
    tx.commit().await?;
    let Some(api_key) = api_key else {
        return failed("mailbox_reconnect");
    };
    let sender = format!("{}@{domain}", address.local_part);
    let from = From {
        address: &sender,
        name: &address.display_name,
    };
    let rfc = payload::rfc_id(out.message, domain);
    let Some(body) = payload::mail(&out.email, &from, &rfc, out.message) else {
        return failed("invalid_message");
    };
    let sent = client()
        .post(format!("{}/v3/mail/send", config.api_url))
        .bearer_auth(&api_key)
        .json(&body)
        .send()
        .await;
    let response = match sent {
        Ok(response) => response,
        // A refused connection never reached SendGrid; anything later might have.
        Err(error) if error.is_connect() => return retry(None, "provider_unavailable"),
        Err(_) => return unknown(),
    };
    let header = |name: &str| {
        response
            .headers()
            .get(name)
            .and_then(|value| value.to_str().ok())
            .map(str::trim)
            .map(str::to_owned)
    };
    match response.status().as_u16() {
        200..=299 => Ok(mail::Delivery::Sent {
            // SendGrid's ID for its events; the CRM's own ID when the header is missing.
            id: header("x-message-id")
                .filter(|id| bounded(id))
                .unwrap_or_else(|| out.message.to_string()),
            thread_id: rfc.clone(),
            rfc_id: Some(rfc),
        }),
        429 => {
            let after = header("retry-after")
                .and_then(|value| value.parse::<u64>().ok())
                .map(|seconds| Duration::from_secs(seconds.min(3600)));
            retry(after, "rate_limited")
        }
        // Only 401 proves the key no longer works; 403 can be one sender's problem (L1).
        401 => mail::reconnect(pool, out).await,
        400..=499 => failed("provider_refused"),
        _ => unknown(),
    }
}

fn retry(after: Option<Duration>, code: &'static str) -> ApiResult<mail::Delivery> {
    Ok(mail::Delivery::Retry { after, code })
}

fn unknown() -> ApiResult<mail::Delivery> {
    Ok(mail::Delivery::Unknown {
        code: "provider_unclear",
    })
}

fn bounded(id: &str) -> bool {
    (1..=200).contains(&id.len())
        && id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || b"-_.".contains(&byte))
}
