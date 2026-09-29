import subprocess
import os
import tempfile

# Target connection in ~/.snowflake/connections.toml.
# Point at another account with:  CLEARSET_CONNECTION=<name> python migrate_all.py
CONNECTION = os.environ.get("CLEARSET_CONNECTION", "clearset-hack")

def run_sql(sql_content, desc):
    with tempfile.NamedTemporaryFile(mode='w', suffix='.sql', delete=False, encoding='utf-8') as f:
        f.write(sql_content)
        temp_path = f.name

    try:
        result = subprocess.run(
            ['snow', 'sql', '-f', temp_path, '--connection', CONNECTION, '--format', 'csv'],
            capture_output=True, text=True, timeout=300
        )
        if result.returncode == 0:
            print(f"âœ“ {desc}")
            return result.stdout
        else:
            print(f"âœ— {desc}: {result.stderr}")
            raise Exception(result.stderr)
    finally:
        os.unlink(temp_path)


def already_loaded(marker_sql):
    """Return True when the marker row already exists (section was run before)."""
    out = run_sql(marker_sql, "guard check")
    for line in out.splitlines():
        line = line.strip()
        if not line or line.upper().startswith('K,N') or 'CHECK_NAME' in line.upper():
            continue
        try:
            return int(line.split(',')[-1]) > 0
        except ValueError:
            continue
    return False


def run_insert_once(marker_sql, sql_content, desc):
    if already_loaded(marker_sql):
        print(f"- SKIP {desc} (already present)")
        return
    run_sql(sql_content, desc)


# ===== COUNTERPARTIES (8 rows -> running total 13) =====
run_insert_once("""SELECT COUNT(*) AS N FROM CLEARSET_DB.CLEARSET_SCHEMA.COUNTERPARTIES WHERE CP_ID = 'CP-301';""", """
USE DATABASE CLEARSET_DB;
USE SCHEMA CLEARSET_SCHEMA;
INSERT INTO COUNTERPARTIES (CP_ID, NAME, BIC, LEI, CREDIT_RATING, PRIOR_FAILURES_30D, TOTAL_TRADES_TODAY, HISTORICAL_FAIL_RATE, AVG_RESOLUTION_HOURS, PRIMARY_DESK_CONTACT, PRIMARY_EMAIL) VALUES
('CP-301', 'Northgate Brokerage Services', 'NGTBUS33XXX', '549300A1B2C3DEF4G5H6', 'A-', 2, 45, 2.4, 3.1, 'Priya Nair (Client Settlements)', 'settlements@northgatebrokerage.com'),
('CP-302', 'Helios Capital Markets', 'HLIOGB2LXXX', '213800ABCDEF12GH34IK', 'AA-', 9, 120, 6.7, 5.4, 'Tom Bradley (EMEA Operations London)', 'emea.settlements@helioscap.com'),
('CP-303', 'Meridian Trust Bank', 'MERIUS33XXX', '549300Z9Y8X7W6V5U4T3', 'A', 1, 260, 1.2, 1.6, 'Grace Kim (US Settlements)', 'ops@meridiantrust.com'),
('CP-304', 'Ironwood Securities', 'IRWDUS33XXX', '549300QWERT123ASDF45', 'BBB+', 12, 75, 11.3, 8.9, 'Luis Ortega (Middle Office)', 'middle-office@ironwoodsec.com'),
('CP-305', 'Blue Harbor Asset Management', 'BLHAJPJTXXX', '9876543210ZXCVBNM12', 'A+', 3, 58, 3.5, 2.7, 'Kenji Watanabe (APAC Settlements)', 'apac-ops@blueharbor.co.jp'),
('CP-306', 'Redstone Clearing Group', 'RDSTUS44XXX', '549300PLKMNO987IJH6', 'BB+', 15, 91, 14.8, 10.2, 'Dana Whitfield (Settlement Recovery)', 'escalations@redstoneclearing.com'),
('CP-307', 'Silverpine Markets', 'SVPMGB22XXX', '213800QAZWSXEDCRFVT', 'AA', 2, 143, 1.9, 2.2, 'Amelia Hart (UK Client Operations)', 'uk-settlements@silverpinemarkets.com'),
('CP-308', 'Kestrel Prime Services', 'KESTUS33XXX', '549300TGBRFYHNUJMI87', 'BBB', 8, 66, 7.6, 6.1, 'Victor Osei (Prime Brokerage Ops)', 'pb-settlements@kestrelprime.com');
""", "Counterparties (8 rows)")

# ===== SECURITIES =====
run_insert_once("""SELECT COUNT(*) AS N FROM CLEARSET_DB.CLEARSET_SCHEMA.SECURITIES WHERE ISIN = 'US02079K1079';""", """
USE DATABASE CLEARSET_DB;
USE SCHEMA CLEARSET_SCHEMA;
INSERT INTO SECURITIES (ISIN, CUSIP, TICKER, NAME, ASSET_CLASS, DEPOSITORY, MARKET_TIER) VALUES
('US02079K1079', '02079K107', 'GOOGL', 'Alphabet Inc. Class A Common Stock', 'Equities', 'DTC', 'NASDAQ Global Select'),
('US0231351067', '023135106', 'AMZN', 'Amazon.com Inc. Common Stock', 'Equities', 'DTC', 'NASDAQ Global Select'),
('US4581401001', '458140100', 'INTC', 'Intel Corp Common Stock', 'Equities', 'DTC', 'NASDAQ Global Select'),
('US4781601046', '478160104', 'JPM', 'JPMorgan Chase and Co. Common Stock', 'Equities', 'DTC', 'NYSE'),
('US68389X1054', '68389X105', 'ORCL', 'Oracle Corp Common Stock', 'Equities', 'DTC', 'NYSE'),
('US912810TZ97', '912810TZ9', 'UST30Y', 'US Treasury 4.75% Due 2054', 'Fixed Income', 'Fedwire', 'US Government'),
('US459200KS21', '459200KS2', 'IBMCORP', 'IBM Corp 5.0% Notes Due 2033', 'Corporate Bond', 'Fedwire', 'IG Corporates'),
('US78462F1030', '78462F103', 'SPY', 'SPDR S and P 500 ETF Trust', 'ETF', 'DTC', 'NYSE Arca');
""", "Securities (8 rows)")

