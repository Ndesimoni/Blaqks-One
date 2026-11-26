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
/// is accepted, and a trunk `0` written after the UAE code (`+971 0 50 …`) is dropped, so
/// one phone has one key (WhatsApp design W-M5). Between 8 and 15 digits (E.164), else
/// `None`.
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
    let international = match international.strip_prefix("9710") {
        Some(rest) => format!("{UAE}{rest}"),
        None => international,
    };
    (8..=15)
        .contains(&international.len())
        .then_some(international)
}

/// The canonical WhatsApp key of a phone: `+` and its E.164 digits, never starting `+0`.
/// Consents, conversations and Twilio's `From` and `To` all use it. International forms
/// (`+…`, `00…`) are taken as written. A national form is read only as a UAE mobile (`05…`
/// or `5…`: nine digits after the 0, giving `+9715…`), which the member confirms before
/// sending (`expectedPhone`); any other national form is refused, so the default region
/// never decides who receives a message (W1b security review M1, refining decision O6).
pub fn whatsapp_key(value: &str) -> Option<String> {
    let digits: String = value.chars().filter(char::is_ascii_digit).collect();
    let typed = value.trim();
    let typed = typed.strip_prefix("whatsapp:").unwrap_or(typed).trim();
    if !typed.starts_with('+') && !digits.starts_with("00") {
        let national = digits.strip_prefix('0').unwrap_or(&digits);
        if national.len() != 9 || !national.starts_with('5') {
            return None;
        }
    }
    phone(value)
        .filter(|digits| !digits.starts_with('0'))
        .map(|digits| format!("+{digits}"))
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
        "whatsapp" => whatsapp_key(from).map(|key| Contact {
            phone_digits: Some(key[1..].to_owned()),
            display: key.clone(),
            key,
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
