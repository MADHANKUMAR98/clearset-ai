-- ============================================================================
-- CLEARSET AI — SNOWFLAKE DATA FOUNDATION VALIDATION SUITE (READ-ONLY)
-- Purpose: Verify tables, seed counts, TRD-92831 showcase facts, and views.
-- ============================================================================

USE DATABASE CLEARSET_DB;
USE SCHEMA CLEARSET_SCHEMA;

-- ----------------------------------------------------------------------------
-- 1. VALIDATION: OBJECT EXISTENCE & ROW COUNTS
-- Expected counts:
--   COUNTERPARTIES: 5
--   SECURITIES: 5
--   TRADES: 5
--   SETTLEMENT_INSTRUCTIONS: 5
--   SETTLEMENT_EVENTS: 5
--   EXCEPTIONS: 5
--   HISTORICAL_CASES: 5
--   POLICY_CHUNKS: 6
--   INVESTIGATIONS: 0 (Populated upon human approval in ClearSet)
-- ----------------------------------------------------------------------------
SELECT 'COUNTERPARTIES' AS TABLE_NAME, COUNT(*) AS ROW_COUNT FROM COUNTERPARTIES
UNION ALL
SELECT 'SECURITIES', COUNT(*) FROM SECURITIES
UNION ALL
SELECT 'TRADES', COUNT(*) FROM TRADES
UNION ALL
SELECT 'SETTLEMENT_INSTRUCTIONS', COUNT(*) FROM SETTLEMENT_INSTRUCTIONS
UNION ALL
SELECT 'SETTLEMENT_EVENTS', COUNT(*) FROM SETTLEMENT_EVENTS
UNION ALL
SELECT 'EXCEPTIONS', COUNT(*) FROM EXCEPTIONS
UNION ALL
SELECT 'HISTORICAL_CASES', COUNT(*) FROM HISTORICAL_CASES
UNION ALL
SELECT 'POLICY_CHUNKS', COUNT(*) FROM POLICY_CHUNKS
UNION ALL
SELECT 'INVESTIGATIONS', COUNT(*) FROM INVESTIGATIONS;

-- ----------------------------------------------------------------------------
-- 2. VALIDATION: SHOWCASE HERO TRADE TRD-92831 CORE FACTS
-- Expected:
--   $2,400,000.00 | 12,000 shares @ $200.00 | AAPL | Apex Prime Clearing (CP-192) | DVP
-- ----------------------------------------------------------------------------
SELECT 
    t.TRADE_ID,
    t.TRADE_VALUE,
    t.QUANTITY,
    t.PRICE,
    t.CURRENCY,
    t.SETTLEMENT_TYPE,
    t.SETTLEMENT_STATUS,
    t.INSTRUCTION_STATUS,
    s.TICKER,
    s.NAME AS SECURITY_NAME,
    s.ISIN,
    s.DEPOSITORY,
    c.CP_ID,
    c.NAME AS COUNTERPARTY_NAME
FROM TRADES t
JOIN SECURITIES s ON t.ISIN = s.ISIN
JOIN COUNTERPARTIES c ON t.CP_ID = c.CP_ID
WHERE t.TRADE_ID = 'TRD-92831';

-- ----------------------------------------------------------------------------
-- 3. VALIDATION: COUNTERPARTY CP-192 PROFILE & 30-DAY FAILURE METRICS
-- Expected:
--   Name: Apex Prime Clearing Ltd. | Rating: A | Fails: 7 | Fail Rate: 8.4% | Avg Delay: 4.2h
-- ----------------------------------------------------------------------------
SELECT 
    CP_ID,
    NAME,
    BIC,
    CREDIT_RATING,
    PRIOR_FAILURES_30D,
    TOTAL_TRADES_TODAY,
    HISTORICAL_FAIL_RATE,
    AVG_RESOLUTION_HOURS,
    PRIMARY_DESK_CONTACT,
    PRIMARY_EMAIL
FROM COUNTERPARTIES
WHERE CP_ID = 'CP-192';

-- ----------------------------------------------------------------------------
-- 4. VALIDATION: SETTLEMENT INSTRUCTION (SSI) FOR TRD-92831
-- Expected:
--   Status: MISSING | Depository: DTC (Participant 0244) | Missing subaccount details
-- ----------------------------------------------------------------------------
SELECT 
    INSTRUCTION_ID,
    TRADE_ID,
    SETTLEMENT_TYPE,
    CUSTODIAN_BIC,
    DEPOSITORY,
    CASH_ACCOUNT,
    SECURITIES_ACCOUNT,
    STATUS,
    MISMATCH_DETAILS
FROM SETTLEMENT_INSTRUCTIONS
WHERE TRADE_ID = 'TRD-92831';

