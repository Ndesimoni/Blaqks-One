# Connected finance design: Deals, Payments and Expenses (finance packet set)

**Status:** owner-approved (all §11 recommendations, 2026-10-14); pending security review before freeze. Proposed by senior_architect. This is the sensitive tier, so the order is: owner answers (§11), then freeze, then security review, then implementation. No files were edited. The finance section of `docs/product-decisions.md` (lines 60–73) is binding. This design composes with the frozen assignments-design §3/§4 (H1–H4) and action-permissions-design §1–§14.

---

## 0. Decision summary

1. **Finance gets dedicated typed tables** (`crm_deals`, `crm_deal_snapshots`, `crm_deal_commission_lines`, `crm_payments`, `crm_expenses`, `crm_finance_settings`, `crm_commission_agreements`, `crm_finance_events`). It does not join the generic `crm_records`/`COLLECTIONS` model.
   - Reused pieces: the composite-FK link convention, `links::ensure_linkable` for Client/Property targets, the `crm_check_assignee` trigger, `ids` issuance, `crm_assignments` history, the workspace advisory lock, `ensure_writable` and the §4 check order.
2. **Money is stored as `BIGINT` fils** (1 AED = 100 fils).
   - Rates and shares are `INTEGER` basis points (bp, 1 bp = 0.01%, range 0–10000).
   - Intermediate products use `i128` in Rust and `BigInt` in JS.
   - The wire carries integers (`…Fils`, `…Bp`). AED decimals exist only at the UI and workbook edges, converted by string arithmetic and never by floats.
3. **One pure calculation spec (§3)** is implemented twice:
   - Rust `finance/calc.rs` is authoritative.
   - JS `src/lib/finance/commission.js` is used only for editor preview.
   - Both are tested against one shared golden fixture.
4. **The split is snapshotted when a deal is marked earned.**
   - Snapshots and their commission lines are append-only. An Admin revision with a reason creates a new revision and supersedes the old one.
   - Later changes to agreements or team defaults never rewrite a snapshot.
5. **Payments and Expenses use the states `pending → approved | rejected`.**
   - `rejected → pending` happens on edit (resubmission). `approved → void` is Admin-only, with a reason.
   - There are no server drafts and no deletes.
   - Only `approved` rows count anywhere. Approved and void rows are locked except on the Admin path, and a DB trigger enforces this as defence in depth.
6. **New `finance` action key:** `create`, `edit`, `assign`, `approve`, `teamView`.
   - `approve` and `teamView` are denied by default and never come from position presets or invitations.
   - `teamView` requires `record_scope='team'`. `approve` requires `teamView`.
   - Admin-only operations stay role-based: settings, agreements, split override, revise, unearn, void, editing approved rows and deleting deals.
7. **Finance scope:**
   - `Team` = Admin, Super Admin, or staff with finance ∧ team scope ∧ `teamView`.
   - `Own(caller)` = everyone else with the finance module.
   - Full-team access alone never shows colleagues' finance.
8. **Responses are shaped per caller.** The own view never contains the company share, colleagues' lines, override reasons, others' agreements, team totals or a hidden-row count. A second agent sees only their statement line, never the deal.
9. **The Interaction log deal link is enforced** through a new `crm_records.deal_ref` FK to `crm_deals`. Legacy dangling values are grandfathered while unchanged.
10. **Imports of finance are deferred.** The Super Admin import contract stays at 8 collections. The demo and its workbook schema are untouched.

---

## 1. Current-state facts (file:line)

**Workbook definitions**

- Deals has 34 columns, Payments 9 and Expenses 10 (`src/data/schemas/deals.js:3-63`). Columns are append-only by letter (`src/data/schemas/columns.js:9-15`).
- Calculated fields: Deals has Gross fee, After partner, Your expected/earned fee, Outstanding and Payment status; Payments has Total received (`src/config/fields.js:21-29,40,44`).

**Current calculations (`src/lib/crm.js`), all floating point**

- `feeNumber` returns fixed fee, or agreed value × rate ÷ 100 (`:29-34`).
- `yourFee` = fee × (1 − partner%) × your% (`:36-39`).
- `totalPaid` sums "Your fee received AED ex VAT" (`:41-45`).
- Outstanding = max(0, earned − paid). Payment status is "Not earned", "Paid" or "Outstanding" (`:99-109`).
- Total received = ex VAT + VAT (`:111-112`).
- The model is single-user ("Your share %") with no company/agent split, no second agent, no rounding and no approval.

**Field options**

- `Fee basis` is Percentage or Fixed. `Document status` options exist (`src/config/fields/clientAndContactOptions.js:41-42`).
- `Deal stage` has 10 options. `Sale / rental` is Sale, Rental or Holiday home (`src/config/fields/stageAndListingOptions.js:14-25,38`).
- `Lost / cancelled reason` options exist (`outcomeAndCareOptions.js:30-41`).
- `Expense category` has no option list.
- Demo IDs use `DL-`, `PM-` and `EX-` (`src/data/demo.js`).

**Generic record model, and why finance should stay out of it**

- `COLLECTIONS` lists exactly 8 collections (`records/collections.rs:73-86`), and `find("Deals")` errors (`:130`).
- Imports require **every** collection and no others (`imports/model.rs:46-50`).
- `GET records` always emits all collection keys (`records/list.rs:69-76`).
- `recordActions` covers "all eight" (`auth/grants.rs:116-131`).
- `imports/snapshot.rs:19-21` and `team/archive/snapshot.rs:48` scan `crm_records` without a collection filter.
- `assignments/bulk.rs:77` fetches by id without a collection filter.
- Putting finance rows into `crm_records` would silently pull them into imports, fingerprints, bulk moves and counts.

**Number validation**

- Payload numbers are validated as `f64` (`records/validation/numbers.rs:49-61`), which cannot meet the "exact to the fils" decision.

**Links and IDs**

- Links are composite FKs `(workspace_id, collection, legacy_id)` (`migrations/0006_client_workflows.sql:13-28`).
- A link check under the lock returns an identical `link_missing` for hidden and unknown targets (`records/links.rs:50-91`).
- The Interaction log stores `deal_id_optional` unenforced (`records/validation/workflow_fields.rs:61`; `docs/backend-foundation.md:85`).
- ID prefixes cover 8 collections only (`records/ids.rs:8-19`).

**Visibility**

- The single predicate lives at `records/visibility.rs:56-68`. `ASSIGNABLE` and `PARENTS` are at `:7-10`.
- Departure release only covers `ASSIGNABLE` in `crm_records` (`assignments/departure.rs:15-22,41-46`).

**Permissions**

- The `finance` boolean exists (`auth/permissions.rs:9`). `Module::of` has no finance collections (`:42-48`), and a test asserts `!collection("Deals")` (`:86`).
- The action wire format is strict with 3 modules (`auth/actions_wire.rs:37-43`). A test asserts that a `"finance"` key is **refused** today (`auth/actions_tests.rs:27`).
- Positions: Accountant = finance + reports only (`team/positions.rs:26-30`). Property Agent and Team Supervisor have no finance (`:16-20,41-45`).
- `ensure_writable(collection, action)` re-checks under the lock (`workspaces/mod.rs:59-86`).

**Error mapping**

- 23505 → "That record ID is already in use." and 23503 → "A linked record prevents this change." (`error.rs:51-58`).

**Assignment tables**

- The `crm_assignments.collection` CHECK allows 4 collections.
- `crm_assignment_notes.record_id` has an FK to `crm_records` (assignments-design §2).
- The `crm_check_assignee()` function is generic over `NEW.assignee_id/NEW.workspace_id`, so it can be reused on another table.

**Frontend**

