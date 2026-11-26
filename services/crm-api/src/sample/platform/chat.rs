//! Sample Team chat for the Blaqks One team only: a short morning in #general and one direct
//! conversation between the Owner and Sample · Grace Mensah. Messages from a member who is
//! not live are left out rather than put in the Owner's name.
use super::{
    super::{failed, Outcome},
    chat_data::{Line, DIRECT, GENERAL},
    marks,
    people::{People, Who::Grace},
};
use crate::workspaces::ORGANISATION;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

type Tx<'c> = Transaction<'c, Postgres>;

/// Returns how many messages were added and how many were already present.
pub async fn seed(tx: &mut Tx<'_>, people: &People) -> Outcome<(usize, usize)> {
    let present = marks::live(tx, "chat_message").await?.len();
    if present > 0 {
        return Ok((0, present));
    }
    let general = general(tx, people.owner).await?;
    let mut ids = post(tx, people, general, &GENERAL).await?;
    if let Some(grace) = people.live(Grace) {
        let room = direct(tx, people.owner, grace).await?;
        marks::mark(tx, "chat_room", &[room]).await?;
        ids.extend(post(tx, people, room, &DIRECT).await?);
    }
    marks::mark(tx, "chat_message", &ids).await?;
    Ok((ids.len(), 0))
}

/// The organisation's #general, created as the chat module creates it.
async fn general(tx: &mut Tx<'_>, owner: Uuid) -> Outcome<Uuid> {
    sqlx::query(
        "INSERT INTO chat.crm_chat_rooms (id,workspace_id,kind,name,created_by) \
         VALUES ($1,$2,'channel','general',$3) \
         ON CONFLICT (workspace_id,name) WHERE kind='channel' DO NOTHING",
    )
    .bind(Uuid::new_v4())
    .bind(ORGANISATION)
    .bind(owner)
    .execute(&mut **tx)
    .await
    .map_err(failed)?;
    sqlx::query_scalar(
        "SELECT id FROM chat.crm_chat_rooms WHERE workspace_id=$1 AND kind='channel' \
         AND name='general'",
    )
    .bind(ORGANISATION)
    .fetch_one(&mut **tx)
    .await
    .map_err(failed)
}

/// A new direct room between two people, keyed as the chat module keys it.
async fn direct(tx: &mut Tx<'_>, owner: Uuid, peer: Uuid) -> Outcome<Uuid> {
    let (low, high) = if owner < peer {
        (owner, peer)
    } else {
        (peer, owner)
    };
    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO chat.crm_chat_rooms (id,workspace_id,kind,direct_key,created_by) \
         VALUES ($1,$2,'direct',$3,$4)",
    )
    .bind(id)
    .bind(ORGANISATION)
    .bind(format!("{low}:{high}"))
    .bind(owner)
    .execute(&mut **tx)
    .await
    .map_err(failed)?;
    sqlx::query(
        "INSERT INTO chat.crm_chat_participants (room_id,member_id) VALUES ($1,$2),($1,$3)",
    )
    .bind(id)
    .bind(low)
    .bind(high)
    .execute(&mut **tx)
    .await
    .map_err(failed)?;
    Ok(id)
}

async fn post(tx: &mut Tx<'_>, people: &People, room: Uuid, lines: &[Line]) -> Outcome<Vec<Uuid>> {
    let mut ids = Vec::new();
    for (who, body, minutes_ago) in lines {
        let Some(author) = people.live(*who) else {
            continue;
        };
        let id = Uuid::new_v4();
        sqlx::query(
            "WITH sent AS (INSERT INTO chat.crm_chat_messages (id,room_id,workspace_id, \
             author_id,body,created_at) VALUES ($1,$2,$3,$4,$5,now()-make_interval(mins=>$6)) \
             RETURNING created_at) UPDATE chat.crm_chat_rooms r SET last_message_at= \
             GREATEST(r.last_message_at,sent.created_at) FROM sent WHERE r.id=$2",
        )
        .bind(id)
        .bind(room)
        .bind(ORGANISATION)
        .bind(author)
        .bind(body)
        .bind(minutes_ago)
        .execute(&mut **tx)
        .await
        .map_err(failed)?;
        ids.push(id);
    }
    Ok(ids)
}

/// Removes the sample messages, then the sample direct room.
pub async fn clear(tx: &mut Tx<'_>) -> Outcome<u64> {
    let messages = marks::live(tx, "chat_message").await?;
    let removed = sqlx::query("DELETE FROM chat.crm_chat_messages WHERE id=ANY($1)")
        .bind(&messages)
        .execute(&mut **tx)
        .await
        .map_err(failed)?;
    let rooms = marks::live(tx, "chat_room").await?;
    sqlx::query("DELETE FROM chat.crm_chat_rooms WHERE id=ANY($1)")
        .bind(&rooms)
        .execute(&mut **tx)
        .await
        .map_err(failed)?;
    Ok(removed.rows_affected())
}
