//! Sender normalisation (design §6): phones to international digits with the UAE as the
//! default region (decision O6), emails to lower case, social IDs per channel. Invalid
//! values never match anything.

/// A sender as the Inbox stores and matches it.
#[derive(Clone, Debug, PartialEq)]
pub struct Contact {
    /// Unique per channel inside a company: `+<digits>`, a lower-case email or
    /// `<channel>:<platform id>`. Blocks and conversations use it.
    pub key: String,
    /// What staff see for an unknown sender.
    pub display: String,
    /// International digits without `+`, for matching Clients and Contacts.
    pub phone_digits: Option<String>,
    pub email: Option<String>,
}

const UAE: &str = "971";

/// International digits for a phone typed or sent in any common form: `+971 50 …`,
/// `00971 50 …`, `050 …` or a bare 9-digit national number. Twilio's `whatsapp:` prefix
/// is accepted. Between 8 and 15 digits (E.164), else `None`.
pub fn phone(value: &str) -> Option<String> {
    let value = value.trim();
    let value = value.strip_prefix("whatsapp:").unwrap_or(value).trim();
    let allowed = |c: char| c.is_ascii_digit() || " +-.()".contains(c);
    if value.is_empty() || !value.chars().all(allowed) || value[1..].contains('+') {
        return None;
    }
    let digits: String = value.chars().filter(char::is_ascii_digit).collect();
    let international = if value.starts_with('+') {
        digits
    } else if let Some(rest) = digits.strip_prefix("00") {
        rest.to_owned()
    } else if let Some(rest) = digits.strip_prefix('0') {
        format!("{UAE}{rest}")
    } else if digits.len() == 9 {
        format!("{UAE}{digits}")
    } else {
        digits
    };
    (8..=15)
        .contains(&international.len())
        .then_some(international)
}

/// A lower-case address with one `@`, a non-empty local part and a dotted domain.
pub fn email(value: &str) -> Option<String> {
    let value = value.trim().to_lowercase();
    let (local, domain) = value.split_once('@')?;
    let ok = !local.is_empty()
        && domain.contains('.')
        && !domain.starts_with('.')
        && !domain.ends_with('.')
        && !domain.contains('@')
        && value.len() <= 254
        && !value.chars().any(char::is_whitespace);
    ok.then_some(value)
}

/// The sender for a message on `channel`, or `None` when it cannot be normalised.
pub fn contact(channel: &str, from: &str) -> Option<Contact> {
    match channel {
        "whatsapp" => phone(from).map(|digits| Contact {
            key: format!("+{digits}"),
            display: format!("+{digits}"),
            phone_digits: Some(digits),
            email: None,
        }),
        "email" => email(from).map(|address| Contact {
            key: address.clone(),
            display: address.clone(),
            phone_digits: None,
            email: Some(address),
        }),
        "facebook" | "instagram" | "tiktok" => {
            let id = from.trim();
            let ok = (1..=200).contains(&id.len())
                && id
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b"._-".contains(&b));
            ok.then(|| Contact {
                key: format!("{channel}:{id}"),
                display: id.to_owned(),
                phone_digits: None,
                email: None,
            })
        }
        _ => None,
    }
}

#[cfg(test)]
#[path = "normalize_tests.rs"]
mod tests;
