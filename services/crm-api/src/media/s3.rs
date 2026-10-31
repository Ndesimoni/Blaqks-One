//! The S3 calls the CRM needs (packet F1): put, bounded get, delete and creating the
//! bucket locally. Path-style URLs, signed with [`super::sigv4`]. Errors are fixed
//! outcomes; no key, secret or body reaches a log or a message.
use super::request::send;
use crate::config::media_settings::MediaConfig;

#[derive(Debug, PartialEq)]
pub enum StorageError {
    Missing,
    Unavailable,
}

fn outcome(status: reqwest::StatusCode) -> Result<(), StorageError> {
    match status.as_u16() {
        200..=299 => Ok(()),
        404 => Err(StorageError::Missing),
        _ => Err(StorageError::Unavailable),
    }
}

pub async fn put(
    config: &MediaConfig,
    key: &str,
    body: Vec<u8>,
    kind: &str,
) -> Result<(), StorageError> {
    let response = send(config, reqwest::Method::PUT, key, body, Some(kind))
        .send()
        .await
        .map_err(|_| StorageError::Unavailable)?;
    outcome(response.status())
}

/// The object's bytes, refusing anything larger than `max`.
pub async fn get(config: &MediaConfig, key: &str, max: usize) -> Result<Vec<u8>, StorageError> {
    let mut response = send(config, reqwest::Method::GET, key, Vec::new(), None)
        .send()
        .await
        .map_err(|_| StorageError::Unavailable)?;
    outcome(response.status())?;
    let mut body = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| StorageError::Unavailable)?
    {
        if body.len() + chunk.len() > max {
            return Err(StorageError::Unavailable);
        }
        body.extend_from_slice(&chunk);
    }
    Ok(body)
}

/// Deleting a missing object is a success: the goal is that it is gone.
pub async fn delete(config: &MediaConfig, key: &str) -> Result<(), StorageError> {
    let response = send(config, reqwest::Method::DELETE, key, Vec::new(), None)
        .send()
        .await
        .map_err(|_| StorageError::Unavailable)?;
    match outcome(response.status()) {
        Err(StorageError::Missing) => Ok(()),
        other => other,
    }
}

/// Creates the bucket when it does not exist (local development and the tests; production
/// buckets are provisioned with their policies in advance).
pub async fn ensure_bucket(config: &MediaConfig) -> Result<(), StorageError> {
    let response = send(config, reqwest::Method::PUT, "", Vec::new(), None)
        .send()
        .await
        .map_err(|_| StorageError::Unavailable)?;
    // 409 means the bucket already exists.
    match response.status().as_u16() {
        200..=299 | 409 => Ok(()),
        _ => Err(StorageError::Unavailable),
    }
}

/// A put after making sure, once per process, that the bucket exists. Creating it first
/// matters: some S3 servers half-create a bucket on a write into a missing one. Best effort,
/// so a provisioned production bucket with a narrower policy still works.
pub async fn put_creating(
    config: &MediaConfig,
    key: &str,
    body: Vec<u8>,
    kind: &str,
) -> Result<(), StorageError> {
    static READY: tokio::sync::OnceCell<()> = tokio::sync::OnceCell::const_new();
    READY
        .get_or_init(|| async {
            let _ = ensure_bucket(config).await;
        })
        .await;
    put(config, key, body, kind).await
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Against the disposable storage container of `npm run test:api`.
    #[tokio::test]
    #[ignore = "needs the test storage container"]
    async fn put_get_and_delete_round_trip() {
        let config = crate::config::media_settings::from_env(true)
            .expect("valid storage settings")
            .expect("the test runner sets CRM_MEDIA_*");
        let key = uuid::Uuid::new_v4().simple().to_string();
        put_creating(
            &config,
            &key,
            b"synthetic bytes".to_vec(),
            "application/pdf",
        )
        .await
        .expect("stored");
        assert_eq!(
            get(&config, &key, 1024).await.expect("read back"),
            b"synthetic bytes"
        );
        assert_eq!(get(&config, &key, 4).await, Err(StorageError::Unavailable));
        delete(&config, &key).await.expect("deleted");
        assert_eq!(get(&config, &key, 1024).await, Err(StorageError::Missing));
    }
}
