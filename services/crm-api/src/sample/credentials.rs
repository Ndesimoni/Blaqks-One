//! Sample staff passwords, hashed before the seed transaction. A generated password is
//! kept in memory only to be printed once; nothing stores or logs it.
//!
//! There is deliberately no password environment variable: the binary loads `.env`, so
//! one could silently come from a file. The password comes only from a hidden terminal
//! prompt (typed twice) or one piped line; blank generates a password per account.
use super::{failed, target::UNCHANGED, Outcome};
use crate::{
    auth::{password, session},
    bootstrap,
};
use std::io::{self, IsTerminal};

pub struct Credential {
    /// Present only when the password was generated for this account.
    pub generated: Option<String>,
    pub hash: String,
}

pub async fn credentials(count: usize) -> Outcome<Vec<Credential>> {
    if count == 0 {
        return Ok(Vec::new());
    }
    let prompt = "Sample staff password (leave blank to generate one per account): ";
    let shared = bootstrap::prompt_secret(prompt).map_err(failed)?;
    if !shared.is_empty() && !password::valid_length(&shared) {
        return Err(format!("Passwords need 8 to 1024 bytes.{UNCHANGED}"));
    }
    if !shared.is_empty() && io::stdin().is_terminal() {
        let again = bootstrap::prompt_secret("Confirm password: ").map_err(failed)?;
        if again != shared {
            return Err(format!("Passwords must match.{UNCHANGED}"));
        }
    }
    let mut credentials = Vec::with_capacity(count);
    for _ in 0..count {
        let generated = shared
            .is_empty()
            .then(|| session::random_token()[..20].to_owned());
        let plain = generated.clone().unwrap_or_else(|| shared.clone());
        let hash = password::hash(plain).await.map_err(failed)?;
        credentials.push(Credential { generated, hash });
    }
    Ok(credentials)
}
