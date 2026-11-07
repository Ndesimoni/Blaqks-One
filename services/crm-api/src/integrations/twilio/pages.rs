//! Reading Twilio's paged lists (senders, content templates): at most ten pages (design §4
//! and §8), each bounded, and a next-page link followed only when it is another page of the
//! same list on the same host, so the token is never sent anywhere else.
use crate::integrations::google::oauth::{bounded, Failure};
use serde::de::DeserializeOwned;

pub const MAX_PAGES: usize = 10;
/// A page of 50 senders or templates fits well inside this.
const MAX_PAGE_BYTES: usize = 512 * 1024;

/// Whether `next` is another page of `path` on `base`'s origin.
pub fn same_page(base: &str, path: &str, next: &str) -> bool {
    let (Ok(next), Ok(base)) = (url::Url::parse(next), url::Url::parse(base)) else {
        return false;
    };
    next.origin() == base.origin()
        && next.path() == path
        && next.username().is_empty()
        && next.password().is_none()
        && next.fragment().is_none()
}

/// As `oauth::read`, with room for a full page; failures follow `status::failure`.
pub async fn large<T: DeserializeOwned>(
    sent: Result<reqwest::Response, reqwest::Error>,
) -> Result<T, Failure> {
    let response = sent.map_err(|_| Failure::Unavailable)?;
    if let Some(failure) = super::status::failure(response.status()) {
        return Err(failure);
    }
    serde_json::from_slice(&bounded(response, MAX_PAGE_BYTES).await?)
        .map_err(|_| Failure::Unavailable)
}
