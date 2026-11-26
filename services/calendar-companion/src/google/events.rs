use super::{Failure, Google};
use crate::store::{Calendar, Job, Tokens};
use reqwest::StatusCode;
use serde_json::{json, Value};

impl Google {
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
}
