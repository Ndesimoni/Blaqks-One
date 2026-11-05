//! One Gmail message (E1c): its headers, or — only for mail the Inbox accepts — its body.
use super::{
    history::{get, urlencode},
    oauth::Failure,
    parse::Part,
};
use crate::config::google_settings::GoogleConfig;
use serde::Deserialize;

const FULL_MESSAGE_BYTES: usize = 2 * 1024 * 1024;

#[derive(Deserialize)]
pub struct Message {
    pub id: String,
    #[serde(rename = "threadId")]
    pub thread_id: String,
    pub payload: Part,
}

/// `format=metadata` (headers only) or `format=full` (with the body).
pub async fn message(
    config: &GoogleConfig,
    token: &str,
    id: &str,
    full: bool,
) -> Result<Message, Failure> {
    let format = if full {
        "full"
    } else {
        "metadata&metadataHeaders=From&metadataHeaders=Subject\
         &metadataHeaders=Message-ID&metadataHeaders=Content-Type\
         &metadataHeaders=Authentication-Results"
    };
    let url = format!(
        "{}/gmail/v1/users/me/messages/{}?format={format}",
        config.gmail_url,
        urlencode(id)
    );
    get(
        url,
        token,
        if full { FULL_MESSAGE_BYTES } else { 64 * 1024 },
    )
    .await
}
