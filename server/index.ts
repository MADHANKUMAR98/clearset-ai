import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { snowflakeClient } from './snowflakeClient.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

/**
 * GET /api/health
 * Returns the operational mode and whether live Snowflake is accessible.
 */
app.get('/api/health', async (_req: Request, res: Response) => {
  try {
    const isConfigured = snowflakeClient.isConfigured();

    if (!isConfigured) {
      return res.json({
        mode: 'local',
        snowflake: false,
        message: 'Snowflake credentials not provided. Running in local simulation mode.',
        config: snowflakeClient.getConfigSummary(),
      });
    }

    // Ping Snowflake with connection test
    const testResult = await snowflakeClient.testConnection();

    if (testResult.success) {
      return res.json({
        mode: 'snowflake',
        snowflake: true,
        message: 'Connected to live Snowflake data warehouse.',
        session: testResult.data,
      });
    } else {
      return res.json({
        mode: 'local',
        snowflake: false,
        message: `Snowflake connection failed (${testResult.error}). Operating in local fallback mode.`,
        error: testResult.error,
      });
    }
  } catch (err: any) {
    return res.json({
      mode: 'local',
      snowflake: false,
      message: 'Health check encountered an error. Operating in local fallback mode.',
      error: err?.message || 'Unknown error',
    });
  }
});

/**
 * GET /api/test-snowflake
 * Executes a connection test query on Snowflake:
 * SELECT CURRENT_ACCOUNT(), CURRENT_USER(), CURRENT_ROLE(), CURRENT_WAREHOUSE();
 */
app.get('/api/test-snowflake', async (_req: Request, res: Response) => {
  try {
    if (!snowflakeClient.isConfigured()) {
      return res.status(200).json({
        success: false,
        mode: 'local',
        error: 'Snowflake environment variables are not set. Check server/.env file.',
        config: snowflakeClient.getConfigSummary(),
      });
    }

    const testResult = await snowflakeClient.testConnection();

    if (testResult.success) {
      return res.json({
        success: true,
        mode: 'snowflake',
        message: 'Successfully executed query against Snowflake.',
        result: testResult.data,
      });
    } else {
      return res.status(200).json({
        success: false,
        mode: 'local',
        error: testResult.error,
        message: 'Query execution failed. The frontend will continue with local simulation.',
      });
    }
  } catch (err: any) {
    return res.status(200).json({
      success: false,
      mode: 'local',
      error: err?.message || 'Unexpected server error while querying Snowflake.',
    });
  }
});

// Global error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Server Error]', err);
  res.status(500).json({
    success: false,
    error: err?.message || 'Internal Server Error',
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`[ClearSet Backend] Server running on http://localhost:${PORT}`);
  console.log(`[ClearSet Backend] Snowflake Configured: ${snowflakeClient.isConfigured() ? 'YES' : 'NO (Local Fallback Active)'}`);
});
