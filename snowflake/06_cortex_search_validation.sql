-- ============================================================================
-- CLEARSET AI — CORTEX SEARCH SERVICE VALIDATION SUITE (MILESTONE 2)
-- Purpose: Read-only validation queries to test Cortex Search Service over SOPs.
-- ============================================================================

USE DATABASE CLEARSET_DB;
USE SCHEMA CLEARSET_SCHEMA;

-- ----------------------------------------------------------------------------
-- 1. VALIDATION: SERVICE EXISTENCE & STATUS
-- Expected:
--   Name: CLEARSET_POLICY_SEARCH_SERVICE | Database: CLEARSET_DB | Schema: CLEARSET_SCHEMA
-- ----------------------------------------------------------------------------
SHOW CORTEX SEARCH SERVICES IN SCHEMA CLEARSET_DB.CLEARSET_SCHEMA;

-- ----------------------------------------------------------------------------
-- 2. VALIDATION: DESCRIBE SEARCH SERVICE CONFIGURATION
-- Expected:
--   search_column: CHUNK_TEXT
--   attribute_columns: DOC_CODE, POLICY_NAME, POLICY_SECTION, APPLICABLE_CP_ID, APPLICABLE_ASSET_CLASS
--   warehouse: COMPUTE_WH
-- ----------------------------------------------------------------------------
DESCRIBE CORTEX SEARCH SERVICE CLEARSET_DB.CLEARSET_SCHEMA.CLEARSET_POLICY_SEARCH_SERVICE;

-- ----------------------------------------------------------------------------
-- 3. TEST QUERY 1: Missing Settlement Instruction Procedure
-- Question: "What is the procedure for a missing settlement instruction?"
-- Expected Top Match:
--   CHUNK_ID: PC-001 (Settlement Exception SOP §3.2 - Expedited SSI Repair)
-- ----------------------------------------------------------------------------
SELECT PARSE_JSON(
    SNOWFLAKE.CORTEX.SEARCH_PREVIEW(
        'CLEARSET_DB.CLEARSET_SCHEMA.CLEARSET_POLICY_SEARCH_SERVICE',
        '{
            "query": "What is the procedure for a missing settlement instruction?",
            "columns": ["CHUNK_ID", "DOC_CODE", "POLICY_NAME", "POLICY_SECTION", "CHUNK_TEXT", "RISK_SCORE_IMPACT"],
            "limit": 3
        }'
    )
)['results'] AS SEARCH_RESULTS;

-- ----------------------------------------------------------------------------
-- 4. TEST QUERY 2: Missing SSI with Approaching Cutoff Urgency
-- Question: "What should an analyst do when an SSI is missing and cutoff is approaching?"
-- Expected Top Match:
--   CHUNK_ID: PC-001 (SOP §3.2: Automated SWIFT MT599 repair + early desk escalation)
-- ----------------------------------------------------------------------------
SELECT PARSE_JSON(
    SNOWFLAKE.CORTEX.SEARCH_PREVIEW(
        'CLEARSET_DB.CLEARSET_SCHEMA.CLEARSET_POLICY_SEARCH_SERVICE',
        '{
            "query": "What should an analyst do when an SSI is missing and cutoff is approaching?",
            "columns": ["CHUNK_ID", "DOC_CODE", "POLICY_NAME", "POLICY_SECTION", "CHUNK_TEXT", "RISK_SCORE_IMPACT"],
            "limit": 3
        }'
    )
)['results'] AS SEARCH_RESULTS;

-- ----------------------------------------------------------------------------
-- 5. TEST QUERY 3: Counterparty Failure Escalation
-- Question: "What is the escalation procedure for repeated counterparty settlement failures?"
-- Expected Top Match:
--   CHUNK_ID: PC-003 (Counterparty Escalation Policy §2.1 - Phone Escalation Protocol)
-- ----------------------------------------------------------------------------
SELECT PARSE_JSON(
    SNOWFLAKE.CORTEX.SEARCH_PREVIEW(
        'CLEARSET_DB.CLEARSET_SCHEMA.CLEARSET_POLICY_SEARCH_SERVICE',
        '{
            "query": "What is the escalation procedure for repeated counterparty settlement failures?",
            "columns": ["CHUNK_ID", "DOC_CODE", "POLICY_NAME", "POLICY_SECTION", "CHUNK_TEXT"],
            "limit": 3
        }'
    )
)['results'] AS SEARCH_RESULTS;

-- ----------------------------------------------------------------------------
-- 6. TEST QUERY 4: Settlement Penalties and Regulations
-- Question: "What are the applicable settlement penalty rules?"
-- Expected Top Match:
--   CHUNK_ID: PC-005 (CSDR Penalty Avoidance Protocol)
-- ----------------------------------------------------------------------------
SELECT PARSE_JSON(
    SNOWFLAKE.CORTEX.SEARCH_PREVIEW(
        'CLEARSET_DB.CLEARSET_SCHEMA.CLEARSET_POLICY_SEARCH_SERVICE',
        '{
            "query": "What are the applicable settlement penalty rules?",
            "columns": ["CHUNK_ID", "DOC_CODE", "POLICY_NAME", "POLICY_SECTION", "CHUNK_TEXT", "RISK_SCORE_IMPACT"],
            "limit": 3
        }'
    )
)['results'] AS SEARCH_RESULTS;

-- ----------------------------------------------------------------------------
-- 7. TEST QUERY 5: Attribute-Filtered Cortex Search
-- Filter: DOC_CODE = 'SOP-3.2'
-- Expected:
--   Returns only SOP §3.2 documents matching the query
-- ----------------------------------------------------------------------------
SELECT PARSE_JSON(
    SNOWFLAKE.CORTEX.SEARCH_PREVIEW(
        'CLEARSET_DB.CLEARSET_SCHEMA.CLEARSET_POLICY_SEARCH_SERVICE',
        '{
            "query": "escalation protocol",
            "columns": ["CHUNK_ID", "DOC_CODE", "POLICY_NAME", "POLICY_SECTION", "CHUNK_TEXT"],
            "filter": {"@eq": {"DOC_CODE": "SOP-3.2"}},
            "limit": 1
        }'
    )
)['results'] AS FILTERED_RESULTS;

-- ----------------------------------------------------------------------------
-- 8. BENCHMARK: SQL Vector Cosine Similarity (Fallback / Ground Truth)
-- Purpose: Direct mathematical semantic similarity test over POLICY_CHUNKS
-- ----------------------------------------------------------------------------
SELECT 
    CHUNK_ID,
    DOC_CODE,
    POLICY_NAME,
    POLICY_SECTION,
    CHUNK_TEXT,
    VECTOR_COSINE_SIMILARITY(
        SNOWFLAKE.CORTEX.EMBED_TEXT_768('snowflake-arctic-embed-m', CHUNK_TEXT),
        SNOWFLAKE.CORTEX.EMBED_TEXT_768('snowflake-arctic-embed-m', 'missing standing settlement instruction approaching cutoff')
    ) AS SIMILARITY_SCORE
FROM POLICY_CHUNKS
ORDER BY SIMILARITY_SCORE DESC;
