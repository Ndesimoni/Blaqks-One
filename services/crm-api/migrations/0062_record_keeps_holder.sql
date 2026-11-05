-- Owner module: records (docs/agreements-design.md §18, H3 code review L2). A member who
-- holds a record again no longer keeps a read-only copy of it, so an old badge never comes
-- back when the record later moves on. Covers every writer of `assignee_id`.

CREATE FUNCTION crm_record_keeps_on_hold() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    DELETE FROM crm_record_keeps WHERE record_id = NEW.id AND member_id = NEW.assignee_id;
    RETURN NEW;
END;
$$;

CREATE TRIGGER crm_records_keeps_on_hold
    AFTER UPDATE OF assignee_id ON crm_records
    FOR EACH ROW
    WHEN (NEW.assignee_id IS NOT NULL AND NEW.assignee_id IS DISTINCT FROM OLD.assignee_id)
    EXECUTE FUNCTION crm_record_keeps_on_hold();
