# Dual-Ledger Jewellery Retail — POC App

A runnable demo of the architecture in the
[animated walkthrough](https://mi2arun.github.io/jewellery-architecture-demo/):
**two separate Postgres instances** (Physical = official books, Logical =
complete truth incl. personal), event-driven Logical writes via a transactional
outbox, personal-vs-business routing, live reconciliation, role-based reporting,
and a **real Connection Router DB-switch**.

## Run it (one command)

```bash
cd poc
docker compose up --build
```

Then open:

- **Web UI:** http://localhost:5173
- **API:** http://localhost:3000

On first boot the API pushes both Prisma schemas, seeds 4 stores + curated
transactions (some personal), and starts. Two Postgres instances run on host
ports **5433** (physical) and **5434** (logical).

> Reset everything: `docker compose down -v && docker compose up --build`

## What to demo

1. **Create a business sale** (Personal off) → it appears in **both** the
   Physical and Logical ledgers (Physical written synchronously; Logical via the
   outbox worker ~1s later).
2. **Toggle "PERSONAL" and post** → the entry shows up in **Logical only**; the
   Physical ledger never sees it.
3. **Reconciliation card** proves the identity: `Logical − Physical = Personal`.
4. **Switch Role to `employee`** → the Logical ledger panel locks with
   **403 — restricted to management**. The Physical (official) reporting still
   works for employees.
5. **Connection Router** (management) → click **Physical / Logical**: the routed
   management report rebinds to whichever DB instance is selected — a real
   switch, audited each time. Employees cannot switch (403).
6. **Unmask personal** (management) → personal rows are masked by default
   (`Personal — •••••`) and revealed only on explicit, audited unmask.

## Architecture

```
 React/Vite UI ─▶ NestJS API ─┬─ if !personal: write PHYSICAL DB (sync)   :5433
                              ├─ always: write Logical intake + OUTBOX     :5434
                              └─ OutboxWorker (poll 1s) drains outbox → LOGICAL ledger
 Management reads ─▶ Connection Router ─▶ (Physical | Logical) DB  [switchable, audited]
```

- **PostingService** — builds balanced double-entry, writes Physical directly
  for business txns, always writes the Logical intake + outbox row.
- **OutboxWorker** — in-process poller; drains outbox into the Logical ledger.
  Idempotent via a unique `sourceTxnId`.
- **ConnectionRouterService** — holds the active ledger-DB binding for the
  management plane; `POST /router/switch` flips it; reports run against the bound
  client.
- **AuditService** — hash-chained log of management reads + router switches.
- Role boundary via `x-role` header (`employee` | `management`); personal-row
  masking on Logical reads.

## API endpoints

| Method | Path | Role | Notes |
|---|---|---|---|
| POST | `/transactions` | any | `{storeId,type,amount,isPersonal,party,sku}` |
| GET | `/ledger/physical?store=` | any | Official books |
| GET | `/ledger/logical?store=&unmask=1` | management | Personal masked unless `unmask=1` |
| GET | `/reconciliation?store=` | management | `{physicalTotal,logicalTotal,personalTotal,identityHolds}` |
| GET | `/router/status` | any | Current binding |
| POST | `/router/switch` | management | `{target:'physical'|'logical'}` |
| GET | `/ledger/report?store=` | management | Runs against the routed DB |
| GET | `/inventory?store=` · `/stores` · `/audit` | varies | |

## Tech

NestJS + TypeScript · Prisma (two clients) · PostgreSQL ×2 · React + Vite ·
Docker Compose.

## Scope notes

Built for real: dual-DB posting, outbox→Logical, personal routing,
reconciliation, role boundary, masking, **and the Connection Router DB-switch**.
Simplified for the POC (documented in `../POC-PLAN.md` §10): real MFA / private
networking / separate `physical_ro`/`logical_ro` DB users, a native mobile app
binary (the web router toggle stands in), and Redis/Kafka (the outbox worker is
in-process). Seed is 4 stores; the model supports any number via `storeId`.
