//! Message views with their photos and files (F1) and the members they mention (C3), in one
//! query each for a whole page.
use super::{access::Tx, files::KIND, mentions, messages::Message};
use crate::{error::ApiResult, media::owned};
use serde_json::{json, Value};
use uuid::Uuid;

pub async fn views(tx: &mut Tx<'_>, messages: &[Message]) -> ApiResult<Vec<Value>> {
    let ids: Vec<Uuid> = messages.iter().map(|message| message.id).collect();
    let files = owned::list(tx, KIND, &ids).await?;
    let mentioned = mentions::of(tx, &ids).await?;
    Ok(messages
        .iter()
        .map(|message| {
            let mut view = message.view();
            let attached: Vec<Value> = files
                .iter()
                .filter(|(owner, _)| *owner == message.id)
                .map(|(_, item)| item.view())
                .collect();
            let members: Vec<Value> = mentioned
                .iter()
                .filter(|(owner, _)| *owner == message.id)
                .map(|(_, member)| json!(member))
                .collect();
            view["attachments"] = Value::Array(attached);
            view["mentions"] = Value::Array(members);
            view
        })
        .collect())
}
