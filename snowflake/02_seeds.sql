-- ============================================================================
-- CLEARSET AI — SNOWFLAKE SYNTHETIC DATA SEEDS (PHASE 2)
-- Domain: Financial Services / Capital Markets / Post-Trade Operations
-- ============================================================================

USE DATABASE CLEARSET_DB;
USE SCHEMA CLEARSET_SCHEMA;

-- ----------------------------------------------------------------------------
-- 1. SEED COUNTERPARTIES MASTER
-- ----------------------------------------------------------------------------
INSERT INTO COUNTERPARTIES (
    CP_ID, NAME, BIC, LEI, CREDIT_RATING, 
    PRIOR_FAILURES_30D, TOTAL_TRADES_TODAY, HISTORICAL_FAIL_RATE, 
    AVG_RESOLUTION_HOURS, PRIMARY_DESK_CONTACT, PRIMARY_EMAIL
)
VALUES
('CP-192', 'Apex Prime Clearing Ltd.', 'APEXUS33XXX', '5493006MHB84DD0Z4J21', 'A', 7, 84, 8.4, 4.2, 'Marcus Vance (Equities Clearing Desk NY)', 'settlements.desk@apexclearing.com'),
('CP-104', 'Vanguard Global Markets', 'VANGUS33XXX', '54930089K8L62NNX8211', 'AAA', 6, 210, 4.1, 2.8, 'Sarah Jenkins (Fixed Income Operations)', 'posttrade@vanguardmarkets.com'),
('CP-088', 'Goldman Execution Services', 'GSEXUS33XXX', 'W22LROWP2IHZNBB6K528', 'AA+', 5, 340, 3.2, 2.1, 'David Sterling (Institutional Settlements NY)', 'ops-escalations@gs.com'),
('CP-210', 'Citadel Custody & Clearing', 'CITDUS33XXX', '549300H287LKNM882199', 'AA', 4, 195, 3.8, 2.5, 'Elena Rostova (Settlement Control)', 'settlement-control@citadel.com'),
('CP-115', 'Morgan Stanley Prime Ops', 'MSNYUS33XXX', '4PQUHN3V0GFWSCYVVQ11', 'AA', 3, 160, 2.9, 1.9, 'Robert Chen (Equities Ops)', 'ms-settlements-team@morganstanley.com');

-- ----------------------------------------------------------------------------
-- 2. SEED SECURITIES MASTER
-- ----------------------------------------------------------------------------
INSERT INTO SECURITIES (ISIN, CUSIP, TICKER, NAME, ASSET_CLASS, DEPOSITORY, MARKET_TIER)
VALUES
('US0378331005', '037833100', 'AAPL', 'Apple Inc. Common Stock', 'Equities', 'DTC', 'NASDAQ Global Select'),
('US912828ZG64', '912828ZG6', 'UST10Y', 'US Treasury 4.25% Due 2034', 'Fixed Income', 'Fedwire', 'US Government'),
('US67066G1040', '67066G104', 'NVDA', 'NVIDIA Corp Common Stock', 'Equities', 'DTC', 'NASDAQ Global Select'),
('US5949181045', '594918104', 'MSFT', 'Microsoft Corp Common Stock', 'Equities', 'DTC', 'NASDAQ Global Select'),
('US88160R1014', '88160R101', 'TSLA', 'Tesla Inc. Common Stock', 'Equities', 'DTC', 'NASDAQ Global Select');

-- ----------------------------------------------------------------------------
-- 3. SEED TRADES (Including Showcase Hero Trade TRD-92831)
-- ----------------------------------------------------------------------------
INSERT INTO TRADES (
    TRADE_ID, ISIN, CP_ID, TRADE_DATE, SETTLEMENT_DATE, 
    SETTLEMENT_TYPE, TRADE_VALUE, QUANTITY, PRICE, CURRENCY, 
    BOOKING_DESK, TRADER_REF, SETTLEMENT_STATUS, INSTRUCTION_STATUS, CUTOFF_TIME
)
VALUES
('TRD-92831', 'US0378331005', 'CP-192', '2026-08-09 09:32:00', '2026-08-09', 'DVP', 2400000.00, 12000, 200.00, 'USD', 'US Institutional Equities', 'TR-8821 (Alex Mercer)', 'PENDING', 'MISSING', '2026-08-09 15:30:00'),
('TRD-81232', 'US912828ZG64', 'CP-104', '2026-08-09 08:15:00', '2026-08-09', 'DVP', 8100000.00, 80000, 101.25, 'USD', 'Rates & Sovereign Debt', 'TR-4192 (Sarah Lin)', 'PENDING', 'MISMATCHED', '2026-08-09 15:00:00'),
('TRD-71292', 'US67066G1040', 'CP-088', '2026-08-09 09:45:00', '2026-08-09', 'DVP', 1200000.00, 10000, 120.00, 'USD', 'Tech Sector Trading Desk', 'TR-7719 (Jason Vance)', 'PENDING', 'MISSING', '2026-08-09 15:30:00'),
('TRD-65419', 'US5949181045', 'CP-210', '2026-08-09 09:05:00', '2026-08-09', 'DVP', 3750000.00, 8500, 441.17, 'USD', 'US Institutional Equities', 'TR-3301 (David Miller)', 'PENDING', 'MISMATCHED', '2026-08-09 15:30:00'),
('TRD-54210', 'US88160R1014', 'CP-115', '2026-08-09 10:11:00', '2026-08-09', 'DVP', 4500000.00, 18000, 250.00, 'USD', 'High Beta Growth Desk', 'TR-9122 (Emily Zhao)', 'PENDING', 'PENDING', '2026-08-09 16:00:00');

