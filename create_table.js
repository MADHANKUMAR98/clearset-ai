const { snowflakeClient } = require('./dist/snowflakeClient.js');

async function createTable() {
  if (!snowflakeClient.isConfigured()) {
    console.log('Snowflake not configured');
    process.exit(1);
  }
  
  const sql = `
    CREATE OR REPLACE TABLE CLEARSET_DB.CLEARSET_SCHEMA.RESOLUTION_CASES (
      CASE_ID VARCHAR(50) PRIMARY KEY,
      TRADE_ID VARCHAR(50) NOT NULL,
      EXCEPTION_ID VARCHAR(50),
      STATUS VARCHAR(50) NOT NULL,
      RISK_SCORE INT NOT NULL,
      ROOT_CAUSE TEXT NOT NULL,
      RECOMMENDATION TEXT NOT NULL,
      RESOLUTION_OUTCOME TEXT,
      APPROVED_BY VARCHAR(100),
      APPROVED_AT TIMESTAMP_NTZ,
      CREATED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
      UPDATED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
    )
  `;
  
  try {
    const result = await snowflakeClient.executeStatement(sql);
    console.log('Table created:', result);
  } catch (e) {
    console.error('Error creating table:', e.message);
  }
  
  // Verify
  try {
    const result = await snowflakeClient.executeStatement("SHOW TABLES LIKE 'RESOLUTION_CASES' IN SCHEMA CLEARSET_DB.CLEARSET_SCHEMA");
    console.log('Verification:', JSON.stringify(result, null, 2));
  } catch (e) {
    console.error('Verification error:', e.message);
  }
}

createTable().then(() => process.exit(0)).catch(() => process.exit(1));