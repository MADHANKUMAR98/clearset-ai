# Snowflake Cortex Analyst — Semantic Model & Validation Guide (Milestone 3)

## Overview

This document specifies the architecture, semantic definitions, and validation procedures for the **ClearSet AI Cortex Analyst Semantic Layer**.

The semantic model translates natural-language queries from post-trade operations analysts and desk managers into high-accuracy SQL statements evaluated directly against Snowflake data.

---

## 1. Semantic Model Structure

The semantic model is formally codified in [`snowflake/07_semantic_model.yaml`](file:///e:/coco-cli/clearset-ai/snowflake/07_semantic_model.yaml).

### Logical Tables & Underlying Views

| Logical Table | Underlying Snowflake Object | Business Purpose |
| :--- | :--- | :--- |
| **`exceptions_enriched`** | [`V_EXCEPTIONS_ENRICHED`](file:///e:/coco-cli/clearset-ai/snowflake/03_semantic_views.sql#L9) | Main operational triage queue linking exceptions to trade economics, securities, counterparties, SSIs, and cutoff deadlines. |
| **`counterparties`** | [`COUNTERPARTIES`](file:///e:/coco-cli/clearset-ai/snowflake/01_schema.sql#L13) | Master directory of trading firms, credit ratings, 30-day failure counts, historical fail rates, and escalation contacts. |
| **`settlement_events`** | [`V_SETTLEMENT_EVENTS`](file:///e:/coco-cli/clearset-ai/snowflake/03_semantic_views.sql#L72) | Chronological audit trail of SWIFT messages (MT541, MT548, MT599, ISO 20022) and depository events. |
| **`historical_cases`** | [`V_HISTORICAL_CASES`](file:///e:/coco-cli/clearset-ai/snowflake/03_semantic_views.sql#L111) | Institutional playbook memory containing prior root causes, applied SOP rules, resolution steps, and CSDR penalties avoided. |
| **`settlement_instructions`** | [`V_SSI_STATUS`](file:///e:/coco-cli/clearset-ai/snowflake/03_semantic_views.sql#L133) | Standing Settlement Instructions (SSI), depository participant IDs, and mismatch details. |

---

## 2. Business Dimensions & Measures

### Key Dimensions

- **`exception_id` / `trade_id`**: Canonical operational identifiers (e.g. `EX-92831`, `TRD-92831`).
- **`severity`**: Triage classifications (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`).
- **`exception_status`**: Case status (`OPEN`, `INVESTIGATING`, `PENDING_APPROVAL`, `RESOLVED`).
- **`exception_type`**: Root failure category (`Missing Instruction`, `Cash Discrepancy`, `Counterparty Fail Risk`).
- **`ticker` / `security_name` / `asset_class`**: Instrument details (`AAPL`, `UST10Y`, `Equities`, `Fixed Income`).
- **`depository`**: Central settlement venue (`DTC`, `Fedwire`, `Euroclear`).
- **`counterparty_name` / `counterparty_id`**: Counterparty institution (`Apex Prime Clearing Ltd.`, `CP-192`).
- **`ssi_status`**: Instruction state (`MISSING`, `MISMATCHED`, `PENDING`, `MATCHED`).

### Key Measures & Metrics

- **`risk_score`**: 0–100 explainable deterministic risk score calculated by ClearSet Risk Engine (`default_aggregation: max`).
- **`trade_value`**: Gross notional trade amount in USD (`default_aggregation: sum`).
- **`minutes_to_cutoff`**: Proximity in minutes to official market cutoff deadline (`default_aggregation: min`).
- **`prior_failures_30d`**: 30-day failure count for counterparty (`default_aggregation: sum`).
- **`historical_fail_rate`**: Rolling 30-day fail percentage (e.g. `8.4%`, `default_aggregation: avg`).
- **`csdr_penalty_avoided`**: Regulatory financial penalty avoided through expedited resolution (`default_aggregation: sum`).

---

## 3. Required Natural-Language Questions & Ground-Truth SQL

Cortex Analyst maps user prompts to the following verified SQL queries:

### Question 1: *"Show me critical settlement exceptions approaching cutoff."*
```sql
SELECT 
    TRADE_ID, 
    TICKER, 
    COUNTERPARTY_NAME, 
    TRADE_VALUE, 
    MINUTES_TO_CUTOFF, 
    RISK_SCORE 
FROM CLEARSET_DB.CLEARSET_SCHEMA.V_EXCEPTIONS_ENRICHED
WHERE SEVERITY = 'CRITICAL' AND EXCEPTION_STATUS IN ('OPEN', 'INVESTIGATING')
ORDER BY RISK_SCORE DESC, MINUTES_TO_CUTOFF ASC;
```
**Expected Data Result:**
- `TRD-92831` ($2.4M AAPL, Apex Prime, Score: 91, Cutoff: 15:30 EST)
- `TRD-81232` ($8.1M UST10Y, Vanguard, Score: 89, Cutoff: 15:00 EST)
- `TRD-71292` ($1.2M NVDA, Goldman, Score: 86, Cutoff: 15:30 EST)

---

### Question 2: *"Why is TRD-92831 critical?"*
```sql
SELECT 
    TRADE_ID,
    TICKER,
    COUNTERPARTY_NAME,
    TRADE_VALUE,
    SSI_STATUS,
    MINUTES_TO_CUTOFF,
    PRIOR_FAILURES_30D,
    HISTORICAL_FAIL_RATE,
    RISK_SCORE,
    SEVERITY
FROM CLEARSET_DB.CLEARSET_SCHEMA.V_EXCEPTIONS_ENRICHED
WHERE TRADE_ID = 'TRD-92831';
```
**Expected Data Result:**
- Trade value: `$2,400,000.00`
- SSI status: `MISSING`
- Counterparty: `Apex Prime Clearing Ltd.` (`CP-192`) with `7 prior failures` (8.4% fail rate)
- Risk Score: `91/100` (`CRITICAL`)

---

### Question 3: *"Show me the settlement history for TRD-92831."*
```sql
SELECT 
    EVENT_ID,
    EVENT_TIMESTAMP,
    MESSAGE_TYPE,
    EVENT_STATUS,
    DESCRIPTION,
    SOURCE
FROM CLEARSET_DB.CLEARSET_SCHEMA.V_SETTLEMENT_EVENTS
WHERE TRADE_ID = 'TRD-92831'
ORDER BY EVENT_TIMESTAMP ASC;
```
**Expected Data Result:**
- 5 chronological events from Trade Booking (`EVT-101`) to SSI Lookup (`EVT-102`), MT548 Exception (`EVT-103`), Cutoff Warning (`EVT-104`), and Risk Flagged (`EVT-105`).

---

### Question 4: *"How many failures has CP-192 had in the last 30 days?"*
```sql
SELECT 
    CP_ID,
    NAME,
    PRIOR_FAILURES_30D,
    HISTORICAL_FAIL_RATE,
    AVG_RESOLUTION_HOURS
FROM CLEARSET_DB.CLEARSET_SCHEMA.COUNTERPARTIES
WHERE CP_ID = 'CP-192';
```
**Expected Data Result:**
- `PRIOR_FAILURES_30D`: `7`
- `HISTORICAL_FAIL_RATE`: `8.4%`
- `AVG_RESOLUTION_HOURS`: `4.2h`

---

### Question 5: *"What is the total exposure of open critical settlement exceptions?"*
```sql
SELECT 
    COUNT(EXCEPTION_ID) AS TOTAL_CRITICAL_EXCEPTIONS,
    SUM(TRADE_VALUE) AS TOTAL_GROSS_EXPOSURE_USD
FROM CLEARSET_DB.CLEARSET_SCHEMA.V_EXCEPTIONS_ENRICHED
WHERE SEVERITY = 'CRITICAL' AND EXCEPTION_STATUS IN ('OPEN', 'INVESTIGATING');
```
**Expected Data Result:**
- `TOTAL_CRITICAL_EXCEPTIONS`: `3` (`TRD-92831`, `TRD-81232`, `TRD-71292`)
- `TOTAL_GROSS_EXPOSURE_USD`: `$11,700,000.00` ($2.4M + $8.1M + $1.2M)

---

### Question 6: *"Show me historical cases similar to TRD-92831."*
```sql
SELECT 
    HISTORICAL_CASE_ID,
    ORIGINAL_TRADE_ID,
    CASE_DATE,
    COUNTERPARTY_NAME,
    ROOT_CAUSE,
    APPLIED_PROCEDURE,
    RESOLUTION_STRATEGY,
    TIME_TO_RESOLVE_HOURS,
    OUTCOME,
    CSDR_PENALTY_AVOIDED
FROM CLEARSET_DB.CLEARSET_SCHEMA.V_HISTORICAL_CASES
WHERE CP_ID = 'CP-192'
ORDER BY CASE_DATE DESC;
```
**Expected Data Result:**
- 5 historical cases for Apex Prime (`INV-2026-00412`, `00389`, `00311`, `00288`, `00245`) with applied SOP §3.2, §2.4, §4.1 resolution strategies.

---

### Question 7: *"Which counterparties have the highest settlement failure rates?"*
```sql
SELECT 
    CP_ID,
    NAME,
    PRIOR_FAILURES_30D,
    HISTORICAL_FAIL_RATE,
    AVG_RESOLUTION_HOURS
FROM CLEARSET_DB.CLEARSET_SCHEMA.COUNTERPARTIES
ORDER BY HISTORICAL_FAIL_RATE DESC, PRIOR_FAILURES_30D DESC;
```
**Expected Data Result:**
- Top 1: `CP-192` (Apex Prime: 8.4% fail rate, 7 fails)
- Top 2: `CP-104` (Vanguard: 4.1% fail rate, 6 fails)
- Top 3: `CP-210` (Citadel: 3.8% fail rate, 4 fails)

---

### Question 8: *"Which exceptions have missing settlement instructions?"*
```sql
SELECT 
    EXCEPTION_ID,
    TRADE_ID,
    TICKER,
    COUNTERPARTY_NAME,
    TRADE_VALUE,
    SEVERITY,
    RISK_SCORE,
    MINUTES_TO_CUTOFF
FROM CLEARSET_DB.CLEARSET_SCHEMA.V_EXCEPTIONS_ENRICHED
WHERE SSI_STATUS = 'MISSING' AND EXCEPTION_STATUS IN ('OPEN', 'INVESTIGATING')
ORDER BY RISK_SCORE DESC;
```
**Expected Data Result:**
- `EX-92831` (`TRD-92831`, AAPL, Apex Prime, $2.4M, Score: 91)
- `EX-71292` (`TRD-71292`, NVDA, Goldman, $1.2M, Score: 86)

---

## 4. Snowflake Cortex Analyst Deployment Steps

When uploading the semantic model to Snowflake:

1. **Upload YAML to Snowflake Internal Stage**:
   ```sql
   USE DATABASE CLEARSET_DB;
   USE SCHEMA CLEARSET_SCHEMA;

   -- Upload 07_semantic_model.yaml to stage
   PUT file://path/to/07_semantic_model.yaml @CLEARSET_POLICY_STAGE AUTO_COMPRESS=FALSE OVERWRITE=TRUE;
   ```

2. **Query via Cortex Analyst REST Endpoint (used by backend in Milestone 4)**:
   ```http
   POST /api/v2/cortex/analyst/message
   Content-Type: application/json
   Authorization: Bearer <token>

   {
     "messages": [
       {
         "role": "user",
         "content": [
           {
             "type": "text",
             "text": "Show me critical settlement exceptions approaching cutoff."
           }
         ]
       }
     ],
     "semantic_model_file": "@CLEARSET_DB.CLEARSET_SCHEMA.CLEARSET_POLICY_STAGE/07_semantic_model.yaml"
   }
   ```

3. **Execution Grounding**:
   - The returned response contains the validated SQL and natural-language explanation.
   - The backend proxy executes the SQL against Snowflake, returning evidence-grounded facts to the ClearSet Copilot and Investigation workspaces.

---

## 5. Verification Matrix for Hero Trade `TRD-92831`

| Dimension / Measure | Expected Value in Snowflake | Business Significance |
| :--- | :--- | :--- |
| **`TRADE_ID`** | `TRD-92831` | Primary showcase trade ticket. |
| **`TRADE_VALUE`** | `$2,400,000.00 USD` | High-value threshold (> $1M) triggering Tier 1 escalation. |
| **`TICKER` / `ISIN`** | `AAPL` (`US0378331005`) | NASDAQ equity settled at DTC. |
| **`COUNTERPARTY`** | `Apex Prime Clearing Ltd.` (`CP-192`) | Chronic failure counterparty (8.4% fail rate, 7 fails). |
| **`SSI_STATUS`** | `MISSING` | Depository participant 0244 missing cash affirmation subaccount. |
| **`RISK_SCORE`** | `91 / 100` (`CRITICAL`) | Deterministic additive score (25 + 25 + 20 + 15 + 6). |
| **`APPLIED_PROCEDURE`** | `Settlement Exception SOP §3.2` | Automated SWIFT MT599 repair + expedited desk phone call. |
