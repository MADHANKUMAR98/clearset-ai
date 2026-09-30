-- ============================================================================
-- CLEARSET AI - DEMO SEED: approval turnaround (supports the GCC slide deck)
--
-- RESOLUTION_CASES ships empty (only the DDL in 08_resolution_cases.sql), so
-- the dashboard "cases approved" and "avg approval turnaround" tiles render
-- empty. This seeds the two demo approvals referenced in the deck.
--
-- Target: avg turnaround = (360 + 480) / 2 = 420 minutes.
-- Rows link to the two already-RESOLVED exceptions so the audit trail is real.
--
-- Run:
--   snow sql -f snowflake/ops/seed_demo_cases.sql --connection clearset-hack
--
-- Idempotent: re-running replaces the two demo rows (same CASE_IDs).
-- ============================================================================

DELETE FROM CLEARSET_DB.CLEARSET_SCHEMA.RESOLUTION_CASES
WHERE CASE_ID IN ('CASE-DEMO-0001', 'CASE-DEMO-0002');

-- Case 1: HIGH severity settlement mismatch - 360 minute turnaround
INSERT INTO CLEARSET_DB.CLEARSET_SCHEMA.RESOLUTION_CASES (
    CASE_ID, TRADE_ID, EXCEPTION_ID, STATUS, RISK_SCORE,
    ROOT_CAUSE, RECOMMENDATION, RESOLUTION_OUTCOME,
    APPROVED_BY, APPROVED_AT, CREATED_AT, UPDATED_AT
)
SELECT
    'CASE-DEMO-0001',
    'TRD-90010',
    'EX-90010',
    'APPROVED',
    78,
    'Settlement instruction mismatch: MT599 beneficiary differed from the standing settlement instructions for the booking entity.',
    'Re-issue the MT599 with the SSI-confirmed beneficiary and obtain counterparty operations confirmation before cut-off.',
    'Instruction repaired and re-issued; exception resolved same business day.',
    'clearset.demo.approver',
    CURRENT_TIMESTAMP(),
    DATEADD('minute', -360, CURRENT_TIMESTAMP()),
    CURRENT_TIMESTAMP();

-- Case 2: LOW severity trade enrichment gap - 480 minute turnaround
INSERT INTO CLEARSET_DB.CLEARSET_SCHEMA.RESOLUTION_CASES (
    CASE_ID, TRADE_ID, EXCEPTION_ID, STATUS, RISK_SCORE,
    ROOT_CAUSE, RECOMMENDATION, RESOLUTION_OUTCOME,
    APPROVED_BY, APPROVED_AT, CREATED_AT, UPDATED_AT
)
SELECT
    'CASE-DEMO-0002',
    'TRD-90017',
    'EX-90017',
    'APPROVED',
    41,
    'Trade enrichment gap: counterparty LEI and optional beneficiary reference were missing from the inbound feed.',
    'Backfill LEI from the golden-source reference data service and replay the enrichment step for the affected trade.',
    'Attributes backfilled from golden source; exception resolved after overnight replay.',
    'clearset.demo.approver',
    CURRENT_TIMESTAMP(),
    DATEADD('minute', -480, CURRENT_TIMESTAMP()),
    CURRENT_TIMESTAMP();