# ===== TRADES (30 rows) =====
run_insert_once("""SELECT COUNT(*) AS N FROM CLEARSET_DB.CLEARSET_SCHEMA.TRADES WHERE TRADE_ID = 'TRD-90001';""", """
USE DATABASE CLEARSET_DB;
USE SCHEMA CLEARSET_SCHEMA;
INSERT INTO TRADES (TRADE_ID, ISIN, CP_ID, TRADE_DATE, SETTLEMENT_DATE, SETTLEMENT_TYPE, TRADE_VALUE, QUANTITY, PRICE, CURRENCY, BOOKING_DESK, TRADER_REF, SETTLEMENT_STATUS, INSTRUCTION_STATUS, CUTOFF_TIME) VALUES
('TRD-90001', 'US02079K1079', 'CP-301', '2026-08-10 09:12:00', '2026-08-11', 'DVP', 3250000.00, 25000, 130.0000, 'USD', 'US Institutional Equities', 'TR-5501 (Omar Haddad)', 'PENDING', 'MISSING', '2026-08-11 15:30:00'),
('TRD-90002', 'US912810TZ97', 'CP-302', '2026-08-10 08:05:00', '2026-08-11', 'DVP', 12500004.00, 120000, 104.1667, 'USD', 'Rates & Sovereign Debt', 'TR-5508 (Nina Kovac)', 'SETTLED', 'AFFIRMED', '2026-08-11 15:00:00'),
('TRD-90003', 'US78462F1030', 'CP-303', '2026-08-10 10:22:00', '2026-08-11', 'DVP', 4800000.00, 10000, 480.0000, 'USD', 'ETF Desk', 'TR-5512 (Chris Doyle)', 'INSTRUCTED', 'AFFIRMED', '2026-08-11 16:00:00'),
('TRD-90004', 'US88160R1014', 'CP-304', '2026-08-10 11:41:00', '2026-08-11', 'DVP', 2750000.00, 11000, 250.0000, 'USD', 'High Beta Growth Desk', 'TR-5519 (Emily Zhao)', 'PENDING', 'MISMATCHED', '2026-08-11 15:30:00'),
('TRD-90005', 'US459200KS21', 'CP-305', '2026-08-10 09:55:00', '2026-08-12', 'DVP', 6500000.00, 6500000, 100.0000, 'USD', 'Credit Trading', 'TR-5521 (Farah Aziz)', 'FAILED', 'REJECTED', '2026-08-12 14:00:00'),
('TRD-90006', 'US0378331005', 'CP-306', '2026-08-10 14:33:00', '2026-08-11', 'DVP', 1900000.00, 8000, 237.5000, 'USD', 'US Institutional Equities', 'TR-5524 (Alex Mercer)', 'PENDING', 'PENDING', '2026-08-11 15:30:00'),
('TRD-90007', 'US912828ZG64', 'CP-307', '2026-08-10 08:47:00', '2026-08-11', 'DVP', 9600000.00, 95000, 101.0526, 'USD', 'Rates & Sovereign Debt', 'TR-5531 (Sarah Lin)', 'SETTLED', 'MATCHED', '2026-08-11 15:00:00'),
('TRD-90008', 'US0231351067', 'CP-308', '2026-08-10 15:58:00', '2026-08-11', 'DVP', 5200000.00, 22000, 236.3636, 'USD', 'Tech Sector Trading Desk', 'TR-5536 (Jason Vance)', 'ON_HOLD', 'MISSING', '2026-08-11 11:00:00'),
('TRD-90009', 'US4781601046', 'CP-301', '2026-08-11 09:20:00', '2026-08-12', 'DVP', 3400000.00, 30000, 113.3300, 'USD', 'Financials Desk', 'TR-5541 (Marcus Bell)', 'INSTRUCTED', 'MATCHED', '2026-08-12 15:30:00'),
('TRD-90010', 'US67066G1040', 'CP-302', '2026-08-11 10:05:00', '2026-08-12', 'DVP', 7350000.00, 30000, 245.0000, 'USD', 'Tech Sector Trading Desk', 'TR-5546 (Jason Vance)', 'FAILED', 'MISMATCHED', '2026-08-12 15:30:00'),
('TRD-90011', 'US5949181045', 'CP-303', '2026-08-11 11:26:00', '2026-08-12', 'DVP', 2100000.00, 5000, 420.0000, 'USD', 'US Institutional Equities', 'TR-5551 (David Miller)', 'SETTLED', 'AFFIRMED', '2026-08-12 15:30:00'),
('TRD-90012', 'US459200KS21', 'CP-304', '2026-08-11 13:44:00', '2026-08-13', 'DVP', 4300000.00, 4300000, 100.0000, 'USD', 'Credit Trading', 'TR-5558 (Farah Aziz)', 'INSTRUCTED', 'MATCHED', '2026-08-13 14:00:00'),
('TRD-90013', 'US88160R1014', 'CP-305', '2026-08-11 14:52:00', '2026-08-12', 'DVP', 1650000.00, 6000, 275.0000, 'USD', 'High Beta Growth Desk', 'TR-5563 (Emily Zhao)', 'PENDING', 'MISSING', '2026-08-12 15:30:00'),
('TRD-90014', 'US02079K1079', 'CP-306', '2026-08-11 09:37:00', '2026-08-12', 'DVP', 2900000.00, 20000, 145.0000, 'USD', 'US Institutional Equities', 'TR-5568 (Omar Haddad)', 'SETTLED', 'AFFIRMED', '2026-08-12 15:30:00'),
('TRD-90015', 'US912810TZ97', 'CP-307', '2026-08-11 10:18:00', '2026-08-12', 'DVP', 6720000.00, 65000, 103.3846, 'USD', 'Rates & Sovereign Debt', 'TR-5574 (Nina Kovac)', 'ON_HOLD', 'MISMATCHED', '2026-08-12 15:00:00'),
('TRD-90016', 'US78462F1030', 'CP-308', '2026-08-11 12:03:00', '2026-08-12', 'DVP', 5280000.00, 11000, 480.0000, 'USD', 'ETF Desk', 'TR-5580 (Chris Doyle)', 'PENDING', 'REJECTED', '2026-08-12 16:00:00'),
('TRD-90017', 'US0378331005', 'CP-301', '2026-08-12 09:02:00', '2026-08-13', 'DVP', 1750000.00, 7000, 250.0000, 'USD', 'Delta One Desk', 'TR-5587 (Alex Mercer)', 'PENDING', 'PENDING', '2026-08-13 15:30:00'),
('TRD-90018', 'US4581401001', 'CP-302', '2026-08-12 09:48:00', '2026-08-13', 'DVP', 980000.00, 40000, 24.5000, 'USD', 'Tech Sector Trading Desk', 'TR-5593 (Jason Vance)', 'SETTLED', 'AFFIRMED', '2026-08-13 15:30:00'),
('TRD-90019', 'US912828ZG64', 'CP-303', '2026-08-12 10:29:00', '2026-08-13', 'RVP', 5400000.00, 52000, 103.8462, 'USD', 'Rates & Sovereign Debt', 'TR-5599 (Sarah Lin)', 'INSTRUCTED', 'MATCHED', '2026-08-13 15:00:00'),
('TRD-90020', 'US68389X1054', 'CP-304', '2026-08-12 11:57:00', '2026-08-13', 'DVP', 2250000.00, 10000, 225.0000, 'USD', 'US Institutional Equities', 'TR-5604 (David Miller)', 'FAILED', 'MISSING', '2026-08-13 15:30:00'),
('TRD-90021', 'US0231351067', 'CP-305', '2026-08-12 13:15:00', '2026-08-13', 'DVP', 3800000.00, 15000, 253.3333, 'USD', 'Tech Sector Trading Desk', 'TR-5611 (Jason Vance)', 'ON_HOLD', 'MISMATCHED', '2026-08-13 15:30:00'),
('TRD-90022', 'US4781601046', 'CP-306', '2026-08-12 14:40:00', '2026-08-13', 'DVP', 1470000.00, 13000, 113.0800, 'USD', 'Financials Desk', 'TR-5618 (Marcus Bell)', 'PENDING', 'AFFIRMED', '2026-08-13 15:30:00'),
('TRD-90023', 'US5949181045', 'CP-307', '2026-08-12 15:22:00', '2026-08-13', 'DVP', 6300000.00, 15000, 420.0000, 'USD', 'US Institutional Equities', 'TR-5624 (David Miller)', 'PENDING', 'MISSING', '2026-08-13 15:30:00'),
('TRD-90024', 'US78462F1030', 'CP-308', '2026-08-12 16:05:00', '2026-08-13', 'DVP', 2400000.00, 5000, 480.0000, 'USD', 'ETF Desk', 'TR-5630 (Chris Doyle)', 'SETTLED', 'AFFIRMED', '2026-08-13 16:00:00'),
('TRD-90025', 'US459200KS21', 'CP-301', '2026-08-13 09:31:00', '2026-08-14', 'DVP', 3100000.00, 3100000, 100.0000, 'USD', 'Credit Trading', 'TR-5637 (Farah Aziz)', 'INSTRUCTED', 'MATCHED', '2026-08-14 14:00:00'),
('TRD-90026', 'US67066G1040', 'CP-302', '2026-08-13 10:44:00', '2026-08-14', 'DVP', 4900000.00, 20000, 245.0000, 'USD', 'Tech Sector Trading Desk', 'TR-5643 (Jason Vance)', 'PENDING', 'MISMATCHED', '2026-08-14 15:30:00'),
('TRD-90027', 'US912810TZ97', 'CP-303', '2026-08-13 11:39:00', '2026-08-14', 'DVP', 8250000.00, 80000, 103.1250, 'USD', 'Rates & Sovereign Debt', 'TR-5649 (Nina Kovac)', 'INSTRUCTED', 'AFFIRMED', '2026-08-14 15:00:00'),
('TRD-90028', 'US88160R1014', 'CP-304', '2026-08-13 13:26:00', '2026-08-14', 'DVP', 1980000.00, 6000, 330.0000, 'USD', 'High Beta Growth Desk', 'TR-5656 (Emily Zhao)', 'ON_HOLD', 'PENDING', '2026-08-14 15:30:00'),
('TRD-90029', 'US02079K1079', 'CP-305', '2026-08-13 14:51:00', '2026-08-14', 'DVP', 2175000.00, 15000, 145.0000, 'USD', 'Delta One Desk', 'TR-5662 (Omar Haddad)', 'PENDING', 'MISSING', '2026-08-14 15:30:00'),
('TRD-90030', 'US0378331005', 'CP-306', '2026-08-13 15:47:00', '2026-08-14', 'DVP', 1425000.00, 5000, 285.0000, 'USD', 'US Institutional Equities', 'TR-5668 (Alex Mercer)', 'SETTLED', 'AFFIRMED', '2026-08-14 15:30:00');
""", "Trades (30 rows)")

