use super::Store;
use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use rand::RngCore;
use std::{
    fs::{self, OpenOptions},
    io::Write,
    path::PathBuf,
};

#[derive(Clone)]
pub struct Vault {
    pub path: PathBuf,
    pub key: Option<[u8; 32]>,
}
impl Vault {
    pub fn new(path: PathBuf, key: &str) -> Result<Self, String> {
        let key = if key.is_empty() {
            None
        } else {
            if key.len() != 64 || !key.bytes().all(|b| b.is_ascii_hexdigit()) {
                return Err(
                    "CALENDAR_ENCRYPTION_KEY must contain exactly 64 hexadecimal characters".into(),
                );
            }
            let mut bytes = [0; 32];
            for (i, byte) in bytes.iter_mut().enumerate() {
                *byte = u8::from_str_radix(&key[i * 2..i * 2 + 2], 16).unwrap();
            }
            Some(bytes)
        };
        Ok(Self { path, key })
    }
    pub fn load(&self) -> Result<Store, String> {
        if !self.path.exists() {
            return Ok(Store::default());
        }
        let raw = fs::read(&self.path).map_err(|_| "Calendar store could not be read")?;
        let key = self
            .key
            .ok_or("The existing calendar store requires its original encryption key")?;
        if raw.len() < 32 || &raw[..4] != b"KWS1" {
            return Err("Calendar store is invalid; preserve it for recovery".into());
        }
        let cipher = Aes256Gcm::new_from_slice(&key).unwrap();
        let plain = cipher
            .decrypt(Nonce::from_slice(&raw[4..16]), &raw[16..])
            .map_err(|_| "Calendar store could not be decrypted; check its encryption key")?;
        serde_json::from_slice(&plain).map_err(|_| "Calendar store contents are invalid".into())
    }
    pub fn save(&self, store: &Store) -> Result<(), String> {
        let Some(key) = self.key else {
            return Ok(());
        };
        let cipher = Aes256Gcm::new_from_slice(&key).unwrap();
        let mut nonce = [0u8; 12];
        rand::thread_rng().fill_bytes(&mut nonce);
        let plain = serde_json::to_vec(store).map_err(|_| "Calendar store could not be encoded")?;
        let encrypted = cipher
            .encrypt(Nonce::from_slice(&nonce), plain.as_ref())
            .map_err(|_| "Calendar store encryption failed")?;
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent)
                .map_err(|_| "Calendar storage directory could not be created")?;
        }
        let temporary = self.path.with_extension("tmp");
        let mut options = OpenOptions::new();
        options.create(true).truncate(true).write(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        let mut file = options
            .open(&temporary)
            .map_err(|_| "Calendar store could not be written")?;
        file.write_all(b"KWS1")
            .and_then(|_| file.write_all(&nonce))
            .and_then(|_| file.write_all(&encrypted))
            .and_then(|_| file.sync_all())
            .map_err(|_| "Calendar store write failed")?;
        fs::rename(temporary, &self.path).map_err(|_| "Calendar store could not be committed")?;
        Ok(())
    }
}
