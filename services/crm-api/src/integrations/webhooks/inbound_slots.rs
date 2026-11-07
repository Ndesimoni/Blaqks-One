//! Slots for incoming-mail posts (E3c review M1): at most two at a time per connection and
//! eight in all, taken only after the cheap checks and the key lookup, so one company's
//! slow posts can never hold back another company's mail. A slot is freed on drop.
use std::{
    collections::HashMap,
    sync::{Arc, Mutex, OnceLock},
};
use tokio::sync::{OwnedSemaphorePermit, Semaphore};
use uuid::Uuid;

const PER_CONNECTION: usize = 2;
const TOTAL: usize = 8;

pub struct Slot {
    connection: Uuid,
    _total: OwnedSemaphorePermit,
}

fn total() -> Arc<Semaphore> {
    static TOTAL_CELL: OnceLock<Arc<Semaphore>> = OnceLock::new();
    TOTAL_CELL
        .get_or_init(|| Arc::new(Semaphore::new(TOTAL)))
        .clone()
}

fn busy() -> &'static Mutex<HashMap<Uuid, usize>> {
    static BUSY: OnceLock<Mutex<HashMap<Uuid, usize>>> = OnceLock::new();
    BUSY.get_or_init(|| Mutex::new(HashMap::new()))
}

/// A slot for `connection`, or `None` when it or the whole route is busy.
pub fn take(connection: Uuid) -> Option<Slot> {
    let mut busy = busy().lock().ok()?;
    let count = busy.entry(connection).or_insert(0);
    if *count >= PER_CONNECTION {
        return None;
    }
    let permit = total().try_acquire_owned().ok()?;
    *count += 1;
    Some(Slot {
        connection,
        _total: permit,
    })
}

impl Drop for Slot {
    fn drop(&mut self) {
        if let Ok(mut busy) = busy().lock() {
            if let Some(count) = busy.get_mut(&self.connection) {
                *count = count.saturating_sub(1);
                if *count == 0 {
                    busy.remove(&self.connection);
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::take;
    use uuid::Uuid;

    #[test]
    fn each_connection_gets_two_slots_and_frees_them_on_drop() {
        let (one, two) = (Uuid::new_v4(), Uuid::new_v4());
        let first = take(one).unwrap();
        let _second = take(one).unwrap();
        assert!(take(one).is_none(), "a third post for one connection waits");
        let other = take(two);
        assert!(other.is_some(), "another connection is not held back");
        drop(first);
        assert!(take(one).is_some());
    }
}
