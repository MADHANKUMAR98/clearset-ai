---
name: investigate-settlement-exception
description: Investigate a post-trade settlement exception for ClearSet AI. Retrieves live trade, exception, counterparty, and settlement event data from Snowflake, uses Cortex Search to retrieve the applicable SOP procedure, uses Cortex Analyst to confirm structured trade analytics, applies a deterministic 5-factor risk scoring formula, and produces a human-approval-gated resolution recommendation. Use when asked to investigate a settlement exception, investigate a trade, or analyse a failed or at-risk settlement.
---

# ClearSet AI — Settlement Exception Investigation

## Overview

ClearSet AI is a post-trade settlement operations application backed by
`CLEARSET_DB.CLEARSET_SCHEMA` in Snowflake. This skill orchestrates a complete
10-step settlement exception investigation using live Snowflake data.

**Snowflake objects used by this skill:**

| Object | Type | Purpose |
|---|---|---|
| `V_EXCEPTIONS_ENRICHED` | Semantic view | Exception details, risk scores, SSI status |
| `TRADES` | Table | Trade master data |
| `COUNTERPARTIES` | Table | Counterparty failure records |
| `SETTLEMENT_EVENTS` | Table | SWIFT / depository event audit trail |
| `CLEARSET_ANALYTICS` | Semantic view | Cortex Analyst NL-to-SQL queries |
| `CLEARSET_POLICY_SEARCH_SERVICE` | Cortex Search service | SOP and policy retrieval |

**Safety constraint:** This skill is read-only. It retrieves and analyses data only.
It must **never** autonomously send SWIFT messages, send emails, place calls, modify trades,
modify settlement instructions, or approve exceptions. Every recommended operational action
requires explicit human analyst authorisation before execution.

---

## Invocation

CoCo will auto-select this skill when the prompt clearly matches its description.
You can also invoke it explicitly:

```
$investigate-settlement-exception TRD-92831
```

Or ask in plain language:

> "Investigate settlement exception TRD-92831"
> "Run a settlement investigation for the highest-risk open exception"
> "Why is TRD-92831 critical?"

---

## Prerequisites

The ClearSet backend Express server must be running on `http://localhost:3001` for the
application API steps (Steps 1–5). Steps 6 and 7 use Snowflake Cortex directly.

To start the backend:
```bash
cd server
node --import tsx index.ts
```

Alternatively, run the bundled demonstration script which exercises all steps end-to-end:
```bash
node .kiro/skills/investigate-settlement-exception/scripts/run_investigation.mjs TRD-92831
```

> Note: The demonstration script lives under `.kiro/skills/` because it was created
> alongside the Kiro version of this skill. It is shared between both skill registrations
> and calls the same live backend endpoints. No credentials are embedded in the script.

---

## Investigation Workflow

Execute all 10 steps in sequence. Do **not** hardcode values — retrieve current data
from the application and Snowflake at runtime.

### Step 1 — Verify Connection and Data Mode

Call `GET http://localhost:3001/api/health`.

- Response `snowflake: true` → all subsequent steps use live Snowflake data.
- Response `snowflake: false` → the application is in local simulation mode.
  Report this clearly and proceed using the local fallback data, noting that
  results are simulated.

### Step 2 — Retrieve Exception Details

Call `GET http://localhost:3001/api/exceptions`.

Locate the exception matching the requested trade ID. Extract:

- `EXCEPTION_ID` — unique exception reference (e.g. EX-92831)
- `TRADE_ID` — linked trade identifier
- `EXCEPTION_TYPE` — failure category (e.g. Missing Instruction, Cash Discrepancy)
- `RISK_SCORE` — Snowflake-calculated risk score (0–100)
- `SEVERITY` — CRITICAL / HIGH / MEDIUM / LOW
- `SSI_STATUS` — MISSING / MISMATCHED / PENDING / MATCHED
- `EXCEPTION_STATUS` — OPEN / INVESTIGATING / PENDING_APPROVAL / RESOLVED
- `TRADE_VALUE` — gross monetary exposure in USD
- `COUNTERPARTY_NAME`, `CP_ID` — counterparty identity

