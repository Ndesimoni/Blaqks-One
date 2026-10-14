//! Second check, after connecting and before migrations or any write: the database must
//! carry the `crm_environment` local-development marker. Only the local Docker compose
//! database receives it (init script for new volumes, `npm run db:mark-dev` inside the
//! container), so a tunnel or proxy on a loopback port to another server is refused.
use super::{failed, Outcome};
use sqlx::PgPool;

pub const UNMARKED: &str = "This database is not marked as a local development database. \
     Nothing was changed. For the local Docker database, run npm run db:mark-dev once.";

pub async fn ensure(pool: &PgPool) -> Outcome<()> {
    let table: bool =
        sqlx::query_scalar("SELECT to_regclass('public.crm_environment') IS NOT NULL")
            .fetch_one(pool)
            .await
            .map_err(failed)?;
    let marked = table
        && sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(SELECT 1 FROM public.crm_environment WHERE name='local-development')",
        )
        .fetch_one(pool)
        .await
        .map_err(failed)?;
    if marked {
        Ok(())
    } else {
        Err(UNMARKED.into())
    }
}