# ===== SETTLEMENT INSTRUCTIONS (30 rows) =====
run_insert_once("""SELECT COUNT(*) AS N FROM CLEARSET_DB.CLEARSET_SCHEMA.SETTLEMENT_INSTRUCTIONS WHERE INSTRUCTION_ID = 'SSI-90001';""", """
USE DATABASE CLEARSET_DB;
USE SCHEMA CLEARSET_SCHEMA;
INSERT INTO SETTLEMENT_INSTRUCTIONS (INSTRUCTION_ID, TRADE_ID, SETTLEMENT_TYPE, CUSTODIAN_BIC, DEPOSITORY, CASH_ACCOUNT, SECURITIES_ACCOUNT, STATUS, MISMATCH_DETAILS) VALUES
('SSI-90001', 'TRD-90001', 'DVP', 'NGTBUS33XXX', 'DTC (Participant 0311)', NULL, NULL, 'MISSING', 'No standing settlement instruction on file for CP-301 / DTC equities tier; SSI lookup returned zero rows.'),
('SSI-90002', 'TRD-90002', 'DVP', 'HLIOGB2LXXX', 'Fedwire / Euroclear UK', 'CASH-FED-330211', 'SEC-FED-330212', 'AFFIRMED', NULL),
('SSI-90003', 'TRD-90003', 'DVP', 'MERIUS33XXX', 'DTC (Participant 0788)', 'CASH-DTC-903311', 'SEC-DTC-903312', 'AFFIRMED', NULL),
('SSI-90004', 'TRD-90004', 'DVP', 'IRWDUS33XXX', 'DTC (Participant 0442)', 'CASH-DTC-881920', 'SEC-DTC-442199', 'MISMATCHED', 'Securities account suffix differs from master SSI record (expected SEC-DTC-442100); allocation blocked at matching utility.'),
('SSI-90005', 'TRD-90005', 'DVP', 'BLHAJPJTXXX', 'Fedwire / DTC cross-border', 'CASH-FED-552001', 'SEC-FED-552002', 'REJECTED', 'Instruction rejected by custodian: settlement capacity limit exceeded for corporate bond nominal.'),
('SSI-90006', 'TRD-90006', 'DVP', 'RDSTUS44XXX', 'DTC (Participant 0917)', 'CASH-DTC-617300', 'SEC-DTC-617301', 'PENDING', 'Instruction dispatched to DTC matching utility; awaiting counterparty affirmation.'),
('SSI-90007', 'TRD-90007', 'DVP', 'SVPMGB22XXX', 'Fedwire', 'CASH-FED-774100', 'SEC-FED-774101', 'MATCHED', NULL),
('SSI-90008', 'TRD-90008', 'DVP', 'KESTUS33XXX', 'DTC (Participant 0265)', NULL, NULL, 'MISSING', 'Late booking after 15:00 EU window: no SSI generated for early Amsterdam cutoff cycle.'),
('SSI-90009', 'TRD-90009', 'DVP', 'NGTBUS33XXX', 'DTC (Participant 0311)', 'CASH-DTC-310455', 'SEC-DTC-310456', 'MATCHED', NULL),
('SSI-90010', 'TRD-90010', 'DVP', 'HLIOGB2LXXX', 'DTC (Participant 2208)', 'CASH-DTC-208114', 'SEC-DTC-999888', 'MISMATCHED', 'Depository participant BIC mismatch: instruction routed via DTC-2208 but master SSI mandates Fedwire settlement.'),
('SSI-90011', 'TRD-90011', 'DVP', 'MERIUS33XXX', 'DTC (Participant 0788)', 'CASH-DTC-788201', 'SEC-DTC-788202', 'AFFIRMED', NULL),
('SSI-90012', 'TRD-90012', 'DVP', 'IRWDUS33XXX', 'Fedwire', 'CASH-FED-442551', 'SEC-FED-442552', 'MATCHED', NULL),
('SSI-90013', 'TRD-90013', 'DVP', 'BLHAJPJTXXX', 'DTC (Participant 0519)', NULL, NULL, 'MISSING', 'APAC desk failed to transmit SSI before US cutoff; custodian unreachable for manual repair.'),
('SSI-90014', 'TRD-90014', 'DVP', 'RDSTUS44XXX', 'DTC (Participant 0917)', 'CASH-DTC-917122', 'SEC-DTC-917123', 'AFFIRMED', NULL),
('SSI-90015', 'TRD-90015', 'DVP', 'SVPMGB22XXX', 'Fedwire', 'CASH-FED-741009', 'SEC-FED-741010', 'MISMATCHED', 'Settlement date on instruction (2026-08-13) differs from trade record (2026-08-12); value-date break pending repair.'),
('SSI-90016', 'TRD-90016', 'DVP', 'KESTUS33XXX', 'DTC (Participant 0265)', 'CASH-DTC-265880', 'SEC-DTC-265881', 'REJECTED', 'Custodian rejected ETF instruction: invalid place of settlement code (expected USA, received XEUR).'),
('SSI-90017', 'TRD-90017', 'DVP', 'NGTBUS33XXX', 'DTC (Participant 0311)', 'CASH-DTC-310455', 'SEC-DTC-310456', 'PENDING', 'Instruction queued for affirmation; counterparty response outstanding.'),
('SSI-90018', 'TRD-90018', 'DVP', 'HLIOGB2LXXX', 'DTC (Participant 2208)', 'CASH-DTC-208114', 'SEC-DTC-208115', 'AFFIRMED', NULL),
('SSI-90019', 'TRD-90019', 'RVP', 'MERIUS33XXX', 'Fedwire', 'CASH-FED-788903', 'SEC-FED-788904', 'MATCHED', NULL),
('SSI-90020', 'TRD-90020', 'DVP', 'IRWDUS33XXX', 'DTC (Participant 0442)', NULL, NULL, 'MISSING', 'SSI lookup failed: counterparty custodian delisted from DTC participant directory last quarter; no remap on file.'),
('SSI-90021', 'TRD-90021', 'DVP', 'BLHAJPJTXXX', 'DTC (Participant 0519)', 'CASH-DTC-519777', 'SEC-DTC-111222', 'MISMATCHED', 'Depot location error: securities account points to DTC-0519 vault B instead of vault A per master agreement.'),
('SSI-90022', 'TRD-90022', 'DVP', 'RDSTUS44XXX', 'DTC (Participant 0917)', 'CASH-DTC-917122', 'SEC-DTC-917124', 'AFFIRMED', NULL),
('SSI-90023', 'TRD-90023', 'DVP', 'SVPMGB22XXX', 'DTC (Participant 0731)', NULL, NULL, 'MISSING', 'High-value booking at 15:22 exceeded SSI generation window; manual repair request opened with CP-307.'),
('SSI-90024', 'TRD-90024', 'DVP', 'KESTUS33XXX', 'DTC (Participant 0265)', 'CASH-DTC-265880', 'SEC-DTC-265882', 'AFFIRMED', NULL),
('SSI-90025', 'TRD-90025', 'DVP', 'NGTBUS33XXX', 'Fedwire', 'CASH-FED-310457', 'SEC-FED-310458', 'MATCHED', NULL),
('SSI-90026', 'TRD-90026', 'DVP', 'HLIOGB2LXXX', 'DTC (Participant 2208)', 'CASH-DTC-208114', 'SEC-DTC-208114', 'MISMATCHED', 'Duplicate settlement instruction detected: two active MT540 chains for same trade; matching engine suspended allocation.'),
('SSI-90027', 'TRD-90027', 'DVP', 'MERIUS33XXX', 'Fedwire', 'CASH-FED-788905', 'SEC-FED-788906', 'AFFIRMED', NULL),
('SSI-90028', 'TRD-90028', 'DVP', 'IRWDUS33XXX', 'DTC (Participant 0442)', 'CASH-DTC-442199', 'SEC-DTC-442200', 'PENDING', 'Custodian helpdesk unresponsive for 4+ hours; instruction in pending state approaching cutoff.'),
('SSI-90029', 'TRD-90029', 'DVP', 'BLHAJPJTXXX', 'DTC (Participant 0519)', NULL, NULL, 'MISSING', 'No SSI on file for Delta One book / CP-305 combination; first-time settlement route.'),
('SSI-90030', 'TRD-90030', 'DVP', 'RDSTUS44XXX', 'DTC (Participant 0917)', 'CASH-DTC-917125', 'SEC-DTC-917126', 'AFFIRMED', NULL);
""", "Settlement Instructions (30 rows)")

