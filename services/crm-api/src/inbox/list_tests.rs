use super::*;

#[test]
fn filters_are_strict_and_default_to_fifty() {
    let defaults = parse(None).unwrap();
    assert_eq!(defaults.limit, 50);
    assert!(defaults.state.is_none() && defaults.cursor.is_none());
    let chosen = parse(Some(
        "state=new&channel=tiktok&assignee=unassigned&limit=10",
    ))
    .unwrap();
    assert_eq!(chosen.state.as_deref(), Some("new"));
    assert_eq!(chosen.channel.as_deref(), Some("tiktok"));
    assert_eq!(chosen.assignee.as_deref(), Some("unassigned"));
    assert_eq!(chosen.limit, 10);
    for bad in [
        "state=closed",
        "channel=sms",
        "assignee=someone",
        "limit=0",
        "limit=101",
        "limit=ten",
        "cursor=abc",
        "surprise=1",
        "state=new&state=open",
    ] {
        assert!(parse(Some(bad)).is_err(), "{bad}");
    }
}
