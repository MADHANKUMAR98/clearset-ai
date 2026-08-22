import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import https from 'https';
import type { IncomingHttpHeaders } from 'http';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });

import { snowflakeClient } from './snowflakeClient.js';

const app = express();
// Production (Snowflake App Runtime) expects port 8080.
// Local development continues on 3001 via .env PORT=3001.
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());

// ============================================================================
// STATIC FILE SERVING (production)
// In Snowflake App Runtime the Express process serves both the React SPA and
// the /api/* endpoints.  The Vite build output lives at ../dist relative to
// server/dist/index.js (or ../dist relative to server/index.ts in dev).
// In local development the Vite dev-server proxy handles /api → Express, so
// this block is simply never reached for the front-end assets.
// ============================================================================
const DIST_DIR = path.resolve(__dirname, path.basename(__dirname) === 'dist' ? '../../dist' : '../dist');
if (fs.existsSync(DIST_DIR) && fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
  app.use(express.static(DIST_DIR));
  console.log(`[ClearSet Backend] Serving React frontend from ${DIST_DIR}`);
}

// ============================================================================
// UTILITY HELPERS
// ============================================================================

function toJsonSafe(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === 'bigint') {
    return Number(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(toJsonSafe);
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      out[key] = toJsonSafe(nested);
    }
    return out;
  }
  return value;
}

// ============================================================================
// GET /api/health
// Returns the operational mode and whether live Snowflake is accessible.
// ============================================================================
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

// ============================================================================
// GET /api/test-snowflake
// Executes a connection test query on Snowflake.
// ============================================================================
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

// ============================================================================
// GET /api/exceptions
// Returns live exception rows from V_EXCEPTIONS_ENRICHED.
// ============================================================================
const EXCEPTIONS_ENRICHED_SQL = `
  SELECT
    EXCEPTION_ID,
    TRADE_ID,
    SEVERITY,
    EXCEPTION_STATUS,
    EXCEPTION_TYPE,
    RISK_SCORE,
    TRADE_VALUE,
    CURRENCY,
    SETTLEMENT_DATE,
    SETTLEMENT_TYPE,
    CUTOFF_TIME,
    MINUTES_TO_CUTOFF,
    TICKER,
    SECURITY_NAME,
    ASSET_CLASS,
    DEPOSITORY,
    CP_ID,
    COUNTERPARTY_NAME,
    CREDIT_RATING,
    PRIOR_FAILURES_30D,
    HISTORICAL_FAIL_RATE,
    SSI_STATUS,
    CUSTODIAN_BIC
  FROM CLEARSET_DB.CLEARSET_SCHEMA.V_EXCEPTIONS_ENRICHED
  ORDER BY RISK_SCORE DESC NULLS LAST
`;

app.get('/api/exceptions', async (_req: Request, res: Response) => {
  try {
    if (!snowflakeClient.isConfigured()) {
      return res.status(200).json({
        success: false,
        mode: 'local',
        data: [],
        message: 'Snowflake unavailable',
      });
    }

    const rows = await snowflakeClient.executeStatement(EXCEPTIONS_ENRICHED_SQL);

    return res.json({
      success: true,
      mode: 'snowflake',
      data: toJsonSafe(rows),
    });
  } catch (err: any) {
    return res.status(200).json({
      success: false,
      mode: 'local',
      data: [],
      message: 'Snowflake unavailable',
      error: err?.message || 'Failed to query V_EXCEPTIONS_ENRICHED.',
    });
  }
});

