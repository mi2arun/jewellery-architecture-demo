# Dual-Ledger Jewellery Retail — POC App Plan

A runnable demo of the architecture shown in the animation: POS → inventory →
**Physical** (official) and **Logical** (complete) ledgers in two separate
Postgres instances, with personal-vs-business routing, event-driven Logical
writes, reconciliation, and a secured-reporting plane.

---

## 1. Decisions (locked)

| Area | Choice |
|---|---|
| Scope | **Broad but shallow** — touch every box from the animation, keep each thin |
| Stack | **Node + TypeScript**, **NestJS** API, **React + Vite** UI, **Prisma** (two clients) |
| Databases | **Two Postgres instances** — `physical` (Region A), `logical` (Region B) |
| Posting flow | Physical = **direct sync write** (non-personal only); Logical = **event-driven** (all txns) |
| Event bus | **Postgres outbox + in-process worker** (no extra infra) |
| Personal flag | `is_personal=true` → **Logical only**, skips Physical |
| UI goal | **Create a transaction + watch the two ledgers diverge** + reconciliation |
| Security | Shown simply: employee vs management role; reporting split, masking (lightweight) |
| Seed data | **A few stores (3–5), hand-crafted** transactions that make the story crystal clear |
| Provisioning | **Docker Compose** (2× Postgres + API + web) |

> Identity: `Logical = Physical + Personal`. Physical is authoritative for
> official books; Logical is the complete internal truth.

---

## 2. Architecture (as implemented)

```
  React + Vite UI  ──fetch──▶  NestJS API ──────────────────────────────┐
   - Txn entry form                  │ PostingService.post(txn)          │
   - Physical | Logical views        │                                   │
   - Reconciliation                  │  if !personal:                    │
   - Role switch (emp/mgmt)          │    write Physical (sync)  ────────┼──▶  PHYSICAL DB
                                      │  always:                          │     (Postgres :5433)
                                      │    write OUTBOX row (intake DB)   │
                                      │                                   │
                                      │  OutboxWorker (in-process, polls) │
                                      │    reads outbox → writes Logical ─┼──▶  LOGICAL DB
                                      └───────────────────────────────────┘     (Postgres :5434)
```

- **Intake/outbox** lives in the **Logical DB** (it must capture *every* txn,
  including personal). The worker drains the outbox into Logical's
  `ledger_entries`. Physical is written directly inside the request for
  non-personal txns.
- Two Prisma clients (`prismaPhysical`, `prismaLogical`), two schemas,
  two `DATABASE_URL`s.

---

## 3. Data model

**Physical DB** (`schema.physical.prisma`)
- `stores` (id, name, region)
- `chart_of_accounts` (code, name, type)
- `ledger_entries` (id, store_id, account_code, debit, credit, source_txn_id **(unique)**, posted_at)

**Logical DB** (`schema.logical.prisma`)
- `stores`, `chart_of_accounts` (mirrored)
- `transactions` (id, store_id, type SALE|PURCHASE, is_personal, amount, party, created_at) — the canonical intake record
- `transaction_lines` (txn_id, account_code, debit, credit)
- `inventory_items` (sku, metal, purity, weight_g, qty, store_id) — adjusted on every txn
- `ledger_entries` (same shape as Physical; holds **all** entries incl. personal)
- `outbox` (id, txn_id, payload jsonb, status pending|done|error, created_at, processed_at)
- `audit_log` (id, actor_role, action, resource, row_count, prev_hash, row_hash, ts) — hash-chained reads

> Idempotency: `ledger_entries.source_txn_id` unique in both DBs, so replays
> never double-post.

---

## 4. Posting engine (the heart)

`PostingService.post({store, type, amount, isPersonal, items})`:
1. Build **balanced double-entry** lines (debits = credits) for SALE / PURCHASE.
   - SALE business: `Dr Cash / Cr Sales`
   - PURCHASE business: `Dr Purchases / Cr Bank`
   - PERSONAL: `Dr Drawings(Personal) / Cr Inventory` (or Cash)
2. Persist `transactions` + `transaction_lines` + adjust `inventory_items` in Logical (single Logical tx).
3. If **not personal** → write `ledger_entries` to **Physical DB** synchronously.
4. Always → insert an **outbox** row (in the same Logical tx as step 2).
5. **OutboxWorker** (runs in the API process, polls every ~1s) → reads pending
   outbox rows → writes `ledger_entries` into **Logical** → marks `done`.

Unit-tested: balancing invariant, personal routing (Physical skipped),
idempotency on replay.

---

## 5. API endpoints (NestJS)

| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `/transactions` | any | Create sale/purchase (+`isPersonal`) → runs posting engine |
| GET | `/ledger/physical?store=` | employee+ | Physical entries (official books) |
| GET | `/ledger/logical?store=` | **management** | Logical entries (all, personal masked unless `?unmask=1`) |
| GET | `/reconciliation?store=` | management | `{ physicalTotal, logicalTotal, personalTotal }` proving the identity |
| GET | `/inventory?store=` | any | Stock levels |
| GET | `/stores` | any | Store list |
| GET | `/audit` | management | Audit-log reads |

