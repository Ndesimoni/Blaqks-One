//! A strict `multipart/form-data` reader for verified Inbound Parse posts (E3c, review
//! M3). It runs only after the signature check, never panics, and refuses rather than
//! guesses: at most 64 parts, part headers of at most 8 KiB, and no repeated field name.
//! File parts (attachments) are kept as ranges of the verified body, never copied (F3b,
//! review M4); a part whose headers cannot be read is skipped and counted, never the mail.
use std::{collections::HashMap, ops::Range};

const MAX_PARTS: usize = 64;
const MAX_HEADER: usize = 8 * 1024;

#[derive(Debug)]
pub struct FilePart {
    /// The form field (`attachment1` …), which `attachment-info` names.
    pub field: String,
    pub range: Range<usize>,
}

#[derive(Debug, Default)]
pub struct Form {
    pub fields: HashMap<String, Vec<u8>>,
    pub files: Vec<FilePart>,
    /// Parts skipped because their headers could not be read (review L2).
    pub unreadable: usize,
}

/// The boundary from a `multipart/form-data; boundary=…` content type.
pub fn boundary(content_type: &str) -> Option<String> {
    let mut parts = content_type.split(';');
    let kind = parts.next()?.trim();
    if !kind.eq_ignore_ascii_case("multipart/form-data") {
        return None;
    }
    let value = parts
        .map(str::trim)
        .find_map(|param| param.strip_prefix("boundary="))?
        .trim_matches('"');
    let ok = (1..=70).contains(&value.len()) && value.bytes().all(|b| b.is_ascii_graphic());
    ok.then(|| value.to_owned())
}

fn find(haystack: &[u8], needle: &[u8], from: usize) -> Option<usize> {
    haystack
        .get(from..)?
        .windows(needle.len())
        .position(|window| window == needle)
        .map(|at| at + from)
}

/// `name` and whether `filename` is present, from a part's Content-Disposition.
fn disposition(headers: &str) -> Option<(String, bool)> {
    let line = headers.split("\r\n").find(|line| {
        line.to_ascii_lowercase()
            .starts_with("content-disposition:")
    })?;
    let mut name = None;
    let mut file = false;
    for param in line.split(';').skip(1).map(str::trim) {
        if let Some(value) = param.strip_prefix("name=") {
            name = Some(value.trim_matches('"').to_owned());
        } else if param.starts_with("filename") {
            file = true;
        }
    }
    let name =
        name.filter(|n| (1..=100).contains(&n.len()) && n.bytes().all(|b| b.is_ascii_graphic()));
    Some((name?, file))
}

pub fn parse(body: &[u8], boundary: &str) -> Option<Form> {
    let delimiter = format!("--{boundary}");
    let mut form = Form::default();
    let mut at = find(body, delimiter.as_bytes(), 0)? + delimiter.len();
    for _ in 0..=MAX_PARTS {
        if body.get(at..at + 2)? == b"--" {
            return Some(form);
        }
        let start = at + 2; // the CRLF after the delimiter
        let split = find(body, b"\r\n\r\n", start)?;
        if split - start > MAX_HEADER {
            return None;
        }
        let content = split + 4;
        let end = find(body, format!("\r\n{delimiter}").as_bytes(), content)?;
        let headers = std::str::from_utf8(&body[start..split]).ok();
        let Some((name, file)) = headers.and_then(disposition) else {
            form.unreadable += 1;
            at = end + 2 + delimiter.len();
            continue;
        };
        if file {
            form.files.push(FilePart {
                field: name,
                range: content..end,
            });
        } else if form
            .fields
            .insert(name, body[content..end].to_vec())
            .is_some()
        {
            return None;
        }
        at = end + 2 + delimiter.len();
    }
    None
}

#[cfg(test)]
#[path = "multipart_tests.rs"]
mod tests;
