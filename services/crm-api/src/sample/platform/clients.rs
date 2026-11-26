//! Writes the sample Blaqks One clients (`clients_data::CLIENTS`) and their timelines in the
//! shapes the `platform_clients` module writes: a website-form client is created by nobody
//! with the message on its first entry; the others are created by the person working them.
use super::{
    super::{data, failed, Outcome},
    client_spec::Client,
    clients_data::CLIENTS,
    marks,
    people::People,
};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

type Tx<'c> = Transaction<'c, Postgres>;

/// Adds the clients unless a set from an earlier seed is still there; returns how many
/// were added and how many were already present.
pub async fn seed(tx: &mut Tx<'_>, people: &People) -> Outcome<(usize, usize)> {
    let present = marks::live(tx, "client").await?.len();
    if present > 0 {
        return Ok((0, present));
    }
    let mut ids = Vec::with_capacity(CLIENTS.len());
    for spec in &CLIENTS {
        ids.push(insert(tx, people, spec).await?);
    }
    marks::mark(tx, "client", &ids).await?;
    Ok((ids.len(), 0))
}

async fn insert(tx: &mut Tx<'_>, people: &People, spec: &Client) -> Outcome<Uuid> {
    let id = Uuid::new_v4();
    let from_website = spec.source == "website_form";
    let creator = match from_website {
        true => None,
        false => people.id(spec.owner).or(Some(people.owner)),
    };
    let notes = (!from_website).then_some(spec.text);
    let latest = spec.history.iter().map(|entry| entry.2).min();
    let updated = latest.unwrap_or(spec.added_days_ago);
    sqlx::query(
        "INSERT INTO platform_clients.crm_platform_clients (id,company_name,contact_name,phone, \
         email,source,stage,notes,next_follow_up,owner_id,created_at,created_by,updated_at) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,CASE WHEN $9::int IS NULL THEN NULL ELSE \
         (now() AT TIME ZONE 'Asia/Dubai')::date+$9::int END,$10, \
         now()-make_interval(days=>$11),$12,now()-make_interval(days=>$13))",
    )
    .bind(id)
    .bind(data::name(spec.company))
    .bind(spec.contact)
    .bind(spec.phone_number())
    .bind(spec.email())
    .bind(spec.source)
    .bind(spec.stage)
    .bind(notes)
    .bind(spec.follow_up)
    .bind(people.id(spec.owner))
    .bind(spec.added_days_ago)
    .bind(creator)
    .bind(updated)
    .execute(&mut **tx)
    .await
    .map_err(failed)?;
    let message = from_website.then_some(spec.text);
    let first = (spec.added_days_ago, 0);
    entry(tx, id, "created", message, first, creator).await?;
    for (step, (kind, text, days_ago, who)) in (1..).zip(spec.history) {
        let author = people.id(*who).or(Some(people.owner));
        entry(tx, id, kind, Some(text), (*days_ago, step), author).await?;
    }
    Ok(id)
}

/// One timeline entry at `(days ago, step)`: each step a minute later, so entries of the
/// same day keep the story's order.
async fn entry(
    tx: &mut Tx<'_>,
    client: Uuid,
    kind: &str,
    body: Option<&str>,
    (days_ago, step): (i32, i32),
    author: Option<Uuid>,
) -> Outcome<()> {
    sqlx::query(
        "INSERT INTO platform_clients.crm_platform_client_timeline (id,client_id,kind,body, \
         author_id,at) VALUES ($1,$2,$3,$4,$5, \
         now()-make_interval(days=>$6)+make_interval(mins=>$7))",
    )
    .bind(Uuid::new_v4())
    .bind(client)
    .bind(kind)
    .bind(body)
    .bind(author)
    .bind(days_ago)
    .bind(step)
    .execute(&mut **tx)
    .await
    .map_err(failed)?;
    Ok(())
}

/// Archives the sample clients still kept, as the app's Archive does; their timelines stay.
pub async fn clear(tx: &mut Tx<'_>) -> Outcome<u64> {
    let ids = marks::live(tx, "client").await?;
    let archived = sqlx::query(
        "UPDATE platform_clients.crm_platform_clients SET archived_at=now(),updated_at=now(), \
         version=version+1 WHERE id=ANY($1) AND archived_at IS NULL",
    )
    .bind(&ids)
    .execute(&mut **tx)
    .await
    .map_err(failed)?;
    Ok(archived.rows_affected())
}
