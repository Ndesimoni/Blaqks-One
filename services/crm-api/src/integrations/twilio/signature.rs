//! Twilio's webhook signature (design §6, W-L1): HMAC-SHA1 with the Auth Token over the
//! URL built from `CRM_PUBLIC_URL` (never `Host` or forwarded headers) with the raw query
//! exactly as received, followed by every form parameter's name and value, sorted by name
//! byte by byte. A repeated name is refused rather than guessed at. `ring` compares the
//! MAC in constant time.
use base64::{engine::general_purpose::STANDARD, Engine};
use ring::hmac;

/// Form parameters in the order received; `None` when a name repeats.
pub fn parse_form(body: &[u8]) -> Option<Vec<(String, String)>> {
    let mut params: Vec<(String, String)> = Vec::new();
    for (name, value) in url::form_urlencoded::parse(body) {
        if params.iter().any(|(known, _)| *known == name) {
            return None;
        }
        params.push((name.into_owned(), value.into_owned()));
    }
    Some(params)
}

/// The exact string Twilio signs for `url` and these parameters.
pub fn signed_text(url: &str, params: &[(String, String)]) -> String {
    let mut sorted: Vec<&(String, String)> = params.iter().collect();
    sorted.sort_by(|left, right| left.0.as_bytes().cmp(right.0.as_bytes()));
    let mut text = url.to_owned();
    for (name, value) in sorted {
        text.push_str(name);
        text.push_str(value);
    }
    text
}

/// The header's 20 bytes, or `None` for anything else (a cheap refusal, before the body).
pub fn header_bytes(header: &str) -> Option<Vec<u8>> {
    (header.len() == 28)
        .then(|| STANDARD.decode(header).ok())
        .flatten()
        .filter(|bytes| bytes.len() == 20)
}

pub fn verify(token: &str, text: &str, signature: &[u8]) -> bool {
    let key = hmac::Key::new(hmac::HMAC_SHA1_FOR_LEGACY_USE_ONLY, token.as_bytes());
    hmac::verify(&key, text.as_bytes(), signature).is_ok()
}

/// The header value Twilio would send (the stand-in signs the same way in JavaScript).
#[cfg(test)]
pub fn sign(token: &str, text: &str) -> String {
    let key = hmac::Key::new(hmac::HMAC_SHA1_FOR_LEGACY_USE_ONLY, token.as_bytes());
    STANDARD.encode(hmac::sign(&key, text.as_bytes()).as_ref())
}

#[cfg(test)]
mod tests {
    use super::*;

    const TOKEN: &str = "12345678901234567890123456789012";
    const URL: &str = "https://crm.example.test/api/integrations/webhooks/twilio/c/status?m=x";

    fn params(pairs: &[(&str, &str)]) -> Vec<(String, String)> {
        pairs
            .iter()
            .map(|(name, value)| (name.to_string(), value.to_string()))
            .collect()
    }

    #[test]
    fn the_base_string_is_the_url_then_sorted_names_and_values() {
        let form = params(&[
            ("To", "whatsapp:+9991"),
            ("AccountSid", "AC1"),
            ("Body", "a b"),
        ]);
        assert_eq!(
            signed_text(URL, &form),
            format!("{URL}AccountSidAC1Bodya bTowhatsapp:+9991")
        );
        // Byte order: upper-case names sort before lower-case ones.
        let mixed = params(&[("b", "2"), ("B", "1"), ("a", "3")]);
        assert_eq!(signed_text("u", &mixed), "uB1a3b2");
    }

    #[test]
    fn forms_decode_and_refuse_repeated_names() {
        let form = parse_form(b"Body=Hello+there%21&To=whatsapp%3A%2B9991").unwrap();
        assert_eq!(form[0], ("Body".into(), "Hello there!".into()));
        assert_eq!(form[1], ("To".into(), "whatsapp:+9991".into()));
        assert!(parse_form(b"To=1&To=2").is_none());
    }

    #[test]
    fn only_the_token_url_and_parameters_signed_verify() {
        let form = params(&[("MessageStatus", "delivered"), ("MessageSid", "SM1")]);
        let text = signed_text(URL, &form);
        let header = sign(TOKEN, &text);
        let bytes = header_bytes(&header).unwrap();
        assert!(verify(TOKEN, &text, &bytes));
        assert!(!verify(&TOKEN.replace('1', "0"), &text, &bytes));
        let changed = params(&[("MessageStatus", "read"), ("MessageSid", "SM1")]);
        assert!(!verify(TOKEN, &signed_text(URL, &changed), &bytes));
        assert!(!verify(
            TOKEN,
            &signed_text(&URL.replace("m=x", "m=y"), &form),
            &bytes
        ));
        assert!(header_bytes("not base64 at all, nope!!!!!").is_none());
        assert!(header_bytes(&STANDARD.encode([0u8; 32])).is_none());
    }
}
