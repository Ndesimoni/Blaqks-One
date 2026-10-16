# Design system v2: Limestone

Status: **approved by the owner on 2026-10-16**, not yet built. This is the new visual baseline for the premium redesign (feature 1 in [Product vision](product-vision.md)). It replaces the forest-green and gold refresh screen by screen, starting with the Dashboard. Until a screen has been migrated, it keeps the [current refresh](design-refresh.md) look; never mix the two styles on one screen.

The owner chose direction **B+ · Limestone** from three previews (A · Emerald Atelier, B · Limestone, C · Midnight). B+ is Limestone with two elements from Midnight: the large 12-month fees chart and the ring-chart finance card. The owner also asked for small charts in the key-figure cards and a collapsible sidebar. Interactive previews of all directions, in light and dark mode, are on the owner's private design canvas: https://claude.ai/artifact/JHoU8Zf49vRWNV5X3CnLbK. This document is the source of truth when building, because agents cannot open that canvas.

## Character

Calm, editorial and orderly: warm stone surfaces, near-black text and one forest-green accent. Sections are separated by **hairline rules, not boxed cards**. Large, light-weight figures carry the hierarchy. Colour is used sparingly and always means something (the current period, a target, an alert).

## Themes

**Light is the default** (owner, 2026-10-16). Dark mode is a full alternative, and each person's saved choice is remembered. The first visit and a missing preference open in light.

| Token           | Light     | Dark      | Use                                                 |
| --------------- | --------- | --------- | --------------------------------------------------- |
| `--bg`          | `#F3F0EA` | `#151412` | Page background (limestone / warm charcoal)         |
| `--panel`       | `#FBFAF7` | `#1C1B18` | Inputs, callouts, menus, modals                     |
| `--hover`       | `#E9E5DD` | `#24231F` | Hover and selected navigation                       |
| `--line`        | `#DCD6CB` | `#36342E` | Hairline dividers and borders                       |
| `--ink`         | `#1B1A17` | `#F1EEE8` | Text, section rules, primary button fill            |
| `--muted`       | `#686359` | `#A9A499` | Labels and supporting text (≥ 4.5:1 on `--bg`)      |
| `--accent`      | `#1F5A43` | `#86C9A6` | Forest green: current period, positive trend, links |
| `--accent-soft` | `#E2ECE5` | `#22302A` | Accent backgrounds and chart fills                  |
| `--warm`        | `#A3531F` | `#E59C66` | Second series, pending amounts, alert dots          |
| `--bar`         | `#E2DDD3` | `#2E2C28` | Chart tracks and inactive bars                      |

Chart series order: accent, warm, ink, light accent, muted, pale. Two series that must be told apart also differ in lightness. Status colours (error, success) are added to the token set when the first form is migrated, with checked contrast in both themes.

## Typography

- **Geist** for interface text and figures; **Geist Mono** for small uppercase labels (11px, 0.06em tracking). Both are SIL Open Font License; self-host the WOFF2 files rather than loading them from Google Fonts. Only Arabic needs a separate font, chosen with the language feature.
- Body 14px/1.5. Page title 52px, weight 600, −0.045em (36px on phones). Key figures 52px, weight 500, −0.04em, with the unit at 20px in `--muted` (for example **38.6**M AED).
- All figures use tabular numerals. Money follows the existing UAE formatting helpers.

## Layout

- Spacing stays on the 4px scale. Desktop content padding 32px top, 48px sides; phones 16px sides.
- Dashboard grid: 12 columns with a 40px gutter. Fees chart 8 columns + finance 4; the remaining sections are 6 + 6. Below 1180px each section spans the full width; key figures go to 2 columns, then 1 on phones.
- A section starts with a 1px `--ink` rule, then a mono label and an optional text link (green, underlined). Key figures sit in one strip divided by `--line` rules.
- Controls: buttons are 44px high and fully rounded (pill). The primary button is filled with `--ink` and has `--bg` text. Period switching (Month / Quarter / Year) uses underlined tabs. Search is a pill input.

## Sidebar

- **Open:** 248px, with icon, label and count, grouped under mono headings (Workspace, Sales, Settings).
- **Closed:** 80px, icons only. A "K" brand mark replaces the name, and thin rules replace the headings. Each icon has a tooltip and an accessible name that includes its count. Items needing attention (Messages, Follow-ups, Viewings) show a small `--warm` dot.
- A panel button beside the brand toggles it (`aria-expanded`). The width animates over 220ms; reduced motion switches instantly.
- Defaults: open on desktop, closed on tablets (768–1279px), and a slide-in drawer from a menu button on phones. Remember each person's choice.

## Charts

Charts are hand-built SVG components with no chart library. They use `vector-effect: non-scaling-stroke`, both themes, a text alternative (`role="img"` and `aria-label`) and the bar/line grow-in animation (disabled for reduced motion).

| Component         | Where                     | Form                                                                     |
| ----------------- | ------------------------- | ------------------------------------------------------------------------ |
| Column sparkline  | Active leads              | 8 weekly columns, latest in `--accent`, others `--bar`                   |
| Stage bar         | Open deals                | Segmented bar with a mono legend (negotiating / contract / transfer)     |
| Trend sparkline   | Pipeline value            | Line + soft area, end dot                                                |
| Target bar        | Fees this month           | Progress against target with an end marker and "x% of target"            |
| Comparison area   | Fees received · 12 months | This year line + area, last year dashed, gridlines, latest-month callout |
| Ring              | Monthly finance           | Received / pending / expenses with net in the centre, ledger rows below  |
| Pipeline bars     | Pipeline                  | Horizontal bars per stage with counts and stage-to-stage conversion      |
| Share bar + table | Lead sources              | 100% stacked bar, then a table with leads, share and closed              |
| Table with target | Team                      | Deals, fees and a thin target bar per agent                              |
| Agenda            | Today                     | Time, title, place and person, with a coloured type label                |

## Motion

Brief and purposeful: 160ms colour and border transitions, 220ms sidebar width, and an 800ms chart grow-in with `cubic-bezier(.2,.8,.2,1)`. Buttons move 1px when pressed. Everything respects `prefers-reduced-motion`.

## Right-to-left readiness

Use logical properties only (`margin-inline`, `padding-inline`, `inset-inline`, `border-inline-start`, `text-align: start/end`), and flex/grid ordering rather than left/right positioning. Time-series charts mirror in right-to-left layout. This prepares feature 2 (English and Arabic).

## Rollout

1. Foundation: tokens for both themes with light as the default, self-hosted fonts, and shared buttons, tabs, inputs, section headers and the collapsible sidebar.
2. Chart components (above), each in its own file under the 150-line rule.
3. Dashboard on scoped server aggregates, with permission-aware sections, skeleton loading and empty states.
4. Then the remaining screens one at a time, with behaviour unchanged. Update [Design standards](design-standards.md) and the reference screenshots as each lands.
