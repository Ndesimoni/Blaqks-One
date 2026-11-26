//! A template's numbered placeholders, `{{1}}` to `{{k}}` (design §5 and §8): how many a
//! text template takes, and the text the client receives once the values are filled in.

pub const MAX_VARIABLES: usize = 10;

/// The placeholders of `body`: `Some(k)` when they are exactly `{{1}}`…`{{k}}`, k ≤ 10.
pub fn variable_count(body: &str) -> Option<i16> {
    let mut seen = [false; MAX_VARIABLES];
    let mut rest = body;
    while let Some(start) = rest.find("{{") {
        let after = &rest[start + 2..];
        let end = after.find("}}")?;
        let index: usize = Some(&after[..end])
            .filter(|digits| !digits.is_empty() && digits.bytes().all(|b| b.is_ascii_digit()))
            .and_then(|digits| digits.parse().ok())
            .filter(|index| (1..=MAX_VARIABLES).contains(index))?;
        seen[index - 1] = true;
        rest = &after[end + 2..];
    }
    let count = seen.iter().take_while(|known| **known).count();
    seen[count..]
        .iter()
        .all(|known| !known)
        .then_some(count as i16)
}

/// The text the client receives: each `{{n}}` replaced by the n-th value in one pass, so a
/// value that itself looks like a placeholder is shown as typed.
pub fn fill(body: &str, values: &[String]) -> String {
    let mut text = String::with_capacity(body.len());
    let mut rest = body;
    while let Some(start) = rest.find("{{") {
        text.push_str(&rest[..start]);
        let after = &rest[start + 2..];
        let value = after.find("}}").and_then(|end| {
            let index: usize = after[..end].parse().ok()?;
            let value = values.get(index.checked_sub(1)?)?;
            Some((value, end))
        });
        match value {
            Some((value, end)) => {
                text.push_str(value);
                rest = &after[end + 2..];
            }
            None => {
                text.push_str("{{");
                rest = after;
            }
        }
    }
    text.push_str(rest);
    text
}
