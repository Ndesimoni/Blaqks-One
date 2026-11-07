//! Sample staff passwords, hashed before the seed transaction. A generated password is
//! kept in memory only to be printed once; nothing stores or logs it.
//!
//! There is deliberately no password environment variable: the binary loads `.env`, so
//! one could silently come from a file. The password comes only from a hidden terminal
//! prompt (typed twice) or one piped line; blank generates a password per account. Both
//! follow the new-password policy: the random part gets a fixed "-Kw1" suffix so every
//! generated password has an uppercase and lowercase letter, a number and a symbol.
use super::{failed, target::UNCHANGED, Outcome};
use crate::{
    auth::{password, password_policy, session},
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
    if !shared.is_empty() && !password_policy::strong(&shared) {
        return Err(format!("{}{UNCHANGED}", password_policy::WEAK_PASSWORD));
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
            .then(|| format!("{}-Kw1", &session::random_token()[..20]));
        let plain = generated.clone().unwrap_or_else(|| shared.clone());
        let hash = password::hash(plain).await.map_err(failed)?;
        credentials.push(Credential { generated, hash });
    }
    Ok(credentials)
}