# ===== SETTLEMENT EVENTS (~28 rows) =====
run_insert_once("""SELECT COUNT(*) AS N FROM CLEARSET_DB.CLEARSET_SCHEMA.SETTLEMENT_EVENTS WHERE EVENT_ID = 'EVT-201';""", """
USE DATABASE CLEARSET_DB;
USE SCHEMA CLEARSET_SCHEMA;
INSERT INTO SETTLEMENT_EVENTS (EVENT_ID, TRADE_ID, EVENT_TIMESTAMP, MESSAGE_TYPE, STATUS, DESCRIPTION, SOURCE) VALUES
('EVT-201', 'TRD-90001', '2026-08-10 09:12:00', 'INTERNAL_ALERT', 'TRADE_BOOKED', 'Trade booked by US Institutional Equities TR-5501: Buy 25,000 GOOGL @ $130.00 ($3.25M DVP).', 'MATCHING_ENGINE'),
('EVT-202', 'TRD-90001', '2026-08-10 09:12:20', 'SWIFT MT541', 'SSI_LOOKUP_INITIATED', 'SSI engine queried master repository for CP-301 / DTC equities tier; no instruction rows returned.', 'MATCHING_ENGINE'),
('EVT-203', 'TRD-90002', '2026-08-11 15:04:00', 'SWIFT MT548', 'SETTLED', 'DTC/Fedwire settlement confirmed: 120,000 UST30Y vs USD 12.5M delivered free of breaks.', 'DEPOSITORY'),
('EVT-204', 'TRD-90004', '2026-08-10 13:05:00', 'SWIFT MT599', 'INSTRUCTION_MISMATCH', 'Custodian IRWDUS33XXX reported securities account suffix mismatch on allocation 1 of 1.', 'CUSTODIAN'),
('EVT-205', 'TRD-90005', '2026-08-12 14:02:00', 'SWIFT MT548', 'REJECTED', 'Instruction rejected by custodian: settlement capacity limit exceeded for IBM Corp bond nominal.', 'CUSTODIAN'),
('EVT-206', 'TRD-90005', '2026-08-12 16:30:00', 'INTERNAL_ALERT', 'CRITICAL_RISK_FLAGGED', 'ClearSet Risk Engine scored trade 93/100 (CRITICAL) after rejection with T+2 cutoff breach imminent.', 'CLEARSET_AGENT'),
('EVT-207', 'TRD-90008', '2026-08-10 16:05:00', 'INTERNAL_ALERT', 'CUTOFF_WARNING_T240', 'Early EU cutoff detected: Amsterdam cycle closes 11:00 EST; no SSI generated for CP-308.', 'CLEARSET_AGENT'),
('EVT-208', 'TRD-90010', '2026-08-12 15:31:00', 'SWIFT MT548', 'FAILED', 'Settlement failed at depository: instruction routed via wrong participant chain (BIC mismatch).', 'DEPOSITORY'),
('EVT-209', 'TRD-90010', '2026-08-12 17:45:00', 'INTERNAL_ALERT', 'ESCALATION_SENT', 'Auto-escalated to Helios EMEA ops desk lead; fail recapture window opened per SOP 4.1.', 'CLEARSET_AGENT'),
('EVT-210', 'TRD-90013', '2026-08-12 09:30:00', 'INTERNAL_ALERT', 'CUTOFF_WARNING_T360', 'Missing SSI on TSLA trade; 6 hours to 15:30 DTC intraday cutoff. CP-305 prior failures: 3.', 'CLEARSET_AGENT'),
('EVT-211', 'TRD-90015', '2026-08-12 11:02:00', 'SWIFT MT599', 'VALUE_DATE_BREAK', 'Custodian flagged value-date mismatch (13th vs 12th); trade placed ON_HOLD pending repair confirmation.', 'SWIFT_GATEWAY'),
('EVT-212', 'TRD-90016', '2026-08-12 14:20:00', 'SWIFT MT548', 'REJECTED', 'SPY instruction rejected: invalid place of settlement code XEUR for US-domiciled ETF.', 'CUSTODIAN'),
('EVT-213', 'TRD-90017', '2026-08-13 12:00:00', 'INTERNAL_ALERT', 'AFFIRMATION_REMINDER', 'Pending affirmation reminder dispatched to CP-301; 3.5h to cutoff.', 'CLEARSET_AGENT'),
('EVT-214', 'TRD-90018', '2026-08-13 15:44:00', 'SWIFT MT548', 'SETTLED', 'Settlement confirmed: 40,000 INTC vs USD 980K delivered DVP, zero breaks.', 'DEPOSITORY'),
('EVT-215', 'TRD-90019', '2026-08-13 15:10:00', 'SWIFT MT548', 'INSTRUCTED', 'RVP instruction matched at Fedwire; awaiting settlement cycle release.', 'MATCHING_ENGINE'),
('EVT-216', 'TRD-90020', '2026-08-13 15:33:00', 'SWIFT MT548', 'FAILED', 'Trade failed at cutoff: no valid SSI after custodian delisting event.', 'DEPOSITORY'),
('EVT-217', 'TRD-90021', '2026-08-13 10:41:00', 'SWIFT MT599', 'DEPOT_MISMATCH', 'Depot location variance reported (vault B vs vault A) on AMZN allocation.', 'CUSTODIAN'),
('EVT-218', 'TRD-90023', '2026-08-12 16:00:00', 'INTERNAL_ALERT', 'CRITICAL_RISK_FLAGGED', 'High-value MSFT trade booked 15:22 with missing SSI; risk score 82/100 (HIGH). Repair desk paged.', 'CLEARSET_AGENT'),
('EVT-219', 'TRD-90023', '2026-08-13 08:15:00', 'INTERNAL_ALERT', 'CUTOFF_WARNING_T435', 'Manual repair in progress with CP-307 ops; 7.25 hours to cutoff.', 'CLEARSET_AGENT'),
('EVT-220', 'TRD-90024', '2026-08-13 16:12:00', 'SWIFT MT548', 'SETTLED', 'Settlement confirmed: 5,000 SPY vs USD 2.4M delivered DVP.', 'DEPOSITORY'),
('EVT-221', 'TRD-90026', '2026-08-13 14:05:00', 'SWIFT MT599', 'DUPLICATE_INSTRUCTION', 'Matching engine suspended allocation: two active instruction chains detected for same trade.', 'MATCHING_ENGINE'),
('EVT-222', 'TRD-90026', '2026-08-14 09:10:00', 'INTERNAL_ALERT', 'ESCALATION_SENT', 'Duplicate chain cancellation requested from Helios; HIGH severity exception opened.', 'CLEARSET_AGENT'),
('EVT-223', 'TRD-90028', '2026-08-13 18:02:00', 'INTERNAL_ALERT', 'CUSTODIAN_UNREACHABLE', 'Ironwood custodian helpdesk unresponsive 4h+; pending instruction at risk before 08-14 cutoff.', 'CLEARSET_AGENT'),
('EVT-224', 'TRD-90029', '2026-08-13 15:05:00', 'SWIFT MT541', 'SSI_LOOKUP_INITIATED', 'First-time settlement route: no standing instructions for Delta One book / CP-305 combination.', 'MATCHING_ENGINE');
""", "Settlement Events (~28 rows)")

