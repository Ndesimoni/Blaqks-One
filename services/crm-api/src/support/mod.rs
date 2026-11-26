//! Help requests (BO1c, docs/blaqks-one-console.md §3 item 3 and §11): any company member asks
//! Blaqks One for help and reads the answers; the Owner and the Blaqks One team members with
//! the `help_requests` area read (View), answer, assign and solve (Manage). Only the requester
//! and that team read a request, never the requester's company Admin. Owns schema `support`
//! (migration 0094). People's names come from the published identity view and a company's
//! name from `workspaces::platform::company_names`; it never reads a company's records.
mod events;
mod guard;
mod input;
mod member;
mod member_thread;
mod platform;
pub mod platform_counts;
mod platform_thread;
pub mod routes;
mod store;
mod view;
