-- ============================================================================
-- CLEARSET AI — 10: REFRESH DEMO DATES FOR LIVE PRESENTATION
-- Purpose:
--   The expansion seed (09) wrote static dates around 2026-08-11. As calendar
--   time advances, every non-protected trade renders as grossly OVERDUE
--   (MINUTES_TO_CUTOFF ≈ -17,000). This script re-dates all NON-PROTECTED
--   trades to "today", staggering cutoffs across realistic urgency buckets
--   (<2h critical, <4h warning, moderate, comfortable), and shifts dependent
--   timestamps by the same delta so timelines stay internally consistent.
--
-- PROTECTED RECORDS — NEVER MODIFIED BY THIS SCRIPT:
--   TRADES:      TRD-92831, TRD-81232
--   (and every child row referencing them)
--
-- Idempotent: safe to re-run any time the demo looks stale.
-- ============================================================================

USE DATABASE CLEARSET_DB;
USE SCHEMA CLEARSET_SCHEMA;

-- ----------------------------------------------------------------------------
-- 1. Build refresh map: staggered cutoff offsets from "now".
--    Bucket pattern (mod 6): 40 / 75 / 110 / 170 / 300 / 480 minutes,
--    plus a small per-row stagger so cutoffs are not identical.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE TEMP TABLE _TRADE_DATE_REFRESH AS
WITH ranked AS (
    SELECT
        t.TRADE_ID,
        t.CUTOFF_TIME AS OLD_CUTOFF,
        ROW_NUMBER() OVER (ORDER BY t.TRADE_ID) AS RN
    FROM TRADES t
    WHERE t.TRADE_ID NOT IN ('TRD-92831', 'TRD-81232')
)
SELECT
    r.TRADE_ID,
    DATEADD(
        'minute',
        CASE (r.RN % 6)
            WHEN 1 THEN 40    -- CRITICAL bucket (<2h)
            WHEN 2 THEN 75    -- CRITICAL bucket (<2h)
            WHEN 3 THEN 110   -- WARNING bucket (<2h boundary)
            WHEN 4 THEN 170   -- WARNING bucket (<4h)
            WHEN 5 THEN 300   -- MODERATE (<8h)
            ELSE 480          -- COMFORTABLE
        END + (r.RN * 2),
        CURRENT_TIMESTAMP()
    ) AS NEW_CUTOFF,
    DATEDIFF(
        'minute',
        r.OLD_CUTOFF,
        DATEADD(
            'minute',
            CASE (r.RN % 6)
                WHEN 1 THEN 40
                WHEN 2 THEN 75
                WHEN 3 THEN 110
                WHEN 4 THEN 170
                WHEN 5 THEN 300
                ELSE 480
            END + (r.RN * 2),
            CURRENT_TIMESTAMP()
        )
    ) AS DELTA_MIN
FROM ranked r;

-- ----------------------------------------------------------------------------
-- 2. Re-date TRADES (same-day DVP: traded today, settling today).
-- ----------------------------------------------------------------------------
UPDATE TRADES t
SET
    TRADE_DATE      = CURRENT_TIMESTAMP(),
    SETTLEMENT_DATE = CURRENT_DATE,
    CUTOFF_TIME     = m.NEW_CUTOFF
FROM _TRADE_DATE_REFRESH m
WHERE t.TRADE_ID = m.TRADE_ID;

-- ----------------------------------------------------------------------------
-- 3. Shift SWIFT settlement-event timelines by the same delta so the
--    "minutes before cutoff" story of each event is preserved exactly.
-- ----------------------------------------------------------------------------
UPDATE SETTLEMENT_EVENTS e
SET EVENT_TIMESTAMP = DATEADD('minute', m.DELTA_MIN, e.EVENT_TIMESTAMP)
FROM _TRADE_DATE_REFRESH m
WHERE e.TRADE_ID = m.TRADE_ID;

-- ----------------------------------------------------------------------------
-- 4. Shift SSI last-updated stamps and exception detection stamps for
--    internal consistency with the new cutoffs.
-- ----------------------------------------------------------------------------
UPDATE SETTLEMENT_INSTRUCTIONS s
SET LAST_UPDATED = DATEADD('minute', m.DELTA_MIN, s.LAST_UPDATED)
FROM _TRADE_DATE_REFRESH m
WHERE s.TRADE_ID = m.TRADE_ID;

UPDATE EXCEPTIONS x
SET DETECTED_AT = DATEADD('minute', m.DELTA_MIN, x.DETECTED_AT)
FROM _TRADE_DATE_REFRESH m
WHERE x.TRADE_ID = m.TRADE_ID;

-- ----------------------------------------------------------------------------
-- 5. Verification
-- ----------------------------------------------------------------------------
SELECT 'REFRESHED_TRADES' AS CHECK_NAME, COUNT(*) AS ROW_COUNT
FROM TRADES
WHERE TRADE_ID NOT IN ('TRD-92831', 'TRD-81232')
  AND CUTOFF_TIME > CURRENT_TIMESTAMP();

SELECT
    CASE
        WHEN MINUTES_TO_CUTOFF < 0   THEN 'OVERDUE'
        WHEN MINUTES_TO_CUTOFF < 120 THEN 'CRITICAL_LT_2H'
        WHEN MINUTES_TO_CUTOFF < 240 THEN 'WARNING_LT_4H'
        WHEN MINUTES_TO_CUTOFF < 480 THEN 'MODERATE_LT_8H'
        ELSE 'COMFORTABLE'
    END AS URGENCY_BUCKET,
    COUNT(*) AS TRADE_COUNT
FROM V_EXCEPTIONS_ENRICHED
GROUP BY 1
ORDER BY 1;
