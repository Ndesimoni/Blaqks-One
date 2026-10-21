//! What a SendGrid key may hold and which domain it proves (docs/sendgrid-design.md §4).
//! A key with any permission outside the allowlist is refused (security review M4), so
//! a leaked key can never create keys, add teammates or change the account.
use serde::Deserialize;

/// Without these the CRM can neither send nor prove the domain.
const REQUIRED: [&str; 2] = ["mail.send", "whitelabel.read"];
/// Account flags SendGrid may attach to any key; they grant nothing.
const FLAGS: [&str; 4] = [
    "2fa_exempt",
    "2fa_required",
    "sender_verification_eligible",
    "sender_verification_exempt",
];
/// Exactly what E3b and E3c need to create, read and remove their own incoming-mail and
/// event settings (code review M1): no `update`, so a leaked key cannot repoint incoming
/// mail elsewhere. The names are confirmed in the SendGrid sandbox before E3b (design §8).
const WEBHOOKS: [&str; 7] = [
    "user.webhooks.parse.settings.create",
    "user.webhooks.parse.settings.read",
    "user.webhooks.parse.settings.delete",
    "user.webhooks.event.settings.create",
    "user.webhooks.event.settings.read",
    "user.webhooks.event.settings.delete",
    "user.webhooks.security.policies.create",
];

pub const MISSING: &str =
    "This key cannot send mail or read your domain. Give it Mail Send and Sender Authentication read access.";
pub const TOO_BROAD: &str =
    "This key has more access than the CRM needs. Create a restricted key with only the listed permissions.";
pub const DOMAIN: &str = "Enter the company domain, such as keyswithsimoni.com.";
pub const NOT_AUTHENTICATED: &str =
    "SendGrid has not verified this domain for this account. Finish Sender Authentication first.";

pub fn scopes_ok(scopes: &[String]) -> Result<(), &'static str> {
    let allowed = |scope: &str| {
        REQUIRED.contains(&scope) || FLAGS.contains(&scope) || WEBHOOKS.contains(&scope)
    };
    if scopes.iter().any(|scope| !allowed(scope)) {
        return Err(TOO_BROAD);
    }
    if !REQUIRED
        .iter()
        .all(|needed| scopes.iter().any(|scope| scope == needed))
    {
        return Err(MISSING);
    }
    Ok(())
}

/// A lower-case domain such as `keyswithsimoni.com`; never an address, URL or IP.
pub fn domain(value: &str) -> Result<String, &'static str> {
    let domain = value.trim().trim_end_matches('.').to_ascii_lowercase();
    let label_ok = |label: &str| {
        (1..=63).contains(&label.len())
            && !label.starts_with('-')
            && !label.ends_with('-')
            && label
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
    };
    let labels: Vec<&str> = domain.split('.').collect();
    let top_ok = labels
        .last()
        .is_some_and(|top| top.bytes().any(|byte| byte.is_ascii_alphabetic()));
    if domain.len() > 160 || labels.len() < 2 || !labels.iter().all(|l| label_ok(l)) || !top_ok {
        return Err(DOMAIN);
    }
    Ok(domain)
}

#[derive(Deserialize)]
pub struct AuthenticatedDomain {
    pub domain: String,
    #[serde(default)]
    pub valid: bool,
}

/// The account proves the domain only when SendGrid lists it as verified.
pub fn proves(listed: &[AuthenticatedDomain], wanted: &str) -> bool {
    listed
        .iter()
        .any(|entry| entry.valid && entry.domain.trim().eq_ignore_ascii_case(wanted))
}

#[cfg(test)]
#[path = "account_tests.rs"]
mod tests;