This endpoint queries `V_EXCEPTIONS_ENRICHED` in `CLEARSET_DB.CLEARSET_SCHEMA`.

### Step 3 — Retrieve Trade Master Data

Call `GET http://localhost:3001/api/trades`.

Locate the matching trade and extract: ticker symbol, ISIN, asset class,
depository (DTC / Euroclear / Fedwire), settlement type (DVP / FOP / RVP),
settlement status, instruction status, settlement date, and booking desk.

### Step 4 — Retrieve Settlement Event History

Call `GET http://localhost:3001/api/settlement-events/{TRADE_ID}`.

List all events in chronological order. Each event includes:
- `EVENT_ID`, `EVENT_TIMESTAMP`
- `MESSAGE_TYPE` — SWIFT MT541, MT548, MT599, ISO 20022, INTERNAL_ALERT
- `STATUS` — depository milestone (e.g. TRADE_BOOKED, SSI_NOT_FOUND, CRITICAL_RISK_FLAGGED)
- `DESCRIPTION` — message payload text
- `SOURCE` — MATCHING_ENGINE / DEPOSITORY / CLEARSET_AGENT

This data comes from `CLEARSET_DB.CLEARSET_SCHEMA.SETTLEMENT_EVENTS`.

### Step 5 — Retrieve Counterparty Risk Profile

Call `GET http://localhost:3001/api/counterparties/{CP_ID}`.

Extract:
- `NAME`, `BIC` — legal entity name and SWIFT identifier
- `CREDIT_RATING` — institutional credit grade
- `PRIOR_FAILURES_30D` — settlement failures in the past 30 days
- `HISTORICAL_FAIL_RATE` — percentage failure rate
- `AVG_RESOLUTION_HOURS` — average time to resolve
- `PRIMARY_DESK_CONTACT` — named operations desk contact for escalation

This data comes from `CLEARSET_DB.CLEARSET_SCHEMA.COUNTERPARTIES`.

### Step 6 — Retrieve Applicable SOP via Cortex Search

Call `POST http://localhost:3001/api/cortex/search` with body:

```json
{
  "query": "missing settlement instruction expedited SSI repair close to cutoff",
  "limit": 3
}
```

This invokes Snowflake Cortex Search over the `CLEARSET_POLICY_SEARCH_SERVICE`
service, which indexes `CLEARSET_DB.CLEARSET_SCHEMA.POLICY_CHUNKS`.

Extract from the top result:
- `DOC_CODE` — policy document code (e.g. SOP-3.2)
- `POLICY_SECTION` — section title (e.g. Expedited SSI Repair)
- `POLICY_NAME` — full document name

Present the top 3 matching policy citations to the analyst.

### Step 7 — Confirm Analytics via Cortex Analyst

Call `POST http://localhost:3001/api/cortex/analyst` with body:

```json
{
  "question": "Show me trade {TRADE_ID} with its trade value, settlement status, instruction status, risk score, and exception type."
}
```

This performs a natural language query against the `CLEARSET_ANALYTICS` semantic
view using the Snowflake Cortex Analyst REST API (PAT-authenticated server-side —
no credentials are required or exposed in this skill).

Verify that the returned data matches what was retrieved in Steps 2–3.
If the data differs, note the discrepancy.

### Step 8 — Apply Deterministic Risk Scoring

Calculate the risk score using this deterministic, explainable formula.
Use the actual values retrieved in Steps 2–5 — do not use fixed numbers.

| Risk Dimension | Rule | Points |
|---|---|---|
| Instruction Risk | SSI_STATUS = MISSING | +25 |
| | SSI_STATUS = MISMATCHED | +18 |
| | SSI_STATUS = PENDING | +10 |
| Cutoff Urgency | Cutoff < 120 min remaining | +25 |
| | Cutoff < 240 min remaining | +15 |
| | Cutoff < 480 min remaining | +8 |
| Financial Exposure | Trade value > $2.0M | +20 |
| | Trade value > $1.0M | +15 |
| | Trade value > $500k | +10 |
| Counterparty Track Record | Prior failures > 5 in 30d | +15 |
| | Prior failures > 2 in 30d | +10 |
| | Prior failures > 0 in 30d | +5 |
| Institutional Memory | Historical pattern match | +6 |