// ============================================================================
// GET /api/trades
// Returns live trade rows from V_TRADE_ENRICHED.
// NOTE: RISK_SCORE is not in V_TRADE_ENRICHED; it lives in EXCEPTIONS table.
//       We left-join EXCEPTIONS to include RISK_SCORE where available.
//       Fields not in Snowflake (DEPOSITORY from securities): included via join.
// ============================================================================
const TRADES_ENRICHED_SQL = `
  SELECT
    T.TRADE_ID,
    T.ISIN,
    S.TICKER,
    S.NAME        AS SECURITY_NAME,
    S.ASSET_CLASS,
    S.DEPOSITORY,
    T.CP_ID,
    C.NAME        AS COUNTERPARTY_NAME,
    C.CREDIT_RATING,
    T.TRADE_DATE,
    T.SETTLEMENT_DATE,
    T.SETTLEMENT_TYPE,
    T.TRADE_VALUE,
    T.QUANTITY,
    T.PRICE,
    T.CURRENCY,
    T.BOOKING_DESK,
    T.SETTLEMENT_STATUS,
    T.INSTRUCTION_STATUS,
    T.CUTOFF_TIME,
    E.RISK_SCORE
  FROM CLEARSET_DB.CLEARSET_SCHEMA.TRADES T
  LEFT JOIN CLEARSET_DB.CLEARSET_SCHEMA.SECURITIES S ON T.ISIN = S.ISIN
  LEFT JOIN CLEARSET_DB.CLEARSET_SCHEMA.COUNTERPARTIES C ON T.CP_ID = C.CP_ID
  LEFT JOIN CLEARSET_DB.CLEARSET_SCHEMA.EXCEPTIONS E ON T.TRADE_ID = E.TRADE_ID
  ORDER BY T.TRADE_VALUE DESC NULLS LAST
`;

app.get('/api/trades', async (_req: Request, res: Response) => {
  try {
    if (!snowflakeClient.isConfigured()) {
      return res.status(200).json({
        success: false,
        mode: 'local',
        data: [],
        message: 'Snowflake unavailable',
      });
    }

    const rows = await snowflakeClient.executeStatement(TRADES_ENRICHED_SQL);

    return res.json({
      success: true,
      mode: 'snowflake',
      data: toJsonSafe(rows),
    });
  } catch (err: any) {
    return res.status(200).json({
      success: false,
      mode: 'local',
      data: [],
      message: 'Snowflake unavailable',
      error: err?.message || 'Failed to query TRADES.',
    });
  }
});

// ============================================================================
// GET /api/counterparties/:id
// Returns a single counterparty record from the COUNTERPARTIES table.
// Example: GET /api/counterparties/CP-192
// ============================================================================
app.get('/api/counterparties/:id', async (req: Request, res: Response) => {
  const cpId = req.params.id;

  try {
    if (!snowflakeClient.isConfigured()) {
      return res.status(200).json({
        success: false,
        mode: 'local',
        data: null,
        message: 'Snowflake unavailable',
      });
    }

    const rows = await snowflakeClient.executeStatement(
      `SELECT
         CP_ID,
         NAME,
         BIC,
         LEI,
         CREDIT_RATING,
         PRIOR_FAILURES_30D,
         HISTORICAL_FAIL_RATE,
         AVG_RESOLUTION_HOURS,
         TOTAL_TRADES_TODAY,
         PRIMARY_DESK_CONTACT,
         PRIMARY_EMAIL
       FROM CLEARSET_DB.CLEARSET_SCHEMA.COUNTERPARTIES
       WHERE CP_ID = ?`,
      [cpId],
    );

    if (!rows || rows.length === 0) {
      return res.status(200).json({
        success: false,
        mode: 'snowflake',
        data: null,
        message: `No counterparty found for CP_ID=${cpId}`,
      });
    }

    return res.json({
      success: true,
      mode: 'snowflake',
      data: toJsonSafe(rows[0]),
    });
  } catch (err: any) {
    return res.status(200).json({
      success: false,
      mode: 'local',
      data: null,
      message: 'Snowflake unavailable',
      error: err?.message || `Failed to query counterparty ${cpId}.`,
    });
  }
});

