//! Team chat inside one company (docs/team-chat.md, packet C1): channels open to every
//! member (created by the Admin; #general for every company) and private direct
//! conversations between two members. Own schema `chat`; message bodies never leave it.
pub mod access;
mod change;
mod messages;
mod read;
mod rooms;
pub mod routes;
mod start;
mod wire;
