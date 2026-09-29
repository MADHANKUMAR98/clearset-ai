import os
import subprocess
import sys
import tempfile

CONNECTION = os.environ.get("CLEARSET_CONNECTION", "clearset-hack")


def run_sql(sql, desc):
    with tempfile.NamedTemporaryFile(mode="w", suffix=".sql", delete=False, encoding="utf-8") as f:
        f.write(sql)
        path = f.name
    try:
        result = subprocess.run(
            ["snow", "sql", "-f", path, "--connection", CONNECTION, "--format", "csv"],
            capture_output=True, text=True, timeout=300,
        )
        out = (result.stdout or "") + (result.stderr or "")
        if result.returncode != 0:
            print("FAIL " + desc)
            print(out)
            sys.exit(1)
        print("OK   " + desc)
        return out
    finally:
        os.unlink(path)


# ---------------------------------------------------------------------------
# 1) REMOVE DUPLICATE MASTER ROWS
#    SECURITIES and COUNTERPARTIES were inserted twice (chunk1/chunk2 ran
#    twice), so V_EXCEPTIONS_ENRICHED fanned every exception out 2x2 = 4 rows.
#    Keep the newest copy of each key inside a transaction.
# ---------------------------------------------------------------------------
run_sql("""
USE DATABASE CLEARSET_DB;
USE SCHEMA CLEARSET_SCHEMA;
BEGIN;
CREATE OR REPLACE TEMP TABLE _SEC_KEEP AS
SELECT ISIN, CUSIP, TICKER, NAME, ASSET_CLASS, DEPOSITORY, MARKET_TIER
FROM SECURITIES
QUALIFY ROW_NUMBER() OVER (PARTITION BY ISIN ORDER BY UPDATED_AT DESC) = 1;
DELETE FROM SECURITIES;
INSERT INTO SECURITIES (ISIN, CUSIP, TICKER, NAME, ASSET_CLASS, DEPOSITORY, MARKET_TIER)
SELECT ISIN, CUSIP, TICKER, NAME, ASSET_CLASS, DEPOSITORY, MARKET_TIER FROM _SEC_KEEP;
COMMIT;
""", "Dedupe SECURITIES (keep 1 row per ISIN)")

run_sql("""
USE DATABASE CLEARSET_DB;
USE SCHEMA CLEARSET_SCHEMA;
BEGIN;
CREATE OR REPLACE TEMP TABLE _CP_KEEP AS
SELECT CP_ID, NAME, BIC, LEI, CREDIT_RATING, PRIOR_FAILURES_30D, TOTAL_TRADES_TODAY,
       HISTORICAL_FAIL_RATE, AVG_RESOLUTION_HOURS, PRIMARY_DESK_CONTACT, PRIMARY_EMAIL
FROM COUNTERPARTIES
QUALIFY ROW_NUMBER() OVER (PARTITION BY CP_ID ORDER BY UPDATED_AT DESC) = 1;
DELETE FROM COUNTERPARTIES;
INSERT INTO COUNTERPARTIES (CP_ID, NAME, BIC, LEI, CREDIT_RATING, PRIOR_FAILURES_30D,
    TOTAL_TRADES_TODAY, HISTORICAL_FAIL_RATE, AVG_RESOLUTION_HOURS, PRIMARY_DESK_CONTACT, PRIMARY_EMAIL)
SELECT CP_ID, NAME, BIC, LEI, CREDIT_RATING, PRIOR_FAILURES_30D, TOTAL_TRADES_TODAY,
       HISTORICAL_FAIL_RATE, AVG_RESOLUTION_HOURS, PRIMARY_DESK_CONTACT, PRIMARY_EMAIL FROM _CP_KEEP;
COMMIT;
""", "Dedupe COUNTERPARTIES (keep 1 row per CP_ID)")

