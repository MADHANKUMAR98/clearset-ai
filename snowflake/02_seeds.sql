-- ============================================================================
-- CLEARSET AI — SYNTHETIC DATA SEEDS
-- ============================================================================

USE DATABASE CLEARSET_DB;
USE SCHEMA CLEARSET_SCHEMA;

-- 1. SEED COUNTERPARTIES
INSERT INTO COUNTERPARTIES (CP_ID, NAME, BIC, LEI, CREDIT_RATING, PRIOR_FAILURES_30D, TOTAL_TRADES_TODAY, HISTORICAL_FAIL_RATE, AVG_RESOLUTION_HOURS, PRIMARY_DESK_CONTACT, PRIMARY_EMAIL)
VALUES
('CP-192', 'Apex Prime Clearing Ltd.', 'APEXUS33XXX', '5493006MHB84DD0Z4J21', 'A', 7, 84, 8.4, 4.2, 'Marcus Vance (Equities Desk NY)', 'settlements.desk@apexclearing.com'),
('CP-104', 'Vanguard Global Markets', 'VANGUS33XXX', '54930089K8L62NNX8211', 'AAA', 6, 210, 4.1, 2.8, 'Sarah Jenkins (Rates & Sovereign)', 'posttrade@vanguardmarkets.com'),
('CP-088', 'Goldman Execution Services', 'GSEXUS33XXX', 'W22LROWP2IHZNBB6K528', 'AA+', 5, 340, 3.2, 2.1, 'David Sterling (Institutional NY)', 'ops-escalations@gs.com'),
('CP-210', 'Citadel Custody & Clearing', 'CITDUS33XXX', '549300H287LKNM882199', 'AA', 4, 195, 3.8, 2.5, 'Elena Rostova (Settlement Support)', 'settlement-control@citadel.com'),
('CP-115', 'Morgan Stanley Prime Ops', 'MSNYUS33XXX', '4PQUHN3V0GFWSCYVVQ11', 'AA', 3, 160, 2.9, 1.9, 'Robert Chen (Equities Ops)', 'ms-settlements-team@morganstanley.com');

-- 2. SEED SECURITIES
INSERT INTO SECURITIES (ISIN, CUSIP, TICKER, NAME, ASSET_CLASS, DEPOSITORY, MARKET_TIER)
VALUES
('US0378331005', '037833100', 'AAPL', 'Apple Inc. Common Stock', 'Equities', 'DTC', 'NASDAQ Global Select'),
('US912828ZG64', '912828ZG6', 'UST10Y', 'US Treasury 4.25% Due 2034', 'Fixed Income', 'Fedwire', 'US Government'),
('US67066G1040', '67066G104', 'NVDA', 'NVIDIA Corp Common Stock', 'Equities', 'DTC', 'NASDAQ Global Select'),
('US5949181045', '594918104', 'MSFT', 'Microsoft Corp Common Stock', 'Equities', 'DTC', 'NASDAQ Global Select'),
('US88160R1014', '88160R101', 'TSLA', 'Tesla Inc. Common Stock', 'Equities', 'DTC', 'NASDAQ Global Select');

-- 3. SEED TRADES
INSERT INTO TRADES (TRADE_ID, ISIN, CP_ID, TRADE_DATE, SETTLEMENT_DATE, SETTLEMENT_TYPE, TRADE_VALUE, QUANTITY, PRICE, CURRENCY, BOOKING_DESK, TRADER_REF, SETTLEMENT_STATUS, INSTRUCTION_STATUS, CUTOFF_TIME)
VALUES
('TRD-92831', 'US0378331005', 'CP-192', '2026-08-09 09:32:00', '2026-08-09', 'DVP', 2400000.00, 12000, 200.00, 'USD', 'US Institutional Equities', 'TR-8821', 'PENDING', 'MISSING', '2026-08-09 15:30:00'),
('TRD-81232', 'US912828ZG64', 'CP-104', '2026-08-09 08:15:00', '2026-08-09', 'DVP', 8100000.00, 80000, 101.25, 'USD', 'Rates & Sovereign Debt', 'TR-4192', 'PENDING', 'MISMATCHED', '2026-08-09 15:00:00'),
('TRD-71292', 'US67066G1040', 'CP-088', '2026-08-09 09:45:00', '2026-08-09', 'DVP', 1200000.00, 10000, 120.00, 'USD', 'Tech Sector Trading Desk', 'TR-7719', 'PENDING', 'MISSING', '2026-08-09 15:30:00');