# ===== EXCEPTIONS (16 rows) - Use SELECT/UNION ALL for PARSE_JSON =====
run_insert_once("""SELECT COUNT(*) AS N FROM CLEARSET_DB.CLEARSET_SCHEMA.EXCEPTIONS WHERE EXCEPTION_ID = 'EX-90001';""", """
USE DATABASE CLEARSET_DB;
USE SCHEMA CLEARSET_SCHEMA;
INSERT INTO EXCEPTIONS (EXCEPTION_ID, TRADE_ID, SEVERITY, STATUS, EXCEPTION_TYPE, RISK_SCORE, RISK_BREAKDOWN_JSON, DETECTED_AT, ASSIGNED_ANALYST)
SELECT 'EX-90001', 'TRD-90001', 'HIGH', 'OPEN', 'Missing Instruction', 74, PARSE_JSON('{"missing_instruction": 20, "cutoff_urgency": 15, "trade_value": 15, "cp_failures": 10, "historical_precedents": 14}'), '2026-08-10 09:13:00', 'J. Whitfield'
UNION ALL SELECT 'EX-90004', 'TRD-90004', 'HIGH', 'INVESTIGATING', 'Account Number Mismatch', 71, PARSE_JSON('{"mismatch_instruction": 18, "cutoff_urgency": 15, "trade_value": 18, "cp_failures": 12, "historical_precedents": 8}'), '2026-08-10 13:06:00', 'R. Castellanos'
UNION ALL SELECT 'EX-90005', 'TRD-90005', 'CRITICAL', 'ESCALATED', 'Rejected Instruction', 93, PARSE_JSON('{"rejected_instruction": 25, "cutoff_urgency": 25, "trade_value": 20, "cp_failures": 8, "historical_precedents": 15}'), '2026-08-12 14:03:00', 'Settlement Recovery Desk'
UNION ALL SELECT 'EX-90006', 'TRD-90006', 'MEDIUM', 'OPEN', 'Late Affirmation', 48, PARSE_JSON('{"pending_instruction": 10, "cutoff_urgency": 10, "trade_value": 12, "cp_failures": 8, "historical_precedents": 8}'), '2026-08-10 16:40:00', NULL
UNION ALL SELECT 'EX-90008', 'TRD-90008', 'CRITICAL', 'OPEN', 'Missing Instruction', 94, PARSE_JSON('{"missing_instruction": 25, "cutoff_urgency": 25, "trade_value": 20, "cp_failures": 12, "historical_precedents": 12}'), '2026-08-10 16:06:00', 'EU Cutoff Team'
UNION ALL SELECT 'EX-90010', 'TRD-90010', 'HIGH', 'RESOLVED', 'Post-Cutoff Fail', 77, PARSE_JSON('{"failed_settlement": 20, "cutoff_urgency": 15, "trade_value": 20, "cp_failures": 12, "historical_precedents": 10}'), '2026-08-12 15:32:00', 'K. Osei'
UNION ALL SELECT 'EX-90013', 'TRD-90013', 'HIGH', 'OPEN', 'Missing Instruction', 76, PARSE_JSON('{"missing_instruction": 20, "cutoff_urgency": 20, "trade_value": 12, "cp_failures": 12, "historical_precedents": 12}'), '2026-08-12 09:31:00', NULL
UNION ALL SELECT 'EX-90015', 'TRD-90015', 'MEDIUM', 'INVESTIGATING', 'Settlement Date Mismatch', 52, PARSE_JSON('{"value_date_break": 15, "cutoff_urgency": 10, "trade_value": 15, "cp_failures": 5, "historical_precedents": 7}'), '2026-08-12 11:03:00', 'A. Fontaine'
UNION ALL SELECT 'EX-90016', 'TRD-90016', 'HIGH', 'ESCALATED', 'Instruction Rejected', 80, PARSE_JSON('{"rejected_instruction": 20, "cutoff_urgency": 15, "trade_value": 18, "cp_failures": 12, "historical_precedents": 15}'), '2026-08-12 14:22:00', 'Settlement Recovery Desk'
UNION ALL SELECT 'EX-90017', 'TRD-90017', 'LOW', 'RESOLVED', 'Instruction Pending', 34, PARSE_JSON('{"pending_instruction": 8, "cutoff_urgency": 6, "trade_value": 10, "cp_failures": 4, "historical_precedents": 6}'), '2026-08-13 12:01:00', NULL
UNION ALL SELECT 'EX-90020', 'TRD-90020', 'CRITICAL', 'INVESTIGATING', 'Failed Settlement', 90, PARSE_JSON('{"failed_settlement": 25, "cutoff_urgency": 25, "trade_value": 15, "cp_failures": 12, "historical_precedents": 13}'), '2026-08-13 15:34:00', 'K. Osei'
UNION ALL SELECT 'EX-90021', 'TRD-90021', 'MEDIUM', 'OPEN', 'Depot Location Error', 45, PARSE_JSON('{"depot_mismatch": 12, "cutoff_urgency": 8, "trade_value": 12, "cp_failures": 6, "historical_precedents": 7}'), '2026-08-13 10:42:00', NULL
UNION ALL SELECT 'EX-90023', 'TRD-90023', 'HIGH', 'OPEN', 'Missing Instruction', 82, PARSE_JSON('{"missing_instruction": 20, "cutoff_urgency": 20, "trade_value": 20, "cp_failures": 5, "historical_precedents": 17}'), '2026-08-12 16:01:00', 'Repair Desk'
UNION ALL SELECT 'EX-90026', 'TRD-90026', 'HIGH', 'INVESTIGATING', 'Duplicate Instruction', 68, PARSE_JSON('{"duplicate_instruction": 15, "cutoff_urgency": 12, "trade_value": 15, "cp_failures": 12, "historical_precedents": 14}'), '2026-08-13 14:06:00', 'A. Fontaine'
UNION ALL SELECT 'EX-90028', 'TRD-90028', 'MEDIUM', 'OPEN', 'Custodian Unreachable', 43, PARSE_JSON('{"custodian_unresponsive": 12, "cutoff_urgency": 10, "trade_value": 8, "cp_failures": 8, "historical_precedents": 5}'), '2026-08-13 18:03:00', NULL
UNION ALL SELECT 'EX-90029', 'TRD-90029', 'HIGH', 'OPEN', 'Missing Instruction', 78, PARSE_JSON('{"missing_instruction": 20, "cutoff_urgency": 18, "trade_value": 10, "cp_failures": 10, "historical_precedents": 20}'), '2026-08-13 15:06:00', 'J. Whitfield';
""", "Exceptions (16 rows) - SELECT/UNION ALL")

