//! Team chat inside one company (docs/team-chat.md, packets C1 and C3): channels open to
//! every member (created by the Admin; #general for every company), private direct
//! conversations between two members, and private groups of up to 21 members. Mentions in
//! channels and groups notify in the app only. Own schema `chat`; bodies never leave it.
pub mod access;
mod change;
mod counts;
mod files;
mod group_input;
mod groups;
mod leave;
mod mentions;
mod messages;
mod participants;
mod read;
mod rooms;
pub mod routes;
mod send;
mod start;
mod view;
mod wire;