// ============================================================================
// GET /api/settlement-events/:tradeId
// Returns settlement events from V_SETTLEMENT_EVENTS for a given trade.
// Falls back to the base SETTLEMENT_EVENTS table with JOINs if view is missing.
// Example: GET /api/settlement-events/TRD-92831
// ============================================================================
app.get('/api/settlement-events/:tradeId', async (req: Request, res: Response) => {
  const tradeId = req.params.tradeId;

  try {
    if (!snowflakeClient.isConfigured()) {
      return res.status(200).json({
        success: false,
        mode: 'local',
        data: [],
        message: 'Snowflake unavailable',
      });
    }

    let rows: any[] = [];

    // Try the enriched semantic view first
    try {
      rows = await snowflakeClient.executeStatement(
        `SELECT
           EVENT_ID,
           TRADE_ID,
           CP_ID,
           COUNTERPARTY_NAME,
           EVENT_TIMESTAMP,
           MESSAGE_TYPE,
           EVENT_STATUS,
           DESCRIPTION,
           SOURCE,
           TRADE_VALUE,
           SETTLEMENT_DATE,
           CUTOFF_TIME
         FROM CLEARSET_DB.CLEARSET_SCHEMA.V_SETTLEMENT_EVENTS
         WHERE TRADE_ID = ?
         ORDER BY EVENT_TIMESTAMP ASC`,
        [tradeId],
      );
    } catch (_viewErr: any) {
      // V_SETTLEMENT_EVENTS view not yet deployed — fall back to base table with JOINs
      console.warn('[ClearSet] V_SETTLEMENT_EVENTS unavailable; falling back to base SETTLEMENT_EVENTS table');
      rows = await snowflakeClient.executeStatement(
        `SELECT
           SE.EVENT_ID,
           SE.TRADE_ID,
           T.CP_ID,
           C.NAME        AS COUNTERPARTY_NAME,
           SE.EVENT_TIMESTAMP,
           SE.MESSAGE_TYPE,
           SE.STATUS     AS EVENT_STATUS,
           SE.DESCRIPTION,
           SE.SOURCE,
           T.TRADE_VALUE,
           T.SETTLEMENT_DATE,
           T.CUTOFF_TIME
         FROM CLEARSET_DB.CLEARSET_SCHEMA.SETTLEMENT_EVENTS SE
         JOIN CLEARSET_DB.CLEARSET_SCHEMA.TRADES T
           ON SE.TRADE_ID = T.TRADE_ID
         LEFT JOIN CLEARSET_DB.CLEARSET_SCHEMA.COUNTERPARTIES C
           ON T.CP_ID = C.CP_ID
         WHERE SE.TRADE_ID = ?
         ORDER BY SE.EVENT_TIMESTAMP ASC`,
        [tradeId],
      );
    }

    return res.json({
      success: true,
      mode: 'snowflake',
      data: toJsonSafe(rows),
    });
  } catch (err: any) {
    return res.status(200).json({
      success: false,
      mode: 'local',
      data: [],
      message: 'Snowflake unavailable',
      error: err?.message || `Failed to query settlement events for ${tradeId}.`,
    });
  }
});

