# Product decisions

Owner decisions that settle open questions in the [implementation roadmap](claude-implementation-roadmap.md#17-business-decisions-to-settle-before-the-dependent-packets). They override the roadmap's recommended starting points where the two differ. Record new decisions here with their date; do not change a decision without the owner's approval.

## Record visibility and assignment (decided 2026-10-12)

| Topic                    | Decision                                                                                                                                                                                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Staff visibility         | Staff see **only the records assigned to them**, including on their dashboard. This applies to lists, search, counts, dashboard figures, reports, exports, link pickers and recipient suggestions; hidden records must not be revealed through totals or error messages. |
| Admin and Super Admin    | An Admin sees their whole team. The Super Admin sees every team. Unchanged from the current model.                                                                                                                                                                       |
| Full-team access         | Optional per-person grant, **off by default**. An Admin may give a staff member (for example a team manager) access to the whole team's records. It never extends beyond the team.                                                                                       |
| Assignment on create     | A record a staff member creates is **assigned to its creator by default**. The creator may then assign it to an approved member of the same team.                                                                                                                        |
| Reassignment consequence | A staff member without full-team access who reassigns a record loses sight of it. The interface must say so before the change is confirmed.                                                                                                                              |

## Public listings (decided 2026-10-12)

| Topic                           | Decision                                                                                                                                                                                                                                                               |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Who can be a listing agent      | **Any staff member the Admin grants listing permission to.** No separate professional-credential gate in the product. Publication still requires exact-version Super Admin approval.                                                                                   |
| Coworkers and one property      | Each permitted coworker has **their own public listing**, not internal collaborator status.                                                                                                                                                                            |
| Listings per team               | **At most 2 live listings of the same property per Admin team.**                                                                                                                                                                                                       |
| Teams per property              | **At most 2 Admin teams** may list the same property. A third team's submission is **rejected**. Maximum: 4 live listings of one property across the website.                                                                                                          |
| What counts                     | Submitted, approved-awaiting-activation and published listings hold a slot. Draft, rejected/changes-requested, withdrawn and expired listings do not. Enforce at submission and recheck at approval and activation so concurrent submissions cannot exceed the limits. |
| Same-property detection         | The server identifies the physical property (for example by advertising permit number or normalised building + unit reference), so a duplicate private Property record cannot bypass the limits.                                                                       |
| Privacy of the cross-team check | The cross-team comparison runs on the server only. A rejection states that the property has reached its listing limit; it never reveals which team, agent or private record holds the other listings.                                                                  |
| Permits                         | Each public listing carries its own advertising permit reference, checked at Super Admin approval. Confirm the applicable UAE/Dubai permit rules with the company's compliance contact.                                                                                |
| Website presentation            | Proposed, pending design review: each agent's listing is shown separately but linked ("Also listed by …"), with one canonical page for search engines.                                                                                                                 |

## Enquiries (decided 2026-10-12)

| Topic                            | Decision                                                                                                                                                                                                         |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Routing                          | An enquiry goes to the listing's approved agent first, then to that team's Admin queue.                                                                                                                          |
| Unassigned or orphaned enquiries | If the agent is unavailable, suspended or removed, their open enquiries move to their own team's Admin queue. Attribution history is preserved; enquiries are never moved to another Admin's team automatically. |

## Still open

Business mail provider, WhatsApp number ownership, social account ownership, Super Admin communication visibility, marketing campaigns, calling, hosting/retention region and public languages remain open; see roadmap section 17. They do not block P1.
