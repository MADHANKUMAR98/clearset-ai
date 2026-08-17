-- ============================================================================
-- CLEARSET AI — CORTEX ANALYST SEMANTIC VIEWS & VERIFIED QUERIES
-- ============================================================================

USE DATABASE CLEARSET_DB;
USE SCHEMA CLEARSET_SCHEMA;

-- ----------------------------------------------------------------------------
-- 1. V_EXCEPTIONS_ENRICHED - Analytical view for Cortex Agent
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW V_EXCEPTIONS_ENRICHED AS
SELECT 
    e.EXCEPTION_ID,
    e.TRADE_ID,
    e.SEVERITY,
    e.STATUS AS EXCEPTION_STATUS,
    e.EXCEPTION_TYPE,
    e.RISK_SCORE,
    t.TRADE_VALUE,
    t.CURRENCY,
    t.SETTLEMENT_DATE,
    t.SETTLEMENT_TYPE,
    t.CUTOFF_TIME,
    DATEDIFF('minute', CURRENT_TIMESTAMP(), t.CUTOFF_TIME) AS MINUTES_TO_CUTOFF,
    s.TICKER,
    s.NAME AS SECURITY_NAME,
    s.ASSET_CLASS,
    s.DEPOSITORY,
    c.CP_ID,
    c.NAME AS COUNTERPARTY_NAME,
    c.CREDIT_RATING,
    c.PRIOR_FAILURES_30D,
    c.HISTORICAL_FAIL_RATE,
    ssi.STATUS AS SSI_STATUS,
    ssi.CUSTODIAN_BIC
FROM EXCEPTIONS e
JOIN TRADES t ON e.TRADE_ID = t.TRADE_ID
JOIN SECURITIES s ON t.ISIN = s.ISIN
JOIN COUNTERPARTIES c ON t.CP_ID = c.CP_ID
LEFT JOIN SETTLEMENT_INSTRUCTIONS ssi ON t.TRADE_ID = ssi.TRADE_ID;

-- ----------------------------------------------------------------------------
-- 2. V_CRITICAL_APPROACHING_CUTOFF - Critical exceptions sorted by urgency
-- Question: "Show me critical settlement exceptions approaching cutoff."
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW V_CRITICAL_APPROACHING_CUTOFF AS
SELECT 
    TRADE_ID, 
    TICKER, 
    COUNTERPARTY_NAME, 
    TRADE_VALUE, 
    MINUTES_TO_CUTOFF, 
    RISK_SCORE 
FROM V_EXCEPTIONS_ENRICHED
WHERE SEVERITY = 'CRITICAL' AND EXCEPTION_STATUS IN ('OPEN', 'INVESTIGATING')
ORDER BY RISK_SCORE DESC, MINUTES_TO_CUTOFF ASC;

-- ----------------------------------------------------------------------------
-- 3. V_COUNTERPARTY_FAIL_STATS - Counterparty failure statistics
-- Question: "How many settlement failures has CP-192 had?"
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW V_COUNTERPARTY_FAIL_STATS AS
SELECT DISTINCT
    CP_ID, 
    NAME, 
    PRIOR_FAILURES_30D, 
    HISTORICAL_FAIL_RATE, 
    AVG_RESOLUTION_HOURS 
FROM COUNTERPARTIES;

-- ----------------------------------------------------------------------------
-- 4. V_POLICY_SEARCH - Policy chunks for semantic search
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW V_POLICY_SEARCH AS
SELECT 
    CHUNK_ID,
    DOC_CODE,
    POLICY_NAME,
    POLICY_SECTION,
    CHUNK_TEXT,
    KEYWORDS,
    APPLICABLE_CP_ID,
    APPLICABLE_ASSET_CLASS,
    RISK_SCORE_IMPACT,
    CREATED_DATE,
    LAST_UPDATED
FROM POLICY_CHUNKS;