// ============================================================================
// POST /api/cortex/search
// Calls Snowflake Cortex Search via SNOWFLAKE.CORTEX.SEARCH_PREVIEW() SQL function.
// Request: { "query": "string", "limit"?: number, "filter"?: object }
// Response: { success, mode, results: [...] }
// ============================================================================
app.post('/api/cortex/search', async (req: Request, res: Response) => {
  const { query, limit = 5, filter } = req.body as {
    query?: string;
    limit?: number;
    filter?: Record<string, unknown>;
  };

  if (!query || typeof query !== 'string' || !query.trim()) {
    return res.status(400).json({
      success: false,
      error: 'Request body must include a non-empty "query" string.',
    });
  }

  try {
    if (!snowflakeClient.isConfigured()) {
      return res.status(200).json({
        success: false,
        mode: 'local',
        results: [],
        message: 'Snowflake unavailable',
      });
    }

    // Build the SEARCH_PREVIEW JSON payload
    const searchPayload: Record<string, unknown> = {
      query: query.trim(),
      columns: [
        'CHUNK_ID',
        'DOC_CODE',
        'POLICY_NAME',
        'POLICY_SECTION',
        'CHUNK_TEXT',
        'APPLICABLE_CP_ID',
        'APPLICABLE_ASSET_CLASS',
        'RISK_SCORE_IMPACT',
      ],
      limit: Math.min(Number(limit) || 5, 20),
    };

    if (filter && typeof filter === 'object') {
      searchPayload.filter = filter;
    }

    const searchPayloadJson = JSON.stringify(searchPayload).replace(/'/g, "\\'");

    // Use SNOWFLAKE.CORTEX.SEARCH_PREVIEW via SQL
    const sql = `
      SELECT PARSE_JSON(
        SNOWFLAKE.CORTEX.SEARCH_PREVIEW(
          'CLEARSET_DB.CLEARSET_SCHEMA.CLEARSET_POLICY_SEARCH_SERVICE',
          '${searchPayloadJson}'
        )
      ) AS SEARCH_OUTPUT
    `;

    const rows = await snowflakeClient.executeStatement<Record<string, unknown>>(sql);

    if (!rows || rows.length === 0) {
      return res.json({
        success: true,
        mode: 'snowflake',
        results: [],
      });
    }

    // SEARCH_OUTPUT is a parsed JSON object; results array is inside it
    const searchOutput = rows[0]['SEARCH_OUTPUT'] as any;
    const results = Array.isArray(searchOutput?.results) ? searchOutput.results : [];

    return res.json({
      success: true,
      mode: 'snowflake',
      results: toJsonSafe(results),
    });
  } catch (err: any) {
    console.error('[ClearSet] Cortex Search error:', err?.message);
    return res.status(200).json({
      success: false,
      mode: 'local',
      results: [],
      message: 'Cortex Search unavailable',
      error: err?.message || 'Failed to call Cortex Search service.',
    });
  }
});

// ============================================================================
// Cortex Analyst REST helpers
// Authentication strategy:
//   SNOWFLAKE APP RUNTIME: Snowflake injects an OAuth token at
//     /snowflake/session/token inside the container. We use that token with
//     X-Snowflake-Authorization-Token-Type: OAUTH — no credentials needed.
//   LOCAL DEVELOPMENT: Falls back to SNOWFLAKE_PAT from server/.env.
// ============================================================================

/**
 * Reads the Snowflake-injected OAuth token from /snowflake/session/token.
 * Returns null if the file does not exist (i.e. running outside SPCS/App Runtime).
 * The token rotates every few minutes; read it fresh on every request.
 */
function readSpcsOAuthToken(): string | null {
  const TOKEN_PATH = '/snowflake/session/token';
  try {
    if (fs.existsSync(TOKEN_PATH)) {
      return fs.readFileSync(TOKEN_PATH, 'utf8').trim();
    }
  } catch {
    // Not inside SPCS — expected in local development
  }
  return null;
}

interface CortexAnalystDiagnostic {
  requestUrl: string;
  requestBody: Record<string, unknown>;
  statusCode?: number;
  contentType?: string;
  snowflakeRequestId?: string;
  responseHeaders?: Record<string, string | string[] | undefined>;
  responseBodyLength?: number;
  responseBody?: string;
}

class CortexAnalystRequestError extends Error {
  constructor(
    message: string,
    public readonly diagnostic: CortexAnalystDiagnostic,
  ) {
    super(message);
    this.name = 'CortexAnalystRequestError';
  }
}

function relevantSnowflakeHeaders(headers: IncomingHttpHeaders): Record<string, string | string[] | undefined> {
  return {
    'content-type': headers['content-type'],
    'x-snowflake-request-id': headers['x-snowflake-request-id'],
    'x-snowflake-error-code': headers['x-snowflake-error-code'],
  };
}

async function callCortexAnalystRest(question: string): Promise<any> {
    const account = (process.env.SNOWFLAKE_ACCOUNT || '').toLowerCase();

    // Prefer Snowflake-injected OAuth token (inside App Runtime / SPCS).
    // Fall back to PAT for local development.
    const spcsToken = readSpcsOAuthToken();
    const pat = process.env.SNOWFLAKE_PAT || '';

    if (!spcsToken && !pat) {
      throw new Error(
        'No Cortex Analyst credential available. ' +
        'Inside Snowflake App Runtime the OAuth token is injected automatically. ' +
        'For local development, set SNOWFLAKE_PAT in server/.env.',
      );
    }

    const authToken = spcsToken ?? pat;
    const tokenType = spcsToken ? 'OAUTH' : 'PROGRAMMATIC_ACCESS_TOKEN';

    const requestBody = {
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: question,
            },
          ],
        },
      ],
      semantic_view: 'CLEARSET_DB.CLEARSET_SCHEMA.CLEARSET_ANALYTICS',
    };
    const body = JSON.stringify(requestBody);

    const options: https.RequestOptions = {
      // Inside SPCS: use SNOWFLAKE_HOST (Snowflake-internal network — no EAI needed).
      // Locally: fall back to the public account hostname.
      hostname: process.env.SNOWFLAKE_HOST || `${account}.snowflakecomputing.com`,
      port: 443,
      path: '/api/v2/cortex/analyst/message',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        Authorization: `Bearer ${authToken}`,
        'X-Snowflake-Authorization-Token-Type': tokenType,
        Accept: 'application/json',
        'User-Agent': 'ClearSetAI/1.0',
      },
    };
    const requestUrl = `https://${options.hostname}${options.path}`;

    return await new Promise((resolve, reject) => {
      const request = https.request(options, (response) => {
      let data = '';
      response.on('data', (chunk) => {
        data += chunk;
      });
      response.on('end', () => {
        const diagnostic: CortexAnalystDiagnostic = {
          requestUrl,
          requestBody,
          statusCode: response.statusCode,
          contentType: response.headers['content-type'],
          snowflakeRequestId: response.headers['x-snowflake-request-id'] as string | undefined,
          responseHeaders: relevantSnowflakeHeaders(response.headers),
          responseBodyLength: data.length,
          // Only log body on error to avoid leaking data
          responseBody: response.statusCode && response.statusCode >= 400 ? data : undefined,
        };
        console.log('[ClearSet] Cortex Analyst response: status=%d length=%d request-id=%s',
          diagnostic.statusCode, diagnostic.responseBodyLength, diagnostic.snowflakeRequestId);

        if (!data.trim()) {
          return reject(new CortexAnalystRequestError(
            `Cortex Analyst returned an empty response body (HTTP ${response.statusCode ?? 'unknown'}).`,
            diagnostic,
          ));
        }

        try {
          const parsed = JSON.parse(data);
          if (response.statusCode && response.statusCode >= 400) {
            reject(
              new CortexAnalystRequestError(
                `Cortex Analyst HTTP ${response.statusCode}: ${parsed?.message || data.slice(0, 200)}`,
                diagnostic,
              ),
            );
          } else {
            resolve(parsed);
          }
        } catch (parseErr: any) {
          reject(new CortexAnalystRequestError(
            `Failed to parse Cortex Analyst response: ${parseErr.message}.`,
            { ...diagnostic, responseBody: data },
          ));
        }
      });
    });

    request.on('error', (err) => {
      reject(err);
    });

    request.setTimeout(45000, () => {
      request.destroy(new Error('Cortex Analyst REST request timed out after 45s'));
    });

      request.write(body);
      request.end();
    });
}

