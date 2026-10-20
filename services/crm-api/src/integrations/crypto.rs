//! Credential sealing (docs/messaging-design.md §8): AES-256-GCM with a random nonce
//! and additional data that binds the ciphertext to one company, connection, provider,
//! channel and key version. The key comes from the environment and is never stored in the database.
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
    // Each part is length-prefixed so no value can shift into its neighbour.
    let mut out = b"integrations.crm_channel_connections".to_vec();
    for part in [workspace, connection, provider, channel] {
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

#[allow(dead_code)] // Provider adapters open sealed credentials in W1 and E1.
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
