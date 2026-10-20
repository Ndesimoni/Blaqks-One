//! The job a worker holds, what a domain's send reports, and the domain interface.
use std::{future::Future, pin::Pin, time::Duration};
use uuid::Uuid;

/// Claims per job, including the first. Retries happen only before provider acceptance.
pub const MAX_ATTEMPTS: i32 = 5;
pub const LEASE_SECONDS: i64 = 60;
/// Every provider call ends well inside the lease, so a live worker never loses its lease
/// mid-call; only a crash or a hung process leaves an expired lease (SEC-2).
pub const CALL_TIMEOUT: Duration = Duration::from_secs(30);

/// A job this worker owns until its lease expires. `attempts` includes this claim.
#[derive(Clone, Debug, sqlx::FromRow)]
pub struct Job {
    pub id: Uuid,
    pub workspace_id: String,
    pub domain: String,
    pub object_id: Uuid,
    pub attempts: i32,
    pub owner: Uuid,
}

/// A send's result. Codes are fixed snake_case words, never provider text, so no body,
/// address or credential can reach a job row or a log.
#[derive(Clone, Debug, PartialEq)]
pub enum Outcome {
    /// The provider accepted the message; the domain has stored its message ID.
    Sent,
    /// Refused before the provider could have accepted it; safe to try again later.
    Retry {
        after: Option<Duration>,
        code: &'static str,
    },
    /// Permanently refused; a person decides what happens next.
    Failed { code: &'static str },
    /// The provider may have accepted it (timeout, reset, unclear reply): never re-sent
    /// automatically; only provider evidence or a person resolves it.
    Unknown { code: &'static str },
}

impl Outcome {
    /// The attempt row's outcome word.
    pub fn label(&self) -> &'static str {
        match self {
            Self::Sent => "sent",
            Self::Retry { .. } => "retry",
            Self::Failed { .. } => "failed",
            Self::Unknown { .. } => "unknown",
        }
    }
}

pub type SendFuture<'a> = Pin<Box<dyn Future<Output = Outcome> + Send + 'a>>;

/// One sending domain (the Inbox from X3). `send` loads its own object by `object_id`
/// inside the job's workspace and talks to the provider adapter.
pub trait Domain: Send + Sync {
    fn name(&self) -> &'static str;
    fn send<'a>(&'a self, job: &'a Job) -> SendFuture<'a>;
}
