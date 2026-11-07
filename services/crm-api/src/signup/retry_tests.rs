use super::backoff;
use std::time::Duration;

#[test]
fn attempts_double_from_five_seconds_and_cap_at_five_minutes() {
    let plain = |attempts, jitter| backoff(attempts, None, jitter);
    assert_eq!(plain(1, 0), Duration::from_secs(5));
    assert_eq!(plain(2, 0), Duration::from_secs(10));
    assert_eq!(plain(3, 0), Duration::from_secs(20));
    assert_eq!(plain(7, 0), Duration::from_secs(300));
    assert_eq!(plain(8, 0), Duration::from_secs(300));
    assert_eq!(plain(1, 999), Duration::from_millis(5_999));
    assert_eq!(plain(1, 1_250), Duration::from_millis(5_250));
}

#[test]
fn retry_after_wins_but_is_capped() {
    assert_eq!(
        backoff(1, Some(Duration::from_secs(2)), 0),
        Duration::from_secs(2)
    );
    assert_eq!(
        backoff(1, Some(Duration::from_secs(900)), 0),
        Duration::from_secs(300)
    );
    assert_eq!(
        backoff(4, Some(Duration::from_secs(0)), 10),
        Duration::from_millis(10)
    );
}
