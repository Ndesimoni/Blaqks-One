//! Blaqks One's own clients (BO1e, docs/blaqks-one-console.md §9 and §11): a small sales
//! list of brokerages and agents interested in Blaqks One, worked on by the Owner and the
//! team members with the `clients` area (reads View, changes Manage). Owns schema
//! `platform_clients`: the clients and their append-only timeline (migration 0093). It
//! never reads or writes company data: people's names come from the published identity
//! view, a linked company's name from `workspaces::platform::company_names`, and the
//! sign-up module links a new company through `link_signup` in its own transaction. The
//! marketing website's contact form adds clients through the public intake.
mod archive;
mod create;
mod entries;
mod events;
mod guard;
mod input;
mod intake;
mod list;
mod model;
mod owners;
pub mod platform_counts;
mod read;
pub mod routes;
mod rules;
mod signup;
mod store;
mod timeline;
mod update;
mod view;

pub use signup::link_signup;