# ---------------------------------------------------------------------------
# 2) RESTORE MISSING SEED SECURITIES (AAPL / UST10Y / NVDA / MSFT / TSLA)
#    Without these, 8 exceptions drop out of V_EXCEPTIONS_ENRICHED (INNER JOIN).
# ---------------------------------------------------------------------------
run_sql("""
USE DATABASE CLEARSET_DB;
USE SCHEMA CLEARSET_SCHEMA;
INSERT INTO SECURITIES (ISIN, CUSIP, TICKER, NAME, ASSET_CLASS, DEPOSITORY, MARKET_TIER)
SELECT v.ISIN, v.CUSIP, v.TICKER, v.NAME, v.ASSET_CLASS, v.DEPOSITORY, v.MARKET_TIER
FROM VALUES
  ('US0378331005', '037833100', 'AAPL', 'Apple Inc. Common Stock', 'Equities', 'DTC', 'NASDAQ Global Select'),
  ('US912828ZG64', '912828ZG6', 'UST10Y', 'US Treasury 4.25% Due 2034', 'Fixed Income', 'Fedwire', 'US Government'),
  ('US67066G1040', '67066G104', 'NVDA', 'NVIDIA Corp Common Stock', 'Equities', 'DTC', 'NASDAQ Global Select'),
  ('US5949181045', '594918104', 'MSFT', 'Microsoft Corp Common Stock', 'Equities', 'DTC', 'NASDAQ Global Select'),
  ('US88160R1014', '88160R101', 'TSLA', 'Tesla Inc. Common Stock', 'Equities', 'DTC', 'NASDAQ Global Select')
AS v(ISIN, CUSIP, TICKER, NAME, ASSET_CLASS, DEPOSITORY, MARKET_TIER)
WHERE NOT EXISTS (SELECT 1 FROM SECURITIES s WHERE s.ISIN = v.ISIN);
""", "Restore 5 seed SECURITIES")

# ---------------------------------------------------------------------------
# 3) RESTORE SEED TRADES (hero trade TRD-92831 + 4 others)
# ---------------------------------------------------------------------------
run_sql("""
USE DATABASE CLEARSET_DB;
USE SCHEMA CLEARSET_SCHEMA;
INSERT INTO TRADES (TRADE_ID, ISIN, CP_ID, TRADE_DATE, SETTLEMENT_DATE, SETTLEMENT_TYPE,
    TRADE_VALUE, QUANTITY, PRICE, CURRENCY, BOOKING_DESK, TRADER_REF,
    SETTLEMENT_STATUS, INSTRUCTION_STATUS, CUTOFF_TIME)
SELECT v.TRADE_ID, v.ISIN, v.CP_ID, v.TRADE_DATE, v.SETTLEMENT_DATE, v.SETTLEMENT_TYPE,
    v.TRADE_VALUE, v.QUANTITY, v.PRICE, v.CURRENCY, v.BOOKING_DESK, v.TRADER_REF,
    v.SETTLEMENT_STATUS, v.INSTRUCTION_STATUS, v.CUTOFF_TIME
FROM VALUES
  ('TRD-92831', 'US0378331005', 'CP-192', '2026-08-09 09:32:00', '2026-08-09', 'DVP', 2400000.00, 12000, 200.00, 'USD', 'US Institutional Equities', 'TR-8821 (Alex Mercer)', 'PENDING', 'MISSING', '2026-08-09 15:30:00'),
  ('TRD-81232', 'US912828ZG64', 'CP-104', '2026-08-09 08:15:00', '2026-08-09', 'DVP', 8100000.00, 80000, 101.25, 'USD', 'Rates & Sovereign Debt', 'TR-4192 (Sarah Lin)', 'PENDING', 'MISMATCHED', '2026-08-09 15:00:00'),
  ('TRD-71292', 'US67066G1040', 'CP-088', '2026-08-09 09:45:00', '2026-08-09', 'DVP', 1200000.00, 10000, 120.00, 'USD', 'Tech Sector Trading Desk', 'TR-7719 (Jason Vance)', 'PENDING', 'MISSING', '2026-08-09 15:30:00'),
  ('TRD-65419', 'US5949181045', 'CP-210', '2026-08-09 09:05:00', '2026-08-09', 'DVP', 3750000.00, 8500, 441.17, 'USD', 'US Institutional Equities', 'TR-3301 (David Miller)', 'PENDING', 'MISMATCHED', '2026-08-09 15:30:00'),
  ('TRD-54210', 'US88160R1014', 'CP-115', '2026-08-09 10:11:00', '2026-08-09', 'DVP', 4500000.00, 18000, 250.00, 'USD', 'High Beta Growth Desk', 'TR-9122 (Emily Zhao)', 'PENDING', 'PENDING', '2026-08-09 16:00:00')
AS v(TRADE_ID, ISIN, CP_ID, TRADE_DATE, SETTLEMENT_DATE, SETTLEMENT_TYPE, TRADE_VALUE,
     QUANTITY, PRICE, CURRENCY, BOOKING_DESK, TRADER_REF, SETTLEMENT_STATUS, INSTRUCTION_STATUS, CUTOFF_TIME)
WHERE NOT EXISTS (SELECT 1 FROM TRADES t WHERE t.TRADE_ID = v.TRADE_ID);
""", "Restore 5 seed TRADES (incl. hero TRD-92831)")

