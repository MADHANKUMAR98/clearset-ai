# Snowflake Data Foundation — Deployment Checklist & Execution Guide

## Overview
This document specifies the exact, step-by-step procedure for deploying the **ClearSet AI** data foundation into a dedicated Snowflake AI Data Cloud trial account.

You can execute either the **unified single script** ([`entire-schema.sql`](file:///e:/coco-cli/clearset-ai/snowflake/entire-schema.sql)) or the **modular scripts** ([`01_schema.sql`](file:///e:/coco-cli/clearset-ai/snowflake/01_schema.sql) through [`05_validation.sql`](file:///e:/coco-cli/clearset-ai/snowflake/05_validation.sql)) in order.

---

## 1. Execution Methods

### Option A: Unified One-Click Deployment (Recommended)
Run [`snowflake/entire-schema.sql`](file:///e:/coco-cli/clearset-ai/snowflake/entire-schema.sql) in a single Snowflake worksheet. It executes Parts 1 through 5 sequentially.

### Option B: Modular Execution Order
Run the following SQL scripts in sequence inside a Snowflake Worksheet (or via SnowSQL / Python / VS Code Snowflake Extension):

| Step | Script File | Purpose | Execution Mode |
| :---: | :--- | :--- | :--- |
| **1** | [`01_schema.sql`](file:///e:/coco-cli/clearset-ai/snowflake/01_schema.sql) | Creates `CLEARSET_DB`, `CLEARSET_SCHEMA`, and all 9 operational tables (including `POLICY_CHUNKS`). | Mandatory |
| **2** | [`02_seeds.sql`](file:///e:/coco-cli/clearset-ai/snowflake/02_seeds.sql) | Seeds master counterparties, securities, active trades (including `TRD-92831`), SSIs, SWIFT audit events, exceptions (via `SELECT ... UNION ALL`), and historical playbooks. | Mandatory |
| **3** | [`03_semantic_views.sql`](file:///e:/coco-cli/clearset-ai/snowflake/03_semantic_views.sql) | Creates 8 enriched analytical views (`V_EXCEPTIONS_ENRICHED`, `V_CRITICAL_APPROACHING_CUTOFF`, `V_COUNTERPARTY_FAIL_STATS`, `V_POLICY_SEARCH`, `V_SETTLEMENT_EVENTS`, `V_TRADE_ENRICHED`, `V_HISTORICAL_CASES`, `V_SSI_STATUS`). | Mandatory |
| **4** | [`04_cortex_search.sql`](file:///e:/coco-cli/clearset-ai/snowflake/04_cortex_search.sql) | Creates policy stage (`CLEARSET_POLICY_STAGE`) and populates 5 SOP policy chunks. | Mandatory (Cortex Search Service definition is documented for future milestone) |
| **5** | [`05_validation.sql`](file:///e:/coco-cli/clearset-ai/snowflake/05_validation.sql) | Runs 12 comprehensive read-only validation queries to verify table schemas, row counts, TRD-92831 showcase facts, and all views. | Verification |

---

## 2. Expected Database Objects After Execution

### Database & Schema
- **Database:** `CLEARSET_DB`
- **Schema:** `CLEARSET_SCHEMA`

### Tables (9 Tables)
1. `COUNTERPARTIES` — Counterparty institutional master data, 30-day failure counts, contacts.
2. `SECURITIES` — Master security records, ISIN, ticker, asset class, primary depository.
3. `TRADES` — Core transaction economics, settlement date/type, status, and cutoff time.
4. `SETTLEMENT_INSTRUCTIONS` — Standing Settlement Instructions (SSI), depository participant IDs, account numbers.
5. `SETTLEMENT_EVENTS` — SWIFT message logs (MT541, MT548, MT599, ISO 20022) and depository events.
6. `EXCEPTIONS` — Detected post-trade exceptions, severity classifications, and deterministic risk score JSON.
7. `INVESTIGATIONS` — Immutable audit ledger for resolved cases and human approval records (empty initially, written upon analyst sign-off).
8. `HISTORICAL_CASES` — Institutional memory containing past resolution playbooks and embeddings.
9. `POLICY_CHUNKS` — Standard Operating Procedure (SOP) sections, keywords array, and risk score impacts.

### Internal Stages (1 Stage)
- `CLEARSET_POLICY_STAGE` — Secure internal stage (`SNOWFLAKE_SSE`) for raw SOP and policy documents.

### Views (8 Views)
1. `V_EXCEPTIONS_ENRICHED` — Multi-table join view unifying exceptions, trades, securities, counterparties, and SSIs.
2. `V_CRITICAL_APPROACHING_CUTOFF` — Priority queue filtering critical exceptions approaching market cutoffs.
3. `V_COUNTERPARTY_FAIL_STATS` — Analytical view summarizing counterparty failure rates and average delay metrics.
4. `V_POLICY_SEARCH` — Policy chunks view for fast semantic search and SOP rule lookups.
5. `V_SETTLEMENT_EVENTS` — Full chronological settlement events timeline with trade and counterparty context.
6. `V_TRADE_ENRICHED` — Master trade economics enriched with security details and counterparty track record.
7. `V_HISTORICAL_CASES` — Historical institutional cases enriched with counterparty statistics.
8. `V_SSI_STATUS` — Standing settlement instructions joined with trade exposure and cutoff timelines.

---

## 3. Expected Row Counts

| Table | Expected Row Count | Description |
| :--- | :---: | :--- |
| `COUNTERPARTIES` | **5** | Apex (CP-192), Vanguard (CP-104), Goldman (CP-088), Citadel (CP-210), Morgan Stanley (CP-115) |
| `SECURITIES` | **5** | AAPL, UST10Y, NVDA, MSFT, TSLA |
| `TRADES` | **5** | `TRD-92831` ($2.4M AAPL), `TRD-81232` ($8.1M UST10Y), `TRD-71292`, `TRD-65419`, `TRD-54210` |
| `SETTLEMENT_INSTRUCTIONS` | **5** | `SSI-92831` (Missing), `SSI-81232` (Mismatched), `SSI-71292`, `SSI-65419`, `SSI-54210` |
| `SETTLEMENT_EVENTS` | **5** | Audit trail events for `TRD-92831` (`EVT-101` through `EVT-105`) |
| `EXCEPTIONS` | **5** | `EX-92831` (Score 91, CRITICAL), `EX-81232` (Score 89), `EX-71292`, `EX-65419`, `EX-54210` |
| `HISTORICAL_CASES` | **5** | Institutional precedent cases (`INV-2026-00412`, `00389`, `00311`, `00288`, `00245`) |
| `POLICY_CHUNKS` | **5** | SOP §3.2 (Expedited SSI Repair), SOP §2.4, CEP §2.1, SOP §4.1, CSDR-001 |

| `INVESTIGATIONS` | **0** | Populated dynamically upon Human Approval in the ClearSet application |

---

## 4. Showcase Hero Verification: `TRD-92831`

The showcase investigation flow in ClearSet AI depends on exact underlying facts for trade `TRD-92831`. The SQL seed data guarantees that querying Snowflake reproduces the exact telemetry:

| Fact Dimension | Expected Value in Snowflake | SQL Verification Match |
| :--- | :--- | :--- |
| **Trade ID** | `TRD-92831` | `TRADES.TRADE_ID = 'TRD-92831'` |
| **Trade Value** | **$2,400,000.00 USD** (12,000 shares @ $200.00) | `TRADES.TRADE_VALUE = 2400000.00` |
| **Security** | Apple Inc. Common Stock (`AAPL`, ISIN `US0378331005`) | `SECURITIES.TICKER = 'AAPL'` |
| **Counterparty** | Apex Prime Clearing Ltd. (`CP-192`, BIC `APEXUS33XXX`) | `COUNTERPARTIES.CP_ID = 'CP-192'` |
| **Prior Failures** | **7 failures** in past 30 days (Fail Rate: **8.4%**) | `COUNTERPARTIES.PRIOR_FAILURES_30D = 7` |
| **Instruction Status**| **`MISSING`** (DTC Participant 0244 missing subaccount) | `SETTLEMENT_INSTRUCTIONS.STATUS = 'MISSING'` |
| **Cutoff Time** | **15:30 EST** (Same-Day Intraday DVP Cutoff) | `TRADES.CUTOFF_TIME = '2026-08-09 15:30:00'` |
| **Deterministic Risk**| **91 / 100 (CRITICAL)** | `EXCEPTIONS.RISK_SCORE = 91` |
| **Applicable SOP** | **SOP-OPS-032 §3.2** (*Expedited SSI Repair*) | `POLICY_CHUNKS.CHUNK_ID = 'CHK-SOP-032-3.2'` |

---

## 5. Account Privileges & Requirements

1. **Role:** `SYSADMIN` or any role with `CREATE DATABASE` privileges.
2. **Warehouse:** Any active warehouse (e.g. `COMPUTE_WH` or `X-Small`).
3. **Application Security Note:** Never use `ACCOUNTADMIN` as an application runtime role. A dedicated restricted role can be created in later milestones.

---

## 6. Assumptions & Trial Account Compatibility Notes

- **Vector Datatype:** `HISTORICAL_CASES` table includes column `SIMILARITY_EMBEDDING VECTOR(FLOAT, 768)`. Vector datatypes are natively supported in Snowflake AWS/Azure trial accounts.
- **Cortex Search Service:** The `CREATE CORTEX SEARCH SERVICE` DDL in `04_cortex_search.sql` is commented out. In this milestone, we only create the `POLICY_CHUNKS` table and stage. The search service will be enabled in the Cortex milestone once search capabilities are verified in the trial account.
