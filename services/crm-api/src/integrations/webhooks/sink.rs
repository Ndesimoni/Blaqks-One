//! What the Inbox receives from providers: a verified event, and for email the question
//! whether a message belongs in the Inbox before its body is read (E1c).
use super::message::Inbound;
use std::{future::Future, pin::Pin};
use uuid::Uuid;

/// A verified provider event, parsed into the provider-neutral message. It lives only in
/// memory; the sealed body is deleted once the event is settled.
pub struct Event {
    pub receipt_id: Uuid,
    pub workspace_id: String,
    pub connection_id: Uuid,
    pub channel: String,
    pub message: Inbound,
}

#[derive(Debug, PartialEq)]
pub enum SinkError {
    /// Try again later, up to [`MAX_ATTEMPTS`].
    Retry,
    /// Give up; the code is a fixed snake_case word.
    Permanent(&'static str),
}

pub type SinkFuture<'a> = Pin<Box<dyn Future<Output = Result<(), SinkError>> + Send + 'a>>;

pub type RelevantFuture<'a> = Pin<Box<dyn Future<Output = Result<bool, SinkError>> + Send + 'a>>;

/// Receives verified events. It must be idempotent per receipt.
pub trait Sink: Send + Sync {
    fn accept<'a>(&'a self, event: &'a Event) -> SinkFuture<'a>;
    /// Email only (E1c): whether mail in `thread` from `from` belongs in the Inbox, asked
    /// before its body is fetched. The default accepts nothing.
    fn email_relevant<'a>(&'a self, _mail: &'a MailRef<'a>) -> RelevantFuture<'a> {
        Box::pin(async { Ok(false) })
    }
}

pub struct MailRef<'a> {
    pub workspace: &'a str,
    pub connection: Uuid,
    pub thread: &'a str,
    pub from: &'a str,
    /// The mailbox owner; a new thread may only match records they can see.
    pub owner: Uuid,
    /// Unverified senders may only join a thread the CRM already holds.
    pub verified: bool,
}
