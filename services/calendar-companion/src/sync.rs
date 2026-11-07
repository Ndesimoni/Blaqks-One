use crate::{
    api::persist,
    store::{now, random_id},
    App,
};

pub async fn tick(app: &App) -> Result<(), String> {
    let _gate = app.sync_gate.lock().await;
    let pending: Vec<_> = {
        let store = app.store.lock().await;
        store
            .sessions
            .iter()
            .filter_map(|(id, session)| {
                if !session.ready {
                    return None;
                }
                let tokens = session.tokens.clone()?;
                let calendar = session.calendar.as_ref()?;
                let (key, job) = session.jobs.iter().find(|(_, j)| {
                    j.calendar_id == calendar.id && j.pending() && j.retry_at <= now()
                })?;
                Some((id.clone(), key.clone(), job.clone(), tokens))
            })
            .collect()
    };
    for (id, key, job, mut tokens) in pending {
        let result = match app
            .google
            .refresh(&mut tokens, &app.client_id, &app.client_secret)
            .await
        {
            Ok(()) => app.google.apply(&tokens, &job).await,
            Err(failure) => Err(failure),
        };
        let mut store = app.store.lock().await;
        let mut candidate = store.clone();
        let session = candidate.sessions.get_mut(&id).unwrap();
        if session
            .tokens
            .as_ref()
            .is_none_or(|t| t.refresh != tokens.refresh)
        {
            continue;
        }
        session.tokens = Some(tokens);
        let Some(current) = session.jobs.get_mut(&key) else {
            continue;
        };
        match result {
            Ok(url) => {
                current.synced = job.desired;
                current.remote_exists = current.synced.is_some();
                current.url = url;
                current.error = None;
                current.attempts = 0;
                current.retry_at = 0;
                // Google retains deleted IDs. Reopening this record needs a fresh event ID.
                if !current.remote_exists {
                    current.google_id = random_id();
                }
            }
            Err(failure) => {
                current.error = Some(failure.message.clone());
                current.attempts = current.attempts.saturating_add(1);
                current.retry_at = now() + (5 * 2_i64.pow(current.attempts.min(6))).min(300);
                if failure.reconnect {
                    session.tokens = None;
                    session.connection_error = Some(failure.message);
                }
            }
        }
        persist(app, &mut store, candidate)
            .map_err(|_| "Calendar sync could not be saved to disk".to_string())?;
    }
    Ok(())
}
