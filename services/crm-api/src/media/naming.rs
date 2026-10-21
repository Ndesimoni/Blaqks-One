//! A file's display name always ends with the extension of its stored type (F3 review M3),
//! so a PDF whose first bytes hide HTML can never be saved or opened as `invoice.html`. Used
//! when storing, when serving and when a file leaves the CRM as an email attachment.

fn extension(content_type: &str) -> &'static str {
    match content_type {
        "image/jpeg" => "jpg",
        "image/png" => "png",
        "image/webp" => "webp",
        _ => "pdf",
    }
}

pub fn typed_name(name: &str, content_type: &str) -> String {
    let wanted = extension(content_type);
    let lower = name.to_ascii_lowercase();
    let fits = match wanted {
        "jpg" => lower.ends_with(".jpg") || lower.ends_with(".jpeg"),
        other => lower.ends_with(&format!(".{other}")),
    };
    if fits {
        return name.to_owned();
    }
    let stem = name
        .rsplit_once('.')
        .map(|(stem, _)| stem)
        .filter(|stem| !stem.trim().is_empty())
        .unwrap_or(name);
    let stem: String = stem.chars().take(190).collect();
    format!("{}.{wanted}", stem.trim_end())
}

#[cfg(test)]
mod tests {
    use super::typed_name;

    #[test]
    fn the_extension_always_matches_the_stored_type() {
        assert_eq!(
            typed_name("Brochure.PDF", "application/pdf"),
            "Brochure.PDF"
        );
        assert_eq!(typed_name("invoice.html", "application/pdf"), "invoice.pdf");
        assert_eq!(typed_name("plan", "application/pdf"), "plan.pdf");
        assert_eq!(typed_name("villa.jpeg", "image/jpeg"), "villa.jpeg");
        assert_eq!(typed_name("villa.png", "image/jpeg"), "villa.jpg");
        assert_eq!(typed_name("a.tar.gz.exe", "image/webp"), "a.tar.gz.webp");
        assert_eq!(typed_name(".htaccess", "image/png"), ".htaccess.png");
        assert!(typed_name(&"n".repeat(200), "application/pdf").len() <= 200);
    }
}