# ---------------------------------------------------------------------------
# 4) RESTORE SEED SETTLEMENT INSTRUCTIONS
# ---------------------------------------------------------------------------
run_sql("""
USE DATABASE CLEARSET_DB;
USE SCHEMA CLEARSET_SCHEMA;
INSERT INTO SETTLEMENT_INSTRUCTIONS (INSTRUCTION_ID, TRADE_ID, SETTLEMENT_TYPE, CUSTODIAN_BIC,
    DEPOSITORY, CASH_ACCOUNT, SECURITIES_ACCOUNT, STATUS, MISMATCH_DETAILS)
SELECT v.INSTRUCTION_ID, v.TRADE_ID, v.SETTLEMENT_TYPE, v.CUSTODIAN_BIC, v.DEPOSITORY,
    v.CASH_ACCOUNT, v.SECURITIES_ACCOUNT, v.STATUS, v.MISMATCH_DETAILS
FROM VALUES
  ('SSI-92831', 'TRD-92831', 'DVP', 'APEXUS33XXX', 'DTC (Participant 0244)', 'MISSING_SUBACCOUNT_REF', 'MISSING_DTC_SUBID', 'MISSING', 'DTC Participant ID 0244 provided without linked cash settlement affirmation subaccount. Standing instructions missing for market tier NASDAQ.'),
  ('SSI-81232', 'TRD-81232', 'DVP', 'VANGUS33XXX', 'Fedwire / BNY Mellon', 'CASH-FED-992182', 'SEC-FED-002194', 'MISMATCHED', 'Cash amount mismatch: Ticket states $8,100,000.00; Fedwire affirmation message states $8,095,450.00 (Variance: -$4,550.00 accrued coupon interest mismatch).'),
  ('SSI-71292', 'TRD-71292', 'DVP', 'GSEXUS33XXX', 'DTC (Participant 0012)', 'MISSING_CASH_SUB', 'SEC-DTC-77192', 'MISSING', 'Custodian subaccount unmapped for DTC equities clearing window.'),
  ('SSI-65419', 'TRD-65419', 'DVP', 'CITDUS33XXX', 'DTC (Participant 0510)', 'CASH-DTC-881920', 'SEC-DTC-992184', 'MISMATCHED', 'Securities depository participant BIC mismatch on trade allocation.'),
  ('SSI-54210', 'TRD-54210', 'DVP', 'MSNYUS33XXX', 'DTC (Participant 0015)', 'CASH-MS-221948', 'SEC-MS-441920', 'PENDING', 'Instruction dispatched to DTC matching utility; unconfirmed by counterparty custodian.')
AS v(INSTRUCTION_ID, TRADE_ID, SETTLEMENT_TYPE, CUSTODIAN_BIC, DEPOSITORY, CASH_ACCOUNT,
     SECURITIES_ACCOUNT, STATUS, MISMATCH_DETAILS)
WHERE NOT EXISTS (SELECT 1 FROM SETTLEMENT_INSTRUCTIONS s WHERE s.INSTRUCTION_ID = v.INSTRUCTION_ID);
""", "Restore 5 seed SETTLEMENT_INSTRUCTIONS")