-- ----------------------------------------------------------------------------
-- 4. SEED SETTLEMENT INSTRUCTIONS (SSI)
-- ----------------------------------------------------------------------------
INSERT INTO SETTLEMENT_INSTRUCTIONS (
    INSTRUCTION_ID, TRADE_ID, SETTLEMENT_TYPE, CUSTODIAN_BIC, 
    DEPOSITORY, CASH_ACCOUNT, SECURITIES_ACCOUNT, STATUS, MISMATCH_DETAILS
)
VALUES
('SSI-92831', 'TRD-92831', 'DVP', 'APEXUS33XXX', 'DTC (Participant 0244)', 'MISSING_SUBACCOUNT_REF', 'MISSING_DTC_SUBID', 'MISSING', 'DTC Participant ID 0244 provided without linked cash settlement affirmation subaccount. Standing instructions missing for market tier NASDAQ.'),
('SSI-81232', 'TRD-81232', 'DVP', 'VANGUS33XXX', 'Fedwire / BNY Mellon', 'CASH-FED-992182', 'SEC-FED-002194', 'MISMATCHED', 'Cash amount mismatch: Ticket states $8,100,000.00; Fedwire affirmation message states $8,095,450.00 (Variance: -$4,550.00 accrued coupon interest mismatch).'),
('SSI-71292', 'TRD-71292', 'DVP', 'GSEXUS33XXX', 'DTC (Participant 0012)', 'MISSING_CASH_SUB', 'SEC-DTC-77192', 'MISSING', 'Custodian subaccount unmapped for DTC equities clearing window.'),
('SSI-65419', 'TRD-65419', 'DVP', 'CITDUS33XXX', 'DTC (Participant 0510)', 'CASH-DTC-881920', 'SEC-DTC-992184', 'MISMATCHED', 'Securities depository participant BIC mismatch on trade allocation.'),
('SSI-54210', 'TRD-54210', 'DVP', 'MSNYUS33XXX', 'DTC (Participant 0015)', 'CASH-MS-221948', 'SEC-MS-441920', 'PENDING', 'Instruction dispatched to DTC matching utility; unconfirmed by counterparty custodian.');

-- ----------------------------------------------------------------------------
-- 5. SEED SETTLEMENT EVENTS (SWIFT / Depository Audit Trail for TRD-92831)
-- ----------------------------------------------------------------------------
INSERT INTO SETTLEMENT_EVENTS (
    EVENT_ID, TRADE_ID, EVENT_TIMESTAMP, MESSAGE_TYPE, STATUS, DESCRIPTION, SOURCE
)
VALUES
('EVT-101', 'TRD-92831', '2026-08-09 09:32:00', 'INTERNAL_ALERT', 'TRADE_BOOKED', 'Trade booked by Equities Desk TR-8821: Buy 12,000 AAPL @ $200.00 ($2.4M DVP).', 'MATCHING_ENGINE'),
('EVT-102', 'TRD-92831', '2026-08-09 09:32:05', 'SWIFT MT541', 'SSI_LOOKUP_INITIATED', 'Automated SSI engine queried Alert master repository for CP-192 / DTC Participant 0244.', 'MATCHING_ENGINE'),
('EVT-103', 'TRD-92831', '2026-08-09 09:32:15', 'SWIFT MT548', 'SSI_NOT_FOUND', 'Depository lookup returned status: No valid standing settlement instruction found for subaccount. Exception flag raised.', 'DEPOSITORY'),
('EVT-104', 'TRD-92831', '2026-08-09 11:45:00', 'INTERNAL_ALERT', 'CUTOFF_WARNING_T120', 'Depository cutoff threshold warning: 120 minutes remaining before 15:30 EST DTC intraday cycle cutoff.', 'CLEARSET_AGENT'),
('EVT-105', 'TRD-92831', '2026-08-09 11:48:12', 'INTERNAL_ALERT', 'CRITICAL_RISK_FLAGGED', 'ClearSet Risk Engine flagged trade with Deterministic Score: 91/100 (CRITICAL). Escalation workflow primed.', 'CLEARSET_AGENT');

