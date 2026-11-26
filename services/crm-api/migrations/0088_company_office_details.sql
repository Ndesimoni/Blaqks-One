-- Owner module: workspaces (docs/service-boundaries.md); design queue item 15.
-- The company's trade licence number, office phone and office address, set by its Admin on
-- Settings → Company. Each is optional; stored trimmed, the phone in E.164 form.
ALTER TABLE crm_company_profiles
    ADD COLUMN trade_licence TEXT CHECK (trade_licence = btrim(trade_licence)
        AND char_length(trade_licence) BETWEEN 1 AND 40),
    ADD COLUMN office_phone TEXT CHECK (office_phone ~ '^\+[0-9]{7,15}$'),
    ADD COLUMN office_address TEXT CHECK (office_address = btrim(office_address)
        AND char_length(office_address) BETWEEN 1 AND 200);
