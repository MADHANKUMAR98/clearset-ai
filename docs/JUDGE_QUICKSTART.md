# Judge Quickstart — ClearSet AI

**Time budget: 5 minutes.** Everything below is verified working as of 2026-08-24.

---

## 0 · What you're looking at

A **Snowflake-native post-trade settlement copilot**: it detects settlement exceptions across 35 institutional trades, scores them deterministically (0–100, no hallucinated math), investigates them procedurally with Cortex AI *and* a genuine CoCo CLI agent, recommends a fix — and then **refuses to act until a human approves**, persisting every approval to an audit ledger.

The design rule that governs everything: **every number wears its provenance** (`LIVE SNOWFLAKE` / `COMPUTED` / `ESTIMATE` / `DATA NOT AVAILABLE`). If the AI doesn't know, it says so.

---

## 1 · Access paths

| Path | How | Notes |
|------|-----|-------|
| **Production (SPCS)** | https://mafdxb-ziaihbo-fr43183.snowflakecomputing.app | Two supported login options below |
| **Judge account (recommended)** | Username `CLEARSET_JUDGE` · Password `JudgeDemo26` · auto-expires 2026-09-29 | Log in at the URL with these credentials and the app opens directly. Read-only role — writes are blocked at the Snowflake privilege level |
| **Local run** | See README "Quickstart" — backend :3001 + Vite :5173 | Same code that's deployed (image digest `sha256:fd6cfa69…`); runs against your own Snowflake trial account |

**Why there is no public guest mode:** the app is OAuth-gated inside a Snowflake account by design — a settlement copilot anyone can open would be a compliance failure. Judge accounts are provisioned read-only and time-boxed instead.

---

## 2 · The 5-minute evaluation script

1. **Dashboard** — note the provenance tags on every metric card. Find the **Operational Impact** tile: live open-fail exposure, human-approval count/turnaround from `RESOLUTION_CASES`, and an honestly-labeled CSDR accrual estimate.
2. **Exceptions queue** — open **TRD-92831** ($2.4M AAPL, Missing Instruction, risk 91). Click *"Why?"* on the risk score — you get the exact deterministic math, not a vibe.
3. **Investigate** — walk the 10-step procedural workflow. Watch each step cite its source: trade master data, depository gateway, SSI directory, 30-day counterparty failure history, SOP paragraphs via **Cortex Search**.
4. **Copilot** — paste:
   ```
   Show me trade TRD-81232 with its trade value, settlement status,
   instruction status, risk score, and exception type.
   ```
   ($8.1M UST, Cash Discrepancy, 89.) Answers come from the governed semantic model via **Cortex Analyst** — or are declined, never invented.
5. **Approve** — approve the recommendation. Dispatch stays locked until you click. The case lands in the **Cases ledger**.
6. **Audit PDF** — on any approved case, hit **GENERATE AUDIT REPORT**: evidence-grade PDF with factor math, approval identity/timestamps, SWIFT event history, and SOP excerpts retrieved fresh at generation time.
7. **Real CoCo CLI agent** *(terminal)*:
   ```bash
   npm run coco:investigate -- TRD-92831
   ```
   This launches the actual Cortex Code CLI (`cortex exec`) driving a registered skill (`cortex skill list` shows `investigate-settlement-exception`). The agent discovers `snowsql` itself, queries the live tables itself, and ends with `AWAITING ANALYST AUTHORISATION`. Full transcript: [`COCO_RUNBOOK.md`](COCO_RUNBOOK.md).
8. **Tests** *(optional, 10s)*: `npm run server:test` → **37 passing**, zero network required.

---

## 3 · Honesty spot-checks (please try to break it)

- Ask the Copilot something **not in the data** — watch it decline instead of hallucinating.
- Stop Snowflake / break credentials locally — the UI degrades to clearly-labeled `LOCAL FALLBACK`, never fake-live data.
- Look at the impact tile with the backend down — it renders `DATA NOT AVAILABLE`, not zeros dressed up as truth.

---

## 4 · Security posture in one glance

Secrets never leave the server; SPCS runtime uses injected OAUTH tokens only (no external access integration); all SQL parameterized; approvals persisted with approver identity; image scanned clean pre-push. Details: README "Security Posture".

---

*Protected demo records: TRD-92831 & TRD-81232 are read-only by convention — please investigate freely but do not resolve them.*
