# Connected finance design: Deals, Payments and Expenses (finance packet set)

**Status:** frozen contract (2026-10-14): owner-approved (§12), security-reviewed with amendments (§13) that override earlier sections. Proposed by senior_architect. This is the sensitive tier, so the order is: owner answers (§11), then freeze, then security review, then implementation. No files were edited. The finance section of `docs/product-decisions.md` (lines 60–73) is binding. This design composes with the frozen assignments-design §3/§4 (H1–H4) and action-permissions-design §1–§14.

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
   - JS `apps/crm/src/lib/finance/commission.js` is used only for editor preview.
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

- Deals has 34 columns, Payments 9 and Expenses 10 (`apps/crm/src/data/schemas/deals.js:3-63`). Columns are append-only by letter (`apps/crm/src/data/schemas/columns.js:9-15`).
- Calculated fields: Deals has Gross fee, After partner, Your expected/earned fee, Outstanding and Payment status; Payments has Total received (`apps/crm/src/config/fields.js:21-29,40,44`).

**Current calculations (`apps/crm/src/lib/crm.js`), all floating point**

- `feeNumber` returns fixed fee, or agreed value × rate ÷ 100 (`:29-34`).
- `yourFee` = fee × (1 − partner%) × your% (`:36-39`).
- `totalPaid` sums "Your fee received AED ex VAT" (`:41-45`).
- Outstanding = max(0, earned − paid). Payment status is "Not earned", "Paid" or "Outstanding" (`:99-109`).
- Total received = ex VAT + VAT (`:111-112`).
- The model is single-user ("Your share %") with no company/agent split, no second agent, no rounding and no approval.

**Field options**

- `Fee basis` is Percentage or Fixed. `Document status` options exist (`apps/crm/src/config/fields/clientAndContactOptions.js:41-42`).
- `Deal stage` has 10 options. `Sale / rental` is Sale, Rental or Holiday home (`apps/crm/src/config/fields/stageAndListingOptions.js:14-25,38`).
- `Lost / cancelled reason` options exist (`outcomeAndCareOptions.js:30-41`).
- `Expense category` has no option list.
- Demo IDs use `DL-`, `PM-` and `EX-` (`apps/crm/src/data/demo.js`).

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

- Finance routes map to `finance` (`apps/crm/src/config/team.js:82-84`) but render `ServerUnavailableSection` (`apps/crm/src/features/server/ServerContent.jsx:29,33`).
- The dashboard explicitly reads no finance (`apps/crm/src/features/server/dashboard/dashboardModel.js:4`).
- `AED()` formats with 0 decimal places by default (`apps/crm/src/lib/format.js:1`). Finance needs 2.

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

- New columns are appended only in a **connected-only column map** (`apps/crm/src/features/server/finance/financeColumns.js`).
  - Deals: `Agent`, `Second agent`, `Company share AED`, `Agent commission AED`, `Second agent commission AED`, `VAT AED`, `Split source`.
  - Payments and Expenses: `Approval status`, `Submitted by`, `Decided by`, `Decision reason`.
- `apps/crm/src/data/schemas/deals.js` is **not** changed, because the demo is frozen.

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

### 3.5 Worked examples (golden fixture `apps/crm/tests/fixtures/finance-golden.json`)

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

- `apps/crm/src/services/crm/finance.js`: the API client.
- `apps/crm/src/lib/finance/money.js`: AED string ↔ fils, `formatAed(fils)` with 2 dp, tabular numerals. No floats.
- `apps/crm/src/lib/finance/commission.js`: the BigInt preview mirror of §3.
- `apps/crm/src/features/server/finance/financeModel.js`: strict parsing of views, rejecting non-integer fils, plus statuses and labels.
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
- **Sample data (B6, implemented 2026-10-16, see §18):** fictional settings, agreements, deals in every state, and payments/expenses that are pending, approved or rejected.
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

