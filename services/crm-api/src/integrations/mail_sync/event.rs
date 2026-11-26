//! One Gmail message → at most one Inbox event (E1c). Headers first; the body is fetched
//! only when the Inbox says the mail belongs there.
use crate::{
    config::google_settings::GoogleConfig,
    integrations::{
        google::{
            auth_results::authenticated,
            message,
            mime::message_id,
            oauth::Failure,
            parse::{header, is_report, permanent_failure, sender, text},
        },
        webhooks::{
            inbound::{Event, MailRef, Sink},
            message::{EmailMeta, Inbound},
        },
    },
};
use uuid::Uuid;

pub struct Mailbox<'a> {
    pub workspace: &'a str,
    pub connection: Uuid,
    pub owner: Uuid,
    pub address: &'a str,
    pub token: &'a str,
}

pub enum Outcome {
    /// Stored, or not for the Inbox: move on.
    Done,
    /// Gmail or the Inbox could not answer now: keep the cursor and try again later.
    Later,
}

fn subject(value: Option<&str>) -> Option<String> {
    let clean: String = value?
        .chars()
        .filter(|c| !c.is_control())
        .take(200)
        .collect();
    Some(clean.trim().to_owned()).filter(|value| !value.is_empty())
}

pub async fn import(
    google: &GoogleConfig,
    sink: &dyn Sink,
    mail: &Mailbox<'_>,
    id: &str,
) -> Outcome {
    let meta = match message::message(google, mail.token, id, false).await {
        Ok(meta) => meta,
        // Deleted since it arrived, or too large or unreadable to use: skip it, so one
        // message can never hold the mailbox's cursor (review E1c H2).
        Err(Failure::Refused | Failure::Invalid) => return Outcome::Done,
        Err(Failure::Unavailable) => return Outcome::Later,
    };
    let headers = &meta.payload.headers;
    let (name, from) = sender(header(headers, "From").unwrap_or_default());
    // The member's own messages (sent from Gmail) are not client mail.
    if from == mail.address || from.is_empty() {
        return Outcome::Done;
    }
    let verified = authenticated(headers, &from);
    let question = MailRef {
        workspace: mail.workspace,
        connection: mail.connection,
        thread: &meta.thread_id,
        from: &from,
        owner: mail.owner,
        verified,
    };
    match sink.email_relevant(&question).await {
        Ok(true) => {}
        Ok(false) => return Outcome::Done,
        Err(_) => return Outcome::Later,
    }
    let full = match message::message(google, mail.token, id, true).await {
        Ok(full) => full,
        Err(Failure::Refused | Failure::Invalid) => return Outcome::Done,
        Err(Failure::Unavailable) => return Outcome::Later,
    };
    let (body, has_media) = text(&full.payload);
    let headers = &full.payload.headers;
    let email = EmailMeta {
        subject: subject(header(headers, "Subject")),
        rfc_message_id: header(headers, "Message-ID")
            .filter(|value| message_id(value))
            .map(str::to_owned),
        // Only an authenticated, permanent delivery report fails a sent message (M3).
        bounce: verified
            && is_report(header(headers, "Content-Type"))
            && permanent_failure(&full.payload),
        owner: Some(mail.owner),
        verified,
        ..EmailMeta::default()
    };
    let event = Event {
        receipt_id: Uuid::new_v4(),
        workspace_id: mail.workspace.to_owned(),
        connection_id: mail.connection,
        channel: "email".into(),
        message: Inbound {
            thread_id: full.thread_id,
            message_id: full.id,
            from,
            name,
            text: body,
            has_media,
            source: None,
            listing: None,
            email: Some(email),
        },
    };
    match sink.accept(&event).await {
        Err(crate::integrations::webhooks::inbound::SinkError::Retry) => Outcome::Later,
        _ => Outcome::Done,
    }
}
