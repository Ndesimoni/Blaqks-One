//! `users.messages.send` (E1b). The no-duplicate rule (design §5): only an answer proving
//! Gmail did not accept the message may be retried; a timeout, reset, 5xx or unreadable
//! reply after the request left is `Unknown` and is never re-sent automatically.
use super::oauth::client;
use crate::config::google_settings::GoogleConfig;
use serde::Deserialize;
use serde_json::json;
use std::time::Duration;

#[derive(Debug, PartialEq)]
pub enum Sent {
    Accepted {
        id: String,
        thread_id: String,
    },
    /// Refused before acceptance (rate limit, or the connection never opened).
    Retry {
        after: Option<Duration>,
    },
    /// The token no longer works: the mailbox needs reconnecting.
    Unauthorised,
    /// A permanent refusal, such as an invalid recipient.
    Refused,
    Unknown,
}

#[derive(Deserialize)]
struct Accepted {
    id: String,
    #[serde(rename = "threadId")]
    thread_id: String,
}

fn bounded_id(value: &str) -> bool {
    (1..=200).contains(&value.len()) && value.bytes().all(|byte| byte.is_ascii_alphanumeric())
}

pub async fn send(config: &GoogleConfig, token: &str, raw: &str, thread: Option<&str>) -> Sent {
    let mut body = json!({ "raw": raw });
    if let Some(thread) = thread {
        body["threadId"] = json!(thread);
    }
    let sent = client()
        .post(format!(
            "{}/gmail/v1/users/me/messages/send",
            config.gmail_url
        ))
        .bearer_auth(token)
        .json(&body)
        .send()
        .await;
    let response = match sent {
        Ok(response) => response,
        // A refused connection never reached Gmail; anything later might have.
        Err(error) if error.is_connect() => return Sent::Retry { after: None },
        Err(_) => return Sent::Unknown,
    };
    let status = response.status().as_u16();
    match status {
        200..=299 => match super::oauth::read::<Accepted>(Ok(response)).await {
            Ok(accepted) if bounded_id(&accepted.id) && bounded_id(&accepted.thread_id) => {
                Sent::Accepted {
                    id: accepted.id,
                    thread_id: accepted.thread_id,
                }
            }
            _ => Sent::Unknown,
        },
        429 => Sent::Retry {
            after: response
                .headers()
                .get("retry-after")
                .and_then(|value| value.to_str().ok())
                .and_then(|value| value.trim().parse::<u64>().ok())
                .map(|seconds| Duration::from_secs(seconds.min(3600))),
        },
        401 => Sent::Unauthorised,
        400..=499 => Sent::Refused,
        _ => Sent::Unknown,
    }
}

#[cfg(test)]
mod tests {
    use super::bounded_id;

    #[test]
    fn provider_ids_are_plain_and_bounded() {
        assert!(bounded_id("18c2f0a9d3e4b5c6"));
        assert!(!bounded_id(""));
        assert!(!bounded_id("id with space"));
        assert!(!bounded_id(&"a".repeat(201)));
    }
}