- Finance routes map to `finance` (`src/config/team.js:82-84`) but render `ServerUnavailableSection` (`src/features/server/ServerContent.jsx:29,33`).
- The dashboard explicitly reads no finance (`src/features/server/dashboard/dashboardModel.js:4`).
- `AED()` formats with 0 decimal places by default (`src/lib/format.js:1`). Finance needs 2.

**Files near the 150-line limit**
`routes.rs` 137, `grants.rs` 136, `collections.rs` 133, `actions.rs` 130, `actions_wire.rs` 126, `validation/mod.rs` 123, `actionModel.js` 121, `team/members/update_store.rs` 120.

---

## 2. Data model

### 2.1 Why typed tables (tradeoffs)

| Option                                         | For                                                                                                                                                                 | Against                                                                                                                                                     |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. Generic `crm_records` with money in JSONB   | Reuses list, assign and import code                                                                                                                                 | f64 money; generic paths (imports, bulk, snapshot, counts) absorb finance rows; no DB-level state or lock constraints; finance would ride raw `GET records` |
| B. Hybrid (records row plus typed side tables) | Reuses the assignment machinery                                                                                                                                     | Every unfiltered `crm_records` query must be audited; two-table consistency; still leaks into the import fingerprint                                        |
| **C. Dedicated typed tables (recommended)**    | Exact money, CHECKs and triggers on typed columns; unreachable from generic endpoints by construction (`collections::find` rejects them); import contract unchanged | Deal assignment needs its own small endpoint and release (≈150 lines)                                                                                       |

### 2.2 Migrations

Each file is ≤150 lines, idempotent where practical, and never edited after release (M-E).

**`0011_finance_settings.sql`**

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;            -- trusted extension (PG13+)
CREATE TABLE crm_finance_settings (
  workspace_id TEXT PRIMARY KEY REFERENCES crm_workspaces(id),
  agent_share_bp INTEGER NOT NULL CHECK (agent_share_bp BETWEEN 0 AND 10000), -- company = remainder
  second_agent_source TEXT NOT NULL CHECK (second_agent_source IN ('first_agent','company')),
  vat_registered BOOLEAN NOT NULL DEFAULT false,
  vat_rate_bp INTEGER NOT NULL DEFAULT 500 CHECK (vat_rate_bp = 500),     -- 5% fixed by decision
  trn TEXT CHECK (trn ~ '^[0-9]{15}$'),
  version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_by UUID NOT NULL REFERENCES crm_users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE crm_commission_agreements (
  id UUID PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES crm_workspaces(id),
  agent_id UUID NOT NULL REFERENCES crm_users(id),
  agent_share_bp INTEGER NOT NULL CHECK (agent_share_bp BETWEEN 0 AND 10000),
  effective_from DATE NOT NULL,
  effective_to DATE CHECK (effective_to IS NULL OR effective_to > effective_from), -- exclusive
  created_by UUID NOT NULL REFERENCES crm_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crm_agreements_no_overlap EXCLUDE USING gist
    (workspace_id WITH =, agent_id WITH =, daterange(effective_from, effective_to,'[)') WITH &&));
-- Trigger: UPDATE may only change effective_to; agent must be staff of workspace_id.
CREATE TABLE crm_finance_events (              -- append-only financial history (business content)
  id UUID PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES crm_workspaces(id),
  entity TEXT NOT NULL CHECK (entity IN ('settings','agreement','deal','payment','expense')),
  entity_id UUID NOT NULL,                     -- no FK (like crm_assignments, M4)
  action TEXT NOT NULL CHECK (action IN ('created','updated','submitted','resubmitted',
    'approved','rejected','voided','earned','revised','unearned','split_changed','assigned','closed')),
  actor_id UUID NOT NULL REFERENCES crm_users(id),
  changes JSONB NOT NULL DEFAULT '{}',         -- {field:[before,after]} money/rate/date/status/agent only
  reason TEXT CHECK (reason IS NULL OR length(btrim(reason)) BETWEEN 1 AND 500),
  source TEXT NOT NULL DEFAULT COALESCE(NULLIF(current_setting('kws.activity_source',true),''),'app')
    CHECK (source IN ('app','sample')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TRIGGER crm_finance_events_immutable BEFORE UPDATE OR DELETE ON crm_finance_events
  FOR EACH ROW EXECUTE FUNCTION prevent_crm_activity_change();
-- crm_users: finance action guards (L-2 pattern)
ALTER TABLE crm_users ADD CONSTRAINT crm_actions_finance_team CHECK
  (NOT (actions->'finance'->'teamView' = 'true'::jsonb) OR record_scope='team'),
  ADD CONSTRAINT crm_actions_finance_approve CHECK
  (NOT (actions->'finance'->'approve' = 'true'::jsonb) OR actions->'finance'->'teamView'='true'::jsonb);
-- Backfill non-archived staff: finance = {create,edit,assign: permissions->'finance'='true'::jsonb,
-- approve:false, teamView:false}. Versions and sessions untouched; archived rows skipped.
```

Notes:

- Free-text notes are never put into `changes`; they are recorded as `"notes": "changed"`.
- `crm_activity` keeps action names only.

**`0012_finance_deals.sql`**

```sql
CREATE TABLE crm_deals (
  id UUID PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES crm_workspaces(id),
  legacy_id TEXT NOT NULL CHECK (length(legacy_id) BETWEEN 1 AND 128),
  version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
  assignee_id UUID REFERENCES crm_users(id),                 -- holder; NULL = Admin queue
  client_ref TEXT NOT NULL,
  client_collection TEXT NOT NULL DEFAULT 'Clients' CHECK (client_collection='Clients'),
  property_ref TEXT,
  property_collection TEXT NOT NULL DEFAULT 'Properties' CHECK (property_collection='Properties'),
  deal_type TEXT NOT NULL CHECK (deal_type IN ('Sale','Rental','Holiday home')),
  stage TEXT NOT NULL CHECK (stage IN ('New','Qualified','Viewing','Offer','Negotiation',
    'Documentation','Completed','Lost','Cancelled','On hold')),
  agreed_value_fils BIGINT NOT NULL DEFAULT 0 CHECK (agreed_value_fils BETWEEN 0 AND 10000000000000),
  fee_basis TEXT NOT NULL CHECK (fee_basis IN ('percentage','fixed')),
  fee_rate_bp INTEGER CHECK (fee_rate_bp BETWEEN 0 AND 10000),
  fixed_fee_fils BIGINT CHECK (fixed_fee_fils BETWEEN 0 AND 10000000000000),
  CHECK ((fee_basis='percentage' AND fee_rate_bp IS NOT NULL)
      OR (fee_basis='fixed' AND fixed_fee_fils IS NOT NULL)),
  partner_share_bp INTEGER NOT NULL DEFAULT 0 CHECK (partner_share_bp BETWEEN 0 AND 10000),
  partner_name TEXT CHECK (length(partner_name) <= 200),
  second_agent_id UUID REFERENCES crm_users(id),
  second_agent_share_bp INTEGER CHECK (second_agent_share_bp BETWEEN 0 AND 10000),
  CHECK ((second_agent_id IS NULL) = (second_agent_share_bp IS NULL)),
  override_agent_share_bp INTEGER CHECK (override_agent_share_bp BETWEEN 0 AND 10000),
  override_reason TEXT CHECK (length(btrim(override_reason)) BETWEEN 1 AND 500),
  CHECK ((override_agent_share_bp IS NULL) = (override_reason IS NULL)),
  earned_on DATE,
  details JSONB NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(details)='object'), -- workbook text fields
  created_by UUID NOT NULL REFERENCES crm_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, legacy_id),
  FOREIGN KEY (workspace_id, client_collection, client_ref)
    REFERENCES crm_records(workspace_id, collection, legacy_id),
  FOREIGN KEY (workspace_id, property_collection, property_ref)
    REFERENCES crm_records(workspace_id, collection, legacy_id));
CREATE TRIGGER crm_deals_assignee BEFORE INSERT OR UPDATE OF assignee_id ON crm_deals
  FOR EACH ROW EXECUTE FUNCTION crm_check_assignee();
-- Trigger crm_deal_terms_locked: if OLD.earned_on IS NOT NULL, money/split columns may change
-- only when current_setting('kws.finance_admin',true)='on' (SET LOCAL on the Admin path only).
CREATE TABLE crm_deal_snapshots (
  id UUID PRIMARY KEY, deal_id UUID NOT NULL REFERENCES crm_deals(id),     -- RESTRICT
  workspace_id TEXT NOT NULL REFERENCES crm_workspaces(id),
  revision INTEGER NOT NULL CHECK (revision > 0), UNIQUE (deal_id, revision),
  earned_on DATE NOT NULL,
  inputs JSONB NOT NULL,                       -- full calc input incl. agreement id and settings
  split_source TEXT NOT NULL CHECK (split_source IN ('agreement','team_default','override','owner')),
  agreement_id UUID REFERENCES crm_commission_agreements(id),
  gross_fils BIGINT NOT NULL CHECK (gross_fils >= 0),
  partner_fils BIGINT NOT NULL CHECK (partner_fils >= 0),
  net_fils BIGINT NOT NULL CHECK (net_fils >= 0),
  company_fils BIGINT NOT NULL CHECK (company_fils >= 0),
  vat_fils BIGINT NOT NULL CHECK (vat_fils >= 0),
  CHECK (gross_fils = partner_fils + net_fils),
  reason TEXT, actor_id UUID NOT NULL REFERENCES crm_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  superseded_at TIMESTAMPTZ, superseded_reason TEXT);
CREATE UNIQUE INDEX crm_deal_current_snapshot ON crm_deal_snapshots(deal_id) WHERE superseded_at IS NULL;
CREATE TABLE crm_deal_commission_lines (
  snapshot_id UUID NOT NULL REFERENCES crm_deal_snapshots(id),
  role TEXT NOT NULL CHECK (role IN ('primary','second')),
  agent_id UUID NOT NULL REFERENCES crm_users(id),
  share_bp INTEGER NOT NULL CHECK (share_bp BETWEEN 0 AND 10000),
  amount_fils BIGINT NOT NULL CHECK (amount_fils >= 0),
  PRIMARY KEY (snapshot_id, role));
-- Immutability: lines have no UPDATE/DELETE; snapshots have no DELETE, and UPDATE only sets
-- superseded_at/superseded_reason from NULL once. Deferred constraint trigger:
-- net_fils = company_fils + Σ lines.amount_fils.
-- Extend crm_assignments.collection CHECK with 'Deals'; crm_activity collection CHECK with
-- 'Deals','Payments','Expenses' and actions with 'approved','rejected','voided','earned','unearned','revised'.
-- Indexes: crm_deals(workspace_id, assignee_id); crm_deals(workspace_id, client_ref); lines(agent_id).
```

**`0013_finance_payments_expenses.sql`**

```sql
CREATE TABLE crm_payments (
  id UUID PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES crm_workspaces(id),
  legacy_id TEXT NOT NULL CHECK (length(legacy_id) BETWEEN 1 AND 128),
  version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
  deal_ref TEXT NOT NULL,
  receipt_date DATE NOT NULL,
  amount_fils BIGINT NOT NULL CHECK (amount_fils BETWEEN 1 AND 10000000000000),  -- ex VAT
  vat_fils BIGINT NOT NULL CHECK (vat_fils >= 0),                                   -- server computed
  reference TEXT CHECK (length(reference) <= 200), notes TEXT CHECK (length(notes) <= 4000),
  status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected','void')),
  submitted_by UUID NOT NULL REFERENCES crm_users(id),
  last_edited_by UUID NOT NULL REFERENCES crm_users(id),
  decided_by UUID REFERENCES crm_users(id), decided_at TIMESTAMPTZ,
  decision_reason TEXT CHECK (length(btrim(decision_reason)) BETWEEN 1 AND 500),
  CHECK ((status='pending') = (decided_by IS NULL)),
  CHECK (status NOT IN ('rejected','void') OR decision_reason IS NOT NULL),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, legacy_id),
  FOREIGN KEY (workspace_id, deal_ref) REFERENCES crm_deals(workspace_id, legacy_id));