# ===== REFRESH DEMO DATES (idempotent) =====
run_sql("""
USE DATABASE CLEARSET_DB;
USE SCHEMA CLEARSET_SCHEMA;
CREATE OR REPLACE TEMP TABLE _TRADE_DATE_REFRESH AS
WITH ranked AS (
    SELECT t.TRADE_ID, t.CUTOFF_TIME AS OLD_CUTOFF, ROW_NUMBER() OVER (ORDER BY t.TRADE_ID) AS RN
    FROM TRADES t
    WHERE t.TRADE_ID NOT IN ('TRD-92831', 'TRD-81232')
)
SELECT r.TRADE_ID,
    DATEADD('minute', CASE (r.RN % 6)
        WHEN 1 THEN 40 WHEN 2 THEN 75 WHEN 3 THEN 110 WHEN 4 THEN 170 WHEN 5 THEN 300 ELSE 480 END + (r.RN * 2),
        CURRENT_TIMESTAMP()) AS NEW_CUTOFF,
    DATEDIFF('minute', r.OLD_CUTOFF,
        DATEADD('minute', CASE (r.RN % 6)
            WHEN 1 THEN 40 WHEN 2 THEN 75 WHEN 3 THEN 110 WHEN 4 THEN 170 WHEN 5 THEN 300 ELSE 480 END + (r.RN * 2),
            CURRENT_TIMESTAMP())) AS DELTA_MIN
FROM ranked r;

UPDATE TRADES t SET TRADE_DATE = CURRENT_TIMESTAMP(), SETTLEMENT_DATE = CURRENT_DATE(), CUTOFF_TIME = m.NEW_CUTOFF
FROM _TRADE_DATE_REFRESH m WHERE t.TRADE_ID = m.TRADE_ID;

UPDATE SETTLEMENT_EVENTS e SET EVENT_TIMESTAMP = DATEADD('minute', m.DELTA_MIN, e.EVENT_TIMESTAMP)
FROM _TRADE_DATE_REFRESH m WHERE e.TRADE_ID = m.TRADE_ID;

UPDATE SETTLEMENT_INSTRUCTIONS s SET LAST_UPDATED = DATEADD('minute', m.DELTA_MIN, s.LAST_UPDATED)
FROM _TRADE_DATE_REFRESH m WHERE s.TRADE_ID = m.TRADE_ID;

UPDATE EXCEPTIONS x SET DETECTED_AT = DATEADD('minute', m.DELTA_MIN, x.DETECTED_AT)
FROM _TRADE_DATE_REFRESH m WHERE x.TRADE_ID = m.TRADE_ID;
""", "Refresh demo dates (re-date all non-protected trades)")

