-- ============================================================================
-- CLEARSET AI — CORTEX SEARCH SERVICE SETUP
-- Unstructured Knowledge: SOPs, Cutoff Policies, Escalation Procedures
-- ============================================================================

USE DATABASE CLEARSET_DB;
USE SCHEMA CLEARSET_SCHEMA;

-- 1. STAGE FOR KNOWLEDGE DOCUMENTS
CREATE OR REPLACE STAGE CLEARSET_POLICY_STAGE
    DIRECTORY = (ENABLE = TRUE)
    ENCRYPTION = (TYPE = 'SNOWFLAKE_SSE');

-- 2. POLICY CHUNKS TABLE FOR SEARCH INDEXING
CREATE OR REPLACE TABLE POLICY_CHUNKS (
    CHUNK_ID VARCHAR(50) PRIMARY KEY,
    DOC_CODE VARCHAR(50) NOT NULL,
    DOC_TITLE VARCHAR(255) NOT NULL,
    SECTION_NUMBER VARCHAR(20) NOT NULL,
    SECTION_TITLE VARCHAR(255) NOT NULL,
    CONTENT TEXT NOT NULL,
    MANDATORY_ACTIONS VARIANT,
    ESCALATION_THRESHOLDS VARIANT,
    LAST_UPDATED TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- Seed Policy Chunks
INSERT INTO POLICY_CHUNKS (CHUNK_ID, DOC_CODE, DOC_TITLE, SECTION_NUMBER, SECTION_TITLE, CONTENT, MANDATORY_ACTIONS, ESCALATION_THRESHOLDS)
VALUES
('CHK-SOP-032-3.2', 'SOP-OPS-032', 'Settlement Exception Standard Operating Procedure', '3.2', 'Missing Settlement Instructions & Expedited SSI Repair',
'When a trade is booked without matched Standing Settlement Instructions (SSI) and the settlement cutoff is within 120 minutes: 1. Operational analysts must immediately initiate an automated SWIFT MT599 repair notification. 2. For high-value transactions (> $1,000,000 USD), immediate supervisor escalation is required.',
PARSE_JSON('["Request corrected settlement instruction via SWIFT/ISO 20022 message", "Escalate to Settlement Operations desk lead", "Monitor depository status until confirmed"]'),
PARSE_JSON('["Trade Value > $1,000,000 USD: Mandatory supervisor notification", "Time to Cutoff < 120 mins: Tier 1 Escalation"]')),

('CHK-POL-008-2.1', 'POL-RSK-008', 'Counterparty Escalation Policy & Chronic Failure Protocol', '2.1', 'Chronic Failure Counterparty Escalation Matrix',
'Counterparties exhibiting >= 5 settlement failures within a rolling 30-day window are designated Tier-A Operational Risk. Direct operational contact details must be highlighted in the investigation workspace.',
PARSE_JSON('["Attach counterparty 30-day fail audit to case file", "Notify Institutional Relationship Manager"]'),
PARSE_JSON('["> 5 failures in 30 days: Tier-A Risk classification"]'));

-- 3. CREATE CORTEX SEARCH SERVICE (When running in Snowflake)
-- CREATE OR REPLACE CORTEX SEARCH SERVICE CLEARSET_POLICY_SEARCH_SERVICE
--     ON CONTENT
--     ATTRIBUTES DOC_CODE, SECTION_NUMBER, DOC_TITLE
--     WAREHOUSE = COMPUTE_WH
--     TARGET_LAG = '1 minute'
--     AS (
--         SELECT CHUNK_ID, DOC_CODE, DOC_TITLE, SECTION_NUMBER, SECTION_TITLE, CONTENT
--         FROM POLICY_CHUNKS
--     );
