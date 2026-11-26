//! Writes the sample help requests (`help_data::REQUESTS`) in the shapes the `support` module
//! writes. Requesters are only the company sample staff (`crm_sample_accounts`) of live
//! companies, so no real person is ever made to ask; without any, help is skipped.
use super::{
    super::{failed, Outcome},
    help_data::{Request, REQUESTS},
    marks,
    people::People,
};
use crate::workspaces::ORGANISATION;
use sqlx::{FromRow, Postgres, Transaction};
use uuid::Uuid;

type Tx<'c> = Transaction<'c, Postgres>;

#[derive(FromRow)]
struct Requester {
    id: Uuid,
    workspace_id: String,
}

pub enum Help {
    Added(usize),
    Present(usize),
    /// No company has sample staff to ask (run the company sample command first).
    NoRequesters,
}

pub async fn seed(tx: &mut Tx<'_>, people: &People) -> Outcome<Help> {
    let present = marks::live(tx, "help_request").await?.len();
    if present > 0 {
        return Ok(Help::Present(present));
    }
    let requesters = sqlx::query_as::<_, Requester>(
        "SELECT u.id,u.workspace_id FROM crm_sample_accounts m JOIN crm_users u ON u.id=m.user_id \
         JOIN crm_users o ON o.id=u.owner_id WHERE m.workspace_id<>$1 AND u.role='staff' \
         AND u.active AND u.deleted_at IS NULL AND o.active AND o.deleted_at IS NULL \
         ORDER BY u.workspace_id,u.name,u.id",
    )
    .bind(ORGANISATION)
    .fetch_all(&mut **tx)
    .await
    .map_err(failed)?;
    if requesters.is_empty() {
        return Ok(Help::NoRequesters);
    }
    let mut ids = Vec::with_capacity(REQUESTS.len());
    for (spec, requester) in REQUESTS.iter().zip(requesters.iter().cycle()) {
        ids.push(insert(tx, people, spec, requester).await?);
    }
    marks::mark(tx, "help_request", &ids).await?;
    Ok(Help::Added(ids.len()))
}

async fn insert(
    tx: &mut Tx<'_>,
    people: &People,
    spec: &Request,
    requester: &Requester,
) -> Outcome<Uuid> {
    let id = Uuid::new_v4();
    let opened = spec.opened_minutes_ago;
    let last = spec.messages.iter().map(|message| message.2).max();
    let updated = opened - last.unwrap_or(0);
    let answered = spec.messages.iter().find(|message| message.0);
    let first_answer = answered.map(|message| opened - message.2);
    let read = if spec.read { updated } else { opened };
    sqlx::query(
        "INSERT INTO support.crm_support_requests (id,workspace_id,requester_id,category, \
         subject,state,assignee_id,created_at,updated_at,first_answer_at,solved_at, \
         requester_read_at) VALUES ($1,$2,$3,$4,$5,$6,$7,now()-make_interval(mins=>$8), \
         now()-make_interval(mins=>$9),now()-make_interval(mins=>$10), \
         CASE WHEN $6='solved' THEN now()-make_interval(mins=>$9) END, \
         now()-make_interval(mins=>$11))",
    )
    .bind(id)
    .bind(&requester.workspace_id)
    .bind(requester.id)
    .bind(spec.category)
    .bind(spec.subject)
    .bind(spec.state)
    .bind(people.id(spec.assignee))
    .bind(opened)
    .bind(updated)
    .bind(first_answer)
    .bind(read)
    .execute(&mut **tx)
    .await
    .map_err(failed)?;
    for (platform, body, after, who) in spec.messages {
        let (author, side) = match platform {
            true => (people.id(*who).unwrap_or(people.owner), "platform"),
            false => (requester.id, "member"),
        };
        sqlx::query(
            "INSERT INTO support.crm_support_messages (id,request_id,author_id,side,body, \
             created_at) VALUES ($1,$2,$3,$4,$5,now()-make_interval(mins=>$6))",
        )
        .bind(Uuid::new_v4())
        .bind(id)
        .bind(author)
        .bind(side)
        .bind(body)
        .bind(opened - after)
        .execute(&mut **tx)
        .await
        .map_err(failed)?;
    }
    Ok(id)
}

/// Marks the sample requests solved; requests and their messages are kept as history.
pub async fn clear(tx: &mut Tx<'_>) -> Outcome<u64> {
    let ids = marks::live(tx, "help_request").await?;
    let solved = sqlx::query(
        "UPDATE support.crm_support_requests SET state='solved',solved_at=now(), \
         updated_at=now(),version=version+1 WHERE id=ANY($1) AND state<>'solved'",
    )
    .bind(&ids)
    .execute(&mut **tx)
    .await
    .map_err(failed)?;
    Ok(solved.rows_affected())
}