CREATE TABLE crm_expenses ( /* same identity/version/status/decision columns, plus: */
  incurred_by UUID NOT NULL REFERENCES crm_users(id),  -- owner of the expense (visibility)
  date_paid DATE NOT NULL, category TEXT CHECK (length(category) <= 100),
  supplier TEXT CHECK (length(supplier) <= 200), campaign_reference TEXT CHECK (length(campaign_reference) <= 200),
  property_ref TEXT, property_collection TEXT NOT NULL DEFAULT 'Properties' CHECK (property_collection='Properties'),
  amount_fils BIGINT NOT NULL CHECK (amount_fils BETWEEN 1 AND 10000000000000),  -- as paid
  receipt_url TEXT CHECK (length(receipt_url) <= 2048), notes TEXT CHECK (length(notes) <= 4000)
  /* + FK (workspace_id, property_collection, property_ref) → crm_records */ );
-- Trigger crm_finance_locked on both tables: UPDATE of a row whose OLD.status IN ('approved','void')
-- refused unless current_setting('kws.finance_admin',true)='on'; status 'void' is terminal;
-- DELETE always refused (B6 sample-clear gets a guarded exception).
-- Indexes: payments(workspace_id, deal_ref); expenses(workspace_id, incurred_by);
-- partial (workspace_id) WHERE status='pending' on both.
```

**`0014_interaction_deal_links.sql`**

```sql
ALTER TABLE crm_records ADD COLUMN deal_ref TEXT,
  ADD CONSTRAINT crm_records_deal_scope CHECK (collection='Interaction log' OR deal_ref IS NULL),
  ADD CONSTRAINT crm_records_deal_link FOREIGN KEY (workspace_id, deal_ref)
    REFERENCES crm_deals(workspace_id, legacy_id);
