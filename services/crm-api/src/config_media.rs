//! Private file storage settings (docs/media-storage.md, packet F1): an S3-compatible
//! bucket. Optional: without it the CRM offers no uploads. The secret never reaches the
//! browser, logs or the database. Outside local development the endpoint must be HTTPS.
#[derive(Clone)]
pub struct MediaConfig {
    /// `scheme://host[:port]`, no trailing slash; path-style bucket addressing.
    pub endpoint: String,
    pub bucket: String,
    pub region: String,
    pub access_key: String,
    pub secret_key: String,
}

/// Reads `CRM_MEDIA_*` from the environment.
pub fn from_env(local: bool) -> Result<Option<MediaConfig>, String> {
    let var = |name: &str| std::env::var(name).ok();
    media_config(
        var("CRM_MEDIA_ENDPOINT"),
        var("CRM_MEDIA_BUCKET"),
        var("CRM_MEDIA_REGION"),
        var("CRM_MEDIA_ACCESS_KEY"),
        var("CRM_MEDIA_SECRET_KEY"),
        local,
    )
}

pub fn media_config(
    endpoint: Option<String>,
    bucket: Option<String>,
    region: Option<String>,
    access_key: Option<String>,
    secret_key: Option<String>,
    local: bool,
) -> Result<Option<MediaConfig>, String> {
    let given = |value: Option<String>| {
        value
            .map(|text| text.trim().to_owned())
            .filter(|t| !t.is_empty())
    };
    let values = [
        given(endpoint),
        given(bucket),
        given(access_key),
        given(secret_key),
    ];
    let set = values.iter().filter(|value| value.is_some()).count();
    if set == 0 {
        return Ok(None);
    }
    let [Some(endpoint), Some(bucket), Some(access_key), Some(secret_key)] = values else {
        return Err("CRM_MEDIA_ENDPOINT, CRM_MEDIA_BUCKET, CRM_MEDIA_ACCESS_KEY and CRM_MEDIA_SECRET_KEY go together.".into());
    };
    let endpoint = endpoint.trim_end_matches('/').to_owned();
    let parsed = url::Url::parse(&endpoint).map_err(|_| "CRM_MEDIA_ENDPOINT must be a URL.")?;
    let scheme_ok = parsed.scheme() == "https" || (local && parsed.scheme() == "http");
    if !scheme_ok || parsed.path() != "/" || parsed.query().is_some() {
        return Err("CRM_MEDIA_ENDPOINT must be an https:// origin (http:// only locally).".into());
    }
    let bucket_ok = (3..=63).contains(&bucket.len())
        && bucket
            .bytes()
            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-');
    if !bucket_ok {
        return Err("CRM_MEDIA_BUCKET must be 3–63 lower-case letters, digits or hyphens.".into());
    }
    if secret_key.len() < 16 {
        return Err("CRM_MEDIA_SECRET_KEY must be at least 16 characters.".into());
    }
    Ok(Some(MediaConfig {
        endpoint,
        bucket,
        region: given(region).unwrap_or_else(|| "us-east-1".into()),
        access_key,
        secret_key,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn some(value: &str) -> Option<String> {
        Some(value.into())
    }

    fn config(endpoint: &str, local: bool) -> Result<Option<MediaConfig>, String> {
        media_config(
            some(endpoint),
            some("crm-media"),
            None,
            some("key"),
            some("a-long-enough-secret"),
            local,
        )
    }

    #[test]
    fn storage_is_optional_complete_and_https_outside_local() {
        assert!(media_config(None, None, None, None, None, false)
            .unwrap()
            .is_none());
        assert!(media_config(some("https://s3.test"), None, None, None, None, false).is_err());
        assert!(config("https://s3.me-central-1.example", false)
            .unwrap()
            .is_some());
        assert!(config("http://127.0.0.1:8333", false).is_err());
        assert!(config("http://127.0.0.1:8333", true).unwrap().is_some());
        assert!(config("https://s3.test/path", false).is_err());
        let short = media_config(
            some("https://s3.test"),
            some("b-b"),
            None,
            some("k"),
            some("x"),
            false,
        );
        assert!(short.is_err());
    }
}