# ---------------------------------------------------------------------------
# 5) RESTORE SEED SWIFT EVENTS (TRD-92831 audit trail)
# ---------------------------------------------------------------------------
run_sql("""
USE DATABASE CLEARSET_DB;
USE SCHEMA CLEARSET_SCHEMA;
INSERT INTO SETTLEMENT_EVENTS (EVENT_ID, TRADE_ID, EVENT_TIMESTAMP, MESSAGE_TYPE, STATUS, DESCRIPTION, SOURCE)
SELECT v.EVENT_ID, v.TRADE_ID, v.EVENT_TIMESTAMP, v.MESSAGE_TYPE, v.STATUS, v.DESCRIPTION, v.SOURCE
FROM VALUES
  ('EVT-101', 'TRD-92831', '2026-08-09 09:32:00', 'INTERNAL_ALERT', 'TRADE_BOOKED', 'Trade booked by Equities Desk TR-8821: Buy 12,000 AAPL @ $200.00 ($2.4M DVP).', 'MATCHING_ENGINE'),
  ('EVT-102', 'TRD-92831', '2026-08-09 09:32:05', 'SWIFT MT541', 'SSI_LOOKUP_INITIATED', 'Automated SSI engine queried Alert master repository for CP-192 / DTC Participant 0244.', 'MATCHING_ENGINE'),
  ('EVT-103', 'TRD-92831', '2026-08-09 09:32:15', 'SWIFT MT548', 'SSI_NOT_FOUND', 'Depository lookup returned status: No valid standing settlement instruction found for subaccount. Exception flag raised.', 'DEPOSITORY'),
  ('EVT-104', 'TRD-92831', '2026-08-09 11:45:00', 'INTERNAL_ALERT', 'CUTOFF_WARNING_T120', 'Depository cutoff threshold warning: 120 minutes remaining before 15:30 EST DTC intraday cycle cutoff.', 'CLEARSET_AGENT'),
  ('EVT-105', 'TRD-92831', '2026-08-09 11:48:12', 'INTERNAL_ALERT', 'CRITICAL_RISK_FLAGGED', 'ClearSet Risk Engine flagged trade with Deterministic Score: 91/100 (CRITICAL). Escalation workflow primed.', 'CLEARSET_AGENT')
AS v(EVENT_ID, TRADE_ID, EVENT_TIMESTAMP, MESSAGE_TYPE, STATUS, DESCRIPTION, SOURCE)
WHERE NOT EXISTS (SELECT 1 FROM SETTLEMENT_EVENTS e WHERE e.EVENT_ID = v.EVENT_ID);
""", "Restore 5 seed SETTLEMENT_EVENTS for TRD-92831")

# ---------------------------------------------------------------------------
# 6) RESTORE SEED EXCEPTIONS (PARSE_JSON via SELECT/UNION ALL)
# ---------------------------------------------------------------------------
run_sql("""
USE DATABASE CLEARSET_DB;
USE SCHEMA CLEARSET_SCHEMA;
INSERT INTO EXCEPTIONS (EXCEPTION_ID, TRADE_ID, SEVERITY, STATUS, EXCEPTION_TYPE,
    RISK_SCORE, RISK_BREAKDOWN_JSON, DETECTED_AT, ASSIGNED_ANALYST)
SELECT * FROM (
  SELECT 'EX-92831', 'TRD-92831', 'CRITICAL', 'OPEN', 'Missing Instruction', 91,
         PARSE_JSON('{"missing_instruction": 25, "cutoff_urgency": 25, "trade_value": 20, "cp_failures": 15, "historical_precedents": 6}'),
         '2026-08-09 09:33:00'::TIMESTAMP_NTZ, 'J. Whitfield'
  UNION ALL SELECT 'EX-81232', 'TRD-81232', 'CRITICAL', 'INVESTIGATING', 'Cash Discrepancy', 89,
         PARSE_JSON('{"mismatch_instruction": 18, "cutoff_urgency": 25, "trade_value": 20, "cp_failures": 15, "historical_precedents": 11}'),
         '2026-08-09 08:16:00'::TIMESTAMP_NTZ, 'R. Castellanos'
  UNION ALL SELECT 'EX-71292', 'TRD-71292', 'CRITICAL', 'OPEN', 'Missing Instruction', 86,
         PARSE_JSON('{"missing_instruction": 25, "cutoff_urgency": 25, "trade_value": 15, "cp_failures": 15, "historical_precedents": 6}'),
         '2026-08-09 09:46:00'::TIMESTAMP_NTZ, 'K. Osei'
  UNION ALL SELECT 'EX-65419', 'TRD-65419', 'HIGH', 'OPEN', 'Cash Discrepancy', 73,
         PARSE_JSON('{"mismatch_instruction": 18, "cutoff_urgency": 25, "trade_value": 20, "cp_failures": 10}'),
         '2026-08-09 09:06:00'::TIMESTAMP_NTZ, 'A. Fontaine'
  UNION ALL SELECT 'EX-54210', 'TRD-54210', 'HIGH', 'OPEN', 'Instruction Pending', 65,
         PARSE_JSON('{"pending_instruction": 10, "cutoff_urgency": 15, "trade_value": 20, "cp_failures": 10, "historical_precedents": 10}'),
         '2026-08-09 10:12:00'::TIMESTAMP_NTZ, NULL
) v(EXCEPTION_ID, TRADE_ID, SEVERITY, STATUS, EXCEPTION_TYPE, RISK_SCORE, RISK_BREAKDOWN_JSON, DETECTED_AT, ASSIGNED_ANALYST)
WHERE NOT EXISTS (SELECT 1 FROM EXCEPTIONS x WHERE x.EXCEPTION_ID = v.EXCEPTION_ID);
""", "Restore 5 seed EXCEPTIONS")

