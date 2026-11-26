//! One WhatsApp send: `POST /2010-04-01/Accounts/{sid}/Messages.json` (design §5). The form
//! holds only `From`, `To`, then `Body` or `ContentSid` with `ContentVariables` (built here
//! as JSON from the typed values), and `StatusCallback`; nothing else ever comes from
//! input. The answer becomes a fixed outcome, never Twilio's text. Twilio offers no send
//! idempotency, so only an answer proving Twilio did not accept the message is retried.
use super::codes;
use crate::{
    config::twilio_settings::TwilioConfig,
    integrations::google::oauth::{bounded, client},
};
use serde::Deserialize;
use std::time::Duration;

pub enum Content<'a> {
    Text(&'a str),
    Template {
        sid: &'a str,
        variables: &'a [String],
    },
}

pub struct Send<'a> {
    pub account: &'a str,
    pub token: &'a str,
    /// Canonical E.164 numbers, without the `whatsapp:` prefix.
    pub from: &'a str,
    pub to: &'a str,
    pub content: Content<'a>,
    pub callback: Option<String>,
}

#[derive(Debug, PartialEq)]
pub enum Answer {
    /// Twilio accepted it; its `SM…` ID when the answer could be read.
    Accepted(Option<String>),
    RateLimited(Option<Duration>),
    /// 401: the company's token no longer works.
    Refused,
    /// A 4xx refusal with Twilio's error code, if any.
    Rejected(Option<i64>),
    /// The connection was refused before the request left.
    Unreachable,
    /// Timeout, reset, 5xx or anything unclear: Twilio may have accepted it.
    Unclear,
}

#[derive(Deserialize)]
struct Reply {
    sid: Option<String>,
    code: Option<i64>,
}

/// The form fields, in this order; the request allowlist of design §5.
pub fn form(send: &Send<'_>) -> Vec<(&'static str, String)> {
    let mut fields = vec![
        ("From", format!("whatsapp:{}", send.from)),
        ("To", format!("whatsapp:{}", send.to)),
    ];
    match &send.content {
        Content::Text(body) => fields.push(("Body", (*body).to_owned())),
        Content::Template { sid, variables } => {
            let values: serde_json::Map<String, serde_json::Value> = variables
                .iter()
                .enumerate()
                .map(|(index, value)| ((index + 1).to_string(), value.clone().into()))
                .collect();
            fields.push(("ContentSid", (*sid).to_owned()));
            fields.push((
                "ContentVariables",
                serde_json::Value::Object(values).to_string(),
            ));
        }
    }
    if let Some(callback) = &send.callback {
        fields.push(("StatusCallback", callback.clone()));
    }
    fields
}

pub async fn send(config: &TwilioConfig, send: &Send<'_>) -> Answer {
    let url = format!(
        "{}/2010-04-01/Accounts/{}/Messages.json",
        config.api_url, send.account
    );
    let sent = client()
        .post(url)
        .basic_auth(send.account, Some(send.token))
        .form(&form(send))
        .send()
        .await;
    let response = match sent {
        Ok(response) => response,
        Err(error) if error.is_connect() => return Answer::Unreachable,
        Err(_) => return Answer::Unclear,
    };
    let status = response.status().as_u16();
    let after = response
        .headers()
        .get("retry-after")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.trim().parse::<u64>().ok())
        .map(|seconds| Duration::from_secs(seconds.min(3600)));
    let reply: Option<Reply> = match bounded(response, 64 * 1024).await {
        Ok(bytes) => serde_json::from_slice(&bytes).ok(),
        Err(_) => None,
    };
    answer(status, after, reply)
}

fn answer(status: u16, after: Option<Duration>, reply: Option<Reply>) -> Answer {
    match status {
        200..=299 => Answer::Accepted(
            reply
                .and_then(|reply| reply.sid)
                .filter(|sid| codes::message_sid(sid)),
        ),
        429 => Answer::RateLimited(after),
        401 => Answer::Refused,
        400..=499 => Answer::Rejected(reply.and_then(|reply| reply.code)),
        _ => Answer::Unclear,
    }
}

#[cfg(test)]
#[path = "messages_tests.rs"]
mod tests;
