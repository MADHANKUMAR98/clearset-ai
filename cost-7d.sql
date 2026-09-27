WITH pool_daily AS (
  SELECT 
    TO_DATE(START_TIME) AS day,
    NAME AS pool_name,
    SUM(CREDITS_USED) AS credits
  FROM SNOWFLAKE.ACCOUNT_USAGE.COMPUTE_POOL_USAGE_HISTORY
  WHERE START_TIME >= DATEADD(day, -7, CURRENT_TIMESTAMP())
  GROUP BY day, NAME
),
wh_daily AS (
  SELECT 
    TO_DATE(START_TIME) AS day,
    WAREHOUSE_NAME AS warehouse_name,
    SUM(CREDITS_USED) AS credits
  FROM SNOWFLAKE.ACCOUNT_USAGE.WAREHOUSE_METERING_HISTORY
  WHERE START_TIME >= DATEADD(day, -7, CURRENT_TIMESTAMP())
  GROUP BY day, WAREHOUSE_NAME
)
SELECT 
  'COMPUTE POOL' AS resource_type,
  pool_name AS name,
  ROUND(AVG(credits), 4) AS avg_daily_credits,
  ROUND(SUM(credits), 2) AS total_7d_credits
FROM pool_daily
GROUP BY pool_name
UNION ALL
SELECT 
  'WAREHOUSE' AS resource_type,
  warehouse_name AS name,
  ROUND(AVG(credits), 4) AS avg_daily_credits,
  ROUND(SUM(credits), 2) AS total_7d_credits
FROM wh_daily
GROUP BY warehouse_name
ORDER BY resource_type, total_7d_credits DESC;