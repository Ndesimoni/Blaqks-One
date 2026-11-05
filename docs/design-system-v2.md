# Design system v2: Midnight

Status: **parked (owner, 2026-10-16).** The owner returned to the original [CRM design refresh](design-refresh.md), which stays the approved baseline in [Design standards](design-standards.md). Do not build to this spec unless the owner revives it. The Midnight Dashboard built from it is preserved in commit `673ddd3` and was reverted in the following commit; the Limestone variant is in `d8d5e3e`.

The owner compared three previews (A · Emerald Atelier, B · Limestone, C · Midnight) and first approved a Limestone variant, then on the same day switched to **C · Midnight** after seeing the built Limestone Dashboard. Midnight keeps the additions the owner asked for during review: a small, meaning-specific chart in each key figure and a collapsible sidebar. Interactive previews are on the owner's private design canvas: https://claude.ai/artifact/JHoU8Zf49vRWNV5X3CnLbK. This document is the source of truth when building, because agents cannot open that canvas.

## Character

Modern, confident and data-dense, like a premium finance app: near-black graphite surfaces, a jade accent with blue and amber as supporting colours, and soft depth. Content sits in **rounded bento tiles** with a thin border and a soft shadow. Bold, tightly tracked figures carry the hierarchy. Colour always means something (the current period, a target, an alert).

## Themes

Midnight was designed dark-first and has a full light theme. **Dark is the default** (owner, 2026-10-16), as the CRM already opens today. Each person's saved choice is always remembered.

| Token           | Dark                   | Light                | Use                                        |
| --------------- | ---------------------- | -------------------- | ------------------------------------------ |
| `--bg`          | `#090C12`              | `#F2F4F8`            | Page background                            |
| `--panel`       | `#10151E`              | `#FFFFFF`            | Tiles, menus, modals                       |
| `--panel2`      | `#171E2A`              | `#F1F3F7`            | Insets, tracks, inactive bars, hover       |
| `--line`        | `#222B39`              | `#E2E6EE`            | Tile borders and dividers                  |
| `--ink`         | `#E9EDF4`              | `#0E1422`            | Text                                       |
| `--muted`       | `#8E98AA`              | `#566074`            | Labels and supporting text (≥ 4.5:1)       |
| `--accent`      | `#3DDC97`              | `#047857`            | Jade: primary action, current period, gain |
| `--accent-soft` | `rgba(61,220,151,.14)` | `rgba(4,120,87,.10)` | Chips, highlights, chart glow              |
| `--on-accent`   | `#06261A`              | `#FFFFFF`            | Text on the primary button                 |
| `--blue`        | `#7AA2F7`              | `#3157C4`            | Second series, outstanding amounts         |
| `--amber`       | `#F5B54A`              | `#A85A07`            | Third series, "now", alerts, expenses      |

Tile shadow: dark `inset 0 1px 0 rgba(255,255,255,.04), 0 24px 48px -24px rgba(0,0,0,.7)`; light `0 1px 2px rgba(14,20,34,.04), 0 16px 32px -20px rgba(14,20,34,.18)`. Status colours (error, success) are added with checked contrast when the first form is migrated. Series that must be told apart also differ in lightness, and legends or labels always accompany colour.

## Typography

- **Plus Jakarta Sans** (SIL Open Font License, self-hosted) for all text and figures. Only Arabic needs a separate font, chosen with the language feature.
- Body 14px/1.5. Page title 34px, weight 800, −0.035em (28px on phones). Key figures 32px, weight 800, −0.035em; the hero figure 44px, −0.04em. Labels 13px, weight 600, `--muted`.
- All figures use tabular numerals. Money follows the existing UAE formatting helpers.

## Layout

- Spacing stays on the 4px scale. Content padding 24px top, 32px sides on desktop; 16px on phones.
- **Bento grid:** 4 columns with a 16px gap at desktop, 2 columns below 1180px, 1 column on phones. Tiles have a 24px radius, 1px `--line` border, the tile shadow and 24px padding.
- Dashboard: the fees comparison chart is the hero tile (2 columns × 2 rows) beside the key-figure tiles, then finance, pipeline and sources, then today and team.
- Controls: 44px buttons with a 14px radius. The primary button is filled with `--accent` and uses `--on-accent` text. Segmented controls sit in a bordered panel. Chips are pills (12px, weight 700) on `--accent-soft` or `--panel2`.

## Sidebar

- **Closed:** an 80px icon rail with the brand mark, icons, tooltips and accessible names that include counts. Items needing attention show a small `--amber` dot. The active item uses `--accent-soft` with `--accent` icon colour.
- **Open:** 248px, with icon, label and count, grouped under Workspace, Sales and Settings.
- A toggle beside the brand switches between them (`aria-expanded`), animating over 220ms; reduced motion switches instantly.
- Defaults: open on desktop, closed on tablets (768–1279px), a slide-in drawer from a menu button on phones. Remember each person's choice. Built with the shell step, after the Dashboard.

## Charts

Charts are hand-built SVG/CSS components with no chart library. They use `vector-effect: non-scaling-stroke`, both themes, a text alternative (`role="img"` and `aria-label`) and a grow-in animation that is disabled for reduced motion.

| Component         | Where                       | Form                                                                                       |
| ----------------- | --------------------------- | ------------------------------------------------------------------------------------------ |
| Column sparkline  | Active leads, viewings      | Rounded columns, latest in `--accent`, others `--panel2`                                   |
| Stage bar         | Follow-ups, deals, listings | Rounded segmented bar with a legend                                                        |
| Target bar        | Fees this month             | Progress against target, shown only when a target exists                                   |
| Comparison area   | Fees · 12 months (hero)     | Jade line and area, dashed muted last year, glowing end dot, latest-month callout          |
| Ring              | Finance                     | Round-capped segments (received jade, outstanding blue, expenses amber), net in the centre |
| Pipeline columns  | Lead pipeline               | Vertical rounded columns with counts; no stage-to-stage conversion without stage history   |
| Bar list          | Lead sources                | Horizontal rounded bars; top three jade, blue and amber, the rest muted                    |
| Leaderboard       | Team                        | Rank, initials avatar, name, fees and deals, and a % of target chip when a target exists   |
| Timeline + agenda | Today                       | 09:00–19:00 timeline with an amber "now" line, then the overdue and next-items list        |

## Motion

Tiles fade up 8px over 600ms with a short stagger; charts grow in over 900ms; colour and border transitions take 160ms; all with `cubic-bezier(.2,.8,.2,1)`. Buttons move 1px when pressed. Everything respects `prefers-reduced-motion`.

## Right-to-left readiness

Use logical properties only (`margin-inline`, `padding-inline`, `inset-inline`, `border-inline-start`, `text-align: start/end`), and flex/grid ordering rather than left/right positioning. Time-series charts mirror in right-to-left layout. This prepares feature 2 (English and Arabic).

## Rollout

1. Dashboard content (in progress): v2 tokens scoped to the Dashboard, self-hosted font, chart components.
2. Shell: sidebar, top bar and page chrome, keeping dark as the default.
3. The remaining screens one at a time, with behaviour unchanged. Update [Design standards](design-standards.md) and the reference screenshots as each lands.