CREATE INDEX crm_records_deal_links ON crm_records(workspace_id, deal_ref) WHERE deal_ref IS NOT NULL;
-- No backfill (no connected deals exist). Comment carries a read-only report query listing
-- Interaction logs with a non-empty deal_id_optional (grandfathered, see §6.3).
```

### 2.3 Workbook and Excel compatibility (contract; the export button is deferred to P10)

**Converting amounts**

- AED decimal ↔ fils by string arithmetic: `"2,450,000.5"` → `245000050`.
- More than 2 decimals, a negative value or a non-numeric value is rejected client-side ("Enter AED amounts with up to two decimal places.").
- Export writes `fils / 100` as a number with 2 decimal places into the existing columns, such as `Agreed value AED`.
- Percentages ↔ bp with at most 2 decimals.

**Calculated columns**

- These are filled from the server `calculation`, never recomputed with floats.
- `Your share %` is the caller's effective share of the after-partner amount (`line / net`, 2 dp).
- For an Admin or team view, "Your…" means the company line.

**Appended columns**

- New columns are appended only in a **connected-only column map** (`src/features/server/finance/financeColumns.js`).
  - Deals: `Agent`, `Second agent`, `Company share AED`, `Agent commission AED`, `Second agent commission AED`, `VAT AED`, `Split source`.
  - Payments and Expenses: `Approval status`, `Submitted by`, `Decided by`, `Decision reason`.
- `src/data/schemas/deals.js` is **not** changed, because the demo is frozen.

**Own-view exports**

- These contain only own rows and lines (export rules in assignments-design §1).

### 2.4 Snapshot semantics

**Mark earned**

- Takes the workspace lock, then `FOR UPDATE` on the deal and `FOR SHARE` on settings.
- Selects the agreement, computes the split (§3), inserts snapshot revision 1 and its lines, and sets `earned_on` and `stage='Completed'`.
- Writes an `earned` finance event and an `earned` activity entry.

**Admin actions on earned deals**

- **Revise:** reason required. Supersedes the current snapshot and inserts revision n+1 from the current terms, re-selecting the agreement at `earned_on`.
- **Unearn:** reason required, and only when the deal has no approved payments. Supersedes the snapshot and clears `earned_on`.
- Superseded snapshots stay readable in the team-view history.

---

## 3. Calculation spec (pure; server authoritative)

### 3.1 Notation

All values are integers. `hu(a,b) = (a·b + 5000) div 10000` (half-up). `fl(a,b) = (a·b) div 10000` (floor). Inputs are non-negative and intermediates use i128/BigInt.

### 3.2 Order (as decided)

1. **Fee.**
   - `gross = fixed_fee_fils` when the basis is fixed. A rate entered with a fixed basis is ignored.
   - Otherwise `gross = hu(agreed_value_fils, fee_rate_bp)`.
2. **External partner first.** `partner = hu(gross, partner_share_bp)` and `net = gross − partner`.
3. **Agent share `A` (bp), in this precedence:**
   1. Admin override.
   2. The primary agent's agreement where `effective_from ≤ earned_on < effective_to` (or the agreement is open).
   3. The team default `agent_share_bp`.
   - If the holder is the workspace owner or the deal is in the queue (`owner` source), then `A = 0` and there are no agent lines (owner question Q4).
   - If no settings row exists, the response is 409.
4. **Split.**
   - **No second agent:** `primary = fl(net, A)` and `company = net − primary`.
   - **`first_agent` source:** `pool = fl(net, A)`, `second = fl(pool, S)`, `primary = pool − second`, `company = net − pool`.
   - **`company` source:** `primary = fl(net, A)`, `cshare = net − primary`, `second = fl(cshare, S)`, `company = cshare − second`.
5. **VAT** (when the snapshot's `vat_registered` is true): `vat = hu(net, 500)`, otherwise 0. VAT is calculated on the company's receivable (Q2), and commissions are computed before VAT.
6. **Payment VAT:** `vat_fils = hu(amount_fils, snapshot.vat_rate_bp)`, or 0. Per-payment rounding may differ from deal VAT by at most 1 fil per payment. This is accepted and documented.
7. **Received share per commission line:** `fl_ratio(line, min(received_approved, net), net)` = `(line × r) div net` (0 when net = 0). Outstanding on the deal = `max(0, net − received_approved)`.

### 3.3 Rounding rules

- The fee and the external partner share are rounded half-up, since they match invoices.
- Agent lines are floored.
- The company absorbs every remainder.
- In `first_agent` mode, the primary agent absorbs the remainder within the agent pool.

### 3.4 Invariants (property-tested on 10k random cases)

- `gross = partner + company + Σ lines`.
- Every value is ≥ 0.
- The result is deterministic.
- Rust and JS agree exactly.

### 3.5 Worked examples (golden fixture `tests/fixtures/finance-golden.json`)

| #   | Case                                                                                               | Inputs                                      | Result (fils → AED)                                                                                                                                                                                                                |
| --- | -------------------------------------------------------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1  | Sale, %, no partner, agreement 60%, VAT on                                                         | agreed 245,000,000; rate 200 bp             | gross 4,900,000 (49,000.00); partner 0; net 4,900,000; primary fl = 2,940,000 (29,400.00); company 1,960,000 (19,600.00); VAT hu = 245,000 (2,450.00)                                                                              |
| G2  | Rental, half-up fee, partner 50%, team default 50%, second agent 25% from **first agent**, VAT off | agreed 8,733,333; rate 500                  | gross hu(436,666.65) = 436,667 (4,366.67); partner hu(218,333.5) = 218,334; net 218,333; pool fl(109,166.5) = 109,166; second fl(27,291.5) = 27,291 (272.91); primary 81,875 (818.75); company 109,167 (1,091.67). Sum = 436,667 ✓ |
| G3  | G2 with source **company**                                                                         | same                                        | primary fl = 109,166; cshare 109,167; second fl(27,291.75) = 27,291; company 81,876. Sum 218,333 ✓                                                                                                                                 |
| G4  | Fixed fee, Admin override 80% (agreement 70%), VAT on                                              | fixed 1,500,000                             | gross 1,500,000; primary 1,200,000; company 300,000; VAT 75,000; source `override`                                                                                                                                                 |
| G5  | Payment on G1                                                                                      | 2,450,000 ex VAT                            | VAT 122,500; total 2,572,500; primary received fl(2,940,000·2,450,000/4,900,000) = 1,470,000; outstanding 2,450,000                                                                                                                |
| G6  | Partial payment on G2                                                                              | received 100,000                            | primary fl(37,500.29) = 37,500; second fl(12,499.71) = 12,499                                                                                                                                                                      |
| G7  | Owner-held deal                                                                                    | as G1, holder = Admin                       | primary none; company = net 4,900,000                                                                                                                                                                                              |
| G8  | Extremes                                                                                           | agreed 10¹³; rate 10000; partner 0; A 10000 | no overflow; company 0                                                                                                                                                                                                             |
| G9  | Zero fee                                                                                           | rate 0                                      | all 0; statement line 0                                                                                                                                                                                                            |
| G10 | S = 0% / 100%                                                                                      | G2 inputs                                   | second 0 / pool or cshare                                                                                                                                                                                                          |

### 3.6 Agreement selection examples

Sara has A1 = 60% from 2026-01-01 to 2026-07-01 (exclusive) and A2 = 65% from 2026-07-01 (open).

| Deal earned on | Agreement used |
| -------------- | -------------- |
| 2026-06-30     | A1 (60%)       |
| 2026-07-01     | A2 (65%)       |
| 2025-12-31     | Team default   |

- Creating A3 = 70% from 2026-11-01 auto-closes A2 at 2026-11-01.
- An A3 start ≤ A2's start → 409 "This agreement overlaps another agreement for this agent."
- Earned snapshots never change.
- `earned_on` must be ≤ today in Asia/Dubai (400 "The earned date cannot be in the future.").

---

## 4. Approval workflow

| From          | Action                | Who                                                                                                                                            | To       | Notes                                                                          |
| ------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------ |
| —             | create (= submit)     | `finance.create`; payment on a visible **earned** deal; expense always for self (Admin may name a team member as `incurred_by`)                | pending  | Server issues `PM-`/`EX-` IDs; VAT computed; event `submitted`                 |
| pending       | edit                  | `finance.edit` and visible                                                                                                                     | pending  | `last_edited_by` updated; event `updated`                                      |
| rejected      | edit                  | `finance.edit` and visible                                                                                                                     | pending  | Clears decision fields; event `resubmitted` keeps the old reason in history    |
| pending       | approve               | `approve` (team view); for staff, not `submitted_by`, not `last_edited_by`, not a commission beneficiary/holder of the deal, not `incurred_by` | approved | Payment: approved total ≤ net, else 409                                        |
| pending       | reject (reason 1–500) | same as approve                                                                                                                                | rejected | Reason shown to everyone who sees the row                                      |
| approved      | edit (reason)         | Admin and Super Admin only (`SET LOCAL kws.finance_admin='on'`)                                                                                | approved | Event `updated` with reason; re-validates against net                          |
| approved      | void (reason)         | Admin only                                                                                                                                     | void     | Terminal; excluded from totals                                                 |
| approved/void | edit by anyone else   | —                                                                                                                                              | —        | 403 "Approved records can only be changed by your Admin."                      |
| decided       | approve/reject again  | —                                                                                                                                              | —        | 409 conflict "This record has already been decided. Reload to see its status." |

Rules that apply throughout:

- Only `approved` rows count in received, outstanding, statements, dashboards and totals.
- Pending and rejected rows appear separately as "Awaiting approval" or "Rejected".
- Every write takes the workspace lock, `FOR UPDATE` on the row and a version check (409 `version_conflict`). It then writes the finance event and the `crm_activity` action name in the same transaction.

---

## 5. Visibility and permissions

### 5.1 Effective finance access

Computed in Rust as `UserRow::finance_access()` and exposed in the profile as `financeAccess`. The frontend never re-derives it.

```text
module   = effective_permissions().finance
staff:   create/edit/assign = stored ∧ module
         teamView = stored ∧ module ∧ record_scope='team'
         approve  = stored ∧ teamView