-- ----------------------------------------------------------------------------
-- 6. SEED EXCEPTIONS & RISK LOGS (CORRECTED - Using SELECT/UNION ALL)
-- ----------------------------------------------------------------------------
INSERT INTO EXCEPTIONS (
    EXCEPTION_ID, TRADE_ID, SEVERITY, STATUS, 
    EXCEPTION_TYPE, RISK_SCORE, RISK_BREAKDOWN_JSON
)
SELECT 'EX-92831', 'TRD-92831', 'CRITICAL', 'OPEN', 'Missing Instruction', 91, PARSE_JSON('{"missing_instruction": 25, "cutoff_urgency": 25, "trade_value": 20, "cp_failures": 15, "historical_precedents": 6}')
UNION ALL
SELECT 'EX-81232', 'TRD-81232', 'CRITICAL', 'INVESTIGATING', 'Cash Discrepancy', 89, PARSE_JSON('{"mismatch_instruction": 18, "cutoff_urgency": 25, "trade_value": 20, "cp_failures": 15, "historical_precedents": 11}')
UNION ALL
SELECT 'EX-71292', 'TRD-71292', 'CRITICAL', 'OPEN', 'Missing Instruction', 86, PARSE_JSON('{"missing_instruction": 25, "cutoff_urgency": 25, "trade_value": 15, "cp_failures": 15, "historical_precedents": 6}')
UNION ALL
SELECT 'EX-65419', 'TRD-65419', 'HIGH', 'OPEN', 'Cash Discrepancy', 73, PARSE_JSON('{"mismatch_instruction": 18, "cutoff_urgency": 25, "trade_value": 20, "cp_failures": 10}')
UNION ALL
SELECT 'EX-54210', 'TRD-54210', 'HIGH', 'OPEN', 'Instruction Pending', 65, PARSE_JSON('{"pending_instruction": 10, "cutoff_urgency": 15, "trade_value": 20, "cp_failures": 10, "historical_precedents": 10}');

-- ----------------------------------------------------------------------------
-- 7. SEED HISTORICAL CASES (Institutional Memory & Playbooks)
-- ----------------------------------------------------------------------------
INSERT INTO HISTORICAL_CASES (
    HISTORICAL_CASE_ID, ORIGINAL_TRADE_ID, CASE_DATE, CP_ID, 
    ROOT_CAUSE, APPLIED_PROCEDURE, RESOLUTION_STRATEGY, 
    TIME_TO_RESOLVE_HOURS, OUTCOME, CSDR_PENALTY_AVOIDED
)
VALUES
('INV-2026-00412', 'TRD-77821', '2026-07-28', 'CP-192', 'Missing DTC subaccount SSI on high-value US Equities DVP trade ($3.1M)', 'Settlement Exception SOP §3.2 (Expedited SSI Repair)', 'Dispatched automated SSI repair request to CP-192 Operations desk + early escalation', 1.2, 'RESOLVED_SUCCESS', 14500.00),
('INV-2026-00389', 'TRD-76504', '2026-07-22', 'CP-192', 'Unconfirmed standing settlement instruction approaching 90m cutoff on MSFT trade ($2.2M)', 'Settlement Exception SOP §3.2 & Counterparty Escalation Policy §2.1', 'Direct phone escalation to CP-192 desk lead; manual depository override affirmed', 1.5, 'RESOLVED_SUCCESS', 9800.00),
('INV-2026-00311', 'TRD-71092', '2026-07-15', 'CP-192', 'Missing SSI not addressed until 15 mins prior to cutoff; counterparty failed to reply in time', 'Settlement Exception SOP §4.1 (Post-Cutoff Fail Logging)', 'No early escalation initiated; trade failed at DTC end of day', 24.0, 'FAILED_SETTLEMENT', 0.00),
('INV-2026-00288', 'TRD-68912', '2026-07-09', 'CP-192', 'Missing custodian account mapping for DTC Participant 0244 on NVDA trade ($2.8M)', 'Settlement Exception SOP §3.2', 'Dispatched expedited SWIFT MT599 repair notification; affirmed in 45m', 0.8, 'RESOLVED_SUCCESS', 18200.00),
('INV-2026-00245', 'TRD-64102', '2026-06-30', 'CP-192', 'Cash correspondent BIC variance on AAPL DVP delivery ($1.9M)', 'Settlement Exception SOP §2.4', 'Auto-adjusted cash tolerance threshold under operations discretionary ledger', 0.5, 'RESOLVED_SUCCESS', 6400.00);