/**
 * Extracts the SQL statement from a Cortex Analyst response.
 * The response contains a "message" with content array; SQL items have type "sql".
 */
function extractSqlFromAnalystResponse(analystResponse: any): string | null {
  try {
    const message = analystResponse?.message;
    if (!message) return null;

    const content = message.content;
    if (!Array.isArray(content)) return null;

    for (const item of content) {
      if (item?.type === 'sql' && typeof item.statement === 'string') {
        return item.statement;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Extracts the text interpretation from a Cortex Analyst response.
 */
function extractTextFromAnalystResponse(analystResponse: any): string | null {
  try {
    const content = analystResponse?.message?.content;
    if (!Array.isArray(content)) return null;

    for (const item of content) {
      if (item?.type === 'text' && typeof item.text === 'string') {
        return item.text;
      }
    }
    return null;
  } catch {
    return null;
  }
}

app.post('/api/cortex/analyst', async (req: Request, res: Response) => {
  const { question } = req.body as { question?: string };

  if (!question || typeof question !== 'string' || !question.trim()) {
    return res.status(400).json({
      success: false,
      error: 'Request body must include a non-empty "question" string.',
    });
  }

  try {
    if (!snowflakeClient.isConfigured()) {
      return res.status(200).json({
        success: false,
        mode: 'local',
        data: [],
        message: 'Snowflake unavailable',
      });
    }

    // Step 1: Call Cortex Analyst REST API to get the SQL
    const analystResponse = await callCortexAnalystRest(question.trim());

    const generatedSql = extractSqlFromAnalystResponse(analystResponse);
    const interpretationText = extractTextFromAnalystResponse(analystResponse);

    if (!generatedSql) {
      // Cortex Analyst responded but did not generate SQL (e.g., clarification needed)
      return res.json({
        success: true,
        mode: 'snowflake',
        question: question.trim(),
        sql: null,
        data: [],
        message: interpretationText || 'Cortex Analyst did not generate SQL for this question.',
        analystResponse,
      });
    }

    // Step 2: Execute the generated SQL against Snowflake
    const rows = await snowflakeClient.executeStatement(generatedSql);

    return res.json({
      success: true,
      mode: 'snowflake',
      question: question.trim(),
      sql: generatedSql,
      interpretation: interpretationText,
      data: toJsonSafe(rows),
    });
  } catch (err: any) {
    console.error('[ClearSet] Cortex Analyst error:', err?.message);
    return res.status(200).json({
      success: false,
      mode: 'local',
      data: [],
      question: question?.trim(),
      message: 'Cortex Analyst unavailable',
      error: err?.message || 'Failed to call Cortex Analyst.',
      ...(err instanceof CortexAnalystRequestError ? { diagnostic: err.diagnostic } : {}),
    });
  }
});

// ============================================================================
// POST /api/cases
// Persist an approved resolution case to Snowflake.
// Request: { caseId, tradeId, exceptionId, status, riskScore, rootCause, recommendation, resolutionOutcome, approvedBy, approvedAt }
// Response: { success, mode, caseId?, message?, error? }
// ============================================================================
app.post('/api/cases', async (req: Request, res: Response) => {
  const {
    caseId,
    tradeId,
    exceptionId,
    status,
    riskScore,
    rootCause,
    recommendation,
    resolutionOutcome,
    approvedBy,
    approvedAt,
  } = req.body as {
    caseId?: string;
    tradeId?: string;
    exceptionId?: string;
    status?: string;
    riskScore?: number;
    rootCause?: string;
    recommendation?: string;
    resolutionOutcome?: string;
    approvedBy?: string;
    approvedAt?: string;
  };

  if (!caseId || !tradeId || !status || riskScore === undefined || !rootCause || !recommendation) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: caseId, tradeId, status, riskScore, rootCause, recommendation',
    });
  }

  if (!snowflakeClient.isConfigured()) {
    return res.status(200).json({
      success: false,
      mode: 'local',
      message: 'Snowflake unavailable — case not persisted',
      error: 'Snowflake not configured',
    });
  }

  try {
    const insertSql = `
      INSERT INTO CLEARSET_DB.CLEARSET_SCHEMA.RESOLUTION_CASES (
        CASE_ID, TRADE_ID, EXCEPTION_ID, STATUS, RISK_SCORE,
        ROOT_CAUSE, RECOMMENDATION, RESOLUTION_OUTCOME,
        APPROVED_BY, APPROVED_AT, CREATED_AT, UPDATED_AT
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP())
    `;

    const binds = [
      caseId,
      tradeId,
      exceptionId ?? null,
      status,
      riskScore,
      rootCause,
      recommendation,
      resolutionOutcome ?? null,
      approvedBy ?? null,
      approvedAt ?? new Date().toISOString(),
    ];

    await snowflakeClient.executeStatement(insertSql, binds);

    return res.json({
      success: true,
      mode: 'snowflake',
      caseId,
      message: 'Case persisted to Snowflake',
    });
  } catch (err: any) {
    console.error('[ClearSet] Case persistence error:', err?.message);
    return res.status(200).json({
      success: false,
      mode: 'snowflake',
      error: err?.message || 'Failed to persist case to Snowflake',
      message: 'Case not persisted — check server logs',
    });
  }
});

// ============================================================================
// GET /api/cases
// Load persisted resolution cases from Snowflake.
// Response: { success, mode, data: [...] }
// ============================================================================
app.get('/api/cases', async (_req: Request, res: Response) => {
  if (!snowflakeClient.isConfigured()) {
    return res.status(200).json({
      success: false,
      mode: 'local',
      data: [],
      message: 'Snowflake unavailable',
    });
  }

  try {
    const sql = `
      SELECT
        CASE_ID, TRADE_ID, EXCEPTION_ID, STATUS, RISK_SCORE,
        ROOT_CAUSE, RECOMMENDATION, RESOLUTION_OUTCOME,
        APPROVED_BY, APPROVED_AT, CREATED_AT, UPDATED_AT
      FROM CLEARSET_DB.CLEARSET_SCHEMA.RESOLUTION_CASES
      ORDER BY CREATED_AT DESC
      LIMIT 100
    `;

    const rows = await snowflakeClient.executeStatement(sql);

    return res.json({
      success: true,
      mode: 'snowflake',
      data: rows.map((row) => ({
        caseId: row.CASE_ID,
        tradeId: row.TRADE_ID,
        exceptionId: row.EXCEPTION_ID,
        status: row.STATUS,
        riskScore: Number(row.RISK_SCORE),
        rootCause: row.ROOT_CAUSE,
        recommendation: row.RECOMMENDATION,
        resolutionOutcome: row.RESOLUTION_OUTCOME,
        approvedBy: row.APPROVED_BY,
        approvedAt: row.APPROVED_AT,
        createdAt: row.CREATED_AT,
        updatedAt: row.UPDATED_AT,
      })),
    });
  } catch (err: any) {
    console.error('[ClearSet] Cases load error:', err?.message);
    return res.status(200).json({
      success: false,
      mode: 'snowflake',
      data: [],
      error: err?.message || 'Failed to load cases from Snowflake',
    });
  }
});

// ============================================================================
// Global error handler
// ============================================================================
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Server Error]', err);
  res.status(500).json({
    success: false,
    error: err?.message || 'Internal Server Error',
  });
});