-- ----------------------------------------------------------------------------
-- 5. VALIDATION: SETTLEMENT EVENTS AUDIT TRAIL FOR TRD-92831
-- Expected:
--   5 chronological events from Trade Booking -> SSI Lookup -> MT548 Exception -> Cutoff Warning -> Critical Flag
-- ----------------------------------------------------------------------------
SELECT 
    EVENT_ID,
    TRADE_ID,
    EVENT_TIMESTAMP,
    MESSAGE_TYPE,
    STATUS,
    DESCRIPTION,
    SOURCE
FROM SETTLEMENT_EVENTS
WHERE TRADE_ID = 'TRD-92831'
ORDER BY EVENT_TIMESTAMP ASC;

-- ----------------------------------------------------------------------------
-- 6. VALIDATION: EXCEPTION & DETERMINISTIC RISK SCORE FOR TRD-92831
-- Expected:
--   Severity: CRITICAL | Score: 91 | Breakdown JSON: 25 + 25 + 20 + 15 + 6 = 91
-- ----------------------------------------------------------------------------
SELECT 
    EXCEPTION_ID,
    TRADE_ID,
    SEVERITY,
    STATUS,
    EXCEPTION_TYPE,
    RISK_SCORE,
    RISK_BREAKDOWN_JSON
FROM EXCEPTIONS
WHERE TRADE_ID = 'TRD-92831';

-- ----------------------------------------------------------------------------
-- 7. VALIDATION: HISTORICAL CASES PRECEDENTS (CP-192 REPAIR PLAYBOOKS)
-- Expected:
--   5 historical cases with playbooks, resolution times, and CSDR penalties avoided
-- ----------------------------------------------------------------------------
SELECT 
    HISTORICAL_CASE_ID,
    ORIGINAL_TRADE_ID,
    CASE_DATE,
    CP_ID,
    ROOT_CAUSE,
    APPLIED_PROCEDURE,
    RESOLUTION_STRATEGY,
    TIME_TO_RESOLVE_HOURS,
    OUTCOME,
    CSDR_PENALTY_AVOIDED
FROM HISTORICAL_CASES
WHERE CP_ID = 'CP-192'
ORDER BY CASE_DATE DESC;

-- ----------------------------------------------------------------------------
-- 8. VALIDATION: POLICY CHUNKS & SOP KNOWLEDGE BASE
-- ----------------------------------------------------------------------------
SELECT 
    CHUNK_ID,
    DOC_CODE,
    POLICY_NAME,
    POLICY_SECTION,
    CHUNK_TEXT,
    KEYWORDS,
    APPLICABLE_CP_ID,
    APPLICABLE_ASSET_CLASS,
    RISK_SCORE_IMPACT
FROM POLICY_CHUNKS
ORDER BY DOC_CODE;

-- ----------------------------------------------------------------------------
-- 9. VALIDATION: SEMANTIC VIEW — V_EXCEPTIONS_ENRICHED
-- Expected:
--   Enriched multi-table join for all 5 exceptions
-- ----------------------------------------------------------------------------
SELECT 
    TRADE_ID,
    TICKER,
    COUNTERPARTY_NAME,
    TRADE_VALUE,
    SEVERITY,
    RISK_SCORE,
    EXCEPTION_STATUS,
    SSI_STATUS
FROM V_EXCEPTIONS_ENRICHED
ORDER BY RISK_SCORE DESC;

-- ----------------------------------------------------------------------------
-- 10. VALIDATION: SEMANTIC VIEW — V_CRITICAL_APPROACHING_CUTOFF
-- ----------------------------------------------------------------------------
SELECT * FROM V_CRITICAL_APPROACHING_CUTOFF;

-- ----------------------------------------------------------------------------
-- 11. VALIDATION: SEMANTIC VIEW — V_COUNTERPARTY_FAIL_STATS
-- ----------------------------------------------------------------------------
SELECT * FROM V_COUNTERPARTY_FAIL_STATS ORDER BY PRIOR_FAILURES_30D DESC;

-- ----------------------------------------------------------------------------
-- 12. VALIDATION: ADDITIONAL SEMANTIC VIEWS
-- ----------------------------------------------------------------------------
SELECT COUNT(*) AS POLICY_SEARCH_ROWS FROM V_POLICY_SEARCH;
SELECT COUNT(*) AS SETTLEMENT_EVENT_ROWS FROM V_SETTLEMENT_EVENTS;
SELECT COUNT(*) AS TRADE_ENRICHED_ROWS FROM V_TRADE_ENRICHED;
SELECT COUNT(*) AS HISTORICAL_CASE_ROWS FROM V_HISTORICAL_CASES;
SELECT COUNT(*) AS SSI_STATUS_ROWS FROM V_SSI_STATUS;

