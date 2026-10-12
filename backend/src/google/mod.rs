use crate::store::{now, Calendar, Job, Tokens};
use reqwest::{Client, StatusCode};
use serde_json::{json, Value};
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
    pub async fn exchange(
        &self,
        client_id: &str,
        secret: &str,
        code: &str,
        verifier: &str,
        redirect: &str,
    ) -> Result<Tokens, Failure> {
        let response = self
            .client
            .post(&self.token_url)
            .form(&[
                ("client_id", client_id),
                ("client_secret", secret),
                ("code", code),
                ("code_verifier", verifier),
                ("redirect_uri", redirect),
                ("grant_type", "authorization_code"),
            ])
            .send()
            .await
            .map_err(|_| Failure::network())?;
        if !response.status().is_success() {
            return Err(Failure::auth());
        }
        let body: Value = response.json().await.map_err(|_| Failure::network())?;
        let access = body["access_token"]
            .as_str()
            .filter(|s| !s.is_empty())
            .ok_or_else(Failure::auth)?;
        let refresh = body["refresh_token"]
            .as_str()
            .filter(|s| !s.is_empty())
            .ok_or_else(Failure::auth)?;
        let granted = body["scope"].as_str().unwrap_or("");
        if !SCOPES
            .split_whitespace()
            .all(|scope| granted.split_whitespace().any(|s| s == scope))
        {
            return Err(Failure::auth());
        }
        Ok(Tokens {
            access: access.into(),
            refresh: refresh.into(),
            expires: now() + body["expires_in"].as_i64().unwrap_or(3600),
        })
    }
    pub async fn refresh(
        &self,
        tokens: &mut Tokens,
        client_id: &str,
        secret: &str,
    ) -> Result<(), Failure> {
        if tokens.expires > now() + 60 {
            return Ok(());
        }
        let response = self
            .client
            .post(&self.token_url)
            .form(&[
                ("client_id", client_id),
                ("client_secret", secret),
                ("refresh_token", tokens.refresh.as_str()),
                ("grant_type", "refresh_token"),
            ])
            .send()
            .await
            .map_err(|_| Failure::network())?;
        if !response.status().is_success() {
            return Err(
                if response.status().is_server_error()
                    || response.status() == StatusCode::TOO_MANY_REQUESTS
                {
                    Failure::network()
                } else {
                    Failure::auth()
                },
            );
        }
        let body: Value = response.json().await.map_err(|_| Failure::network())?;
        tokens.access = body["access_token"]
            .as_str()
            .filter(|s| !s.is_empty())
            .ok_or_else(Failure::auth)?
            .into();
        tokens.expires = now() + body["expires_in"].as_i64().unwrap_or(3600);
        Ok(())
    }
    pub async fn calendars(&self, tokens: &Tokens) -> Result<Vec<Calendar>, Failure> {
        let mut calendars = vec![];
        let mut page = String::new();
        for _ in 0..10 {
            let mut url =
                url::Url::parse(&format!("{}/users/me/calendarList", self.api_url)).unwrap();
            url.query_pairs_mut()
                .append_pair("minAccessRole", "writer")
                .append_pair("maxResults", "250");
            if !page.is_empty() {
                url.query_pairs_mut().append_pair("pageToken", &page);
            }
            let response = self
                .client
                .get(url)
                .bearer_auth(&tokens.access)
                .send()
                .await
                .map_err(|_| Failure::network())?;
            if !response.status().is_success() {
                return Err(Failure::api(response.status()));
            }
            let body: Value = response.json().await.map_err(|_| Failure::network())?;
            for item in body["items"].as_array().into_iter().flatten() {
                if matches!(item["accessRole"].as_str(), Some("owner" | "writer")) {
                    if let Some(id) = item["id"].as_str() {
                        calendars.push(Calendar {
                            id: id.into(),
                            summary: item["summary"].as_str().unwrap_or(id).into(),
                        });
                    }
                }
            }
            page = body["nextPageToken"].as_str().unwrap_or("").into();
            if page.is_empty() {
                break;
            }
        }
        Ok(calendars)
    }
    pub async fn apply(&self, tokens: &Tokens, job: &Job) -> Result<Option<String>, Failure> {
        let mut collection = url::Url::parse(&format!("{}/calendars", self.api_url)).unwrap();
        collection
            .path_segments_mut()
            .unwrap()
            .push(&job.calendar_id)
            .push("events");
        let mut target = collection.clone();
        target.path_segments_mut().unwrap().push(&job.google_id);
        let notify = job
            .desired
            .as_ref()
            .is_some_and(|e| !e.attendees.is_empty())
            || job.synced.as_ref().is_some_and(|e| !e.attendees.is_empty());
        target
            .query_pairs_mut()
            .append_pair("sendUpdates", if notify { "all" } else { "none" });
        collection
            .query_pairs_mut()
            .append_pair("sendUpdates", if notify { "all" } else { "none" });
        let Some(event) = &job.desired else {
            if !job.remote_exists {
                return Ok(None);
            }
            let response = self
                .client
                .delete(target)
                .bearer_auth(&tokens.access)
                .send()
                .await
                .map_err(|_| Failure::network())?;
            if response.status().is_success()
                || matches!(response.status(), StatusCode::NOT_FOUND | StatusCode::GONE)
            {
                return Ok(None);
            }
            return Err(Failure::api(response.status()));
        };
        // PUT first handles a successful prior insert whose response was lost.
        let mut response = self
            .client
            .put(target.clone())
            .bearer_auth(&tokens.access)
            .json(&event.google_body())
            .send()
            .await
            .map_err(|_| Failure::network())?;
        if matches!(response.status(), StatusCode::NOT_FOUND | StatusCode::GONE) {
            let mut body = event.google_body();
            body["id"] = json!(job.google_id);
            response = self
                .client
                .post(collection)
                .bearer_auth(&tokens.access)
                .json(&body)
                .send()
                .await
                .map_err(|_| Failure::network())?;
            if response.status() == StatusCode::CONFLICT {
                response = self
                    .client
                    .put(target)
                    .bearer_auth(&tokens.access)
                    .json(&event.google_body())
                    .send()
                    .await
                    .map_err(|_| Failure::network())?;
            }
        }
        if !response.status().is_success() {
            return Err(Failure::api(response.status()));
        }
        let body: Value = response.json().await.map_err(|_| Failure::network())?;
        Ok(body["htmlLink"]
            .as_str()
            .filter(|link| {
                link.starts_with("https://calendar.google.com/")
                    || link.starts_with("https://www.google.com/calendar/")
            })
            .map(String::from))
    }
    pub async fn revoke(&self, tokens: &Tokens) -> Result<(), Failure> {
        let response = self
            .client
            .post(&self.revoke_url)
            .form(&[("token", &tokens.refresh)])
            .send()
            .await
            .map_err(|_| Failure::network())?;
        if response.status().is_success() || response.status() == StatusCode::BAD_REQUEST {
            Ok(())
        } else {
            Err(Failure::network())
        }
    }
}
