mod events;
mod oauth;

use reqwest::{Client, StatusCode};
use std::time::Duration;

pub const SCOPES: &str = "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly";
#[derive(Clone)]
pub struct Google {
    pub client: Client,
    pub token_url: String,
    pub api_url: String,
    pub revoke_url: String,
}
pub struct Failure {
    pub message: String,
    pub reconnect: bool,
}
impl Default for Google {
    fn default() -> Self {
        Self::new()
    }
}
impl Failure {
    fn network() -> Self {
        Self {
            message: "Google Calendar could not be reached. The activity will retry automatically."
                .into(),
            reconnect: false,
        }
    }
    fn auth() -> Self {
        Self {
            message: "Google authorization expired or was revoked. Reconnect your account.".into(),
            reconnect: true,
        }
    }
    fn api(status: StatusCode) -> Self {
        if status == StatusCode::UNAUTHORIZED {
            return Self::auth();
        }
        Self { message: match status {
            StatusCode::FORBIDDEN => "Google denied calendar access. Check the Calendar API and your calendar permissions.",
            StatusCode::TOO_MANY_REQUESTS => "Google Calendar is busy. The activity will retry automatically.",
            _ => "Google Calendar could not save this activity. Check its details or retry.",
        }.into(), reconnect: false }
    }
}
impl Google {
    pub fn new() -> Self {
        Self {
            client: Client::builder()
                .timeout(Duration::from_secs(15))
                .redirect(reqwest::redirect::Policy::none())
                .build()
                .unwrap(),
            token_url: "https://oauth2.googleapis.com/token".into(),
            api_url: "https://www.googleapis.com/calendar/v3".into(),
            revoke_url: "https://oauth2.googleapis.com/revoke".into(),
        }
    }
}