# ===== JUDGE USER (without service role grant - add after SPCS deploy) =====
run_sql("""
USE DATABASE CLEARSET_DB;
USE SCHEMA CLEARSET_SCHEMA;
CREATE ROLE IF NOT EXISTS CLEARSET_JUDGE_ROLE;
CREATE USER IF NOT EXISTS CLEARSET_JUDGE PASSWORD='JudgeDemo26' DEFAULT_ROLE=CLEARSET_JUDGE_ROLE MUST_CHANGE_PASSWORD=FALSE DAYS_TO_EXPIRY=36 COMMENT='Snowflake CoCo CLI Hackathon GCC - judge demo access';
GRANT ROLE CLEARSET_JUDGE_ROLE TO USER CLEARSET_JUDGE;
GRANT USAGE ON DATABASE CLEARSET_DB TO ROLE CLEARSET_JUDGE_ROLE;
GRANT USAGE ON SCHEMA CLEARSET_DB.CLEARSET_SCHEMA TO ROLE CLEARSET_JUDGE_ROLE;
GRANT SELECT ON ALL TABLES IN SCHEMA CLEARSET_DB.CLEARSET_SCHEMA TO ROLE CLEARSET_JUDGE_ROLE;
GRANT SELECT ON ALL VIEWS IN SCHEMA CLEARSET_DB.CLEARSET_SCHEMA TO ROLE CLEARSET_JUDGE_ROLE;
-- GRANT SERVICE ROLE ...  (run after SPCS service deployed)
""", "Judge user (CLEARSET_JUDGE / JudgeDemo26) - no service grant yet")

print("\n=== ALL MIGRATION COMPLETE ===")

