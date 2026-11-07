# Blaqks One technology stack

Status: target stack agreed with the owner on 2026-10-15. **In use** means it runs today; **At launch** is needed for hosting and public sign-up; **Later** is added when the named feature arrives. The architecture rules are in [Service boundaries](service-boundaries.md) and the queued work is in the [roadmap](claude-implementation-roadmap.md#15-remaining-connected-crm-work-outside-the-integrations). A printable copy is in [Blaqks-One-Tech-Stack.pdf](Blaqks-One-Tech-Stack.pdf).

## Frontend

| Technology         | Status | Why we use it                                                           | Problem it solves                                                      |
| ------------------ | ------ | ----------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| React 18           | In use | Widely used component library for building screens from reusable pieces | Keeps a large CRM interface consistent and maintainable                |
| React Router       | In use | Standard page navigation for React                                      | Each screen has its own address and survives a reload                  |
| Vite               | In use | Very fast development server and production build tool                  | Instant updates while building; small, fast files for users            |
| JavaScript and CSS | In use | Plain, well-known languages with light and dark themes                  | No heavy framework lock-in; easy to hire for                           |
| JSZip              | In use | Small library for zip files                                             | Builds Excel workbooks and backups without a large spreadsheet library |

## Backend

| Technology     | Status | Why we use it                                                    | Problem it solves                                         |
| -------------- | ------ | ---------------------------------------------------------------- | --------------------------------------------------------- |
| Rust           | In use | Fast, memory-safe language that catches many bugs before release | Reliable server that handles money and permissions safely |
| Axum and Tokio | In use | Modern Rust web framework and asynchronous runtime               | Serves many users at once with little hardware            |
| SQLx           | In use | Database library that checks queries and runs migrations         | Safe database access and versioned database changes       |
| Argon2         | In use | Recommended password-hashing method                              | Stolen database copies cannot reveal passwords            |
| Rustls         | In use | Modern, memory-safe encryption library                           | Encrypted connections without OpenSSL vulnerabilities     |

## Data and storage

| Technology                                     | Status    | Why we use it                                                             | Problem it solves                                                              |
| ---------------------------------------------- | --------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| PostgreSQL 17                                  | In use    | Proven, open-source database with strong transactions and integrity rules | One trusted source of truth; each company's data stays separate and consistent |
| Docker and Docker Compose                      | In use    | Runs PostgreSQL the same way on every machine                             | Identical development setup; disposable databases for tests                    |
| Managed PostgreSQL in a UAE region             | At launch | Hosted database with automatic backups, updates and failover              | No manual database operations; meets UAE data-location expectations            |
| Object storage in a UAE region (S3-compatible) | At launch | Durable storage for property photos, floor plans and agreement evidence   | Media off the database server, cheap to store and served through the CDN       |
| Valkey (open-source Redis)                     | Later     | In-memory cache and fast counters                                         | Fast public listing pages and real-time features when traffic grows            |

## Hosting and traffic

| Technology                               | Status    | Why we use it                                                  | Problem it solves                                                                           |
| ---------------------------------------- | --------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Cloud provider with a UAE region         | At launch | For example AWS (UAE) or Azure (UAE North)                     | Client data stays in or near the UAE under its data-protection law                          |
| Cloudflare CDN                           | At launch | Global network that serves files and images from near the user | Fast website and photos; blocks attacks and bad traffic before it reaches us                |
| Cloudflare Turnstile                     | At launch | Privacy-friendly bot check on sign-up and sign-in              | Stops fake sign-ups and automated password guessing                                         |
| Nginx (reverse proxy and gateway)        | At launch | Industry-standard entry point in front of our services         | HTTPS, routing `/api/crm`, `/api/public` and `/api/calendar`, rate limits, security headers |
| Forward proxy for outbound calls         | Later     | Controls which outside services our servers may call           | Limits and logs calls to WhatsApp, Meta and AI providers                                    |
| Dedicated API gateway (for example Kong) | Later     | API keys, usage plans and billing per company                  | Only needed if Blaqks One offers an API to outside partners                                 |

Private CRM data is never cached by the CDN or proxy; only public files, photos and approved public listings are cached.

## Accounts, messaging and integrations

| Technology                           | Status          | Why we use it                                       | Problem it solves                                                     |
| ------------------------------------ | --------------- | --------------------------------------------------- | --------------------------------------------------------------------- |
| Transactional email service          | At launch       | For example Amazon SES or Postmark                  | Sign-up verification, invitations and password recovery reach inboxes |
| WhatsApp Business Platform           | Later           | Official WhatsApp API                               | Send and receive client messages from the CRM, within Meta's rules    |
| Meta (Facebook and Instagram) APIs   | Later           | Official business-account connections               | Social messages and ad leads arrive in the CRM                        |
| UAE PASS                             | Later           | UAE government digital identity and signing         | Strongest proof for cross-company deal agreements                     |
| Online payments (for example Stripe) | Later           | Subscription billing for companies                  | Companies pay for Blaqks One plans online                             |
| Google Calendar companion            | In use (paused) | Separate small Rust service, kept for a later phase | Two-way calendar sync when it resumes                                 |

## Quality, delivery and operations

| Technology                            | Status    | Why we use it                                                                                       | Problem it solves                                                       |
| ------------------------------------- | --------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Node test runner, Cargo test          | In use    | Unit and API tests for the frontend and backend                                                     | Catches broken rules and calculations before release                    |
| Playwright                            | In use    | Real-browser tests of complete user journeys                                                        | Proves screens work end to end, on phone and desktop sizes              |
| Prettier, rustfmt, Clippy, size check | In use    | Automatic formatting, code-quality checks and a 150-line file limit                                 | Consistent, readable code that stays easy to change                     |
| cargo-deny, npm audit and Dependabot  | In use    | Scans dependencies for known security holes and licence problems; opens weekly update pull requests | Vulnerable or wrongly licensed libraries are caught and updated quickly |
| Git and GitHub                        | In use    | Version history and code hosting                                                                    | Every change is tracked and recoverable                                 |
| GitHub Actions                        | In use    | Runs all checks automatically on every change                                                       | Nothing is released without passing tests                               |
| Error tracking and uptime monitoring  | At launch | For example Sentry plus an uptime checker                                                           | We learn about problems before customers report them                    |
| Encrypted backups and restore drills  | At launch | Regular, tested database and media backups                                                          | Data can be recovered after mistakes or outages                         |