admin/super-admin: all true, manage = true (role-based Admin-only operations)
other roles: none
scope = Team if role admin/super-admin or teamView; Own if module; none otherwise
```

**Wire format for `actions`**

- `actions.finance = {create, edit, assign, approve, teamView}` is strict in PATCH and must be complete.
- In invitations, `approve` and `teamView` may be omitted. Sending `true` returns 400 "Approving and team finance need whole-team visibility.", because invitations never set team scope.

**Normalisation (M-D extended)**

- Module off → all finance flags false.
- Scope changed to assigned → clears `teamView` and `approve`.
- Positions never set `approve` or `teamView`.
- Losing `teamView` releases nothing. Losing the finance module releases held deals to the queue (reason `access_removed`), and departure does the same (§5.4).

**Presets**

- Positions that grant finance (Accountant today, and Property Agent if Q12 is accepted) get `create`, `edit` and `assign`.
- To make an approver, the Admin ticks whole-team visibility, then "See team finance", then "Approve".

### 5.2 Visibility predicate

Add `finance_predicate(table, alias, ws, caller)` in `records/visibility.rs`, beside the existing predicate, so visibility stays defined in one place. A NULL caller means team view.

- **Deals:** `d.assignee_id = caller`.
- **Payments:** `p.deal_ref IN (SELECT legacy_id FROM crm_deals WHERE workspace_id=ws AND assignee_id=caller)`.
- **Expenses:** `e.incurred_by = caller`.

The second agent and departed beneficiaries see only `statement` lines from `crm_deal_commission_lines WHERE agent_id = caller AND snapshot current`. These lines are never a handle to fetch a deal.

### 5.3 Shaped views: never in own view

- The company share and other agents' lines or amounts.
- `splitSource` detail beyond `adjusted: true`, and the override reason.
- Others' agreements and the team default.
- Team totals, by-agent breakdowns, approver identity on others' rows, and history `changes` (own view gets the timeline only).

The own view shows the second agent's **name** only (Q11). Accepted inference: in `first_agent` mode an agent can derive the second agent's share from their own agreement. Sequential IDs reveal approximate deal volume (the 12 Oct decision is extended; Q13 below).

### 5.4 Composition with existing contracts

- **Module grant:** finance endpoints require the `finance` module; otherwise 403 "Access denied.". `GET records` is unchanged.
- **M1 references:** client and property names appear in finance views only with the relationships or properties grant (`references`). Otherwise only the ID is shown.
- **Link checks:**
  - A deal's `client_ref` that changes must be a Client visible under the records predicate **and** the caller must hold relationships.
  - A changed `property_ref` needs properties plus visibility.
  - A payment's `deal_ref` must be visible under the finance predicate.
  - Hidden and missing targets give an identical `link_missing`. New Deal-slot message: "The linked deal is missing from this workspace. Choose another deal or clear it."
- **Assignment:** `PUT /finance/deals/{id}/assignee` follows assignments §6 semantics.
  - Holder or team view, plus `finance.assign`.
  - Null (queue) only for team view.
  - Eligibility = active member with the finance module.
  - The hand-off warning applies.
  - History is written to `crm_assignments` with collection `'Deals'`.
  - No hand-off note in v1, because `crm_assignment_notes` has an FK to `crm_records`.
  - `GET /finance/assignees` requires `assign` or team view (L-5).
- **M-C extension (Q9):** the deal FK means a Client or Property delete or ID change could produce a 23503 that reveals hidden deals. `covers_references` therefore also requires finance team view for Clients and Properties. Deals are referenced by Interaction log, so deleting a deal additionally requires schedule. In practice only Admins delete deals.
- **Departures:** `finance::departure::release` runs next to `assignments::departure::release` in `team/members/update_store.rs` and `team/archive/store.rs`.
  - It moves held, **unearned and earned** deals to the queue.
  - Commission lines stay attributed to the departed agent.
  - Earning refuses an inactive second agent: 409 "The second agent can no longer receive commission. Update the split first."
- **Super Admin:** has team view in any workspace by role. Archived workspaces are read-only through `ensure_writable`.
- **Self-approval:** a staff approver can never decide their own work. Admins may.

---

## 6. API contract (under `/api/crm/workspaces/{ws}/finance`, in a new `finance/routes.rs` merged into `routes.rs`)

### 6.1 Check order

This mirrors §4 of the assignments design.

1. `ensure_access`, then CSRF on writes.
2. Finance module, then the action or role (403 using the messages below), all before the body.
3. Target-independent body validation (400).
4. Lock, live re-read and re-check (403).
5. Finance-predicate fetch `FOR UPDATE` (404 "Record not found.", identical for hidden, unknown and cross-team).
6. Version (409).
7. State, lock and self-approval rules (403 or 409).
8. Link checks (409 `link_missing`).
9. Business rules (409 `conflict`).
10. Write, finance event, activity, commit.

**New 403 messages** (all depend only on the caller):

- "Your access doesn't include approving finance records."
- "Only your Admin can change finance settings." (also used for agreements, overrides, revise, unearn and void)
- "Another approver must review your own submissions." (step 7, target-dependent, after the 404)

### 6.2 Endpoints

**`GET /finance`** returns one REPEATABLE READ READ ONLY snapshot:

```text
200 { "scope":"team"|"own",
  "settings": team: {version, agentShareBp, secondAgentSource, vatRegistered, vatRateBp, trn}
              own:  {vatRegistered, vatRateBp, trn},
  "myAgreements":[{id, agentShareBp, effectiveFrom, effectiveTo}],
  "deals":[DealView], "payments":[PaymentView], "expenses":[ExpenseView],
  "statement":{ "lines":[{dealId, earnedOn, dealType, role, shareBp, amountFils,
                          receivedShareFils, outstandingFils, adjusted}],
                "totals":{earnedFils, receivedShareFils, outstandingFils} },
  "teamTotals": team only {grossFils, partnerFils, netFils, companyFils, vatFils, receivedFils,
                outstandingFils, expensesApprovedFils, pendingCount, byAgent:[{agent, earnedFils, receivedShareFils}]},
  "references": {Clients:[{client_id, full_name}], Properties:[{property_id, listing_title}]} }
