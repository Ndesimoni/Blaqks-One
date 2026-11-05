//! The `v3/mail/send` body (E3b, design §5 and review L6). It is built only from this
//! allowlist: one recipient, the server's From/Reply-To, plain text, the CRM Message-ID
//! and threading headers, the message UUID as the only custom argument, and every kind
//! of tracking switched off. No request field reaches it directly.
use crate::{
    integrations::google::mime::{message_id, plain_address, subject_ok, Email},
    media::contents::File,
};
use base64::{engine::general_purpose::STANDARD, Engine};
use serde_json::{json, Value};
use uuid::Uuid;

pub struct From<'a> {
    pub address: &'a str,
    pub name: &'a str,
}

/// The Message-ID the CRM gives each message: unique, on the company domain.
pub fn rfc_id(message: Uuid, domain: &str) -> String {
    format!("<{message}@{domain}>")
}

/// `None` for anything that is not plainly safe to send.
pub fn mail(
    email: &Email<'_>,
    from: &From<'_>,
    rfc: &str,
    message: Uuid,
    files: &[File],
) -> Option<Value> {
    let parent_ok = email.in_reply_to.is_none_or(message_id);
    if !plain_address(email.to)
        || !plain_address(from.address)
        || !subject_ok(email.subject)
        || !message_id(rfc)
        || !parent_ok
    {
        return None;
    }
    let mut headers = json!({ "Message-ID": rfc });
    if let Some(parent) = email.in_reply_to {
        headers["In-Reply-To"] = json!(parent);
        headers["References"] = json!(parent);
    }
    let sender = json!({ "email": from.address, "name": from.name });
    let mut mail = json!({
        "personalizations": [{ "to": [{ "email": email.to }] }],
        "from": sender,
        "reply_to": sender,
        "subject": email.subject,
        "content": [{ "type": "text/plain", "value": email.body }],
        "headers": headers,
        "custom_args": { "inbox_message": message.to_string() },
        "tracking_settings": {
            "click_tracking": { "enable": false, "enable_text": false },
            "open_tracking": { "enable": false },
            "subscription_tracking": { "enable": false },
            "ganalytics": { "enable": false },
        },
    });
    // F3a: the message's own files; names already end with their stored type's extension.
    if !files.is_empty() {
        let attached: Vec<Value> = files
            .iter()
            .map(|file| {
                json!({
                    "content": STANDARD.encode(&file.bytes),
                    "filename": file.name,
                    "type": file.content_type,
                    "disposition": "attachment",
                })
            })
            .collect();
        mail["attachments"] = json!(attached);
    }
    Some(mail)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn email<'a>(to: &'a str, parent: Option<&'a str>) -> Email<'a> {
        Email {
            to,
            subject: "Your viewing",
            body: "Hello",
            in_reply_to: parent,
        }
    }

    #[test]
    fn only_safe_mail_is_built_with_tracking_off() {
        let id = Uuid::new_v4();
        let rfc = rfc_id(id, "keys.test");
        let from = From {
            address: "aidah@keys.test",
            name: "Aidah",
        };
        let body = mail(&email("c@x.test", Some("<p@x.test>")), &from, &rfc, id, &[]).unwrap();
        assert_eq!(body["headers"]["In-Reply-To"], "<p@x.test>");
        assert_eq!(
            body["custom_args"],
            json!({ "inbox_message": id.to_string() })
        );
        assert_eq!(body["tracking_settings"]["open_tracking"]["enable"], false);
        assert_eq!(
            body["personalizations"][0]["to"].as_array().unwrap().len(),
            1
        );
        assert!(mail(&email("a@x.test, b@y.test", None), &from, &rfc, id, &[]).is_none());
        assert!(mail(
            &email("c@x.test", Some("<p@x>\r\nBcc: z")),
            &from,
            &rfc,
            id,
            &[]
        )
        .is_none());
        let bad = From {
            address: "x@keys.test\r\nBcc: z@y.test",
            name: "X",
        };
        assert!(mail(&email("c@x.test", None), &bad, &rfc, id, &[]).is_none());
    }
}