| Packet   | Owner              | Write set                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Acceptance                                                                                                                                                                                        |
| -------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C0       | primary + security | `docs/finance-design.md`                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Owner answers recorded; security amendments folded in; frozen                                                                                                                                     |
| B1       | backend_database   | `migrations/0011_finance_settings.sql`; `auth/{permissions,permissions tests}.rs` (finance collections mapped); new `auth/finance_access.rs` + `finance_access_tests.rs` (flags, wire, normalise, presets); `auth/{actions,actions_wire,actions_tests}.rs` (finance key; split if >150); `auth/profile.rs` (`financeAccess`); `team/positions.rs`; `team/members/{prepare,update_store}.rs`; `team/invitations/{create,store}.rs`; `apps/crm/tests/api/finance-permissions-*.test.mjs` | Backfill equivalence; strict/invite decoding; teamView/approve gating (400 + DB CHECK); allowlist for unknown role; `access_changed` activity; profile fields                                     |
| B2       | backend_database   | new `finance/{mod,calc,calc_tests,agreements,settings,events,routes}.rs`; `apps/crm/tests/fixtures/finance-golden.json`; `routes.rs` (one merge line); `apps/crm/tests/api/finance-settings-*.test.mjs`                                                                                                                                                                                                                                                                                | Golden G1–G10 + 10k property test; agreement CRUD, overlap (Rust 409 + exclusion constraint), auto-close, future-only delete; settings version 409; events written                                |
| B3       | backend_database   | `migrations/0012_finance_deals.sql`; `finance/deals/{create,update,split,earn,revise,delete,assign,views,list}.rs`; `records/visibility.rs` (`finance_predicate`); `records/ids.rs` (DL/PM/EX prefixes, table parameter); `auth/grants.rs` (`covers_references` + finance, split if needed); new `finance/departure.rs` + calls in `team/members/update_store.rs`, `team/archive/store.rs`; `apps/crm/tests/api/finance-deals-*.test.mjs`                                              | H1 matrix for deals; shaped views (own view has no company/others); snapshot immutability (DB trigger tests); earn/revise/unearn rules; holder/queue/eligibility; departure release; M-C coverage |
| B4       | backend_database   | `migrations/0013_finance_payments_expenses.sql`; `finance/{payments,expenses}/*.rs`; `finance/{approval,statement,history}.rs`; `apps/crm/tests/api/finance-approval-*.test.mjs`                                                                                                                                                                                                                                                                                                       | Full state table; lock trigger (UPDATE without `kws.finance_admin` raises); self-approval; overpayment; VAT; statement pro-rata; concurrency                                                      |
| B5       | backend_database   | `migrations/0014_interaction_deal_links.sql`; `records/{collections,collections_tests,links,mutation,creation}.rs`; `records/validation/mod.rs`; `apps/crm/tests/api/finance-deal-links.test.mjs`                                                                                                                                                                                                                                                                                      | Deal link enforcement; grandfathering; identical `link_missing`; schedule-only staff cannot set deal links                                                                                        |
| F1       | frontend_engineer  | `services/crm/finance.js`; `lib/finance/{money,commission}.js`; `features/server/finance/{financeModel,financeColumns,useFinance,useFinanceActions,financeAccess}.js`; `apps/crm/tests/unit/finance-*.test.js` (golden parity, money parsing, model rejection)                                                                                                                                                                                                                         | JS = Rust on the golden fixture; no float paths; deny on missing `financeAccess`                                                                                                                  |
| F2       | frontend_engineer  | `features/server/finance/{FinanceContent,DealsPage,DealTable,DealEditor*,DealCalculationPanel,DealSplitDialog,EarnDealDialog,ReviseDealDialog,UnearnDealDialog,CommissionStatement,FinanceHistory}.jsx` + `finance.css`; `ServerContent.jsx`, `sectionStatus.js`                                                                                                                                                                                                                       | Own vs team rendering; preview label; dialogs keep drafts on 403/409                                                                                                                              |
| F3       | frontend_engineer  | `features/server/finance/{PaymentsPage,PaymentForm,ExpensesPage,ExpenseForm,ApprovalActions,RejectDialog,StatusChip}.jsx`; `dashboard/{FinanceWidgets.jsx,dashboardModel.js,ServerDashboard.jsx}`                                                                                                                                                                                                                                                                                      | Queue filter; reasons; resubmit; dashboard figures equal API totals                                                                                                                               |
| F4       | frontend_engineer  | `features/server-team/{FinanceSettingsPanel,AgreementList,AgreementEditor,financeActionModel,TeamActionFields,TeamActionReview}.jsx/js`; `ServerTeamPage.jsx` (tab only)                                                                                                                                                                                                                                                                                                               | Gating text, presets, sensitive flags, agreement timeline                                                                                                                                         |
| Q        | qa_accessibility   | `apps/crm/tests/server-browser/finance-*.spec.js`                                                                                                                                                                                                                                                                                                                                                                                                                                      | Browser matrix in §10; 390px and desktop; both themes; keyboard                                                                                                                                   |
| B6 / I-F | B6 done (§18)      | Sample finance; finance imports                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Separate approval                                                                                                                                                                                 |

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

## 13. Security amendments and final owner answers (2026-10-14)

