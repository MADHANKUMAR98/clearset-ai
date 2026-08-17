-- ============================================================================
-- CLEARSET AI — CORTEX SEARCH SERVICE SETUP & SOP POLICY CHUNKS
-- Unstructured Knowledge: SOPs, Cutoff Policies, Escalation Procedures
-- ============================================================================

USE DATABASE CLEARSET_DB;
USE SCHEMA CLEARSET_SCHEMA;

-- ----------------------------------------------------------------------------
-- 1. STAGE FOR KNOWLEDGE DOCUMENTS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE STAGE CLEARSET_POLICY_STAGE
    DIRECTORY = (ENABLE = TRUE)
    ENCRYPTION = (TYPE = 'SNOWFLAKE_SSE');

-- ----------------------------------------------------------------------------
-- 2. POLICY CHUNKS TABLE FOR SEARCH INDEXING
-- ----------------------------------------------------------------------------
CREATE OR REPLACE TABLE POLICY_CHUNKS (
    CHUNK_ID VARCHAR(50) PRIMARY KEY,
    DOC_CODE VARCHAR(50),
    POLICY_NAME VARCHAR(200),
    POLICY_SECTION VARCHAR(100),
    CHUNK_TEXT VARCHAR(5000),
    KEYWORDS ARRAY,
    APPLICABLE_CP_ID VARCHAR(20),
    APPLICABLE_ASSET_CLASS VARCHAR(50),
    RISK_SCORE_IMPACT INTEGER,
    CREATED_DATE TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    LAST_UPDATED TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- ----------------------------------------------------------------------------
-- 3. SEED POLICY CHUNKS (All SOPs, Cutoff Policies, and Regulations)
-- ----------------------------------------------------------------------------
INSERT INTO POLICY_CHUNKS (
    CHUNK_ID, POLICY_NAME, POLICY_SECTION, CHUNK_TEXT, KEYWORDS, 
    APPLICABLE_CP_ID, APPLICABLE_ASSET_CLASS, DOC_CODE, RISK_SCORE_IMPACT
)
SELECT 'PC-001', 'Settlement Exception SOP §3.2', 'Expedited SSI Repair', 
 'When a Missing SSI exception is detected, immediately dispatch an automated SSI repair request to the counterparty operations desk. If not resolved within 30 minutes, escalate to desk lead via phone. For trades > $1M, trigger early escalation protocol.',
 ARRAY_CONSTRUCT('MISSING SSI', 'REPAIR', 'EXPEDITE', 'ESCALATION', 'AUTOMATED'),
 'CP-192', 'Equities', 'SOP-3.2', 25
UNION ALL
SELECT 'PC-002', 'Settlement Exception SOP §2.4', 'Cash Discrepancy Resolution', 
 'For cash amount mismatches under $10,000, auto-adjust within tolerance threshold under operations discretionary ledger. For variances > $10,000, initiate full reconciliation workflow and notify both counterparty and custodian.',
 ARRAY_CONSTRUCT('CASH MISMATCH', 'TOLERANCE', 'RECONCILIATION', 'ADJUSTMENT'),
 NULL, NULL, 'SOP-2.4', 18
UNION ALL
SELECT 'PC-003', 'Counterparty Escalation Policy §2.1', 'Phone Escalation Protocol', 
 'For critical exceptions (risk score > 80), direct phone escalation to counterparty desk lead is required within 15 minutes of detection. Document all call notes and confirmation details in the exception log.',
 ARRAY_CONSTRUCT('PHONE ESCALATION', 'CRITICAL', 'DESK LEAD', 'DOCUMENTATION'),
 NULL, NULL, 'CEP-2.1', 15
UNION ALL
SELECT 'PC-004', 'Settlement Exception SOP §4.1', 'Post-Cutoff Fail Logging', 
 'If settlement fails at depository cutoff due to unresolved exception, log the failure immediately. Initiate T+1 fail management procedures and notify all internal stakeholders within 30 minutes of cutoff.',
 ARRAY_CONSTRUCT('POST-CUTOFF', 'FAIL', 'LOGGING', 'T+1', 'NOTIFICATION'),
 NULL, NULL, 'SOP-4.1', 20
UNION ALL
SELECT 'PC-005', 'CSDR Penalty Avoidance Protocol', 'Penalty Prevention', 
 'For any trade at risk of CSDR penalty (> €1M or equivalent), implement accelerated resolution workflow. Priority routing to settlement operations manager. Required sign-off from compliance for any tolerance exceptions.',
 ARRAY_CONSTRUCT('CSDR', 'PENALTY', 'ACCELERATED', 'COMPLIANCE', 'TOLERANCE'),
 NULL, NULL, 'CSDR-001', 30;

-- ----------------------------------------------------------------------------
-- 4. CORTEX SEARCH SERVICE DDL
-- Execute this block in Snowflake to create the Cortex Search Service:
-- ----------------------------------------------------------------------------
CREATE OR REPLACE CORTEX SEARCH SERVICE CLEARSET_POLICY_SEARCH_SERVICE
    ON CHUNK_TEXT
    ATTRIBUTES DOC_CODE, POLICY_NAME, POLICY_SECTION, APPLICABLE_CP_ID, APPLICABLE_ASSET_CLASS
    WAREHOUSE = COMPUTE_WH
    TARGET_LAG = '1 hour'
    AS (
        SELECT 
            CHUNK_ID,
            DOC_CODE,
            POLICY_NAME,
            POLICY_SECTION,
            CHUNK_TEXT,
            APPLICABLE_CP_ID,
            APPLICABLE_ASSET_CLASS,
            RISK_SCORE_IMPACT
        FROM CLEARSET_DB.CLEARSET_SCHEMA.POLICY_CHUNKS
    );



