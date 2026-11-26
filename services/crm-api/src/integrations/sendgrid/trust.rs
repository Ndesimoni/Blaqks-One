//! Whether SendGrid authenticated an incoming sender (E3c, design §6, review M1). Only the
//! top-level Inbound Parse `dkim`, `SPF` and `envelope` fields count, never headers inside
//! the mail. A pass counts only when its domain aligns with the `From` domain: the same
//! domain, or one a subdomain of the other. Without the public suffix list this treats a
//! shared suffix such as `co.uk` as a domain, which no sender can sign for anyway.

fn aligned(signer: &str, from: &str) -> bool {
    let (signer, from) = (
        signer.trim().to_ascii_lowercase(),
        from.to_ascii_lowercase(),
    );
    let dotted = |domain: &str| domain.contains('.') && !domain.starts_with('.');
    dotted(&signer)
        && dotted(&from)
        && (signer == from
            || from.ends_with(&format!(".{signer}"))
            || signer.ends_with(&format!(".{from}")))
}

/// `dkim` looks like `{@example.com : pass, @sendgrid.net : fail}`.
fn dkim_passes(dkim: &str, from_domain: &str) -> bool {
    dkim.trim_matches(|c| c == '{' || c == '}')
        .split(',')
        .filter_map(|entry| entry.split_once(':'))
        .any(|(signer, result)| {
            result.trim().eq_ignore_ascii_case("pass")
                && signer
                    .trim()
                    .strip_prefix('@')
                    .is_some_and(|d| aligned(d, from_domain))
        })
}

/// `SPF` is one bare result for the envelope sender, so it counts only when that sender's
/// domain aligns with the `From` domain.
fn spf_passes(spf: &str, envelope_from: &str, from_domain: &str) -> bool {
    spf.trim().eq_ignore_ascii_case("pass")
        && envelope_from
            .rsplit_once('@')
            .is_some_and(|(_, domain)| aligned(domain.trim_end_matches('>'), from_domain))
}

pub fn verified(from: &str, dkim: &str, spf: &str, envelope_from: &str) -> bool {
    let Some((_, domain)) = from.rsplit_once('@') else {
        return false;
    };
    dkim_passes(dkim, domain) || spf_passes(spf, envelope_from, domain)
}

#[cfg(test)]
mod tests {
    use super::verified;

    #[test]
    fn only_a_pass_aligned_with_the_from_domain_counts() {
        let from = "client@gmail.com";
        assert!(verified(from, "{@gmail.com : pass}", "fail", ""));
        assert!(verified(
            from,
            "{@sendgrid.net : pass, @gmail.com : pass}",
            "",
            ""
        ));
        assert!(verified("a@mail.client.ae", "{@client.ae : pass}", "", ""));
        assert!(verified(from, "{}", "pass", "bounce@gmail.com"));
        // A pass for the attacker's own domain or envelope says nothing about Gmail.
        assert!(!verified(
            from,
            "{@evil.example : pass}",
            "pass",
            "x@evil.example"
        ));
        assert!(!verified(
            from,
            "{@gmail.com : fail}",
            "softfail",
            "x@gmail.com"
        ));
        assert!(!verified(from, "{@notgmail.com : pass}", "", ""));
        assert!(!verified(from, "{@com : pass}", "", ""));
        assert!(!verified("no-at-sign", "{@gmail.com : pass}", "pass", ""));
    }
}
