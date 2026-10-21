//! One verified Inbound Parse form → the facts the Inbox needs (E3c, design §6). SendGrid
//! sends parsed fields (`send_raw` off): `from`, `subject`, `text`/`html`, the raw
//! `headers` block, `envelope`, `dkim`, `SPF`, `spam_score` and attachments as file parts,
//! which are only counted. Text is plain, reduced from HTML on the server when needed.
use super::{multipart::Form, trust};
use crate::integrations::google::{
    html,
    mime::{message_id, plain_address},
    parse::{is_report, sender, MAX_TEXT},
};

const SPAM_SCORE: f64 = 5.0;

#[derive(Debug, Default)]
pub struct Mail {
    pub from: String,
    pub name: Option<String>,
    pub subject: Option<String>,
    pub text: String,
    pub has_media: bool,
    pub message_id: Option<String>,
    /// Message-IDs this mail answers (`In-Reply-To`, then `References`), for threading.
    pub references: Vec<String>,
    pub verified: bool,
    pub spam: bool,
    /// A delivery report or mailer-daemon notice: never client mail (review L4).
    pub report: bool,
    pub recipients: Vec<String>,
}

fn field(form: &Form, name: &str) -> String {
    let bytes = form.fields.get(name).map(Vec::as_slice).unwrap_or_default();
    // Anything not UTF-8 is read as Latin-1, which maps every byte to a character.
    String::from_utf8(bytes.to_vec()).unwrap_or_else(|_| bytes.iter().map(|&b| b as char).collect())
}

/// The value of `name` in a raw header block, with folded lines joined.
fn header(block: &str, name: &str) -> Option<String> {
    let unfolded = block
        .replace("\r\n", "\n")
        .replace("\n ", " ")
        .replace("\n\t", " ");
    unfolded.lines().find_map(|line| {
        let (key, value) = line.split_once(':')?;
        key.trim()
            .eq_ignore_ascii_case(name)
            .then(|| value.trim().to_owned())
    })
}

fn ids(value: Option<String>) -> Vec<String> {
    let value = value.unwrap_or_default();
    value
        .split_inclusive('>')
        .filter_map(|part| part.find('<').map(|at| part[at..].trim().to_owned()))
        .filter(|id| message_id(id))
        .collect()
}

/// One address in `From`, outside any quoted display name (review M1).
fn single_address(from: &str) -> bool {
    let mut quoted = false;
    let mut ats = 0;
    for c in from.chars() {
        match c {
            '"' => quoted = !quoted,
            '@' if !quoted => ats += 1,
            ',' | ';' if !quoted => return false,
            _ => {}
        }
    }
    ats == 1
}

pub fn read(form: &Form) -> Option<Mail> {
    let raw_from = field(form, "from");
    let (name, from) = sender(&raw_from);
    // No control character (a NUL would make every retry fail) reaches the Inbox (L4).
    let name = name
        .map(|name| name.chars().filter(|c| !c.is_control()).collect::<String>())
        .filter(|name| !name.trim().is_empty());
    if !single_address(&raw_from) || !plain_address(&from) {
        return None;
    }
    let envelope: serde_json::Value = serde_json::from_str(&field(form, "envelope")).ok()?;
    let envelope_from = envelope["from"].as_str().unwrap_or_default();
    let recipients: Vec<String> = envelope["to"]
        .as_array()?
        .iter()
        .filter_map(|to| to.as_str().map(str::to_ascii_lowercase))
        .filter(|to| plain_address(to))
        .take(50)
        .collect();
    let headers = field(form, "headers");
    let mut references = ids(header(&headers, "In-Reply-To"));
    references.extend(ids(header(&headers, "References")).into_iter().rev());
    references.dedup();
    references.truncate(20);
    let text = Some(field(form, "text"))
        .filter(|text| !text.trim().is_empty())
        .unwrap_or_else(|| html::to_text(&field(form, "html")));
    let text: String = text
        .replace("\r\n", "\n")
        .chars()
        .filter(|c| !c.is_control() || *c == '\n' || *c == '\t')
        .take(MAX_TEXT)
        .collect();
    let local = from.split('@').next().unwrap_or_default();
    let subject: String = field(form, "subject")
        .chars()
        .filter(|c| !c.is_control())
        .take(200)
        .collect();
    let attachments = field(form, "attachments")
        .trim()
        .parse::<u32>()
        .unwrap_or(0);
    Some(Mail {
        verified: trust::verified(
            &from,
            &field(form, "dkim"),
            &field(form, "SPF"),
            envelope_from,
        ),
        spam: field(form, "spam_score")
            .trim()
            .parse::<f64>()
            .is_ok_and(|s| s > SPAM_SCORE),
        report: is_report(header(&headers, "Content-Type").as_deref())
            || matches!(local, "mailer-daemon" | "postmaster"),
        message_id: header(&headers, "Message-ID").filter(|id| message_id(id)),
        subject: Some(subject.trim().to_owned()).filter(|s| !s.is_empty()),
        has_media: form.files > 0 || attachments > 0,
        text: text.trim().to_owned(),
        from,
        name,
        references,
        recipients,
    })
}

#[cfg(test)]
#[path = "inbound_tests.rs"]
mod tests;
