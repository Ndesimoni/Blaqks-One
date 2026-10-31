//! HTML email reduced to plain text (E1c), so markup never reaches the browser.

/// Drops script and style blocks and every tag, keeps line breaks, decodes the common
/// entities. The result is text; the browser shows it as text, never as markup.
pub fn to_text(html: &str) -> String {
    let mut out = String::new();
    let lower = html.to_ascii_lowercase();
    let mut index = 0;
    while let Some(offset) = lower[index..].find('<') {
        out.push_str(&html[index..index + offset]);
        let start = index + offset;
        let skip = ["<script", "<style", "<head"]
            .iter()
            .find(|tag| lower[start..].starts_with(**tag));
        let end = match skip {
            Some(tag) => lower[start..]
                .find(&format!("</{}", &tag[1..]))
                .and_then(|close| {
                    lower[start + close..]
                        .find('>')
                        .map(|gt| start + close + gt + 1)
                }),
            None => lower[start..].find('>').map(|gt| start + gt + 1),
        };
        let Some(end) = end else { break };
        let tag = &lower[start..end];
        if ["<br", "</p", "</div", "</li", "</tr", "</h"]
            .iter()
            .any(|t| tag.starts_with(t))
        {
            out.push('\n');
        }
        index = end;
    }
    if index < html.len() && !lower[index..].contains('<') {
        out.push_str(&html[index..]);
    }
    let decoded = out
        .replace("&nbsp;", " ")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&amp;", "&");
    let lines: Vec<&str> = decoded.lines().map(str::trim_end).collect();
    let mut text = lines.join("\n");
    while text.contains("\n\n\n") {
        text = text.replace("\n\n\n", "\n\n");
    }
    text
}