```

```text
DealView = {id, version, dealId, assignee, clientId, propertyId, dealType, stage, agreedValueFils,
  feeBasis, feeRateBp, fixedFeeFils, partnerShareBp, partnerName, earnedOn, details,
  secondAgent: team {id,name,shareBp} | own {name} | null,
  override: team {agentShareBp, reason} | null   (own: omitted; calculation.adjusted),
  calculation: {preview:bool, revision, grossFils, partnerFils, netFils, vatFils,
                companyFils(team only), lines:[team: all | own: caller's only], adjusted},
  receivedFils, outstandingFils, paymentStatus:"not_earned"|"outstanding"|"paid",
  allowed:{edit, assign, earn, split, revise, unearn, delete}}
PaymentView = {id, version, paymentId, dealId, receiptDate, amountFils, vatFils, totalFils,
  reference, notes, status, submittedBy{id,name}, decidedBy{id,name}|null, decidedAt,
  reason, allowed:{edit, approve, reject, void}}
ExpenseView = {…same pattern…, incurredBy{id,name}, datePaid, category, supplier,
  campaignReference, propertyId, amountFils, receiptUrl}
```

- An unearned deal's `calculation` is a server preview (`preview: true`) that uses today's agreement.
- `GET /finance?agent={uuid}` filters to one agent (team view only, otherwise 403).
- `allowed` is per row and computed by the server, so self-approval and lock rules are never re-derived in JS.

**Settings and agreements** (Admin role)

- `PUT /finance/settings {version|null, agentShareBp, secondAgentSource, vatRegistered, trn|null}`
  - 200 returns the settings.
  - 409 when stale.
  - 400 "Enter a 15-digit TRN." and "Percentages must be between 0 and 100 with up to two decimals."
- `GET /finance/agreements?agentId=` returns 200 `{agreements:[…]}`.
- `POST /finance/agreements {agentId, agentShareBp, effectiveFrom}`
  - 201. Auto-closes the open earlier agreement.
  - 409 on overlap.
  - 400 "Choose a staff member of this team." when the agent is not team staff.
- `DELETE /finance/agreements/{id}` succeeds only if `effective_from > today`. Otherwise 409 "Agreements that have started cannot be removed."

**Deals**

- `POST /finance/deals {deal:{clientId, propertyId?, dealType, stage, agreedValueFils, feeBasis, feeRateBp?, fixedFeeFils?, partnerShareBp?, partnerName?, details}}`
  - 201 returns a DealView.
  - The ID is always issued (`DL-`). Supplying `dealId` → 400 "Record IDs are issued by the server."
  - The holder is the creator (staff) or the owner (Admin or Super Admin).
- `PATCH /finance/deals/{id} {deal, version}` (Edit).
  - Split fields are refused here (400 "Change the split from the split panel.").
  - On an earned deal, money terms → 403 "Earned deals can only be changed by your Admin."
- `PUT /finance/deals/{id}/split {version, secondAgentId|null, secondAgentShareBp|null, overrideAgentShareBp|null, reason}` (Admin).
  - The reason is required if anything changes.
  - Second-agent eligibility: an active staff member with finance who is not the holder. Otherwise 400 "Choose an active team member with finance access."
- `POST /finance/deals/{id}/earn {version, earnedOn}` (`approve`; for staff, not the holder or second agent).
  - 409 if settings are missing: "Set up your team's commission split before marking deals earned."
  - 409 if the deal is Lost or Cancelled: "Lost or cancelled deals cannot be earned."
  - 409 if already earned.
- `POST /finance/deals/{id}/revise {version, reason}` (Admin).
- `POST /finance/deals/{id}/unearn {version, reason}` (Admin). 409 "Void this deal's approved payments first."
- `DELETE /finance/deals/{id} {version}` (Admin). Only when unearned and the deal has never had a snapshot or payment. FK 23503 → existing 409.
- `PUT /finance/deals/{id}/assignee {version, assigneeId|null}` returns 200 `{entry: DealView|null}`.
- `GET /finance/assignees` returns 200 `{assignees:[{id,name}]}`.
- `GET /finance/{deals|payments|expenses}/{id}/history`
  - Team view: `{at, action, actor, changes, reason}`.
  - Own view: `{at, action, actor{name}}` plus the reason only for rejections on its own rows.
  - 404 when the target is not visible.

**Payments and expenses**

- `POST /finance/payments {payment:{dealId, receiptDate, amountFils, reference?, notes?}}`
  - 201 pending.
  - 409 when the deal is not earned: "Payments can be recorded once the deal is earned."
- `PATCH /finance/payments/{id} {payment, version, reason?}`
- `POST /finance/payments/{id}/approve {version}`
  - 409 "Approving this payment would exceed the deal's fee."
- `POST /finance/payments/{id}/reject {version, reason}`
- `POST /finance/payments/{id}/void {version, reason}` (Admin).
- The same set exists for `/finance/expenses`. `incurredBy` is accepted from the Admin only; staff sending it get 400 "Expenses are recorded for yourself."

**Validation messages (400, step 3)**

- "Amounts must be whole fils between 0 and AED 100,000,000,000." (floats, strings or out of range)
- "Choose a valid deal stage." and the equivalents for other options
- "A reason of 1 to 500 characters is required."
- "Enter a valid HTTPS receipt link."
- Reserved and unknown keys are refused for every finance body (strict serde).

### 6.3 Interaction log deal link

- `deal_id_optional` becomes `Slot::Deal`. `collections.rs` must split its tests out first.
- Changed to a non-empty value: the caller needs the finance module and the deal must be visible under the finance predicate. Otherwise `link_missing` with the Deal message.
- Unchanged from the stored **payload** value while `deal_ref IS NULL` (legacy, grandfathered): allowed and kept unlinked. The UI shows "Linked deal unavailable".
- Cleared: allowed.

### 6.4 Profile

Session, login and team member responses gain:

- `financeAccess: {scope, create, edit, assign, approve, teamView, manage}`
- `actions.finance`

`recordActions` stays at 8 collections.

---

## 7. Frontend contract (connected only; the demo is untouched)

**Data and services** (each file ≤150 lines)

- `src/services/crm/finance.js`: the API client.
- `src/lib/finance/money.js`: AED string ↔ fils, `formatAed(fils)` with 2 dp, tabular numerals. No floats.
- `src/lib/finance/commission.js`: the BigInt preview mirror of §3.
- `src/features/server/finance/financeModel.js`: strict parsing of views, rejecting non-integer fils, plus statuses and labels.
- `financeColumns.js`: the export map.
- `useFinance.js`: load and refetch. Never stores data in browser storage. On 404: "This record is no longer available to you."
- `useFinanceActions.js`: refuses using `financeAccess` and the row's `allowed`, with server-equivalent messages. Keeps the draft on 403 or 409.

**Shell**

- `sectionStatus.js` and `ServerContent.jsx` route Deals, Payments and Expenses to `finance/FinanceContent.jsx`.
- No new nav entries: `config/navigation.js` is shared with the frozen demo.

**Screens**

- **Deals ("Deals & commissions")**
  - Paginated table at desktop, cards at 390px.
  - Filters: stage, earned state, and "Assigned to" for team view.
  - Tabs: **Deals**, **Commission statement** (own lines, or a chosen agent's for team view).
  - `DealEditor` reuses the FormStepper/RecordReview patterns: Parties → Value & fee → Pipeline → Review, with a live preview panel labelled "Estimate. Final figures are fixed when the deal is earned."
  - `DealCalculationPanel`: team view shows all lines; own view shows "Your commission".
  - Dialogs: `DealSplitDialog` (Admin: second agent, %, override, required reason, before/after preview), `EarnDealDialog` (date ≤ today, preview, confirm), `ReviseDealDialog`, `UnearnDealDialog`.
  - `DealAssignment` reuses `HandoffDialog` with the warning and without a note.
  - `FinanceHistory`.
- **Payments ("Commission receipts") and Expenses**
  - Paginated list with status chips that include text: Pending approval, Approved, Rejected (with reason), Voided.
  - A filter chip "Awaiting approval" is the **approval queue** for approvers. It shows Approve and Reject (reason dialog) per row only when `allowed`.
  - Forms: `PaymentForm` (deal picker of visible earned deals only; VAT and total preview), `ExpenseForm`.
  - Rejected rows show "Correct and resubmit".
- **Team & access → Finance** (Admin only)
  - `FinanceSettingsPanel`: split slider/inputs for company/agent, second-agent source radio, VAT-registered switch, TRN.
  - `AgreementList` + `AgreementEditor`: per agent, effective-date timeline, "Starts on" validation, auto-close notice.
- **Team member form**
  - `TeamActionFields` gains a Finance row: Add · Edit · Hand on · **See team finance** (needs whole-team visibility) · **Approve** (needs See team finance).
  - Both new ticks are flagged sensitive in `TeamActionReview`. Logic goes in a new `server-team/financeActionModel.js`, because `actionModel.js` is at 121 lines.
- **Dashboard**
  - `dashboard/FinanceWidgets.jsx`, fed only from `GET /finance`.
  - Own view: "Your commission earned (YTD)", "Received share", "Outstanding", "Your submissions awaiting approval".
  - Team view: fees earned, company share, received, outstanding, VAT, approved expenses, and "Awaiting your approval" linking to the filtered queue.
  - `dashboardWidgets()` gains `finance: canOpenSection(user,'Deals')`.

**UX baseline**

- Mobile-first, 44px targets, money right-aligned.
- Status is never shown by colour alone.
- Both themes, focus returns after dialogs, and errors use `role="alert"`.
- Follow `docs/design-standards.md` and the refresh previews (product_designer to confirm the layouts).

---

## 8. Migration, imports and rollback

- **Additive only:** 0011–0014.
  - The only backfill is finance actions for non-archived staff (preset from the module boolean; `approve`/`teamView` false).
  - The migration test lists staff whose effective Client or Property delete changes because of the M-C extension (Q9).
- **No automatic migration** of demo or browser finance data.
- **Super Admin imports stay at the current 8 collections.** Finance sheets in backups are preserved and reported as "not imported yet".
  - A later packet I-F can import Deals as **unearned** (AED parsed to fils exactly, more than 2 dp rejected) and Expenses/Payments as **pending**.
  - It needs an import marker and an explicit review step. Historical earned snapshots are an owner decision for then.
- **Sample data (B6, later):** fictional settings, agreements, deals in every state, and payments/expenses that are pending, approved or rejected.
  - Needs a `crm_sample_finance` marker table, because `crm_sample_records` has an FK to `crm_records`.
  - Needs a guarded delete exception in the lock trigger for `kws.activity_source='sample'` only.
- **Rollback:** fails closed (M-E). Never delete migration rows. An old binary refuses to start (sqlx). Prefer forward fixes. Dropping finance tables is acceptable only on the disposable test database. A rollback dry-run test runs a pre-finance binary against the migrated test database.

---

## 9. Packets

Every packet must:

- Keep every file ≤150 lines.
- Run `cargo fmt`, Clippy, `cargo test`, `npm test`, `npm run build`, `npm run test:api` and `npm run check:lines`.
- Have Q run `npm run test:server:e2e` (connected suite only).
- Add no demo tests.

| Packet   | Owner              | Write set                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Acceptance                                                                                                                                                                                        |
| -------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C0       | primary + security | `docs/finance-design.md`                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Owner answers recorded; security amendments folded in; frozen                                                                                                                                     |
| B1       | backend_database   | `migrations/0011_finance_settings.sql`; `auth/{permissions,permissions tests}.rs` (finance collections mapped); new `auth/finance_access.rs` + `finance_access_tests.rs` (flags, wire, normalise, presets); `auth/{actions,actions_wire,actions_tests}.rs` (finance key; split if >150); `auth/profile.rs` (`financeAccess`); `team/positions.rs`; `team/members/{prepare,update_store}.rs`; `team/invitations/{create,store}.rs`; `tests/api/finance-permissions-*.test.mjs` | Backfill equivalence; strict/invite decoding; teamView/approve gating (400 + DB CHECK); allowlist for unknown role; `access_changed` activity; profile fields                                     |
| B2       | backend_database   | new `finance/{mod,calc,calc_tests,agreements,settings,events,routes}.rs`; `tests/fixtures/finance-golden.json`; `routes.rs` (one merge line); `tests/api/finance-settings-*.test.mjs`                                                                                                                                                                                                                                                                                         | Golden G1–G10 + 10k property test; agreement CRUD, overlap (Rust 409 + exclusion constraint), auto-close, future-only delete; settings version 409; events written                                |
| B3       | backend_database   | `migrations/0012_finance_deals.sql`; `finance/deals/{create,update,split,earn,revise,delete,assign,views,list}.rs`; `records/visibility.rs` (`finance_predicate`); `records/ids.rs` (DL/PM/EX prefixes, table parameter); `auth/grants.rs` (`covers_references` + finance, split if needed); new `finance/departure.rs` + calls in `team/members/update_store.rs`, `team/archive/store.rs`; `tests/api/finance-deals-*.test.mjs`                                              | H1 matrix for deals; shaped views (own view has no company/others); snapshot immutability (DB trigger tests); earn/revise/unearn rules; holder/queue/eligibility; departure release; M-C coverage |
| B4       | backend_database   | `migrations/0013_finance_payments_expenses.sql`; `finance/{payments,expenses}/*.rs`; `finance/{approval,statement,history}.rs`; `tests/api/finance-approval-*.test.mjs`                                                                                                                                                                                                                                                                                                       | Full state table; lock trigger (UPDATE without `kws.finance_admin` raises); self-approval; overpayment; VAT; statement pro-rata; concurrency                                                      |
| B5       | backend_database   | `migrations/0014_interaction_deal_links.sql`; `records/{collections,collections_tests,links,mutation,creation}.rs`; `records/validation/mod.rs`; `tests/api/finance-deal-links.test.mjs`                                                                                                                                                                                                                                                                                      | Deal link enforcement; grandfathering; identical `link_missing`; schedule-only staff cannot set deal links                                                                                        |
| F1       | frontend_engineer  | `services/crm/finance.js`; `lib/finance/{money,commission}.js`; `features/server/finance/{financeModel,financeColumns,useFinance,useFinanceActions,financeAccess}.js`; `tests/unit/finance-*.test.js` (golden parity, money parsing, model rejection)                                                                                                                                                                                                                         | JS = Rust on the golden fixture; no float paths; deny on missing `financeAccess`                                                                                                                  |
| F2       | frontend_engineer  | `features/server/finance/{FinanceContent,DealsPage,DealTable,DealEditor*,DealCalculationPanel,DealSplitDialog,EarnDealDialog,ReviseDealDialog,UnearnDealDialog,CommissionStatement,FinanceHistory}.jsx` + `finance.css`; `ServerContent.jsx`, `sectionStatus.js`                                                                                                                                                                                                              | Own vs team rendering; preview label; dialogs keep drafts on 403/409                                                                                                                              |
| F3       | frontend_engineer  | `features/server/finance/{PaymentsPage,PaymentForm,ExpensesPage,ExpenseForm,ApprovalActions,RejectDialog,StatusChip}.jsx`; `dashboard/{FinanceWidgets.jsx,dashboardModel.js,ServerDashboard.jsx}`                                                                                                                                                                                                                                                                             | Queue filter; reasons; resubmit; dashboard figures equal API totals                                                                                                                               |
| F4       | frontend_engineer  | `features/server-team/{FinanceSettingsPanel,AgreementList,AgreementEditor,financeActionModel,TeamActionFields,TeamActionReview}.jsx/js`; `ServerTeamPage.jsx` (tab only)                                                                                                                                                                                                                                                                                                      | Gating text, presets, sensitive flags, agreement timeline                                                                                                                                         |
| Q        | qa_accessibility   | `tests/server-browser/finance-*.spec.js`                                                                                                                                                                                                                                                                                                                                                                                                                                      | Browser matrix in §10; 390px and desktop; both themes; keyboard                                                                                                                                   |
| B6 / I-F | later              | Sample finance; finance imports                                                                                                                                                                                                                                                                                                                                                                                                                                               | Separate approval                                                                                                                                                                                 |

**Order:** owner answers → C0 freeze → security review → B1 → B2 → B3 ∥ F1 → B4 ∥ F2 → B5 ∥ F3/F4 → Q → docs. B-packets touch shared Rust files, so run them sequentially.

---

## 10. Test matrix

**Calculation**

- G1–G10.
- Half-up at exactly .5 fils; floor at .99.
- VAT on and off; fixed basis ignoring rate.
- `first_agent` vs `company` source; S = 0 and S = 10000.
- Owner-held deal; extremes without overflow.
- Random invariant sum; Rust/JS parity.

**Agreements**

- `from` inclusive / `to` exclusive boundaries.
- No agreement → team default; missing settings → 409.
- Overlap → 409 and the DB exclusion constraint.
- Auto-close; deleting a started agreement → 409; future `earned_on` → 400.

**Snapshots**

- UPDATE or DELETE on snapshots or lines raises.
- Agreement or default changes after earning leave statements unchanged.
- Revise → revision 2, with 1 superseded.
- Unearn blocked by approved payments.
- Changing earned terms on the non-Admin path raises in the DB.

**Approval**

- Every row of §4.
- Reject without reason → 400.
- Approve without grant + bad body → 403 (403 before 400).
- Self-approval for submitter, last editor, holder, second agent → 403. Admin self-approval OK.
- Double decision → 409; overpayment → 409; payment on an unearned deal → 409; void is terminal.

**Leakage**

- An agent asking for another agent's deal, payment or expense gets a 404 byte-identical to unknown and cross-team UUIDs (update, approve, history, assignee).
- The own `GET /finance` contains no `companyFils`, other lines, override reason, `teamTotals` or other agreements.
- A second agent sees a statement line and gets 404 on the deal.
- Team-scope staff **without** teamView get the own view.
- teamView without team scope → 400 and DB CHECK; approve without teamView refused.
- No finance module → 403 on every finance endpoint; `GET records` unchanged.
- References only with grants.
- `link_missing` identical for hidden and unknown deal or client.
- Staff never trigger 23505 (issued IDs).
- M-C: a Client delete by a team member without finance team view → 403 before the FK.
- Super Admin sees across teams; archived workspace is read-only.

**Concurrency**

- Two approvers approving at once → one 200, one 409.
- Approve racing edit → 409.
- Earn racing agreement create → serialised by the lock.
- Reassign racing PATCH; departure racing earn.
- 20 parallel payment creates → unique `PM-` IDs.
- Stale settings PUT → 409.

**Migration**

- Seeded 0010 database → 0014.
- Finance actions backfill equivalence; archived rows untouched; M-C affected-member report.
- Rollback dry-run.
- No amounts or reasons in `crm_activity`.

**Browser**

1. Agent creates a deal and sees the preview.
2. Admin sets the split and marks it earned.
3. Agent submits a payment, which shows as Pending.
4. Accountant (team + teamView + approve) approves.
5. Agent's statement updates.
6. A reject → correct → resubmit flow.
7. The agent cannot see a colleague's figures, including on the dashboard.
8. Team form gating.

Run at 390px and desktop, in light and dark themes, keyboard-only.

---

## 11. Risks and owner questions

### Risks

| Risk                                            | Mitigation                                               |
| ----------------------------------------------- | -------------------------------------------------------- |
| Rust/JS calculation drift                       | Shared golden fixture; server is authoritative           |
| Shaped-view leakage regressions                 | Serializer per scope with snapshot tests                 |
| M-C tightening removes some staff deletes       | Migration report and UI text                             |
| Agreement backdating confuses unearned previews | Preview label plus earn-time confirmation                |
| btree_gist availability on hosting              | Trusted extension; Rust check is the primary guard       |
| Departure of beneficiaries                      | Lines retained; earning refuses an inactive second agent |
| Payment VAT rounding vs deal VAT                | Documented; at most 1 fil per payment                    |
| File-size pressure in auth and records          | Splits pre-planned per packet                            |

### Owner questions (each changes the design; recommendation first)

1. **What "earned" means and who marks it.**
   - Recommended: an Admin or approver confirms "Earned" with the business date the fee became due (sale: transfer/SPA completion; rental: tenancy contract signed). The snapshot is taken then.
   - Agents cannot earn their own deals.
2. **Co-broker receivable.**
   - Recommended: each brokerage collects its own side, so the company's receivable, payments and VAT are on the fee **after** the partner share.
   - The alternative (company collects the gross fee and pays the partner) changes payment caps and VAT.
3. **Second agent.**
   - Recommended: the per-deal % applies to the _source share_ (the first agent's or the company's, per the team setting).
   - Only Admins set the second agent and their %, because it moves company or colleague money.
4. **Deals held by the Admin/owner, or in the queue at earning.**
   - Recommended: no agent line; the company keeps the whole net.
5. **Who creates deals.**
   - Recommended: staff with finance Add, for clients they hold (the deal is assigned to them). Admins can create for anyone.
6. **Expenses.**
   - Recommended: they belong to the person who incurred them (agents see their own). Admins record company expenses or record on behalf of a member.
   - Expenses do **not** reduce commissions in v1.
7. **Payments.**
   - Recommended: partial payments allowed, only on earned deals, with the approved total capped at the receivable.
   - Refunds and negative payments deferred. Admins **void** mistakes with a reason.
8. **Cancellation after earning.**
   - Recommended: the Admin may unearn (with a reason) only when no payment is approved; otherwise the payments are voided first. The snapshot is kept as superseded.
9. **Client/Property delete coverage (M-C).**
   - Recommended: deleting or renaming a Client or Property additionally requires "See team finance", so a deal FK refusal never reveals hidden deals. Staff who hold deleteMain lose it until granted.
   - Alternative: deals keep a snapshot of the client ID and name without an FK. This weakens integrity.
10. **Second agent visibility.**
    - Recommended: the statement line only (deal ID, date, their share), not the deal.
11. **What a deal's holder sees.**
    - Recommended: fee, partner share and their own commission; the second agent's name only.
    - Never the company share or the second agent's amount. The override reason is not shown; "Adjusted by Admin" is.
12. **Agent positions.**
    - Recommended: add finance (own view only) to the Property Agent position default, since agents must see their own deals. Existing members change only when an Admin edits them.
    - Team Supervisor is unchanged.
13. **Commission payouts to agents** (company → agent).
    - Recommended: out of scope for v1. The statement shows the earned share and the share received pro-rata.

### Assumptions (not owner questions)

- AED only, VAT fixed at 5%.
- Dates use Asia/Dubai.
- No server-side pagination (consistent with records).
- Finance export ships with the P10 exports packet using the §2.3 mapping.
- Hand-off notes for deals are deferred.
- Expense category stays free text until the product designer supplies options.

### Unresolved items, not blocking B1

- Exposing superseded snapshot history in a Super Admin audit view.
- Timezone normalisation for `receipt_date` and `date_paid` imports.
- Imported historical earned deals.

## 12. Owner answers (2026-10-14)

The owner approved every recommendation in §11 (questions 1–13) as written: Admin/approver marks deals earned with the business date; each brokerage collects its own side; second-agent % applies to the configured source share and is Admin-set; unassigned or Admin-held deals keep the whole net for the company; staff with finance Add create deals for clients they hold; expenses belong to whoever incurred them and do not reduce commissions in v1; partial payments only on earned deals, capped at the receivable, refunds deferred, Admin voids with a reason; unearn only without approved payments; Client/Property delete or rename also requires "See team finance"; second agents see only their statement line; the deal holder sees fee, partner share, own commission and the second agent's name only; Property Agent gains own-view finance by default; agent payouts are out of scope for v1.