- **Role**: simple header/JWT-lite `x-role: employee|management` for the POC.
  Employee hitting `/ledger/logical` → **403** (demonstrates the boundary).
- Reaching `/ledger/logical` writes an **audit_log** row first (the masking +
  audit "security plane," lightweight version).

---

## 6. Frontend (React + Vite)

Single-page demo with:
1. **Transaction form** — store dropdown, SALE/PURCHASE, amount, item, **Personal toggle** → POST `/transactions`.
2. **Side-by-side ledgers** — Physical | Logical panels, auto-refresh after posting; personal rows visibly appear **only in Logical**.
3. **Reconciliation card** — live `Logical − Physical = Personal`.
4. **Role switch** (Employee / Management) — as Employee, the Logical panel is locked ("403 — no access"); as Management it unlocks (personal masked, with an "unmask" button that hits `?unmask=1`).
5. **Inventory mini-panel** — stock moving on each txn.

Keeps the demo a direct, clickable mirror of the animation.

---

## 7. Repo layout

```
poc/
├─ docker-compose.yml          # postgres-physical, postgres-logical, api, web
├─ api/                        # NestJS
│  ├─ prisma/
│  │  ├─ schema.physical.prisma
│  │  └─ schema.logical.prisma
│  ├─ src/
│  │  ├─ posting/              # PostingService + double-entry builder
│  │  ├─ outbox/               # OutboxWorker
│  │  ├─ ledger/               # read endpoints + masking
│  │  ├─ reconciliation/
│  │  ├─ audit/
│  │  └─ main.ts
│  └─ seed/seed.ts             # 3–5 stores + curated txns (some personal)
├─ web/                        # React + Vite
│  └─ src/ (form, ledger views, reconciliation, role switch)
└─ README.md                   # one-command run + demo script
```

---

## 8. Build order

1. **Scaffold**: monorepo, `docker-compose.yml` (2 Postgres), NestJS + Vite apps, two Prisma schemas.
2. **DB + migrations**: generate both clients; chart of accounts + stores seed.
3. **Posting engine**: double-entry builder + `PostingService` (Physical sync write + outbox) + unit tests.
4. **Outbox worker**: poll → write Logical; idempotency.
5. **Read APIs**: physical/logical ledgers, reconciliation, inventory, stores.
6. **Security-lite**: role header, 403 on employee→logical, audit row + masking.
7. **Seed**: 3–5 stores, curated sales/purchases incl. personal ones.
8. **UI**: txn form, side-by-side ledgers, reconciliation, role switch, inventory.
9. **README + demo script**: `docker compose up` → click-through walkthrough.

---

## 9. Deliverable

`docker compose up` → app at `localhost:5173` (web) / `localhost:3000` (api):
create a sale → see it in **both** ledgers; toggle **Personal** → see it in
**Logical only**; watch **reconciliation** prove `Logical = Physical + Personal`;
switch to **Employee** → Logical access denied. Two real Postgres instances
prove the geo-separated dual-ledger model.

---

## 9a. Connection Router DB-switch (IN SCOPE — built for real)

The management plane includes a **real Connection Router** that binds the
management reporting session to **one ledger DB instance at a time** and can be
switched live (the animation's "SWITCH CONNECTION" button becomes a real
control).

- **`ConnectionRouterService`** holds the active target per management session:
  `physical` | `logical`. It exposes the *currently bound* Prisma client to the
  management reporting endpoints.
- **`POST /router/switch { target: 'physical' | 'logical' }`** (management only,
  audited) — flips the active binding. Returns the new active target.
- **`GET /router/status`** — returns the current binding so the UI toggle
  reflects real server state.
- Management report reads (`GET /ledger/report`, `/reconciliation`) go through
  the router → whichever DB is bound. Employees never touch the router (their
  Physical reporting API is a fixed, separate read-only path).
- Switching is **stateful and explicit**: only one connection active at a time,
  exactly as the diagram shows. Every switch + every routed read writes an
  `audit_log` row.
- UI: the management view gets a **Physical ⇄ Logical toggle + "Switch
  Connection" button** wired to `/router/switch`, mirroring the mobile app.

> This makes the secured-reporting scene real, not mocked: the router truly
> rebinds the DB the management reports run against.

## 10. Deliberately out of scope (POC)

- Real MFA / WebAuthn, real private networking, real `physical_ro`/`logical_ro`
  DB users (shown conceptually; POC uses one app credential per DB).
- A native mobile app binary (the router toggle in the web UI stands in for the
  routing-only mobile app; the **router itself is real**).
- Real Redis/Kafka (outbox worker is in-process).
- 50 live stores (seed is 3–5; data model supports any number via `store_id`).
```
