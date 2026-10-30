//! The hosts and paths social links may use (docs/website-social-links.md §3, review
//! SOC1 M2 and L2): profile hosts per network, never link shims or redirect pages, and no
//! reserved names or URL shorteners for the "Other website" link.

/// Network, its domains and the subdomains allowed in front of them (never link shims).
pub const NETWORKS: [(&str, &[&str], &[&str]); 6] = [
    ("instagram", &["instagram.com"], &["www", "m"]),
    (
        "facebook",
        &["facebook.com", "fb.com"],
        &["www", "m", "mobile"],
    ),
    ("tiktok", &["tiktok.com"], &["www", "m", "vm", "vt"]),
    ("linkedin", &["linkedin.com"], &["www", "m", "mobile"]),
    ("youtube", &["youtube.com", "youtu.be"], &["www", "m"]),
    ("x", &["x.com", "twitter.com"], &["www", "m", "mobile"]),
];
pub const WEBSITE: &str = "website";
pub const REDIRECTS: [&str; 7] = [
    "/l.php",
    "/redirect",
    "/redir",
    "/url",
    "/link/",
    "/attribution_link",
    "/i/redirect",
];
pub const RESERVED: [&str; 8] = [
    "local",
    "localhost",
    "internal",
    "test",
    "example",
    "invalid",
    "onion",
    "arpa",
];
pub const SHORTENERS: [&str; 12] = [
    "bit.ly",
    "tinyurl.com",
    "t.co",
    "goo.gl",
    "ow.ly",
    "is.gd",
    "buff.ly",
    "rb.gy",
    "cutt.ly",
    "lnkd.in",
    "tiny.cc",
    "s.id",
];
