---
name: investigate-settlement-exception
description: Investigate a post-trade settlement exception using live Snowflake data, Cortex Search for SOP retrieval, and Cortex Analyst for business queries. Produces a structured investigation summary with deterministic risk scoring and a human-approval-gated resolution recommendation.
---

# ClearSet AI — Settlement Exception Investigation Skill

## Purpose

This skill orchestrates a complete post-trade settlement exception investigation for ClearSet AI.
It calls the live Express backend (running at `http://localhost:3001`) which is connected to
`CLEARSET_DB.CLEARSET_SCHEMA` in Snowflake.

**Never perform irreversible operational actions** (SWIFT message dispatch, trade modification,
email/phone notification) without explicit human analyst approval. This skill is analysis-only.

---

## How to Invoke

Ask in chat:

> "Investigate settlement exception TRD-92831"
> "Run a settlement investigation for trade TRD-92831"
> "Investigate the highest-risk settlement exception"

Or run the demonstration script directly:

```bash
node .kiro/skills/investigate-settlement-exception/scripts/run_investigation.mjs TRD-92831
```

---

## Investigation Workflow (10 Steps)

When asked to investigate a settlement exception, execute the following steps in order.
For each step, call the appropriate live endpoint or service. Do NOT hardcode any data values.

### Step 1 — Verify Backend Health

Before anything else, call `GET http://localhost:3001/api/health`.

- If `snowflake: true` → proceed with live Snowflake data.
- If `snowflake: false` → report that the backend is in local simulation mode and continue
  with the local fallback data available in `src/data/syntheticData.ts`.

### Step 2 — Retrieve Exception Details

Call `GET http://localhost:3001/api/exceptions`.

Find the exception matching the requested trade ID. Extract:
- `EXCEPTION_ID`, `TRADE_ID`, `EXCEPTION_TYPE`, `RISK_SCORE`, `SEVERITY`
- `SSI_STATUS`, `EXCEPTION_STATUS`, `TRADE_VALUE`
- `COUNTERPARTY_NAME`, `CP_ID`

Expected for TRD-92831:
```
EXCEPTION_ID:    EX-92831
TRADE_VALUE:     2400000
RISK_SCORE:      91
SEVERITY:        CRITICAL
EXCEPTION_TYPE:  Missing Instruction
SSI_STATUS:      MISSING
CP_ID:           CP-192
```

### Step 3 — Retrieve Trade Details

Call `GET http://localhost:3001/api/trades`.

Find TRD-92831 and extract: ticker, ISIN, asset class, depository, settlement type,
settlement status, instruction status, currency.

### Step 4 — Retrieve Settlement Events

Call `GET http://localhost:3001/api/settlement-events/{TRADE_ID}`.

List all SWIFT/depository events in chronological order. For TRD-92831, expect 5 live events
from Snowflake `SETTLEMENT_EVENTS` table including SWIFT MT541, MT548, and INTERNAL_ALERT types.

### Step 5 — Retrieve Counterparty Profile

Call `GET http://localhost:3001/api/counterparties/{CP_ID}`.

Extract: `NAME`, `BIC`, `CREDIT_RATING`, `PRIOR_FAILURES_30D`, `HISTORICAL_FAIL_RATE`,
`AVG_RESOLUTION_HOURS`, `PRIMARY_DESK_CONTACT`.

Expected for CP-192:
```
NAME:                  Apex Prime Clearing Ltd.
PRIOR_FAILURES_30D:    7
HISTORICAL_FAIL_RATE:  8.4
```

### Step 6 — Retrieve Applicable SOP via Cortex Search

Call `POST http://localhost:3001/api/cortex/search` with:
```json
{
  "query": "missing settlement instruction expedited SSI repair close to cutoff",
  "limit": 3
}
```

Extract the top matching policy document code, section, and title.

Expected top result:
```
DOC_CODE:      SOP-3.2
POLICY_SECTION: Expedited SSI Repair
```

This uses Snowflake Cortex Search over the live `POLICY_CHUNKS` table.

### Step 7 — Query Cortex Analyst for Analytical Confirmation

Call `POST http://localhost:3001/api/cortex/analyst` with:
```json
{
  "question": "Show me trade TRD-92831 with its trade value, settlement status, instruction status, risk score, and exception type."
}
```

This queries the `CLEARSET_ANALYTICS` semantic view in Snowflake using PAT-authenticated
Cortex Analyst REST API.

Expected response:
```
TRADE_ID:           TRD-92831
TRADE_VALUE:        2400000
SETTLEMENT_STATUS:  PENDING
INSTRUCTION_STATUS: MISSING
RISK_SCORE:         91
EXCEPTION_TYPE:     Missing Instruction
```

