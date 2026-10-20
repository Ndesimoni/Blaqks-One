//! `GET /api/crm/integrations/google/callback`, the one redirect URI registered with
//! Google. The session cookie is `SameSite=Strict`, so it is absent on this cross-site
//! redirect and this handler proves nothing itself. It answers with a small same-origin
//! page that moves on to the app: a document opened straight from another site keeps
//! Strict cookies away from its requests in some browsers (Safari), while one this page
//! opens is same-site everywhere. `state` and `code` travel in the URL fragment, which
//! browsers never send to a server, and the app posts them to `/mailbox/google/finish`
//! with its session and CSRF token.
use super::grant::token_shaped;
use axum::{
    extract::Query,
    http::{header, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
};
use std::collections::HashMap;
use url::form_urlencoded;

pub async fn callback(Query(query): Query<HashMap<String, String>>) -> Response {
    let mut fragment = form_urlencoded::Serializer::new(String::new());
    let returned = |name: &str, max: usize| {
        query
            .get(name)
            .filter(|value| token_shaped(value, max))
            .cloned()
    };
    match (returned("state", 128), returned("code", 1024)) {
        (Some(returned_state), Some(code)) if !query.contains_key("error") => {
            fragment
                .append_pair("state", &returned_state)
                .append_pair("code", &code);
        }
        _ => {
            // Google's own error text is never echoed; the app shows a fixed message.
            let denied = query.get("error").map(String::as_str) == Some("access_denied");
            fragment.append_pair("error", if denied { "denied" } else { "failed" });
        }
    }
    // Form encoding leaves only [A-Za-z0-9%+*._=&-]; `&` is the one character to escape.
    let target = format!("/#/oauth/google?{}", fragment.finish()).replace('&', "&amp;");
    let page = format!(
        "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">\
         <meta http-equiv=\"refresh\" content=\"0;url={target}\">\
         <title>Connecting your mailbox</title></head><body>\
         <p><a href=\"{target}\">Continue to the CRM</a></p></body></html>"
    );
    (
        StatusCode::OK,
        [
            (
                header::CONTENT_TYPE,
                HeaderValue::from_static("text/html; charset=utf-8"),
            ),
            (header::CACHE_CONTROL, HeaderValue::from_static("no-store")),
            (
                header::REFERRER_POLICY,
                HeaderValue::from_static("no-referrer"),
            ),
            (
                header::CONTENT_SECURITY_POLICY,
                HeaderValue::from_static("default-src 'none'; base-uri 'none'"),
            ),
        ],
        page,
    )
        .into_response()
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::to_bytes;

    async fn page(query: &[(&str, &str)]) -> String {
        let map = query
            .iter()
            .map(|(key, value)| (key.to_string(), value.to_string()))
            .collect();
        let response = callback(Query(map)).await;
        let body = to_bytes(response.into_body(), 16 * 1024).await.unwrap();
        String::from_utf8(body.to_vec()).unwrap()
    }

    #[tokio::test]
    async fn the_page_moves_on_in_the_fragment_and_never_echoes_odd_values() {
        let ok = page(&[("state", "s1"), ("code", "4/abc")]).await;
        assert!(ok.contains("url=/#/oauth/google?state=s1&amp;code=4%2Fabc\""));
        let junk = page(&[("state", "<x>"), ("code", "a b"), ("error", "evil")]).await;
        assert!(junk.contains("url=/#/oauth/google?error=failed\""));
        assert!(!junk.contains("<x>") && !junk.contains("evil"));
    }
}
