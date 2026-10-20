//! Sealing (docs/messaging-design.md §8): AES-256-GCM with a random nonce and additional
//! data that binds the ciphertext to one company, row, provider and key version
//! (credentials also to their channel). The key comes from the environment and is never
//! stored in the database.
use aes_gcm::{
    aead::{Aead, KeyInit, Payload},
    Aes256Gcm, Nonce,
};
use rand::RngCore;

pub const NONCE_BYTES: usize = 12;
const TAG_BYTES: usize = 16;

pub fn aad(
    workspace: &str,
    connection: &str,
    provider: &str,
    channel: &str,
    key_version: i32,
) -> Vec<u8> {
    bound(
        "integrations.crm_channel_connections",
        &[workspace, connection, provider, channel],
        key_version,
    )
}

/// Binds a staged webhook body to its receipt, so it cannot be replayed into another row.
pub fn staging_aad(workspace: &str, receipt: &str, provider: &str, key_version: i32) -> Vec<u8> {
    bound(
        "integrations.crm_webhook_staging",
        &[workspace, receipt, provider],
        key_version,
    )
}

/// Each part is length-prefixed so no value can shift into its neighbour.
fn bound(table: &str, parts: &[&str], key_version: i32) -> Vec<u8> {
    let mut out = table.as_bytes().to_vec();
    for part in parts {
        out.extend_from_slice(format!(":{}:{part}", part.len()).as_bytes());
    }
    out.extend_from_slice(format!(":v{key_version}").as_bytes());
    out
}

/// `nonce || ciphertext || tag`.
pub fn seal(key: &[u8; 32], aad: &[u8], plain: &[u8]) -> Result<Vec<u8>, &'static str> {
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|_| "encryption key is invalid")?;
    let mut nonce = [0u8; NONCE_BYTES];
    rand::thread_rng().fill_bytes(&mut nonce);
    let encrypted = cipher
        .encrypt(Nonce::from_slice(&nonce), Payload { msg: plain, aad })
        .map_err(|_| "credential encryption failed")?;
    let mut sealed = nonce.to_vec();
    sealed.extend_from_slice(&encrypted);
    Ok(sealed)
}

pub fn open(key: &[u8; 32], aad: &[u8], sealed: &[u8]) -> Result<Vec<u8>, &'static str> {
    if sealed.len() < NONCE_BYTES + TAG_BYTES {
        return Err("sealed credential is invalid");
    }
    let (nonce, body) = sealed.split_at(NONCE_BYTES);
    Aes256Gcm::new_from_slice(key)
        .map_err(|_| "encryption key is invalid")?
        .decrypt(Nonce::from_slice(nonce), Payload { msg: body, aad })
        .map_err(|_| "credential decryption failed")
}