### Step 8 — Apply Deterministic Risk Scoring

Calculate risk score using the deterministic formula from `assess_settlement_risk` skill:

| Factor | Rule | Points |
|---|---|---|
| Instruction Risk | Missing SSI | +25 |
| Cutoff Urgency | < 120 minutes remaining | +25 |
| Financial Exposure | Trade value > $2.0M | +20 |
| Counterparty Track Record | > 5 prior failures in 30d | +15 |
| Institutional Memory | Historical failure pattern match | +6 |
| **Total** | | **91/100 — CRITICAL** |

### Step 9 — Determine Root Cause

Synthesize findings:

- **Primary:** Missing Standing Settlement Instruction (SSI) for DTC Participant 0244 subaccount.
- **Contributing:**
  1. Counterparty CP-192 has 7 prior failures (8.4% fail rate).
  2. DTC cutoff approaching — critical time pressure.
  3. $2.4M gross exposure exceeds Tier 1 threshold.
  4. 18 historical precedent cases, 11.1% resulted in depository settlement failure.

### Step 10 — Generate Recommendation (Human Approval Required)

Produce a structured recommendation for human analyst review. **Do NOT execute any actions.**

Recommended actions (require analyst authorization before execution):
1. Dispatch SWIFT MT599 repair notification to CP-192 desk contact.
2. Escalate to Settlement Operations Lead (Tier 1 Priority).
3. Monitor DTC depository queue for affirmation.
4. Recalculate risk score upon SSI confirmation.

Present: `[APPROVE]` / `[REJECT]` / `[REQUEST MORE EVIDENCE]`

Projected CSDR penalty avoided if resolved: **$1,566.67/day**.

---

## Output Format

After completing all steps, produce a structured summary:

```
╔══════════════════════════════════════════════════════════════╗
║          CLEARSET AI — INVESTIGATION SUMMARY                 ║
╠══════════════════════════════════════════════════════════════╣
║  Trade:           TRD-92831                                  ║
║  Exception:       EX-92831                                   ║
║  Exception Type:  Missing Instruction                        ║
║  Trade Value:     $2,400,000 USD                             ║
║  Risk Score:      91/100 (CRITICAL)                          ║
║  Data Source:     LIVE SNOWFLAKE (CLEARSET_DB)               ║
╠══════════════════════════════════════════════════════════════╣
║  SETTLEMENT STATUS:   PENDING                                ║
║  INSTRUCTION STATUS:  MISSING                                ║
║  COUNTERPARTY:        Apex Prime Clearing Ltd. (CP-192)      ║
║  PRIOR FAILURES:      7 in past 30 days (8.4% fail rate)     ║
╠══════════════════════════════════════════════════════════════╣
║  CORTEX SEARCH:    SOP-3.2 Expedited SSI Repair              ║
║  CORTEX ANALYST:   TRD-92831 / PENDING / MISSING / 91        ║
╠══════════════════════════════════════════════════════════════╣
║  ROOT CAUSE:  Missing SSI for DTC Participant 0244           ║
║  URGENCY:     IMMEDIATE                                      ║
╠══════════════════════════════════════════════════════════════╣
║  RECOMMENDED ACTION (PENDING HUMAN APPROVAL):                ║
║  1. SWIFT MT599 repair → CP-192 desk                        ║
║  2. Escalate to Settlement Operations Lead                   ║
║  3. Monitor DTC gateway for affirmation                      ║
║  CSDR Penalty Avoided: $1,566.67/day                        ║
╚══════════════════════════════════════════════════════════════╝
⚠  AWAITING ANALYST AUTHORIZATION — No actions dispatched.
```

---

## Data Sources

| Step | Source | Snowflake Object |
|---|---|---|
| Health | `/api/health` | Snowflake SDK connection |
| Exception details | `/api/exceptions` | `V_EXCEPTIONS_ENRICHED` |
| Trade details | `/api/trades` | `TRADES` + joins |
| Settlement events | `/api/settlement-events/:id` | `SETTLEMENT_EVENTS` |
| Counterparty | `/api/counterparties/:id` | `COUNTERPARTIES` |
| Policy/SOP | `/api/cortex/search` | Cortex Search → `POLICY_CHUNKS` |
| Analytical confirmation | `/api/cortex/analyst` | Cortex Analyst → `CLEARSET_ANALYTICS` |

---

## Safety Guardrails

- **READ-ONLY:** This skill only queries data. No writes to Snowflake.
- **NO autonomous SWIFT dispatch.** Recommendations are presented for human decision only.
- **NO email, phone, or messaging.** Escalation is flagged for human action.
- **Fallback:** If backend is unavailable, the skill reports local simulation mode and
  uses data from `src/data/syntheticData.ts` — the UI still functions normally.
