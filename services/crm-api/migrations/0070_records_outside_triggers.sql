-- Owner module: records (docs/record-sharing.md R2, decision D12, review amendment 2). When a
-- listing changes holder (any writer, the queue too), becomes Sold, Rented or Withdrawn, or
-- is deleted, its open outside shares end in the same transaction through the agreements
-- function. An error there aborts the record change: outside access never outlives it.

CREATE FUNCTION crm_records_outside_closed() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM agreements.crm_outside_source_closed(OLD.workspace_id, OLD.id, 'listing_removed');
        RETURN OLD;
    END IF;
    IF NEW.assignee_id IS DISTINCT FROM OLD.assignee_id THEN
        PERFORM agreements.crm_outside_source_closed(NEW.workspace_id, NEW.id, 'holder_changed');
    ELSIF NEW.payload->>'listing_status' IN ('Sold', 'Rented', 'Withdrawn')
        AND (NEW.payload->>'listing_status') IS DISTINCT FROM (OLD.payload->>'listing_status') THEN
        PERFORM agreements.crm_outside_source_closed(NEW.workspace_id, NEW.id, 'listing_closed');
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER crm_records_outside_on_change
    AFTER UPDATE OF assignee_id, payload ON crm_records
    FOR EACH ROW
    WHEN (OLD.collection = 'Properties' AND (NEW.assignee_id IS DISTINCT FROM OLD.assignee_id
        OR (NEW.payload->>'listing_status') IS DISTINCT FROM (OLD.payload->>'listing_status')))
    EXECUTE FUNCTION crm_records_outside_closed();

CREATE TRIGGER crm_records_outside_on_delete
    AFTER DELETE ON crm_records
    FOR EACH ROW
    WHEN (OLD.collection = 'Properties')
    EXECUTE FUNCTION crm_records_outside_closed();
