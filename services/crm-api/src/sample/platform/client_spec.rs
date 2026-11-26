//! How a sample Blaqks One client is written down (`clients_data::CLIENTS`): a constant
//! built step by step, so each client reads as its story.
use super::people::Who;

/// What happened with a client: `(kind, text, days ago, who)`.
pub type Entry = (&'static str, &'static str, i32, Who);

#[derive(Clone, Copy)]
pub struct Client {
    pub company: &'static str,
    pub contact: &'static str,
    /// The last three digits of the placeholder `+971 50 000 0xxx` number.
    pub phone: u16,
    /// The email local part's tag: `contact+<handle>@example.test`.
    pub handle: &'static str,
    pub source: &'static str,
    pub stage: &'static str,
    pub owner: Who,
    /// Days from today (negative is overdue); `None` has no follow-up.
    pub follow_up: Option<i32>,
    pub added_days_ago: i32,
    /// The website form's message, or the notes.
    pub text: &'static str,
    pub history: &'static [Entry],
}

/// A new client from the website form, added today by nobody in particular.
pub const fn client(
    company: &'static str,
    contact: &'static str,
    phone: u16,
    handle: &'static str,
) -> Client {
    Client {
        company,
        contact,
        phone,
        handle,
        source: "website_form",
        stage: "new",
        owner: Who::Nobody,
        follow_up: None,
        added_days_ago: 0,
        text: "",
        history: &[],
    }
}

impl Client {
    pub const fn source(self, source: &'static str) -> Self {
        Self { source, ..self }
    }

    pub const fn stage(self, stage: &'static str, owner: Who, follow_up: Option<i32>) -> Self {
        Self {
            stage,
            owner,
            follow_up,
            ..self
        }
    }

    pub const fn added(self, days_ago: i32, text: &'static str) -> Self {
        Self {
            added_days_ago: days_ago,
            text,
            ..self
        }
    }

    pub const fn history(self, history: &'static [Entry]) -> Self {
        Self { history, ..self }
    }

    pub fn phone_number(&self) -> String {
        format!("+971500000{}", self.phone)
    }

    pub fn email(&self) -> String {
        format!("contact+{}@example.test", self.handle)
    }
}