// ============================================================================
// SPA catch-all (production only)
// Any request that did not match an /api/* route is served as index.html so
// that client-side React Router navigation works correctly.
// Only enabled when the dist/ directory exists (i.e. after `npm run build`).
// ============================================================================
if (fs.existsSync(DIST_DIR) && fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

process.on('uncaughtException', (err) => {
  console.error('[ClearSet Backend] Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[ClearSet Backend] Unhandled rejection:', reason);
});

const server = app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`[ClearSet Backend] Server running on port ${PORT}`);
  console.log(`[ClearSet Backend] Mode: ${readSpcsOAuthToken() ? 'SNOWFLAKE APP RUNTIME (OAuth)' : 'LOCAL (password/PAT)'}`);
  console.log(
    `[ClearSet Backend] Snowflake Configured: ${snowflakeClient.isConfigured() ? 'YES' : 'NO (Local Fallback Active)'}`,
  );
  console.log(`[ClearSet Backend] Endpoints:`);
  console.log(`  GET  /api/health`);
  console.log(`  GET  /api/test-snowflake`);
  console.log(`  GET  /api/exceptions`);
  console.log(`  GET  /api/trades`);
  console.log(`  GET  /api/counterparties/:id`);
  console.log(`  GET  /api/settlement-events/:tradeId`);
  console.log(`  GET  /api/cases`);
  console.log(`  POST /api/cases`);
  console.log(`  POST /api/cortex/search`);
  console.log(`  POST /api/cortex/analyst`);
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[ClearSet Backend] Port ${PORT} is already in use.`);
    console.error(`[ClearSet Backend] Either use the existing process, or free the port with:`);
    console.error(`  netstat -ano | findstr :${PORT}`);
    console.error(`  Stop-Process -Id <PID> -Force`);
  } else {
    console.error('[ClearSet Backend] Failed to start:', err);
  }
  process.exit(1);
});
