//! Gmail's sender check (RFC 8601 `Authentication-Results`, security review E1c M2).
//! Parts of the header repeat what the sender controls (the envelope address in an SPF
//! comment or `smtp.mailfrom`), so it is parsed, never searched. A header with any quote
//! or backslash fails closed: only a quoted local part can carry `( ) ;` into it, and real
//! Gmail results almost never contain one. Comments are then removed, the server ID must be
//! exactly `mx.google.com`, and one result must be exactly `dmarc=pass` for the visible
//! From address's domain.
use super::parse::{header, Header};

/// The header with `( … )` comments (nested) removed; `None` for any quote or backslash.
fn plain(value: &str) -> Option<String> {
    if value.contains(['"', '\\']) {
        return None;
    }
    let (mut out, mut depth) = (String::new(), 0usize);
    for character in value.chars() {
        match character {
            '(' => depth += 1,
            ')' if depth > 0 => depth -= 1,
            _ if depth > 0 => {}
            _ => out.push(character),
        }
    }
    Some(out)
}

/// Whether Gmail's own, top-most result passes DMARC for `from`'s domain.
pub fn authenticated(headers: &[Header], from: &str) -> bool {
    let Some(value) = header(headers, "Authentication-Results") else {
        return false;
    };
    let Some((_, domain)) = from.rsplit_once('@') else {
        return false;
    };
    let wanted = format!("header.from={}", domain.to_ascii_lowercase());
    let Some(plain) = plain(value).map(|text| text.to_ascii_lowercase()) else {
        return false;
    };
    let mut parts = plain.split(';');
    if parts.next().map(str::trim) != Some("mx.google.com") {
        return false;
    }
    parts.any(|result| {
        let mut words = result.split_whitespace();
        words.next() == Some("dmarc=pass") && words.any(|word| word == wanted)
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn results(value: &str) -> Vec<Header> {
        vec![Header {
            name: "Authentication-Results".into(),
            value: value.into(),
        }]
    }

    #[test]
    fn gmail_dmarc_pass_for_the_from_domain_authenticates() {
        let good = "mx.google.com; dkim=pass header.i=@client.example; \
            spf=pass (google.com: domain of a@client.example) smtp.mailfrom=a@client.example; \
            dmarc=pass (p=REJECT sp=REJECT dis=NONE) header.from=client.example";
        assert!(authenticated(&results(good), "someone@client.example"));
        assert!(!authenticated(&results(good), "someone@other.example"));
    }

    #[test]
    fn sender_controlled_text_cannot_pass() {
        let forged = "mx.google.com; spf=pass (google.com: domain of dmarc=pass@evil.example \
            designates 1.2.3.4 as permitted sender) smtp.mailfrom=\"dmarc=pass@evil.example\"; \
            dmarc=fail (p=NONE sp=NONE dis=NONE) header.from=client.example";
        assert!(!authenticated(&results(forged), "client@client.example"));
        let quoted = "mx.google.com; spf=pass smtp.mailfrom=\"x;dmarc=pass header.from=client.example ;\"@evil.example; dmarc=fail header.from=client.example";
        assert!(!authenticated(&results(quoted), "client@client.example"));
        let comment = "mx.google.com; spf=pass (google.com: domain of \
            \"x);dmarc=pass header.from=client.example;(\"@evil.example designates 1.2.3.4) \
            smtp.mailfrom=x@evil.example; dmarc=fail header.from=client.example";
        assert!(!authenticated(&results(comment), "client@client.example"));
        let absent = "mx.google.com; spf=pass smtp.mailfrom=x@evil.example";
        assert!(!authenticated(&results(absent), "client@client.example"));
        let other = "mx.google.com; dmarc=pass (p=NONE) header.from=other.example";
        assert!(!authenticated(&results(other), "client@client.example"));
    }

    #[test]
    fn only_gmail_counts_and_a_missing_header_fails() {
        let foreign = "evil.example; dmarc=pass header.from=client.example";
        assert!(!authenticated(&results(foreign), "client@client.example"));
        let prefixed = "mx.google.com.evil.example; dmarc=pass header.from=client.example";
        assert!(!authenticated(&results(prefixed), "client@client.example"));
        assert!(!authenticated(&[], "client@client.example"));
    }
}
