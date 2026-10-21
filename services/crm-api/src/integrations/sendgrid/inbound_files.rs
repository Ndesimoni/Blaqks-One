//! The file parts of a verified Inbound Parse post, named (F3b, review L2). SendGrid sends
//! each attachment as a file part `attachment1…N` and their names in the JSON field
//! `attachment-info`; a missing or unreadable name becomes `file`. The bytes stay where they
//! are in the request body.
use super::multipart::Form;
use serde_json::Value;
use std::ops::Range;

#[derive(Debug)]
pub struct Part {
    pub name: String,
    pub range: Range<usize>,
}

pub fn parts(form: &Form) -> Vec<Part> {
    let info: Value = form
        .fields
        .get("attachment-info")
        .and_then(|raw| serde_json::from_slice(raw).ok())
        .unwrap_or(Value::Null);
    form.files
        .iter()
        .map(|file| Part {
            name: info[&file.field]["filename"]
                .as_str()
                .filter(|name| !name.trim().is_empty())
                .unwrap_or("file")
                .to_owned(),
            range: file.range.clone(),
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::super::multipart::{FilePart, Form};
    use super::parts;

    #[test]
    fn names_come_from_attachment_info() {
        let mut form = Form::default();
        let info = br#"{"attachment1":{"filename":"Title deed.pdf","type":"application/pdf"}}"#;
        form.fields.insert("attachment-info".into(), info.to_vec());
        for (field, range) in [("attachment1", 0..4), ("attachment2", 4..8)] {
            form.files.push(FilePart {
                field: field.into(),
                range,
            });
        }
        let named = parts(&form);
        assert_eq!(named[0].name, "Title deed.pdf");
        assert_eq!(named[1].name, "file");
        assert_eq!(named[1].range, 4..8);
    }
}
