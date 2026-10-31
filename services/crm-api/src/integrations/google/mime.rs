//! The RFC 5322 message Gmail sends (E1b): plain UTF-8 text, base64 bodies, an encoded
//! subject so Arabic survives, and reply headers so the client's mail app threads it. Every
//! header value is checked first, so no input can add a header or a recipient. `From` is
//! left to Gmail, which fills in the connected mailbox and its display name.
use base64::{
    engine::general_purpose::{STANDARD, URL_SAFE},
    Engine,
};

pub struct Email<'a> {
    pub to: &'a str,
    pub subject: &'a str,
    pub body: &'a str,
    /// The Message-ID being answered, with angle brackets, when this is a reply.
    pub in_reply_to: Option<&'a str>,
}

/// One plain address: printable ASCII without spaces, quotes, angle brackets, commas,
/// semicolons or backslashes, one `@` and a dotted domain.
pub fn plain_address(value: &str) -> bool {
    let Some((local, domain)) = value.split_once('@') else {
        return false;
    };
    let allowed = |byte: u8| byte.is_ascii_graphic() && !b"\"<>,;:\\()[]@".contains(&byte);
    !local.is_empty()
        && domain.contains('.')
        && value.len() <= 254
        && local.bytes().all(allowed)
        && domain.bytes().all(allowed)
}

/// A `<id@host>` Message-ID without spaces or control characters.
pub fn message_id(value: &str) -> bool {
    value.len() <= 300
        && value.starts_with('<')
        && value.ends_with('>')
        && value.contains('@')
        && value.bytes().all(|byte| byte.is_ascii_graphic())
}

pub fn subject_ok(value: &str) -> bool {
    let count = value.chars().count();
    (1..=200).contains(&count) && !value.chars().any(char::is_control)
}

/// RFC 2047 encoded-words of at most 45 input bytes each, split on character boundaries.
fn encode_subject(subject: &str) -> String {
    if subject.bytes().all(|byte| (b' '..=b'~').contains(&byte)) {
        return subject.to_owned();
    }
    let mut words = Vec::new();
    let mut chunk = String::new();
    for character in subject.chars() {
        if chunk.len() + character.len_utf8() > 45 {
            words.push(format!("=?UTF-8?B?{}?=", STANDARD.encode(&chunk)));
            chunk.clear();
        }
        chunk.push(character);
    }
    words.push(format!("=?UTF-8?B?{}?=", STANDARD.encode(&chunk)));
    words.join("\r\n ")
}

/// The base64url `raw` value for `users.messages.send`, or `None` for unsafe input.
pub fn raw(email: &Email<'_>) -> Option<String> {
    if !plain_address(email.to) || !subject_ok(email.subject) {
        return None;
    }
    let mut headers = vec![
        format!("To: {}", email.to),
        format!("Subject: {}", encode_subject(email.subject)),
    ];
    if let Some(parent) = email.in_reply_to {
        if !message_id(parent) {
            return None;
        }
        headers.push(format!("In-Reply-To: {parent}"));
        headers.push(format!("References: {parent}"));
    }
    headers.extend([
        "MIME-Version: 1.0".to_owned(),
        "Content-Type: text/plain; charset=UTF-8".to_owned(),
        "Content-Transfer-Encoding: base64".to_owned(),
    ]);
    let body = STANDARD.encode(email.body.replace("\r\n", "\n").replace('\n', "\r\n"));
    let lines: Vec<&str> = body
        .as_bytes()
        .chunks(76)
        .map(|line| std::str::from_utf8(line).unwrap_or_default())
        .collect();
    let message = format!("{}\r\n\r\n{}\r\n", headers.join("\r\n"), lines.join("\r\n"));
    Some(URL_SAFE.encode(message))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn decoded(email: &Email<'_>) -> String {
        String::from_utf8(URL_SAFE.decode(raw(email).unwrap()).unwrap()).unwrap()
    }

    #[test]
    fn a_reply_threads_and_encodes_arabic() {
        let text = decoded(&Email {
            to: "client@example.test",
            subject: "شقة في دبي مارينا",
            body: "مرحبا\nThe viewing is at 5.",
            in_reply_to: Some("<abc@mail.example>"),
        });
        assert!(text.contains("To: client@example.test\r\n"));
        assert!(text.contains("Subject: =?UTF-8?B?"));
        assert!(text.contains("In-Reply-To: <abc@mail.example>\r\nReferences: <abc@mail.example>"));
        let body = text.split("\r\n\r\n").nth(1).unwrap().replace("\r\n", "");
        let plain = String::from_utf8(STANDARD.decode(body).unwrap()).unwrap();
        assert_eq!(plain, "مرحبا\r\nThe viewing is at 5.");
    }

    #[test]
    fn header_injection_is_refused() {
        let email = |to, subject, parent| Email {
            to,
            subject,
            body: "Hi",
            in_reply_to: parent,
        };
        assert!(raw(&email("a@b.test\r\nBcc: x@y.test", "Hi", None)).is_none());
        assert!(raw(&email("a@b.test, x@y.test", "Hi", None)).is_none());
        assert!(raw(&email("<a@b.test>", "Hi", None)).is_none());
        assert!(raw(&email("a@b.test", "Hi\r\nBcc: x@y.test", None)).is_none());
        assert!(raw(&email("a@b.test", "", None)).is_none());
        assert!(raw(&email("a@b.test", "Hi", Some("<a b@c>"))).is_none());
        assert!(raw(&email("a@b.test", "Plain subject", None)).is_some());
    }
}