Severity tiers:
- **CRITICAL**: Score ≥ 80
- **HIGH**: Score 60–79
- **MEDIUM**: Score 40–59
- **LOW**: Score < 40

Show the breakdown factor by factor so the analyst can see exactly why the
score was reached. This is a deterministic calculation — there is no inference
or estimation in this step.

### Step 9 — Determine Root Cause

Synthesise all findings from Steps 2–8 into a structured root cause analysis:

1. **Primary failure point** — the single operational failure most directly
   causing the exception (e.g. missing SSI, cash discrepancy, counterparty reject).
2. **Contributing factors** — additional conditions that elevate the risk
   (counterparty history, cutoff proximity, trade value, historical precedents).
3. **Distinguishing explanation** — clearly separate the immediate symptom
   (e.g. unmatched depository status) from the underlying institutional cause
   (e.g. SSI directory not updated for this counterparty's subaccount).

### Step 10 — Produce Recommendation (Human Approval Required)

Formulate a structured resolution plan aligned with the SOP retrieved in Step 6.

**Present for human analyst review. Do NOT execute any action.**

Format:

```
RECOMMENDED RESOLUTION PLAN — AWAITING ANALYST AUTHORISATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Root Cause:    [primary cause from Step 9]
Applicable SOP: [document code and section from Step 6]
Risk Score:    [score]/100 ([severity])
Urgency:       IMMEDIATE / HIGH / ROUTINE

Proposed Actions (each requires explicit analyst sign-off):
  1. [First action — e.g. Request corrected SSI via SWIFT MT599]
  2. [Second action — e.g. Escalate to Settlement Operations Lead]
  3. [Third action — e.g. Monitor DTC depository queue]
  4. [Fourth action — e.g. Recalculate risk score on confirmation]

Regulatory exposure: CSDR penalty approximately $[amount]/day if unresolved.

[ APPROVE ALL ]  [ REJECT ]  [ REQUEST MORE EVIDENCE ]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠  No operational actions have been dispatched.
```

---

## Expected Output Structure

After all 10 steps, summarise findings in this format.
All values must come from live retrieval — do not substitute fixed demonstration values.

```
CLEARSET AI — INVESTIGATION SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Trade ID:          [retrieved]
Exception ID:      [retrieved]
Exception Type:    [retrieved]
Trade Value:       $[retrieved] USD
Risk Score:        [retrieved]/100 ([severity])
Data Mode:         LIVE SNOWFLAKE / LOCAL SIMULATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Settlement Status:   [retrieved]
Instruction Status:  [retrieved]
Counterparty:        [retrieved name] ([retrieved CP_ID])
Prior Failures:      [retrieved] in past 30 days ([retrieved]% rate)
Desk Contact:        [retrieved]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Settlement Events:   [count] events retrieved
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Cortex Search:   [top SOP code] — [top SOP title]
Cortex Analyst:  [trade ID] / $[value] / [settle] / [instr] / [score]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Risk Breakdown (deterministic):
  +[n]  [factor 1]
  +[n]  [factor 2]
  ...
  Total: [score]/100
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Root Cause:  [primary cause]
Urgency:     [IMMEDIATE / HIGH / ROUTINE]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RECOMMENDED ACTIONS — PENDING HUMAN APPROVAL:
  1. [action]
  2. [action]
  3. [action]
CSDR Penalty if unresolved: ~$[amount]/day
⚠  AWAITING ANALYST AUTHORISATION — No actions dispatched.
```

---

## Related Skills

This skill orchestrates the full investigation workflow. The following sub-skills
cover individual steps and can be invoked independently:

- `assess_settlement_risk` — deterministic risk scoring (Step 8)
- `retrieve_procedure` — Cortex Search SOP lookup (Step 6)
- `find_similar_cases` — historical case query (referenced in Step 9)
- `determine_root_cause` — root cause synthesis (Step 9)
- `recommend_resolution` — resolution plan generation (Step 10)
- `escalate_exception` — escalation criteria and brief (when required)

These sub-skills are defined in `skills/` at the project root and can be
referenced or composed into this workflow.