Security verdict: **approve with changes** (1 High, 7 Medium, 8 Low). These override §1–§12 where they differ. Owner rules: [Product decisions](product-decisions.md#finance-additions-after-security-review-decided-2026-10-14).

- **H-F1 Deal hand-over.** Staff may hand on only deals they hold. Moving another person's deal, or to/from the queue, is Admin-only and needs a reason. Hand-over offers _full_ or _keep a referral share_: the kept share becomes a second-agent line sourced from the receiving agent's share, capped by a team setting `maxReferralShareBp`, and takes effect only after the receiving agent **accepts** (pending hand-over request; Admin may approve or adjust). Every deal reassignment writes an `assigned` finance event (from, to, actor, reason). A staff approver may not earn a deal they reassigned since its last earn/unearn. Reassigning an earned deal never changes commission lines.
- **M-F1 Deal creation.** Staff create deals only on clients they hold (`client.assignee_id = caller` under the lock; otherwise identical `link_missing`); staff may change `client_ref` only to a held client. Admin-created deals default to the client's holder (or the queue). Earn flags "Deal holder is not the client's holder".
- **M-F2 Earned date.** Staff approvers: `earned_on` ≥ deal `created_at` (Asia/Dubai) and ≥ today − 31 days; earlier is Admin-only. The earn confirmation shows agreement, split source and lines; the `earned` event stores `earned_on` and `agreement_id`.
- **M-F3 History is never rewritten.** Revise keeps the superseded snapshot's primary agent and `agreement_id` unless the Admin explicitly changes them (response shows before/after). Creating an agreement whose `effective_from` ≤ the `earned_on` of any current snapshot for that agent → 409 "This agreement would apply to deals already earned." Deleting a future agreement reopens the one it auto-closed. Departure never removes earned lines.
- **M-F4 State machine.** Approve re-checks under the lock that the deal is earned and approved + this ≤ current snapshot net (else 409). Revise refuses when new net < approved total (409 "Void approved payments first."). Split changes on an earned deal → 409 "Revise the deal to change its split." Re-earn uses `max(revision)+1`. Payment `deal_ref` is immutable after create (400). Lost/Cancelled on an earned deal requires unearn first. The terms-locked trigger also locks `earned_on`, `second_agent_*` and `override_*` once earned.
- **M-F5 Shaped views.** Second-agent statement lines return only `{dealId, earnedOn, dealType, role, amountFils, receivedShareFils, outstandingFils}` (no `shareBp`; outstanding per line). The owner accepts residual inferences (e.g. a holder with no second agent can infer the company share from net − own line), like sequential IDs. Leakage tests assert exact field allowlists.
- **M-F6 Separation of duties.** An approver who edited or resubmitted a row since its last submission cannot approve it (derived from finance events under the lock). A DB trigger refuses `approved` where `decided_by` ∈ {submitted_by, last_edited_by, incurred_by} unless the decider is an Admin. Admin self-approval records `selfDecided` in the event.
- **M-F7 Admin trigger bypass.** A single helper `finance::admin_path(tx, &live_row)` asserts admin (allowlist, live row under the lock) and uses `set_config('kws.finance_admin','on',true)` only; a test forbids other uses. Triggers raise distinct SQLSTATEs (P0001), never 23514 without a constraint; 23P01 maps to the agreement-overlap 409. Sample-data deletes also require membership in a sample tracking table.
- **Super Admin.** No finance write actions inside companies (no approve, void, settings, agreements, overrides); "manage" means the company's Admin. Super Admin read access follows the platform-phase redesign.
- **L-F1** DB triggers check `second_agent_id`, `incurred_by` and commission-line agents belong to the workspace (active when written); statement queries join snapshots and filter `workspace_id`; earn re-checks the second agent is active with the finance module; CHECK that finance action flags require the finance module.
- **L-F2** Delete/ID-change coverage (M-C) for Clients and Properties includes the finance FKs (`crm_deals.client_ref`, `property_ref`, `crm_expenses.property_ref`) from an explicit list; deal `legacy_id` is immutable for everyone; finance authorisation does not go through `UserRow::can`, and Deals are not added to the generic collections, `ASSIGNABLE` or `collection_key` (generic `/records/Deals` and `/assignments` return 400).
- **L-F3** Realistic caps (e.g. agreed value ≤ AED 10bn), `checked_*` sums, received shares computed in i128 in Rust, frontend rejects non-safe integers; `receipt_date`/`date_paid` ≤ today; length CHECKs on reasons; `vat_rate_bp` stored on snapshots.
- **L-F5** Receipt links https only, rendered with `rel="noopener noreferrer"`, never fetched, never in events/activity/logs.
- **L-F6** `details` JSONB: allowlisted workbook text keys only, strings, ~16 KB cap, reserved keys refused.
- **L-F7** Interaction log deal links resolve only through `deal_ref`; imports set it NULL; when set, payload `deal_id_optional` must equal it; grandfathered values show "Linked deal unavailable".
- **L-F8** Agreements: Admin read/write; teamView staff read-only; never another agent's agreement in the own view. `GET /finance/assignees` needs finance assign or teamView. Target-dependent messages ("Earned deals…", "Approved records…") come after the 404 and version checks.
- **Info** `teamView` requires whole-team record scope (note in team-form copy). ID/table helpers take closed enums, never request strings. Keep: live profile re-read per request and under the lock, Admin-only finance activity, lenient stored decoder.

## 14. Implementation notes (B1/B2, 2026-10-14)

Deviations and clarifications made while implementing B1 and B2; everything else follows §1–§13.

1. **PATCH `actions.finance` is optional.** When present it is strict and complete; when omitted (clients that predate finance) the stored finance flags carry over under the M-D rules. Invitations may omit `finance` (position preset), `approve` and `teamView`; sending either as `true` is 400 "Approving and team finance need whole-team visibility.". Approve without teamView on a team member is 400 "Approving finance records needs See team finance.". Flags for a module that is off are cleared, not refused.
2. **Super Admin.** `financeAccess` is `{scope:"team", teamView:true, create/edit/assign/approve/manage:false}` and `actions.finance` matches. This applies in every workspace, the organisation workspace included, until the platform phase. `manage` is the `admin` role only.
3. **Settings.** 0011 adds `max_referral_share_bp` (H-F1, default 0) and an `id UUID` used as the history entity. `PUT /finance/settings` requires exactly `{version|null, agentShareBp, secondAgentSource ("first_agent"|"company"), maxReferralShareBp, vatRegistered, trn|null}` and returns `{settings:{version, agentShareBp, secondAgentSource, maxReferralShareBp, vatRegistered, vatRateBp, trn}}`. An unchanged save keeps the version and writes no event. New messages: "Provide valid finance settings.", "Choose a valid second-agent split source.", 409 "Finance settings changed. Reload before saving.". Own views get `{vatRegistered, vatRateBp, trn}`.
4. **Agreements.** List items are `{id, agent:{id,name}, agentShareBp, effectiveFrom, effectiveTo}`; `POST` returns 201 `{agreement, closed:{id, effectiveTo}|null}`; `DELETE` returns `{deleted, reopened:{id, effectiveTo}|null}`. The list needs team finance (own-view callers use `myAgreements`, 403 otherwise). Agents are non-archived staff of the workspace (pending and suspended included). Dates are `YYYY-MM-DD` within 2000–2099 ("Enter a valid date (YYYY-MM-DD)."). A deleted future agreement reopens the agreement whose end equals its start, extending it to the deleted agreement's own end (open if that was open), so a later agreement is never overlapped. A trigger also refuses deleting started agreements.
5. **M-F3 hook.** 0011 defines `crm_agreement_applies_to_earned(ws, agent, starts)` returning false; the Rust create path calls it under the lock and answers 409 "This agreement would apply to deals already earned.". 0012 must `CREATE OR REPLACE` it with the current-snapshot query.
6. **SQLSTATEs.** P0F01 agreement terms changed (409), P0F02 agreement agent not team staff (400), P0F03 started agreement deleted (409), 23P01 overlap (409); mapped in `finance/errors.rs`. P0F04 onwards are free for B3/B4.
7. **Finance events.** The action list adds `deleted` and `reopened` (agreements). Rows use `clock_timestamp()` so several events in one transaction keep their order. The TRN is recorded as `"changed"`.
8. **`GET /finance` in B2** returns `scope`, `settings` (or null before setup), `myAgreements`, empty `deals`/`payments`/`expenses`/`references`, a zero `statement` and, for team view, zero `teamTotals`; `?agent=` is team-only and must be a UUID. B3/B4 fill the rest.
9. **`finance::admin::admin_path`** asserts the live Admin row and sets the bypass; nothing calls it until B3. A unit test fails if any other Rust file mentions the setting.
10. **Golden fixture layout.** `apps/crm/tests/fixtures/finance-golden.json` uses column lists and rows to stay within 150 lines: G1–G4, G7–G10 (G10 as a–d) and edge cases E1–E4 (half-up and floor at the boundary); payments G5, G6 and G9; §3.6 agreement selection; and the 10k-case property test (splitmix64, documented draw order, column sums) for JS parity. The calculation is split into `finance/{calc,selection,receipts}.rs`.
11. **Backfill.** Staff whose stored actions are `{}` (never recorded) keep `{}`. The module CHECK treats a missing finance key as off. Existing Property Agents keep their stored modules; the new position default applies when an Admin next applies positions.
12. **Follow-up outside B1/B2.** Profiles and team entries now carry `actions.finance`, so `apps/crm/tests/server-browser/permissions-team-form.spec.js` (exact `stored.actions`) needs the finance key added by Q/F4.

## 15. Implementation notes (B3, 2026-10-14)

Deviations and clarifications made while implementing B3 (deals); everything else follows §1–§14.

1. **Migrations.** To keep each file within 150 lines, deals use three migrations: `0012_finance_deals.sql` (deals, snapshots, lines, history CHECK extensions and a read-only M-C report query), `0013_finance_deal_guards.sql` (triggers, the real `crm_agreement_applies_to_earned` and the `crm_deal_approved_fils` hook) and `0014_finance_deal_handovers.sql`. Payments/expenses therefore become `0015` and Interaction log deal links `0016`.
2. **Columns beyond §2.2.** `crm_deals` adds `second_agent_kind` (`split` = Admin-set, sourced per the team setting; `referral` = kept on a hand-over and always sourced from the primary agent's share) and `UNIQUE (id, workspace_id)` for composite FKs. Snapshots add `primary_agent_id`, `vat_registered` and `vat_rate_bp`; `inputs` stores the agent share, agreement and its share, team default, team second-agent source and override, so a revision never re-reads changed settings. Agreed value and fixed fee are capped at AED 10bn (10¹² fils, L-F3): 400 "Amounts must be whole fils between 0 and AED 10,000,000,000.". `details` holds 15 allowlisted workbook text keys (strings ≤ 4,000 characters, ≤ 16 KB; empty strings dropped).
3. **SQLSTATEs.** P0F04 member not eligible (400 "Choose an active team member with finance access."), P0F05 earned terms locked and earned deletes (403 "Earned deals can only be changed by your Admin."), P0F06 deal identity (400 "Deal IDs cannot be changed."), P0F07 snapshots, lines and decided hand-overs append-only (409), P0F08 deferred split total (409). Lines accept a departed agent only when a revision carries the same agent and role over.
4. **Payments hook (M-F4).** `crm_deal_approved_fils(deal)` returns 0 until B4 replaces its body with the approved-payment sum. Unearn refuses when it is above 0 (409 "Void this deal's approved payments first."), revise when the new net is below it (409 "Void approved payments first."), and views/totals use it as received.
5. **Endpoints.** `POST /deals {deal}` → 201 `{deal}`; `PATCH /deals/{id} {deal, version}` (full object; `dealId` may be echoed and must match) → `{deal}`; `PUT /deals/{id}/split {version, secondAgentId, secondAgentShareBp, overrideAgentShareBp, reason|null}` → `{deal}`; `POST /deals/{id}/earn {version, earnedOn}` → `{deal, warnings}`; `GET /deals/{id}/earn-preview?earnedOn=` (approvers) → `{preview:{earnedOn, agreement, calculation, warnings}}`; `POST /deals/{id}/revise {version, reason, primaryAgentId?, agreementId?, secondAgentId?+secondAgentShareBp?, overrideAgentShareBp?}` → `{deal, before, after}`; `POST /deals/{id}/unearn {version, reason}` → `{deal}`; `DELETE /deals/{id} {version}` → `{deleted}`; `PUT /deals/{id}/assignee {version, assigneeId|null, reason}` (Admin only, H-F1) → `{entry}`; `GET /assignees` → `{assignees:[{id, name, kind:"staff"|"owner"}]}`. Missing create/edit/assign grants reuse the record messages ("Your access doesn't include adding/editing/handing on these records."). History endpoints remain for B4 (`finance/history.rs`).
6. **Hand-overs (H-F1).** `POST /deals/{id}/handovers {version, toId, referralShareBp|null}` (holder with finance Hand on; 403 "Only the deal's holder can hand it over. Ask your Admin to move it." for visible non-holders) → 201 `{handover}`; `POST /handovers/{id}/accept|decline|cancel` (no body) and `/approve {referralShareBp|null, reason}` (Admin, may adjust) → `{handover, entry}`. Receivers are active staff with finance (not the holder); one pending request per deal (409 "This deal already has a pending hand-over."); referral ≤ `maxReferralShareBp` (409 "The referral share is above your team's limit."), only on unearned deals without a second agent. Requests a caller may not decide are 404. Any reassignment cancels pending requests. Accepting writes `crm_assignments` reason `handover` and an `assigned` event `{assignee, requestedBy, secondAgentId?, secondAgentShareBp?}`.
7. **Holders.** Admin-created deals go to the client's holder when that member can hold deals (finance module), otherwise the queue; staff hold what they create and may link only clients they hold. A staff approver may not earn a deal they hold, share, or reassigned/requested to hand on since the last earn or unearn (derived from `assigned` events). Assigning an unearned deal to its second agent is 409 "This team member already shares this deal. Change the split first.".
8. **Views.** Own deal views have exactly `{id, version, dealId, assignee, clientId, propertyId, dealType, stage, agreedValueFils, feeBasis, feeRateBp, fixedFeeFils, partnerShareBp, partnerName, earnedOn, details, secondAgent:{name}, calculation, receivedFils, outstandingFils, paymentStatus, pendingHandover, allowed}` with own lines `{role, amountFils}`; team views add `override`, `secondAgent.{id, shareBp, kind}` and calculation `companyFils`, `splitSource`, `agreementId` and all lines `{role, agent, shareBp, amountFils}`. Statement primary lines add `shareBp` and `adjusted`. `GET /finance` adds `handovers` (pending requests the caller takes part in; all for team finance), deals, references, statement and team totals; `pendingCount` and expenses stay 0 until B4.
9. **Departure and M-C.** `finance::departure` runs in member updates (inactive → `departure`, finance module removed → `access_removed`) and staff archives; it queues held deals and cancels hand-overs to or from the member. `covers_references` uses the explicit `finance::references` list, so team-scope staff need "See team finance" to delete or rename Clients and Properties. Test fixtures were updated (the `teamDelete` permission fixture gains team finance) and the sample Karim (Team Supervisor, no finance) now deletes Contacts but not Clients; `docs/backend-foundation.md` still describes Karim as deleting clients and needs the same wording change.

## 16. Implementation notes (B4, 2026-10-15)

Deviations and clarifications made while implementing B4 (payments, expenses, approval, statement and history); everything else follows §1–§15.

1. **Migration.** `0015_finance_payments_expenses.sql` adds `crm_payments` and `crm_expenses` (amounts 1 fil to AED 10bn, matching the deal cap; reference ≤ 200, notes ≤ 4,000, category ≤ 100, supplier and campaign reference ≤ 200; a CHECK ties `status` to `decided_by`/`decided_at`/`decision_reason`; expense `receipt_url` must match `^https://` and be ≤ 2,048 characters). One guard trigger serves both tables and raises: P0F09 (403 "Approved records can only be changed by your Admin.") for approved rows off the Admin path, any change to a void row and every DELETE; P0F10 (400 "A payment's deal and record IDs cannot be changed.") for identity, submitter or `deal_ref` changes; P0F11 (403 "Another approver must review your own submissions.") when a non-Admin `decided_by` is the submitter, last editor or expense owner; P0F12 (400 "Payment and expense dates cannot be in the future.") for dates after today in Asia/Dubai; P0F13 (409 "This record has already been decided. Reload to see its status.") for transitions outside pending → pending/approved/rejected, rejected → pending and approved → approved/void, and for inserts that are not pending; P0F14 (409 "Approving this payment would exceed the deal's fee.") when approved payments would exceed the current snapshot's net or the deal has no current snapshot; P0F04 when an expense owner is not an active Admin or staff member of the workspace (L-F1). `crm_deal_approved_fils` now returns the sum of approved payments, so received figures, outstanding, unearn ("Void this deal's approved payments first.") and revise ("Void approved payments first.") use real approvals. Indexes cover deal and owner lookups, expense properties and pending rows.
2. **Endpoints.** `POST /payments {payment:{dealId, receiptDate, amountFils, reference?, notes?}}` → 201 `{payment}`. `PATCH /payments/{id} {payment:{receiptDate, amountFils, reference?, notes?, dealId? (echo only)}, version, reason?}` → `{payment}`. `POST /expenses {expense:{datePaid, amountFils, category?, supplier?, campaignReference?, propertyId?, receiptUrl?, notes?, incurredBy? (Admin only)}}` → 201 `{expense}`; `PATCH /expenses/{id}` takes the same fields with `version` and `reason?`. For both kinds, `POST …/{id}/approve {version}`, `…/reject {version, reason}` and `…/void {version, reason}` return `{payment|expense}`. `GET /{deals|payments|expenses}/{id}/history` → `{history}`. IDs are issued as `PM-`/`EX-` (sending one gives 400 "Record IDs are issued by the server."). Body errors: "Provide valid payment details.", "Provide valid expense details.", "Provide the record version.", "Provide a version and a reason.", "Amounts must be whole fils between AED 0.01 and AED 10,000,000,000.", "Enter a valid HTTPS receipt link." and "Expenses are recorded for yourself." (staff sending a non-null `incurredBy`). A hidden or unknown deal gives 409 `link_missing` "The linked deal is missing from this workspace. Choose another deal or clear it."; an unearned deal gives 409 "Payments can be recorded once the deal is earned." on create and on approval.
3. **Check order and grants.** H1 holds: finance module, then create, edit or approve (or the Admin role for void, "Only your Admin can change finance settings."), all before the body; then the lock and live re-read, the predicate fetch `FOR UPDATE` (identical 404), version (409 "This record changed. Reload before saving."), state, separation of duties, links and the M-F4 cap. The Super Admin has no write grant, so every write is 403. Approved rows are edited only by the Admin and need a reason (400 otherwise), opening `finance::admin::admin_path`. Void rows give 409 "Voided records cannot be changed." to the Admin. Voiding a pending or rejected row gives 409 "Only approved records can be voided.". An edit that changes nothing writes nothing, except a resubmission.
4. **Separation of duties (M-F6).** A staff approver cannot approve or reject a row they submitted, last edited or incurred. For payments, this also covers the deal's holder, second agent and current commission-line agents. It also covers anyone who edited or resubmitted the row since its last `submitted`/`resubmitted` event, so a later trivial edit by someone else does not clear them. Admins may decide such rows, and the event then carries `changes.selfDecided: true`.
5. **VAT and money.** VAT is `hu(amount, 500)` when the current snapshot is VAT-registered. It is computed on create and edit, and recomputed on approval, so an approved row always matches its deal's current snapshot; a changed value is recorded as `vatFils` in the `approved` event. Approval locks the deal row and checks earned plus `approved others + amount ≤ net` in `i128` under the workspace lock. Admin edits of approved payments re-check it. Partial payments are allowed; refunds are deferred.
6. **Views.** PaymentView keys are exactly `{id, version, paymentId, dealId, receiptDate, amountFils, vatFils, totalFils, reference, notes, status, submittedBy{id,name}, decidedBy, decidedAt, reason, allowed{edit, approve, reject, void}}`. ExpenseView replaces the payment fields with `{expenseId, incurredBy{id,name}, datePaid, category, supplier, campaignReference, propertyId, receiptUrl}`. In the own view, `decidedBy` is null unless the caller decided the row. The reason of a rejected or voided row is shown to everyone who sees the row. `GET /finance` lists visible payments (own view: on deals the caller holds; second agents see none) and expenses (own view: those they incurred). `?agent=` narrows both. Team totals fill `expensesApprovedFils` and `pendingCount` (pending payments plus expenses in scope). Expense properties join `references.Properties` under the same grant rule.
7. **History.** Team view items are `{at, action, actor{id,name}, changes, reason}`; own-view items are `{at, action, actor{name}}` plus `reason` on `rejected` items only. Deal history follows the deal predicate, so a second agent gets 404. Receipt links, notes and supplier texts are recorded only as `"changed"` (L-F5). `crm_activity` gets `created`, `updated`, `approved`, `rejected` or `voided` for `Payments`/`Expenses`.
8. **Files.** The statement moved from `finance/deals/statement.rs` to `finance/statement.rs`; it was already pro-rata in `i128`. Shared approval code lives in `finance/{entry,entry_sql,entry_view,entry_wire,entry_edit,entry_totals,approval,approval_rules,decisions,history}.rs` with `finance/{payments,expenses}/{create,update,input,row,views}.rs`. `finance/references.rs` already listed `crm_expenses.property_ref`; 0015 now creates that FK.
9. **M-F7 pooled connections.** The bypass is set only through `set_config(…, true)`. The trigger test shows it ends with its transaction on the same connection, and that a later statement on that connection is locked again.
10. **Not in B4.** B6 sample data must replace the guard to allow non-pending inserts and guarded deletes. Refunds, payouts and finance imports remain deferred.

## 17. Implementation notes (B5, 2026-10-15)

Deviations and clarifications made while implementing B5 (Interaction log deal links); everything else follows §1–§16.

1. **Migration.** `0016_interaction_deal_links.sql` adds `crm_records.deal_ref` with `crm_records_deal_scope` (only `Interaction log` rows may set it), `crm_records_deal_payload` (when set, `payload ->> 'deal_id_optional'` must equal it, L-F7), the same-workspace composite foreign key `crm_records_deal_link (workspace_id, deal_ref) → crm_deals (workspace_id, legacy_id)` (the payments convention; not deferred) and the partial index `crm_records_deal_links`. Its comment carries the read-only report query for grandfathered logs.
2. **No backfill, unlike 0007.** Referrals linked existing rows whose target already existed. Deal text is never resolved by matching (L-F7), so every existing row keeps `deal_ref` NULL and its payload, version and timestamps are unchanged, even when the text equals a deal ID in the same workspace. The seeded 0015 → 0016 test checks this.
3. **Grandfathered values on the next save (overrides §6.3 bullet 3).** This follows the referral precedent rather than "unchanged … allowed and kept unlinked". A save is compared with the locked row's `deal_ref`, not with the stored payload text. A grandfathered value therefore counts as a new link request on the next save. If the saver can see a deal with that ID, the save links it. Otherwise the save is refused with the identical 409 `link_missing` ("The linked deal is missing from this workspace. Choose another deal or clear it."), and the user must clear the value or choose a visible deal. Two reasons for this choice. First, it keeps a single invariant: payload text either equals `deal_ref` or is legacy, read-only data until edited. Second, it matches how dangling referrals already behave, so the UI handles both slots the same way.
4. **Link check (step 8).** `records/deal_links.rs` runs after the record-link check in create and update, under the workspace lock and on the live profile. A changed, non-empty deal must pass `finance_predicate(Deals)` for the caller: team finance sees any deal in the workspace, the own view sees deals the caller holds, and second agents see no deals. Callers without the finance module, including schedule-only staff, cannot set any deal link. Hidden, unknown, other-team and finance-less cases all return the byte-identical 409. Unchanged links (equal to `deal_ref`) and cleared links are allowed for anyone who may edit the log.
5. **Validation.** `deal_id_optional` is now `Slot::Deal`: a link field targeting `Deals` that `Slot::record()` excludes from the record-link check and from import link planning. Like other link fields, it must be a string of at most 128 characters; it is trimmed, and blank or null clears it. A numeric or over-long value that was accepted before now returns 400 "Linked record IDs must be strings." on the next save or import.
6. **Imports** keep the deal text in the payload and never bind `deal_ref` (always NULL), whether or not a deal with that ID exists.
7. **Projection `dealLinks`.** `GET records` adds `dealLinks: [{log_id, deal_id}]`. It lists only visible Interaction logs whose `deal_ref` names a deal the caller can see under the finance predicate, and is empty without the finance module. Grandfathered values, hidden deals and finance-less callers are all simply absent, so the UI shows "Linked deal unavailable" for any non-empty `deal_id_optional` without a `dealLinks` entry and cannot tell those cases apart. No other deal data appears in record projections. `dealLinks` is now a reserved payload key. Frontend follow-up: add `dealLinks` to the reserved keys in `apps/crm/src/features/server/records.js`, and render from it instead of matching the text against `GET /finance` deals.
8. **Deletes and M-C.** Deleting a deal that a log references returns the generic 409 "A linked record prevents this change." until the link is cleared. Only Admins can see every log, so this reveals nothing. `covers_references("Deals")` now requires the schedule module through the collection link table. Deal deletes check it on the live row; Admins pass by role. The tests in `collections.rs` moved to `collections_tests.rs`.

## 18. Implementation notes (B6, 2026-10-16)

Deviations and clarifications made while adding sample finance to `npm run crm:sample-data` and `npm run crm:clear-sample` (local development only; see [Backend foundation](backend-foundation.md#sample-data-for-local-testing)); everything else follows §1–§17.

1. **Migration.** `0020_sample_finance.sql` adds `crm_sample_finance (entity, entity_id, workspace_id)` (entities `settings`, `agreement`, `deal`, `handover`, `payment`, `expense`; no FK, because the rows live in several tables) and `crm_sample_finance_removable(kind, id)`. Instead of copying five guard functions, it narrows the existing guard triggers to INSERT/UPDATE and adds one `crm_finance_delete_guard()` BEFORE DELETE trigger on payments, expenses, deals, snapshots, commission lines and agreements. Outside a sample clear it keeps the original rules and SQLSTATEs (P0F09, P0F05 for earned deals, P0F07, P0F03 for started agreements); a delete passes only when `kws.activity_source = 'sample'` (set by `sample::mark_source` alone) and the row (or its deal) is marked. The old functions' DELETE branches are left unreachable. Finance events stay immutable: clearing appends `deleted` events instead.
2. **Owner write paths.** No non-pending inserts were needed. The handlers' bodies after the lock were extracted, unchanged in order and messages, into transaction-level functions that the sample seed calls with the Admin's live row inside its own transaction: `deals::create::insert`, `deals::earn::apply`, `deals::handover::offer`, `payments::create::insert`, `expenses::create::insert`, `approval::apply`, `settings_store::write` and `agreements_store::create_in`. Sample IDs use the `-S` range (`DL-S01`, `PM-S01`, `EX-S01`), which `ids::issue` ignores, so issued numbering is unchanged. The Admin's hand-over approval is composed from `handover_store`, `ensure_move` and `holder::apply`, as `handover_decide` does.
3. **What is seeded.** Settings only when absent; agreements for Layla (55%, from 180 days ago) and Karim (60%, from 240 days ago) only when they have none; six deals (an estimate linked from Interaction log `LG-S01`, two earned under agreements, one handed over with an approved 20% referral, one pending offer, one Admin-held co-broked sale earned with the owner split); five payments (approved, voided after approval, pending, rejected, approved) within each net; three expenses (pending, approved, rejected). All events and activity name the Admin with `source = 'sample'`; the hand-over request names its holder as requester, as in the app. To let Karim hold deals and receive hand-overs, the sample Karim now has a second position (Team Supervisor + Property Agent), which adds own-view finance only.
4. **Idempotency and skips.** A sample ID already present as sample finance is skipped; one taken by another row refuses the whole seed. Steps, payments and the log link run only for deals created in the same run. Deals whose holder or receiver is inactive, lacks the finance module or no longer holds the client, and expenses whose owner cannot incur them, are skipped and reported. The organisation workspace gets none (the Super Admin has no finance write grant).
5. **Clearing.** Refused (with the record checks) while people's own deals use sample clients, properties or agreements, expenses use sample properties, payments reference sample deals or Interaction logs link to them; and, without `--include-edited`, while any sample finance has a finance event with `source <> 'sample'` or a hand-over request the seed did not create. Deletion order: payments and expenses, hand-overs, lines, snapshots, deals, agreements, after the child records and before Clients, Properties and Contacts. Sample settings are removed unless changed in the app or still used by the team's own finance; kept settings lose their marker and become the team's.