-- ----------------------------------------------------------------------------
-- 5. V_SETTLEMENT_EVENTS - Full settlement event timeline
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW V_SETTLEMENT_EVENTS AS
SELECT 
    SE.EVENT_ID,
    SE.TRADE_ID,
    T.CP_ID,
    C.NAME AS COUNTERPARTY_NAME,
    SE.EVENT_TIMESTAMP,
    SE.MESSAGE_TYPE,
    SE.STATUS AS EVENT_STATUS,
    SE.DESCRIPTION,
    SE.SOURCE,
    T.TRADE_VALUE,
    T.SETTLEMENT_DATE,
    T.CUTOFF_TIME
FROM SETTLEMENT_EVENTS SE
JOIN TRADES T ON SE.TRADE_ID = T.TRADE_ID
LEFT JOIN COUNTERPARTIES C ON T.CP_ID = C.CP_ID
ORDER BY SE.EVENT_TIMESTAMP;

-- ----------------------------------------------------------------------------
-- 6. V_TRADE_ENRICHED - Trades with counterparty and security details
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW V_TRADE_ENRICHED AS
SELECT 
    T.TRADE_ID,
    T.ISIN,
    S.TICKER,
    S.NAME AS SECURITY_NAME,
    S.ASSET_CLASS,
    T.CP_ID,
    C.NAME AS COUNTERPARTY_NAME,
    C.CREDIT_RATING,
    T.TRADE_DATE,
    T.SETTLEMENT_DATE,
    T.SETTLEMENT_TYPE,
    T.TRADE_VALUE,
    T.QUANTITY,
    T.PRICE,
    T.CURRENCY,
    T.BOOKING_DESK,
    T.SETTLEMENT_STATUS,
    T.INSTRUCTION_STATUS,
    T.CUTOFF_TIME,
    C.PRIOR_FAILURES_30D,
    C.TOTAL_TRADES_TODAY,
    C.HISTORICAL_FAIL_RATE
FROM TRADES T
LEFT JOIN SECURITIES S ON T.ISIN = S.ISIN
LEFT JOIN COUNTERPARTIES C ON T.CP_ID = C.CP_ID;

-- ----------------------------------------------------------------------------
-- 7. V_HISTORICAL_CASES - Historical cases with CP details
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW V_HISTORICAL_CASES AS
SELECT 
    HC.HISTORICAL_CASE_ID,
    HC.ORIGINAL_TRADE_ID,
    HC.CASE_DATE,
    HC.CP_ID,
    C.NAME AS COUNTERPARTY_NAME,
    HC.ROOT_CAUSE,
    HC.APPLIED_PROCEDURE,
    HC.RESOLUTION_STRATEGY,
    HC.TIME_TO_RESOLVE_HOURS,
    HC.OUTCOME,
    HC.CSDR_PENALTY_AVOIDED,
    C.PRIOR_FAILURES_30D,
    C.HISTORICAL_FAIL_RATE
FROM HISTORICAL_CASES HC
LEFT JOIN COUNTERPARTIES C ON HC.CP_ID = C.CP_ID
ORDER BY HC.CASE_DATE DESC;

-- ----------------------------------------------------------------------------
-- 8. V_SSI_STATUS - Settlement instructions with trade context
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW V_SSI_STATUS AS
SELECT 
    SI.INSTRUCTION_ID,
    SI.TRADE_ID,
    T.CP_ID,
    C.NAME AS COUNTERPARTY_NAME,
    SI.SETTLEMENT_TYPE,
    SI.CUSTODIAN_BIC,
    SI.DEPOSITORY,
    SI.CASH_ACCOUNT,
    SI.SECURITIES_ACCOUNT,
    SI.STATUS AS SSI_STATUS,
    SI.MISMATCH_DETAILS,
    T.TRADE_VALUE,
    T.SETTLEMENT_DATE,
    T.CUTOFF_TIME
FROM SETTLEMENT_INSTRUCTIONS SI
JOIN TRADES T ON SI.TRADE_ID = T.TRADE_ID
JOIN COUNTERPARTIES C ON T.CP_ID = C.CP_ID;