-- 4. SEED SETTLEMENT INSTRUCTIONS
INSERT INTO SETTLEMENT_INSTRUCTIONS (INSTRUCTION_ID, TRADE_ID, SETTLEMENT_TYPE, CUSTODIAN_BIC, DEPOSITORY, CASH_ACCOUNT, SECURITIES_ACCOUNT, STATUS, MISMATCH_DETAILS)
VALUES
('SSI-92831', 'TRD-92831', 'DVP', 'APEXUS33XXX', 'DTC (Participant 0244)', 'MISSING_SUBACCOUNT_REF', 'MISSING_DTC_SUBID', 'MISSING', 'DTC Participant ID 0244 provided without linked cash settlement affirmation subaccount.'),
('SSI-81232', 'TRD-81232', 'DVP', 'VANGUS33XXX', 'Fedwire / BNY Mellon', 'CASH-FED-992182', 'SEC-FED-002194', 'MISMATCHED', 'Variance -$4,550.00 accrued coupon interest mismatch.');

-- 5. SEED EXCEPTIONS
INSERT INTO EXCEPTIONS (EXCEPTION_ID, TRADE_ID, SEVERITY, STATUS, EXCEPTION_TYPE, RISK_SCORE, RISK_BREAKDOWN_JSON)
VALUES
('EX-92831', 'TRD-92831', 'CRITICAL', 'OPEN', 'Missing Instruction', 91, PARSE_JSON('{"missing_instruction": 25, "cutoff_urgency": 25, "trade_value": 20, "cp_failures": 15, "historical_precedents": 6}')),
('EX-81232', 'TRD-81232', 'CRITICAL', 'INVESTIGATING', 'Cash Discrepancy', 89, PARSE_JSON('{"mismatch_instruction": 18, "cutoff_urgency": 25, "trade_value": 20, "cp_failures": 15, "historical_precedents": 11}'));

-- 6. SEED HISTORICAL CASES
INSERT INTO HISTORICAL_CASES (HISTORICAL_CASE_ID, ORIGINAL_TRADE_ID, CASE_DATE, CP_ID, ROOT_CAUSE, APPLIED_PROCEDURE, RESOLUTION_STRATEGY, TIME_TO_RESOLVE_HOURS, OUTCOME, CSDR_PENALTY_AVOIDED)
VALUES
('INV-2026-00412', 'TRD-77821', '2026-07-28', 'CP-192', 'Missing DTC subaccount SSI on high-value US Equities DVP trade ($3.1M)', 'Settlement Exception SOP §3.2', 'Dispatched automated SWIFT MT599 repair notification + early escalation', 1.2, 'RESOLVED_SUCCESS', 14500.00),
('INV-2026-00389', 'TRD-76504', '2026-07-22', 'CP-192', 'Unconfirmed standing settlement instruction approaching 90m cutoff', 'Settlement Exception SOP §3.2 & Counterparty Policy §2.1', 'Direct phone escalation to CP-192 desk lead; manual override affirmed', 1.5, 'RESOLVED_SUCCESS', 9800.00),
('INV-2026-00311', 'TRD-71092', '2026-07-15', 'CP-192', 'Missing SSI not addressed until 15 mins prior to cutoff', 'Settlement Exception SOP §4.1', 'No early escalation initiated; trade failed at DTC end of day', 24.0, 'FAILED_SETTLEMENT', 0.00);
