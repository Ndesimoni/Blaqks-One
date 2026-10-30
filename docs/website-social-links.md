# Social media links on the websites (packet SOC1)

Owner request and decisions, 2026-10-30: users add their social media links and they show on
the websites. **Whose:** the company (entered by its Admin), each member (entered by the member,
covered by their own website consent) and Blaqks One for the general site (Super Admin).
**Which:** Instagram, Facebook, TikTok, LinkedIn, YouTube and X, plus one "Other website" link.

## 1. Where they are entered and shown

| Links      | Entered in                                        | Shown on                                                     |
| ---------- | ------------------------------------------------- | ------------------------------------------------------------ |
| Company    | Website → Content, "Social links" (owning Admin)  | Company site footer and Contact page                         |
| Blaqks One | Platform website → General site, "Social links"   | General site footer and Contact page                         |
| Member     | My profile → Website profile, "Your social links" | The member's public profile on the company and general sites |

Company and platform links follow the content flow: Save draft and Review keep them private,
while Publish (or direct Save & publish) makes them public at once. Member links publish with the member's
profile when it is saved, with no draft, so they appear only while the member's consent is on
and the profile is visible. A member's own **Other website** appears on their company site only,
never on the Blaqks One general site (review H2).
Following the 2026-10-30 profile rule, **only the member changes their own links**; an Admin's
edit of another member's profile keeps them unchanged (`sites/profile_rules.rs`).

## 2. Data

- Site content gains one optional key, `social`: an object with any of `instagram`,
  `facebook`, `tiktok`, `linkedin`, `youtube`, `x`, `website`. Empty fields are left out. No
  migration: content is already JSON, versioned with each draft and published site version.
- The public profile body gains the same optional `social` object (`ProfileInput.social`).
- Public API: site content and public profiles already pass these bodies through; the website
  decoders accept only the same keys and re-check every link (§3).

## 3. Link rules (server and website both check)

- At most 300 characters, `https://` only, no user name or password, no port, no control
  characters or spaces. Stored exactly as validated (trimmed).
- Each network accepts only its own hosts, exactly or as a subdomain:

  | Field     | Allowed hosts             |
  | --------- | ------------------------- |
  | instagram | `instagram.com`           |
  | facebook  | `facebook.com`, `fb.com`  |
  | tiktok    | `tiktok.com`              |
  | linkedin  | `linkedin.com`            |
  | youtube   | `youtube.com`, `youtu.be` |
  | x         | `x.com`, `twitter.com`    |

- `website` accepts any `https://` address whose host is a domain name with a dot. IP
  addresses, `localhost` and single-label hosts are refused.
- The CRM form adds `https://` when the person types only `instagram.com/...` and shows a
  plain error naming the expected site, such as "Enter an Instagram link, like
  https://instagram.com/yourname".
- The websites render each link as an `<a>` with `target="_blank"` and
  `rel="noopener noreferrer nofollow ugc"`, with the network's icon and an accessible name
  such as "Keys with Simoni on Instagram". "Other website" shows as a plain link icon, named
  "Website". Nothing from a link is ever inserted as HTML.

## 4. Packets

- **SOC1a, backend:** validation (`sites/social.rs`) used by the content and profile
  validators, `ProfileInput.social`, the profile rule extended to links, API tests.
- **SOC1b, CRM:** the Social links group on the Content tab (company and platform) and in the
  Website profile (member); read-only in the Admin's Team dialog for other members. The
  product designer reviews screenshots.
- **SOC1c, websites:** decoders, footer and Contact page links, profile links, icons, sample
  data, and the browser check.

## 5. Security review (2026-10-30)

Separate review of this design. Its findings are built into `sites/social.rs`,
`sites/social_hosts.rs`, `profile_rules.rs`, `profiles.rs`, `catalogue.rs` and `SiteRow::dto`:

- **H1:** a bad stored link never breaks a website. The API re-checks every link as it serves
  site content and profiles and drops failures one at a time; the website decoders do the same.
- **H2:** a member's Other website is left out of the general site.
- **M1:** links must already be in the parser's canonical ASCII form (the CRM form sends
  `new URL(value).href`); spaces, control characters, `\`, user info, ports, trailing dots
  and `xn--` labels are refused before or after parsing.
- **M2:** only profile subdomains (`www`, `m`, `mobile`, TikTok's `vm`/`vt`, LinkedIn country
  codes); redirect paths (`/l.php`, `/redirect`, `/redir`, `/url`, `/link/`,
  `/attribution_link`, `/i/redirect`) and query values hiding another address are refused.
- **M3:** a member's own save stores their links; anyone else's edit keeps the stored links
  and may only omit or repeat them.
- **L2:** Other website refuses reserved names (`.test`, `.example`, `.local`, `.internal`
  and similar) and common URL shorteners.
- **L6:** public agents are an explicit field list, not the raw profile body.
- To build in SOC1b and SOC1c: CRM read-only links in the Admin's Team dialog shown as text
  (L3); websites with inline SVG icons, `<nav aria-label="Social media">`, "(opens in a new
  tab)" text, the Other website shown by its host name (L1); sample links clearly illustrative
  (L4).
