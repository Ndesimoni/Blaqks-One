//! Reading a mailbox (E1c): Gmail's history of messages added to the inbox since a
//! cursor, a message's headers, and — only for mail the Inbox accepts — its full body.
use super::oauth::{bounded, client, Failure};
use crate::config::google_settings::GoogleConfig;
use serde::{de::DeserializeOwned, Deserialize};

/// Pages read per sync round, so one busy mailbox cannot hold the worker.
const MAX_PAGES: usize = 5;

#[derive(Deserialize)]
struct Page {
    #[serde(default)]
    history: Vec<Entry>,
    #[serde(rename = "nextPageToken")]
    next: Option<String>,
    #[serde(rename = "historyId")]
    history_id: String,
}

#[derive(Deserialize)]
struct Entry {
    #[serde(rename = "messagesAdded", default)]
    added: Vec<Added>,
}

#[derive(Deserialize)]
struct Added {
    message: Ref,
}

#[derive(Deserialize)]
struct Ref {
    id: String,
    #[serde(rename = "labelIds", default)]
    labels: Vec<String>,
}

pub enum Changes {
    Added {
        ids: Vec<String>,
        cursor: String,
    },
    /// The cursor is older than Gmail keeps; start again from now.
    Expired,
}

pub(super) async fn get<T: DeserializeOwned>(
    url: String,
    token: &str,
    max: usize,
) -> Result<T, Failure> {
    let response = client()
        .get(url)
        .bearer_auth(token)
        .send()
        .await
        .map_err(|_| Failure::Unavailable)?;
    match response.status().as_u16() {
        200..=299 => {
            serde_json::from_slice(&bounded(response, max).await?).map_err(|_| Failure::Invalid)
        }
        // A token that stopped working mid-round: keep the cursor; the next round's
        // refresh tells revoked from temporary (review E1c L1).
        401 => Err(Failure::Unavailable),
        404 => Err(Failure::Refused),
        _ => Err(Failure::Unavailable),
    }
}

/// Inbox messages added since `cursor`, oldest first, and the cursor to store next.
pub async fn changes(config: &GoogleConfig, token: &str, cursor: &str) -> Result<Changes, Failure> {
    let (mut ids, mut page_token, mut latest) = (Vec::new(), None::<String>, cursor.to_owned());
    for _ in 0..MAX_PAGES {
        let mut url = format!(
            "{}/gmail/v1/users/me/history?startHistoryId={cursor}&historyTypes=messageAdded\
             &labelId=INBOX&maxResults=100",
            config.gmail_url
        );
        if let Some(next) = &page_token {
            url.push_str(&format!("&pageToken={}", urlencode(next)));
        }
        let page: Page = match get(url, token, 1024 * 1024).await {
            Err(Failure::Refused) => return Ok(Changes::Expired),
            other => other?,
        };
        for added in page.history.into_iter().flat_map(|entry| entry.added) {
            let inbox = added.message.labels.iter().any(|label| label == "INBOX");
            if inbox && !ids.contains(&added.message.id) {
                ids.push(added.message.id);
            }
        }
        latest = page.history_id;
        page_token = page.next;
        if page_token.is_none() {
            break;
        }
    }
    Ok(Changes::Added {
        ids,
        cursor: latest,
    })
}

/// The mailbox's current history ID, where a new cursor starts (no older mail is read).
pub async fn current(config: &GoogleConfig, token: &str) -> Result<String, Failure> {
    #[derive(Deserialize)]
    struct Profile {
        #[serde(rename = "historyId")]
        history_id: String,
    }
    let url = format!("{}/gmail/v1/users/me/profile", config.gmail_url);
    let profile: Profile = get(url, token, 64 * 1024).await?;
    Ok(profile.history_id)
}

pub(super) fn urlencode(value: &str) -> String {
    url::form_urlencoded::byte_serialize(value.as_bytes()).collect()
}