# ---------------------------------------------------------------------------
# 7) RE-DATE NON-PROTECTED TRADES SO COUNTDOWNS LOOK LIVE
#    (TRD-92831 / TRD-81232 are protected and intentionally untouched.)
# ---------------------------------------------------------------------------
with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "snowflake", "10_refresh_demo_dates.sql"), encoding="utf-8") as f:
    run_sql(f.read(), "Refresh demo dates (non-protected trades)")

# ---------------------------------------------------------------------------
# 8) VERIFICATION
# ---------------------------------------------------------------------------
out = run_sql("""
SELECT 'EXCEPTIONS_TABLE' AS CHECK_NAME, COUNT(*) AS N FROM CLEARSET_DB.CLEARSET_SCHEMA.EXCEPTIONS
UNION ALL SELECT 'VIEW_ROWS', COUNT(*) FROM CLEARSET_DB.CLEARSET_SCHEMA.V_EXCEPTIONS_ENRICHED
UNION ALL SELECT 'VIEW_DISTINCT_EXCEPTIONS', COUNT(DISTINCT EXCEPTION_ID) FROM CLEARSET_DB.CLEARSET_SCHEMA.V_EXCEPTIONS_ENRICHED
UNION ALL SELECT 'SECURITIES', COUNT(*) FROM CLEARSET_DB.CLEARSET_SCHEMA.SECURITIES
UNION ALL SELECT 'SECURITIES_DISTINCT', COUNT(DISTINCT ISIN) FROM CLEARSET_DB.CLEARSET_SCHEMA.SECURITIES
UNION ALL SELECT 'COUNTERPARTIES', COUNT(*) FROM CLEARSET_DB.CLEARSET_SCHEMA.COUNTERPARTIES
UNION ALL SELECT 'COUNTERPARTIES_DISTINCT', COUNT(DISTINCT CP_ID) FROM CLEARSET_DB.CLEARSET_SCHEMA.COUNTERPARTIES
UNION ALL SELECT 'TRADES', COUNT(*) FROM CLEARSET_DB.CLEARSET_SCHEMA.TRADES
UNION ALL SELECT 'HERO_TRADE_92831', COUNT(*) FROM CLEARSET_DB.CLEARSET_SCHEMA.TRADES WHERE TRADE_ID = 'TRD-92831'
UNION ALL SELECT 'TRADES_WITHOUT_SECURITY', COUNT(*) FROM CLEARSET_DB.CLEARSET_SCHEMA.TRADES T
    LEFT JOIN CLEARSET_DB.CLEARSET_SCHEMA.SECURITIES S ON T.ISIN = S.ISIN WHERE S.ISIN IS NULL;
""", "Verification")

print(out)
print("=== REPAIR COMPLETE ===")
