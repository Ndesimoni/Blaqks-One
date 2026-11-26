//! A coarse "Browser · OS" label for the sessions list (account-self-service.md, migration
//! 0018). Only fixed names from these allowlists are ever stored: never the raw
//! User-Agent, a version number or an IP address. Unknown agents store no label.

/// Checked in order: Edge, Opera and Samsung Internet also name Chrome, and Chrome names
/// Safari.
const BROWSERS: [(&str, &str); 10] = [
    ("Edg/", "Edge"),
    ("EdgA/", "Edge"),
    ("EdgiOS/", "Edge"),
    ("OPR/", "Opera"),
    ("SamsungBrowser/", "Samsung Internet"),
    ("Firefox/", "Firefox"),
    ("FxiOS/", "Firefox"),
    ("CriOS/", "Chrome"),
    ("Chrome/", "Chrome"),
    ("Safari/", "Safari"),
];

/// Checked in order: iOS agents say "like Mac OS X" and Android agents say "Linux".
const SYSTEMS: [(&str, &str); 8] = [
    ("iPhone", "iOS"),
    ("iPad", "iPadOS"),
    ("Android", "Android"),
    ("CrOS", "ChromeOS"),
    ("Windows", "Windows"),
    ("Macintosh", "macOS"),
    ("Mac OS X", "macOS"),
    ("Linux", "Linux"),
];

fn find(agent: &str, names: &[(&str, &'static str)]) -> Option<&'static str> {
    names
        .iter()
        .find(|(marker, _)| agent.contains(marker))
        .map(|(_, name)| *name)
}

pub fn label(agent: Option<&str>) -> Option<String> {
    let agent = agent.filter(|value| value.len() <= 1024)?;
    match (find(agent, &BROWSERS), find(agent, &SYSTEMS)) {
        (Some(browser), Some(system)) => Some(format!("{browser} · {system}")),
        (Some(name), None) | (None, Some(name)) => Some(name.to_owned()),
        (None, None) => None,
    }
}

#[cfg(test)]
mod tests {
    use super::label;

    #[test]
    fn labels_common_browsers_without_versions() {
        let cases = [
            ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36", "Chrome · macOS"),
            ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36 Edg/141.0", "Edge · Windows"),
            ("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1", "Safari · iOS"),
            ("Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0", "Firefox · Linux"),
            ("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0 Mobile Safari/537.36", "Samsung Internet · Android"),
        ];
        for (agent, expected) in cases {
            assert_eq!(label(Some(agent)).as_deref(), Some(expected));
        }
    }

    #[test]
    fn unknown_or_oversized_agents_store_nothing_raw() {
        assert_eq!(label(None), None);
        assert_eq!(label(Some("node")), None);
        assert_eq!(label(Some("curl/8.0 <script>")), None);
        assert_eq!(label(Some(&format!("Chrome/1 {}", "x".repeat(1100)))), None);
        let label = label(Some("Chrome/1 192.168.0.1 Windows secret")).unwrap();
        assert_eq!(label, "Chrome · Windows");
        assert!(label.chars().count() <= 60);
    }
}
